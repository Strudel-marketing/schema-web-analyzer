// api/services/schemaAnalyzer.js - Advanced Schema Analysis Engine
// Based on schema-engine.js from the Chrome extension

const config = require('../config');
const logger = require('../utils/logger');
const { isValidUrl, cleanUrl, generateId } = require('../utils/helpers');

class SchemaAnalyzer {
    constructor() {
        this.config = config.ANALYSIS;
        this.processedIds = new Set();
        this.schemas = [];
        this.relationships = new Map();
        this.consistency = {
            idGroups: new Map(),
            typeGroups: new Map(),
            consistentIds: new Map(),
            inconsistentTypes: new Map(),
            bestPracticeScore: 0,
            recommendations: []
        };
    }

    /**
     * Main analysis method - processes schemas and returns comprehensive analysis
     */
    async analyzeSchemas(schemas, pageInfo = {}) {
        logger.info(`Starting schema analysis for ${schemas.length} schemas`);
        
        try {
            this.reset();
            this.schemas = this.validateAndCleanSchemas(schemas);
            
            const analysis = {
                timestamp: new Date().toISOString(),
                pageInfo: pageInfo,
                totalSchemas: this.schemas.length,
                validSchemas: this.schemas.filter(s => this.isValidSchema(s)).length,
                results: {
                    ranking: this.rankSchemas(),
                    entities: this.analyzeEntities(),
                    consistency: await this.analyzeConsistency(),
                    recommendations: await this.generateRecommendations(pageInfo),
                    seoScore: this.calculateSEOScore()
                }
            };

            logger.info(`Analysis completed: ${analysis.results.ranking.length} ranked schemas`);
            return analysis;

        } catch (error) {
            logger.error('Schema analysis failed:', error);
            throw new Error(`Analysis failed: ${error.message}`);
        }
    }

    /**
     * Validate and clean schema objects
     */
    validateAndCleanSchemas(schemas) {
        if (!Array.isArray(schemas)) {
            throw new Error('Schemas must be an array');
        }

        return schemas
            .filter(schema => this.isValidSchema(schema))
            .map(schema => this.cleanSchema(schema));
    }

    /**
     * Check if schema is valid
     */
    isValidSchema(schema) {
        if (!schema || typeof schema !== 'object') return false;
        
        const type = this.getSchemaType(schema);
        if (!type) return false;
        
        return !this.isEmptySchema(schema);
    }

    /**
     * Get schema type safely
     */
    getSchemaType(schema) {
        if (!schema || typeof schema !== 'object') return null;
        
        try {
            const type = schema['@type'];
            return Array.isArray(type) ? type[0] : type;
        } catch (error) {
            logger.warn('Error getting schema type:', error);
            return null;
        }
    }

    /**
     * Check if schema is essentially empty
     */
    isEmptySchema(schema) {
        const keys = Object.keys(schema);
        return keys.length <= 2 && keys.every(key => 
            key === '@type' || key === '@id' || key === '@context'
        );
    }

    /**
     * Clean schema object
     */
    cleanSchema(schema) {
        const cleaned = { ...schema };
        
        // Remove extension-specific properties
        delete cleaned._siteMapperInfo;
        delete cleaned._processed;
        delete cleaned._index;
        
        return cleaned;
    }

    /**
     * Rank schemas by SEO importance
     */
    rankSchemas() {
        logger.info('Ranking schemas by SEO importance');
        
        const ranked = this.schemas.map((schema, index) => {
            const type = this.getSchemaType(schema);
            const rank = this.config.SCHEMA_RANKS[type] || 0;
            
            return {
                index,
                type,
                rank,
                schema,
                seoImportance: this.calculateSchemaImportance(schema, type),
                completeness: this.calculateSchemaCompleteness(schema),
                hasId: !!schema['@id'],
                validId: this.isValidIdFormat(schema['@id'])
            };
        });

        // Sort by rank (highest first), then by completeness
        return ranked.sort((a, b) => {
            if (b.rank !== a.rank) return b.rank - a.rank;
            if (b.completeness !== a.completeness) return b.completeness - a.completeness;
            return b.seoImportance - a.seoImportance;
        });
    }

