const _ = require('lodash');
const { v4: uuidv4 } = require('uuid');

// Schema ranking based on SEO importance (from original extension)
const SCHEMA_RANKS = {
  "Organization": 5,
  "Person": 4,
  "WebSite": 3,
  "WebPage": 2,
  "Article": 4,
  "Product": 5,
  "LocalBusiness": 5,
  "Event": 4,
  "Recipe": 3,
  "Review": 3,
  "FAQPage": 4,
  "HowTo": 4,
  "JobPosting": 3,
  "Course": 3,
  "CreativeWork": 2,
  "BreadcrumbList": 1,
  "ItemList": 1,
  "Footer": 5,
  "Header": 5
};

// Location recommendations for different schema types
const LOCATION_RECOMMENDATIONS = {
  "Organization": {
    "suggestedPage": "About page",
    "reason": "Organization schema is best placed on your About or main company information page.",
    "urlPattern": "/about",
    "example": `{
  "@type": "Organization",
  "@id": "schema:Organization",
  "name": "Your Company Name",
  "url": "https://www.example.com",
  "logo": "https://www.example.com/logo.png",
  "description": "About your company"
}`
  },
  "ContactPage": {
    "suggestedPage": "Contact page",
    "reason": "ContactPage schema should be implemented on your dedicated contact page.",
    "urlPattern": "/contact",
    "example": `{
  "@type": "ContactPage",
  "@id": "schema:ContactPage",
  "name": "Contact Us",
  "url": "https://www.example.com/contact"
}`
  }
};

class SchemaAnalyzer {
  constructor() {
    this.processedIds = new Set();
  }

  // Main analysis function - processes crawler results
  async analyzePage(url, options = {}) {
    try {
      const crawler = require('./crawler');
      const crawlerResult = await crawler.analyzePage(url, options);
      
      if (crawlerResult.status === 'failed') {
        return crawlerResult;
      }

      const schemas = crawlerResult.results.schemas;
      
      // Perform comprehensive analysis
      const analysis = {
        seo_score: this.calculateSEOScore(schemas, url),
        entities: this.analyzeEntities(schemas),
        consistency_analysis: this.analyzeIdConsistency(schemas),
        recommendations: await this.generateRecommendations(schemas, url, crawlerResult.results.basic_info)
      };

      // Update crawler result with analysis
      crawlerResult.results = {
        ...crawlerResult.results,
        ...analysis
      };

      return crawlerResult;

    } catch (error) {
      console.error('Analysis error:', error);
      throw error;
    }
  }

  // Calculate overall SEO score
  calculateSEOScore(schemas, url) {
    if (!schemas || schemas.length === 0) {
      return {
        overall: 0,
        schema_coverage: 0,
        consistency_score: 0,
        entity_completeness: 0,
        breakdown: {
          "Schema Coverage": { score: 0, max: 40, issues: ["No schemas found"] },
          "ID Consistency": { score: 0, max: 30, issues: ["No @id analysis possible"] },
          "Entity Completeness": { score: 0, max: 30, issues: ["No entities found"] }
        }
      };
    }

    let coverageScore = 0;
    let consistencyScore = 0;
    let completenessScore = 0;
    
    const breakdown = {};

    // 1. Schema Coverage (40 points)
    const importantTypes = ['Organization', 'WebSite', 'WebPage', 'BreadcrumbList'];
    const foundTypes = schemas.map(s => this.getSchemaType(s)).filter(Boolean);
    const foundImportant = importantTypes.filter(type => foundTypes.includes(type));
    
    coverageScore = (foundImportant.length / importantTypes.length) * 40;
    
    breakdown["Schema Coverage"] = {
      score: Math.round(coverageScore),
      max: 40,
      details: `Found ${foundImportant.length}/${importantTypes.length} important schema types`,
      issues: importantTypes.filter(type => !foundTypes.includes(type))
        .map(type => `Missing ${type} schema`)
    };

    // 2. ID Consistency (30 points)
    const consistency = this.analyzeIdConsistency(schemas);
    consistencyScore = (consistency.score / 100) * 30;
    
    breakdown["ID Consistency"] = {
      score: Math.round(consistencyScore),
      max: 30,
      details: `@id consistency score: ${consistency.score}/100`,
      issues: consistency.issues || []
    };

    // 3. Entity Completeness (30 points)
    const entities = this.analyzeEntities(schemas);
    const entityScore = entities.found.length > 0 ? 
      Math.min(30, entities.found.length * 5) : 0;
    completenessScore = entityScore;
    
    breakdown["Entity Completeness"] = {
      score: Math.round(completenessScore),
      max: 30,
      details: `Found ${entities.found.length} entity types`,
      issues: entities.orphaned.length > 0 ? 
        [`${entities.orphaned.length} orphaned entities`] : []
    };

    const overall = Math.round(coverageScore + consistencyScore + completenessScore);

    return {
      overall,
      schema_coverage: Math.round(coverageScore),
      consistency_score: Math.round(consistencyScore),
      entity_completeness: Math.round(completenessScore),
      breakdown
    };
  }