    /**
     * Calculate schema importance for SEO
     */
    calculateSchemaImportance(schema, type) {
        let importance = this.config.SCHEMA_RANKS[type] || 0;
        
        // Boost importance based on content
        if (schema.name || schema.headline) importance += 1;
        if (schema.description) importance += 1;
        if (schema.url) importance += 1;
        if (schema.image) importance += 0.5;
        if (schema['@id']) importance += 1;
        
        // Special boosts
        if (type === 'Organization' && schema.logo) importance += 1;
        if (type === 'Person' && schema.jobTitle) importance += 0.5;
        if (type === 'Product' && schema.offers) importance += 1;
        if (type === 'Article' && schema.author) importance += 0.5;
        
        return Math.round(importance * 10) / 10;
    }

    /**
     * Calculate schema completeness percentage
     */
    calculateSchemaCompleteness(schema) {
        const requiredFields = this.getRequiredFields(this.getSchemaType(schema));
        const recommendedFields = this.getRecommendedFields(this.getSchemaType(schema));
        
        let score = 0;
        let maxScore = 0;
        
        // Check required fields (weight: 3)
        requiredFields.forEach(field => {
            maxScore += 3;
            if (schema[field] && schema[field] !== '') {
                score += 3;
            }
        });
        
        // Check recommended fields (weight: 1)
        recommendedFields.forEach(field => {
            maxScore += 1;
            if (schema[field] && schema[field] !== '') {
                score += 1;
            }
        });
        
        return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    }

    /**
     * Get required fields for schema type
     */
    getRequiredFields(type) {
        const fields = {
            'Organization': ['@type', 'name'],
            'Person': ['@type', 'name'],
            'Product': ['@type', 'name'],
            'Article': ['@type', 'headline'],
            'WebPage': ['@type', 'name'],
            'WebSite': ['@type', 'name'],
            'LocalBusiness': ['@type', 'name', 'address'],
            'Event': ['@type', 'name', 'startDate'],
            'Recipe': ['@type', 'name', 'recipeIngredient'],
            'Review': ['@type', 'reviewBody', 'author'],
            'BreadcrumbList': ['@type', 'itemListElement']
        };
        
        return fields[type] || ['@type'];
    }

    /**
     * Get recommended fields for schema type
     */
    getRecommendedFields(type) {
        const fields = {
            'Organization': ['url', 'logo', 'description', 'contactPoint', 'address', 'sameAs'],
            'Person': ['url', 'image', 'jobTitle', 'worksFor', 'sameAs', 'email'],
            'Product': ['description', 'image', 'brand', 'offers', 'review', 'aggregateRating'],
            'Article': ['author', 'datePublished', 'dateModified', 'image', 'publisher'],
            'WebPage': ['description', 'url', 'image', 'breadcrumb', 'mainEntity'],
            'WebSite': ['url', 'description', 'publisher', 'potentialAction'],
            'LocalBusiness': ['telephone', 'openingHours', 'geo', 'priceRange', 'image'],
            'Event': ['location', 'endDate', 'description', 'image', 'organizer'],
            'Recipe': ['recipeInstructions', 'cookTime', 'prepTime', 'nutrition', 'author'],
            'Review': ['itemReviewed', 'reviewRating', 'datePublished'],
            'BreadcrumbList': ['numberOfItems']
        };
        
        return fields[type] || ['name', 'description', 'url', 'image'];
    }

    /**
     * Analyze entities and their relationships
     */
    analyzeEntities() {
        logger.info('Analyzing entity relationships');
        
        const entities = new Map();
        const relationships = [];
        const orphanedEntities = [];
        const brokenReferences = [];

        // Extract entities
        this.schemas.forEach((schema, index) => {
            const type = this.getSchemaType(schema);
            const id = schema['@id'] || `anonymous_${type}_${index}`;
            
            entities.set(id, {
                id,
                type,
                schema,
                index,
                connections: [],
                referencedBy: [],
                references: []
            });
        });

        // Find relationships
        entities.forEach((entity, entityId) => {
            this.findEntityReferences(entity.schema, entityId, entities, relationships, brokenReferences);
        });

        // Find orphaned entities
        entities.forEach((entity, entityId) => {
            if (entity.connections.length === 0 && entity.referencedBy.length === 0) {
                orphanedEntities.push(entityId);
            }
        });

        return {
            totalEntities: entities.size,
            entityTypes: [...new Set(Array.from(entities.values()).map(e => e.type))],
            entities: Object.fromEntries(entities),
            relationships,
            orphanedEntities,
            brokenReferences,
            connectivityScore: this.calculateConnectivityScore(entities, relationships)
        };
    }

    /**
     * Find references between entities
     */
    findEntityReferences(schema, currentId, entities, relationships, brokenReferences) {
        const findRefs = (obj, path = '') => {
            if (!obj || typeof obj !== 'object') return;
            
            Object.entries(obj).forEach(([key, value]) => {
                if (typeof value === 'string' && value.startsWith('schema:')) {
                    if (entities.has(value)) {
                        relationships.push({
                            source: currentId,
                            target: value,
                            property: key,
                            path: path ? `${path}.${key}` : key
                        });
                        
                        entities.get(currentId).references.push(value);
                        entities.get(value).referencedBy.push(currentId);
                    } else {
                        brokenReferences.push({
                            source: currentId,
                            target: value,
                            property: key,
                            path: path ? `${path}.${key}` : key
                        });
                    }
                } else if (typeof value === 'object' && value !== null) {
                    if (value['@id']) {
                        const refId = value['@id'];
                        if (entities.has(refId)) {
                            relationships.push({
                                source: currentId,
                                target: refId,
                                property: key,
                                path: path ? `${path}.${key}` : key
                            });
                            
                            entities.get(currentId).references.push(refId);
                            entities.get(refId).referencedBy.push(currentId);
                        }
                    }
                    
                    const newPath = path ? `${path}.${key}` : key;
                    if (Array.isArray(value)) {
                        value.forEach((item, index) => {
                            findRefs(item, `${newPath}[${index}]`);
                        });
                    } else {
                        findRefs(value, newPath);
                    }
                }
            });
        };
        
        findRefs(schema);
    }

    /**
     * Calculate connectivity score
     */
    calculateConnectivityScore(entities, relationships) {
        const totalEntities = entities.size;
        const totalRelationships = relationships.length;
        const connectedEntities = Array.from(entities.values())
            .filter(e => e.connections.length > 0 || e.referencedBy.length > 0).length;
        
        if (totalEntities === 0) return 0;
        
        const connectivityRatio = connectedEntities / totalEntities;
        const relationshipDensity = totalRelationships / Math.max(totalEntities, 1);
        
        return Math.round((connectivityRatio * 0.7 + Math.min(relationshipDensity, 1) * 0.3) * 100);
    }

    /**
     * Analyze @id consistency across schemas
     */
    async analyzeConsistency() {
        logger.info('Analyzing @id consistency');
        
        const analysis = {
            idGroups: new Map(),
            typeGroups: new Map(),
            consistentIds: new Map(),
            inconsistentTypes: new Map(),
            bestPracticeScore: 0,
            recommendations: []
        };

        // Process schemas for consistency
        this.schemas.forEach((schema, index) => {
            const schemaId = schema['@id'];
            const schemaType = this.getSchemaType(schema);
            
            if (schemaId) {
                // Group by @id
                if (!analysis.idGroups.has(schemaId)) {
                    analysis.idGroups.set(schemaId, []);
                }
                analysis.idGroups.get(schemaId).push({
                    schema,
                    index,
                    type: schemaType
                });
                
                // Count @id usage
                analysis.consistentIds.set(schemaId, (analysis.consistentIds.get(schemaId) || 0) + 1);
            }
            
            if (schemaType) {
                // Group by @type to find inconsistencies
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
            }
        });

        // Generate recommendations
        analysis.recommendations = this.generateConsistencyRecommendations(analysis);
        
        // Calculate score
        const scoreResult = this.calculateConsistencyScore(analysis);
        analysis.bestPracticeScore = scoreResult.score;
        analysis.scoreBreakdown = scoreResult.breakdown;

        return analysis;
    }