  // Analyze entities and their relationships
  analyzeEntities(schemas) {
    const entities = {
      found: [],
      connections: [],
      orphaned: [],
      broken_refs: []
    };

    const entityMap = new Map();
    const references = new Map();

    // First pass: collect all entities
    schemas.forEach(schema => {
      const type = this.getSchemaType(schema);
      const id = schema['@id'];
      
      if (type) {
        entities.found.push(type);
        
        if (id) {
          entityMap.set(id, { type, schema });
        }
      }
    });

    // Remove duplicates
    entities.found = [...new Set(entities.found)];

    // Second pass: find references and connections
    schemas.forEach(schema => {
      this.findReferences(schema, references);
    });

    // Analyze connections
    references.forEach((refs, fromId) => {
      refs.forEach(toId => {
        if (entityMap.has(fromId) && entityMap.has(toId)) {
          entities.connections.push({
            from: fromId,
            to: toId,
            fromType: entityMap.get(fromId).type,
            toType: entityMap.get(toId).type
          });
        } else if (!entityMap.has(toId)) {
          entities.broken_refs.push({
            from: fromId,
            missingRef: toId
          });
        }
      });
    });

    // Find orphaned entities (entities without connections)
    const connectedIds = new Set();
    entities.connections.forEach(conn => {
      connectedIds.add(conn.from);
      connectedIds.add(conn.to);
    });

    entityMap.forEach((entity, id) => {
      if (!connectedIds.has(id)) {
        entities.orphaned.push({
          id,
          type: entity.type
        });
      }
    });

    return entities;
  }

  // Analyze @id consistency (based on original extension logic)
  analyzeIdConsistency(schemas) {
    const analysis = {
      idGroups: new Map(),
      typeGroups: new Map(),
      consistentIds: new Map(),
      inconsistentTypes: new Map(),
      score: 0,
      issues: []
    };

    // Process each schema
    schemas.forEach(schema => {
      const schemaId = schema['@id'];
      const schemaType = this.getSchemaType(schema);
      
      if (schemaId) {
        // Group by @id
        if (!analysis.idGroups.has(schemaId)) {
          analysis.idGroups.set(schemaId, []);
        }
        analysis.idGroups.get(schemaId).push({
          schema,
          type: schemaType
        });
        
        // Count @id usage
        analysis.consistentIds.set(schemaId, 
          (analysis.consistentIds.get(schemaId) || 0) + 1);
      }
      
      if (schemaType) {
        // Group by @type
        if (!analysis.typeGroups.has(schemaType)) {
          analysis.typeGroups.set(schemaType, new Set());
        }
        if (schemaId) {
          analysis.typeGroups.get(schemaType).add(schemaId);
        }
      }
    });

    // Find inconsistent @type usage
    analysis.typeGroups.forEach((idSet, schemaType) => {
      if (idSet.size > 1) {
        analysis.inconsistentTypes.set(schemaType, Array.from(idSet));
        analysis.issues.push(
          `${schemaType} schema uses ${idSet.size} different @id values`
        );
      }
    });

    // Calculate score
    analysis.score = this.calculateIdConsistencyScore(analysis, schemas);

    return analysis;
  }

  calculateIdConsistencyScore(analysis, schemas) {
    const totalSchemas = schemas.length;
    if (totalSchemas === 0) return 0;
    
    let score = 0;
    
    // Category 1: Having @id (up to 40 points)
    const schemasWithId = Array.from(analysis.idGroups.values())
      .reduce((count, instances) => count + instances.length, 0);
    const idCoverage = (schemasWithId / totalSchemas) * 40;
    score += idCoverage;
    
    // Category 2: Using schema: pattern (up to 30 points)
    const totalUniqueIds = analysis.idGroups.size;
    const schemaPatternIds = Array.from(analysis.idGroups.keys())
      .filter(id => id.startsWith('schema:')).length;
    const patternScore = totalUniqueIds > 0 ? 
      (schemaPatternIds / totalUniqueIds) * 30 : 0;
    score += patternScore;
    
    // Category 3: Consistency penalty
    const inconsistentPenalty = analysis.inconsistentTypes.size * 5;
    score = Math.max(0, score - inconsistentPenalty);
    
    // Category 4: Cross-page consistency bonus (up to 30 points)
    const reusedIds = Array.from(analysis.consistentIds.values())
      .filter(count => count > 1).length;
    const crossPageBonus = Math.min(30, reusedIds * 5);
    score += crossPageBonus;
    
    return Math.round(Math.min(100, score));
  }