    /**
     * Check if @id format is valid
     */
    isValidIdFormat(id) {
        if (!id || typeof id !== 'string') return false;
        return id.startsWith('schema:');
    }

    /**
     * Generate consistency recommendations
     */
    generateConsistencyRecommendations(analysis) {
        const recommendations = [];
        
        // Check for schemas without @id
        const schemasWithoutId = this.schemas.filter(schema => !schema['@id']);
        
        if (schemasWithoutId.length > 0) {
            recommendations.push({
                type: 'Missing @id',
                level: 'high',
                message: `${schemasWithoutId.length} schemas are missing @id properties. Add consistent @id values using the pattern "schema:EntityType".`,
                example: '"@id": "schema:WebPageElement"',
                affectedSchemas: schemasWithoutId.length
            });
        }
        
        // Check for inconsistent @type usage
        analysis.inconsistentTypes.forEach((ids, schemaType) => {
            recommendations.push({
                type: 'Inconsistent @id Usage',
                level: 'high',
                message: `The schema type "${schemaType}" uses ${ids.length} different @id values. Use a single consistent @id across all instances.`,
                example: `"@id": "schema:${schemaType}"`,
                details: `Found @ids: ${ids.join(', ')}`,
                affectedSchemas: ids.length
            });
        });
        
        // Check for non-standard @id patterns
        analysis.idGroups.forEach((instances, schemaId) => {
            if (!schemaId.startsWith('schema:')) {
                recommendations.push({
                    type: 'Non-standard @id Pattern',
                    level: 'medium',
                    message: `The @id "${schemaId}" doesn't follow the recommended "schema:EntityType" pattern.`,
                    example: `"@id": "schema:${instances[0].type}"`,
                    badExample: `"@id": "${schemaId}"`,
                    affectedSchemas: instances.length
                });
            }
        });

        return recommendations;
    }

    /**
     * Calculate consistency score
     */
    calculateConsistencyScore(analysis) {
        const totalSchemas = this.schemas.length;
        if (totalSchemas === 0) return { score: 0, breakdown: [] };
        
        let score = 0;
        const breakdown = [];
        
        // @id Coverage (40 points)
        const schemasWithId = Array.from(analysis.idGroups.values())
            .reduce((count, instances) => count + instances.length, 0);
        const idCoverage = (schemasWithId / totalSchemas) * 40;
        score += idCoverage;
        
        breakdown.push({
            category: '@id Coverage',
            description: `${schemasWithId} of ${totalSchemas} schemas have @id properties`,
            points: Math.round(idCoverage),
            maxPoints: 40,
            percentage: Math.round((schemasWithId / totalSchemas) * 100)
        });
        
        // Pattern Compliance (30 points)
        const totalUniqueIds = analysis.idGroups.size;
        const schemaPatternIds = Array.from(analysis.idGroups.keys())
            .filter(id => id.startsWith('schema:')).length;
        const patternScore = totalUniqueIds > 0 ? (schemaPatternIds / totalUniqueIds) * 30 : 0;
        score += patternScore;
        
        breakdown.push({
            category: 'Standard Pattern Usage',
            description: `${schemaPatternIds} of ${totalUniqueIds} unique @ids use "schema:" pattern`,
            points: Math.round(patternScore),
            maxPoints: 30,
            percentage: totalUniqueIds > 0 ? Math.round((schemaPatternIds / totalUniqueIds) * 100) : 0
        });
        
        // Consistency Penalty (subtract 5 points per inconsistent type)
        const inconsistentPenalty = analysis.inconsistentTypes.size * 5;
        score = Math.max(0, score - inconsistentPenalty);
        
        if (inconsistentPenalty > 0) {
            breakdown.push({
                category: 'Type Consistency',
                description: `${analysis.inconsistentTypes.size} schema types use inconsistent @ids`,
                points: -inconsistentPenalty,
                maxPoints: 0,
                percentage: 0
            });
        }
        
        return {
            score: Math.round(Math.min(100, score)),
            breakdown
        };
    }

    /**
     * Generate comprehensive recommendations
     */
    async generateRecommendations(pageInfo = {}) {
        logger.info('Generating schema recommendations');
        
        const recommendations = [];
        
        try {
            // Basic schema recommendations
            await this.checkBasicSchemaRequirements(recommendations, pageInfo);
            
            // @id consistency recommendations
            const consistencyRecs = this.consistency.recommendations || [];
            recommendations.push(...consistencyRecs);
            
            // Entity relationship recommendations
            await this.checkEntityRelationships(recommendations);
            
            // SEO-specific recommendations
            await this.checkSEOOptimizations(recommendations, pageInfo);
            
            // Sort by priority
            return this.sortRecommendationsByPriority(recommendations);
            
        } catch (error) {
            logger.error('Error generating recommendations:', error);
            return [{
                type: 'Analysis Error',
                level: 'high',
                message: `Error generating recommendations: ${error.message}`
            }];
        }
    }

    /**
     * Check basic schema requirements
     */
    async checkBasicSchemaRequirements(recommendations, pageInfo) {
        const schemaTypes = this.schemas.map(s => this.getSchemaType(s));
        const url = pageInfo.url || '';
        
        // Check for missing WebPage schema
        if (!schemaTypes.includes('WebPage')) {
            recommendations.push({
                type: 'Missing WebPage Schema',
                level: 'high',
                message: 'Add WebPage schema to improve page indexing and search appearance.',
                example: this.generateWebPageExample(pageInfo),
                priority: 'high'
            });
        }
        
        // Check for missing Organization schema on about page
        if (url.includes('/about') && !schemaTypes.includes('Organization')) {
            recommendations.push({
                type: 'Missing Organization Schema',
                level: 'high',
                message: 'About pages should include Organization schema for better business entity recognition.',
                example: this.generateOrganizationExample(),
                priority: 'high'
            });
        }
        
        // Check for breadcrumbs on non-homepage
        if (url && !this.isHomePage(url) && !this.hasBreadcrumbSchema()) {
            recommendations.push({
                type: 'Missing BreadcrumbList',
                level: 'medium',
                message: 'Add BreadcrumbList schema to help search engines understand page hierarchy.',
                example: this.generateBreadcrumbExample(url),
                priority: 'medium'
            });
        }
    }

    /**
     * Check entity relationships
     */
    async checkEntityRelationships(recommendations) {
        const entities = this.analyzeEntities();
        
        if (entities.orphanedEntities.length > 0) {
            recommendations.push({
                type: 'Orphaned Entities',
                level: 'medium',
                message: `${entities.orphanedEntities.length} entities have no connections to other entities.`,
                details: 'Consider linking related entities using @id references.',
                priority: 'medium'
            });
        }
        
        if (entities.brokenReferences.length > 0) {
            recommendations.push({
                type: 'Broken Entity References',
                level: 'high',
                message: `${entities.brokenReferences.length} entity references point to non-existent entities.`,
                details: 'Fix broken @id references or add missing entities.',
                priority: 'high'
            });
        }
    }

    /**
     * Check SEO optimizations
     */
    async checkSEOOptimizations(recommendations, pageInfo) {
        // Check for missing images
        const schemasWithoutImages = this.schemas.filter(schema => {
            const type = this.getSchemaType(schema);
            const shouldHaveImage = ['Organization', 'Person', 'Product', 'Article', 'Event'].includes(type);
            return shouldHaveImage && !schema.image;
        });
        
        if (schemasWithoutImages.length > 0) {
            recommendations.push({
                type: 'Missing Images',
                level: 'medium',
                message: `${schemasWithoutImages.length} schemas should include image properties for better visual search results.`,
                priority: 'medium'
            });
        }
        
        // Check for missing descriptions
        const schemasWithoutDescriptions = this.schemas.filter(schema => !schema.description);
        
        if (schemasWithoutDescriptions.length > 0) {
            recommendations.push({
                type: 'Missing Descriptions',
                level: 'low',
                message: `${schemasWithoutDescriptions.length} schemas lack description properties.`,
                details: 'Descriptions help search engines understand content context.',
                priority: 'low'
            });
        }
    }