  // Generate comprehensive recommendations
  async generateRecommendations(schemas, url, pageInfo) {
    const recommendations = [];
    this.processedIds.clear();

    try {
      // Basic schema validation
      const schemasWithoutId = schemas.filter(schema => !schema['@id']);
      if (schemasWithoutId.length > 0) {
        recommendations.push({
          type: 'Missing @id Properties',
          priority: 'high',
          message: `${schemasWithoutId.length} schemas are missing @id properties. Add consistent @id values using the pattern "schema:EntityType".`,
          example: '"@id": "schema:WebPageElement"',
          affectedSchemas: schemasWithoutId.length,
          code: this.generateIdFix(schemasWithoutId[0])
        });
      }

      // Check for missing important schemas
      const foundTypes = schemas.map(s => this.getSchemaType(s));
      const missingImportant = this.checkMissingSchemas(foundTypes, url);
      
      missingImportant.forEach(missing => {
        recommendations.push({
          type: `Missing Schema: ${missing.type}`,
          priority: 'high',
          message: missing.reason,
          example: missing.example,
          affectedSchemas: 0
        });
      });

      // Check @id consistency
      const consistency = this.analyzeIdConsistency(schemas);
      consistency.inconsistentTypes.forEach((ids, schemaType) => {
        recommendations.push({
          type: 'Inconsistent @id Usage',
          priority: 'high',
          message: `The schema type "${schemaType}" uses ${ids.length} different @id values. Use a single consistent @id across all pages.`,
          example: `"@id": "schema:${schemaType}"`,
          details: `Found @ids: ${ids.join(', ')}`,
          affectedSchemas: ids.length
        });
      });

      // Check schema location recommendations
      schemas.forEach(schema => {
        const type = this.getSchemaType(schema);
        if (LOCATION_RECOMMENDATIONS[type]) {
          const rec = LOCATION_RECOMMENDATIONS[type];
          if (!this.isOnRecommendedPage(type, url)) {
            recommendations.push({
              type: `Schema Location: ${type}`,
              priority: 'medium',
              message: rec.reason,
              example: rec.example,
              affectedSchemas: 1
            });
          }
        }
      });

      // Sort by priority
      const priorityOrder = { 'high': 1, 'medium': 2, 'low': 3 };
      recommendations.sort((a, b) => {
        const aPriority = priorityOrder[a.priority] || 3;
        const bPriority = priorityOrder[b.priority] || 3;
        return aPriority - bPriority;
      });

      return recommendations;

    } catch (error) {
      console.error('Error generating recommendations:', error);
      return [{
        type: 'Analysis Error',
        priority: 'high',
        message: `Error analyzing schemas: ${error.message}`,
        example: 'Please check the console for more details.',
        affectedSchemas: 0
      }];
    }
  }

  // Helper methods
  getSchemaType(schema) {
    if (!schema || !schema['@type']) return null;
    return Array.isArray(schema['@type']) ? schema['@type'][0] : schema['@type'];
  }

  findReferences(obj, references, currentId = null) {
    if (typeof obj !== 'object' || obj === null) return;
    
    if (obj['@id'] && currentId && obj['@id'] !== currentId) {
      if (!references.has(currentId)) {
        references.set(currentId, new Set());
      }
      references.get(currentId).add(obj['@id']);
    }
    
    const nodeId = obj['@id'] || currentId;
    
    Object.values(obj).forEach(value => {
      if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          value.forEach(item => this.findReferences(item, references, nodeId));
        } else {
          this.findReferences(value, references, nodeId);
        }
      }
    });
  }

  checkMissingSchemas(foundTypes, url) {
    const missing = [];
    
    // Check for WebPage schema
    if (!foundTypes.includes('WebPage')) {
      missing.push({
        type: 'WebPage',
        reason: 'Add WebPage schema to improve page indexing and search appearance.',
        example: `{
  "@type": "WebPage",
  "@id": "schema:WebPage",
  "url": "${url}",
  "name": "Page Title",
  "description": "Page description"
}`
      });
    }
    
    // Check for Organization schema on about pages
    if (url.includes('/about') && !foundTypes.includes('Organization')) {
      missing.push({
        type: 'Organization',
        reason: 'About pages should include Organization schema.',
        example: LOCATION_RECOMMENDATIONS.Organization.example
      });
    }
    
    return missing;
  }

  isOnRecommendedPage(schemaType, url) {
    const recommendation = LOCATION_RECOMMENDATIONS[schemaType];
    if (!recommendation || !recommendation.urlPattern) return true;
    
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.toLowerCase().includes(recommendation.urlPattern);
    } catch (e) {
      return false;
    }
  }

  generateIdFix(schema) {
    const type = this.getSchemaType(schema);
    if (!type) return null;
    
    const fixedSchema = { ...schema };
    fixedSchema['@id'] = `schema:${type}`;
    
    return JSON.stringify(fixedSchema, null, 2);
  }

  // Build entity graph for visualization
  buildEntityGraph(scanResult) {
    const entities = scanResult.results.entities;
    if (!entities) return { nodes: [], edges: [] };

    const nodes = entities.found.map(type => ({
      id: type,
      type: type,
      size: entities.connections.filter(c => 
        c.fromType === type || c.toType === type
      ).length + 1
    }));

    const edges = entities.connections.map(conn => ({
      source: conn.fromType,
      target: conn.toType,
      weight: 1
    }));

    return { nodes, edges };
  }
}

module.exports = new SchemaAnalyzer();