    /**
     * Calculate overall SEO score
     */
    calculateSEOScore() {
        const scores = {
            schemaQuality: this.calculateSchemaQualityScore(),
            consistency: this.consistency.bestPracticeScore || 0,
            completeness: this.calculateCompletenessScore(),
            entityConnectivity: this.calculateEntityConnectivityScore()
        };
        
        const weights = {
            schemaQuality: 0.3,
            consistency: 0.3,
            completeness: 0.25,
            entityConnectivity: 0.15
        };
        
        const overallScore = Object.entries(scores).reduce((total, [key, score]) => {
            return total + (score * weights[key]);
        }, 0);
        
        return {
            overall: Math.round(overallScore),
            breakdown: scores,
            weights,
            grade: this.getScoreGrade(Math.round(overallScore))
        };
    }

    /**
     * Helper methods for score calculation
     */
    calculateSchemaQualityScore() {
        if (this.schemas.length === 0) return 0;
        
        const qualityScores = this.schemas.map(schema => {
            const completeness = this.calculateSchemaCompleteness(schema);
            const hasValidId = this.isValidIdFormat(schema['@id']) ? 20 : 0;
            const importance = this.calculateSchemaImportance(schema, this.getSchemaType(schema));
            
            return (completeness * 0.6) + hasValidId + (importance * 2);
        });
        
        return Math.min(100, qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length);
    }

    calculateCompletenessScore() {
        if (this.schemas.length === 0) return 0;
        
        const completenessScores = this.schemas.map(schema => 
            this.calculateSchemaCompleteness(schema)
        );
        
        return completenessScores.reduce((a, b) => a + b, 0) / completenessScores.length;
    }

    calculateEntityConnectivityScore() {
        const entities = this.analyzeEntities();
        return entities.connectivityScore || 0;
    }

    getScoreGrade(score) {
        if (score >= 90) return 'A+';
        if (score >= 80) return 'A';
        if (score >= 70) return 'B';
        if (score >= 60) return 'C';
        if (score >= 50) return 'D';
        return 'F';
    }

    /**
     * Utility methods
     */
    isHomePage(url) {
        try {
            const parsedUrl = new URL(url);
            const path = parsedUrl.pathname;
            return path === '/' || path === '/index.html' || path === '/index.php';
        } catch (e) {
            return false;
        }
    }

    hasBreadcrumbSchema() {
        return this.schemas.some(schema => 
            this.getSchemaType(schema) === 'BreadcrumbList'
        );
    }

    sortRecommendationsByPriority(recommendations) {
        const priorityOrder = { 'high': 1, 'medium': 2, 'low': 3 };
        return recommendations.sort((a, b) => {
            const aPriority = priorityOrder[a.level] || 3;
            const bPriority = priorityOrder[b.level] || 3;
            return aPriority - bPriority;
        });
    }

    /**
     * Example generators
     */
    generateWebPageExample(pageInfo) {
        return JSON.stringify({
            "@type": "WebPage",
            "@id": "schema:WebPage",
            "url": pageInfo.url || "https://example.com/page",
            "name": pageInfo.title || "Page Title",
            "description": pageInfo.description || "Page description",
            "datePublished": new Date().toISOString(),
            "dateModified": new Date().toISOString()
        }, null, 2);
    }

    generateOrganizationExample() {
        return JSON.stringify({
            "@type": "Organization",
            "@id": "schema:Organization",
            "name": "Your Company Name",
            "url": "https://example.com",
            "logo": "https://example.com/logo.png",
            "description": "Company description"
        }, null, 2);
    }

    generateBreadcrumbExample(url) {
        return JSON.stringify({
            "@type": "BreadcrumbList",
            "@id": "schema:BreadcrumbList",
            "itemListElement": [
                {
                    "@type": "ListItem",
                    "position": 1,
                    "@id": "schema:ListItem",
                    "name": "Home",
                    "item": "https://example.com/"
                }
            ]
        }, null, 2);
    }

    /**
     * Reset analyzer state
     */
    reset() {
        this.processedIds.clear();
        this.schemas = [];
        this.relationships.clear();
        this.consistency = {
            idGroups: new Map(),
            typeGroups: new Map(),
            consistentIds: new Map(),
            inconsistentTypes: new Map(),
            bestPracticeScore: 0,
            recommendations: []
        };
    }
}

module.exports = SchemaAnalyzer;
