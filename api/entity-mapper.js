// entity-mapper.js - Schema Entity Relationship Analyzer
// מבוסס על הקוד המקורי מ-site-schema-mapper.js + results.js

const { v4: uuidv4 } = require('uuid');

/**
 * EntityMapper - מנוע ניתוח קשרים בין entities
 * מבוסס על ה-logic המתקדם מהקוד המקורי
 */
class EntityMapper {
    constructor() {
        this.schemaMap = new Map(); // @id -> entity details
        this.connections = new Map(); // @id -> array of connected @ids
        this.orphanedEntities = new Set(); // entities ללא קשרים
        this.brokenReferences = new Map(); // @id -> array of broken refs
        this.entityTypes = new Map(); // type -> instances count
        this.crossPageConnections = new Map(); // track cross-page relationships
        
        // Entity patterns מבוסס על הקוד המקורי
        this.entityPatterns = {
            validIdPatterns: [
                /^schema:/,
                /^https?:\/\/.*#/,
                /^#[a-zA-Z]/
            ],
            referenceProperties: [
                'author', 'editor', 'publisher', 'creator',
                'member', 'employee', 'founder', 'owner',
                'mainEntity', 'about', 'mentions',
                'isPartOf', 'hasPart', 'memberOf',
                'worksFor', 'alumniOf', 'knows',
                'follows', 'sponsor', 'funder'
            ],
            entityTypes: {
                'Organization': { priority: 5, expectedRefs: ['member', 'employee', 'founder'] },
                'Person': { priority: 4, expectedRefs: ['worksFor', 'memberOf', 'knows'] },
                'Product': { priority: 5, expectedRefs: ['manufacturer', 'brand', 'seller'] },
                'WebPage': { priority: 2, expectedRefs: ['about', 'mainEntity', 'isPartOf'] },
                'WebSite': { priority: 3, expectedRefs: ['publisher', 'author'] },
                'Article': { priority: 4, expectedRefs: ['author', 'publisher', 'about'] },
                'Event': { priority: 4, expectedRefs: ['organizer', 'performer', 'location'] }
            }
        };
    }

    /**
     * ניתוח מלא של entities ב-schemas
     * מבוסס על analyzeIdConsistencyWithTitles מהקוד המקורי
     */
    async analyzeEntities(schemas, options = {}) {
        console.log(`🕸️ Analyzing ${schemas.length} schemas for entity relationships...`);
        
        this.reset();
        
        const analysis = {
            totalEntities: 0,
            entitiesWithId: 0,
            validConnections: 0,
            brokenConnections: 0,
            orphanedEntities: 0,
            crossPageConnections: 0,
            entityEcosystem: new Map(),
            recommendations: []
        };

        // Phase 1: מיפוי כל ה-entities
        for (const [index, schema] of schemas.entries()) {
            await this.mapEntity(schema, index, options);
        }

        // Phase 2: ניתוח קשרים
        this.analyzeConnections();

        // Phase 3: זיהוי בעיות
        this.findBrokenReferences();
        this.findOrphanedEntities();

        // Phase 4: יצירת תובנות
        analysis.totalEntities = this.schemaMap.size;
        analysis.entitiesWithId = Array.from(this.schemaMap.values())
            .filter(entity => entity.id && entity.id !== 'unknown').length;
        analysis.validConnections = this.countValidConnections();
        analysis.brokenConnections = this.brokenReferences.size;
        analysis.orphanedEntities = this.orphanedEntities.size;
        analysis.crossPageConnections = this.crossPageConnections.size;
        analysis.entityEcosystem = this.buildEntityEcosystem();
        analysis.recommendations = this.generateEntityRecommendations();

        console.log(`✅ Entity analysis complete: ${analysis.totalEntities} entities, ${analysis.validConnections} connections`);
        return analysis;
    }

    /**
     * מיפוי entity יחיד
     * מותאם מהקוד של processPageSchemas
     */
    async mapEntity(schema, index, options) {
        const cleanSchema = this.cleanSchema(schema);
        if (!cleanSchema || !cleanSchema['@type']) return;

        const entityId = this.extractEntityId(cleanSchema, index);
        const entityType = this.getEntityType(cleanSchema);
        const pageUrl = schema._siteMapperInfo?.foundOnUrl || 'current-page';
        const pageTitle = schema._siteMapperInfo?.pageTitle || this.extractTitleFromSchema(cleanSchema);

        // יצירת entity mapping
        const entityData = {
            id: entityId,
            type: entityType,
            schema: cleanSchema,
            pageUrl: pageUrl,
            pageTitle: pageTitle,
            index: index,
            properties: this.extractEntityProperties(cleanSchema),
            references: this.extractReferences(cleanSchema),
            incomingRefs: new Set(),
            outgoingRefs: new Set()
        };

        this.schemaMap.set(entityId, entityData);
        
        // עדכון סטטיסטיקות
        this.entityTypes.set(entityType, (this.entityTypes.get(entityType) || 0) + 1);

        // ניתוח קשרים
        this.trackEntityConnections(cleanSchema, entityId, pageUrl);
    }

    /**
     * חילוץ @id מ-schema או יצירת ID זמני
     * מבוסס על ה-logic המקורי מ-results.js
     */
    extractEntityId(schema, index) {
        if (schema['@id']) {
            return schema['@id'];
        }
        
        // יצירת ID זמני על בסיס type ו-content
        const type = this.getEntityType(schema);
        const nameOrTitle = schema.name || schema.headline || schema.title || '';
        
        if (nameOrTitle) {
            const cleanName = nameOrTitle.toLowerCase()
                .replace(/[^a-z0-9]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            return `temp:${type}-${cleanName}`;
        }
        
        return `temp:${type}-${index}`;
    }

    /**
     * חילוץ סוג entity
     */
    getEntityType(schema) {
        const type = schema['@type'];
        return Array.isArray(type) ? type[0] : type;
    }

    /**
     * ניקוי schema מmetadata
     */
    cleanSchema(schema) {
        if (!schema || typeof schema !== 'object') return null;
        
        const cleaned = { ...schema };
        delete cleaned._siteMapperInfo;
        delete cleaned._metadata;
        
        return cleaned;
    }

    /**
     * חילוץ properties חשובים
     */
    extractEntityProperties(schema) {
        const properties = {};
        const importantProps = [
            'name', 'title', 'headline', 'description',
            'url', 'sameAs', 'identifier', 'email',
            'telephone', 'address', 'location',
            'datePublished', 'dateModified'
        ];

        importantProps.forEach(prop => {
            if (schema[prop]) {
                properties[prop] = schema[prop];
            }
        });

        return properties;
    }

    /**
     * חילוץ references לentities אחרים
     * מבוסס על trackEntityConnections מהקוד המקורי
     */
    extractReferences(schema) {
        const references = new Set();
        
        this.findReferencesRecursive(schema, references);
        
        return Array.from(references);
    }

    /**
     * חיפוש recursive של references
     * מותאם מ-trackSchemaConnections מהקוד המקורי
     */
    findReferencesRecursive(obj, references, path = '') {
        if (!obj || typeof obj !== 'object') return;

        Object.entries(obj).forEach(([key, value]) => {
            // בדיקה של reference properties
            if (this.entityPatterns.referenceProperties.includes(key)) {
                if (typeof value === 'string' && this.isValidEntityReference(value)) {
                    references.add(value);
                } else if (value && value['@id']) {
                    references.add(value['@id']);
                }
            }

            // בדיקה של @id במבנים מקוננים
            if (value && typeof value === 'object') {
                if (value['@id'] && this.isValidEntityReference(value['@id'])) {
                    references.add(value['@id']);
                }
                
                if (Array.isArray(value)) {
                    value.forEach((item, index) => {
                        if (item && typeof item === 'object') {
                            this.findReferencesRecursive(item, references, `${path}.${key}[${index}]`);
                        }
                    });
                } else {
                    this.findReferencesRecursive(value, references, `${path}.${key}`);
                }
            }
        });
    }

    /**
     * בדיקה אם ערך הוא reference תקין לentity
     */
    isValidEntityReference(value) {
        if (!value || typeof value !== 'string') return false;
        
        return this.entityPatterns.validIdPatterns.some(pattern => 
            pattern.test(value)
        );
    }

    /**
     * מעקב אחר קשרים בין entities
     * מבוסס על addConnection מהקוד המקורי
     */
    trackEntityConnections(schema, currentId, pageUrl) {
        const references = this.extractReferences(schema);
        
        references.forEach(refId => {
            this.addConnection(currentId, refId, pageUrl);
        });
    }

    /**
     * הוספת קשר bidirectional
     * מותאם מ-addConnection מהקוד המקורי
     */
    addConnection(fromId, toId, pageUrl) {
        if (fromId === toId) return; // אין self-connections

        // הוספת קשר יוצא
        if (!this.connections.has(fromId)) {
            this.connections.set(fromId, new Set());
        }
        this.connections.get(fromId).add(toId);

        // הוספת קשר נכנס
        if (!this.connections.has(toId)) {
            this.connections.set(toId, new Set());
        }
        this.connections.get(toId).add(fromId);

        // מעקב cross-page connections
        const fromEntity = this.schemaMap.get(fromId);
        const toEntity = this.schemaMap.get(toId);
        
        if (fromEntity && toEntity && fromEntity.pageUrl !== toEntity.pageUrl) {
            const connectionKey = `${fromEntity.pageUrl}→${toEntity.pageUrl}`;
            this.crossPageConnections.set(connectionKey, {
                fromPage: fromEntity.pageUrl,
                toPage: toEntity.pageUrl,
                fromEntity: fromId,
                toEntity: toId,
                relationship: this.inferRelationshipType(fromEntity, toEntity)
            });
        }

        // עדכון entity data
        if (fromEntity) {
            fromEntity.outgoingRefs.add(toId);
        }
        if (toEntity) {
            toEntity.incomingRefs.add(fromId);
        }
    }

    /**
     * זיהוי סוג הקשר בין entities
     */
    inferRelationshipType(fromEntity, toEntity) {
        const fromType = fromEntity.type;
        const toType = toEntity.type;
        
        // כללים בסיסיים לזיהוי קשרים
        if (fromType === 'Person' && toType === 'Organization') {
            return 'worksFor';
        }
        if (fromType === 'Article' && toType === 'Person') {
            return 'author';
        }
        if (fromType === 'Product' && toType === 'Organization') {
            return 'manufacturer';
        }
        if (fromType === 'WebPage' && toType === 'Organization') {
            return 'about';
        }
        
        return 'relatedTo';
    }

    /**
     * ניתוח קשרים קיימים
     */
    analyzeConnections() {
        console.log('🔗 Analyzing entity connections...');
        
        this.connections.forEach((connectedIds, entityId) => {
            const entity = this.schemaMap.get(entityId);
            if (!entity) return;

            // ספירת קשרים valid vs broken
            connectedIds.forEach(connectedId => {
                if (this.schemaMap.has(connectedId)) {
                    // Valid connection
                    entity.outgoingRefs.add(connectedId);
                } else {
                    // Broken reference
                    if (!this.brokenReferences.has(entityId)) {
                        this.brokenReferences.set(entityId, []);
                    }
                    this.brokenReferences.get(entityId).push(connectedId);
                }
            });
        });
    }

    /**
     * זיהוי references שבורים
     */
    findBrokenReferences() {
        console.log('🔍 Finding broken references...');
        
        this.schemaMap.forEach((entity, entityId) => {
            entity.references.forEach(refId => {
                if (!this.schemaMap.has(refId)) {
                    if (!this.brokenReferences.has(entityId)) {
                        this.brokenReferences.set(entityId, []);
                    }
                    this.brokenReferences.get(entityId).push(refId);
                }
            });
        });
    }

    /**
     * זיהוי entities ללא קשרים (orphaned)
     */
    findOrphanedEntities() {
        console.log('🏝️ Finding orphaned entities...');
        
        this.schemaMap.forEach((entity, entityId) => {
            const hasIncomingRefs = entity.incomingRefs.size > 0;
            const hasOutgoingRefs = entity.outgoingRefs.size > 0;
            
            if (!hasIncomingRefs && !hasOutgoingRefs) {
                this.orphanedEntities.add(entityId);
            }
        });
    }

    /**
     * ספירת קשרים תקינים
     */
    countValidConnections() {
        let count = 0;
        this.connections.forEach((connectedIds, entityId) => {
            connectedIds.forEach(connectedId => {
                if (this.schemaMap.has(connectedId)) {
                    count++;
                }
            });
        });
        return Math.floor(count / 2); // חלקים ב-2 כי הקשרים bidirectional
    }

    /**
     * בניית ecosystem map
     * מבוסס על buildSchemaGraph מהקוד המקורי
     */
    buildEntityEcosystem() {
        const ecosystem = {
            nodes: [],
            edges: [],
            clusters: new Map(),
            metrics: {
                avgConnections: 0,
                maxConnections: 0,
                isolatedNodes: 0,
                stronglyConnected: 0
            }
        };

        // יצירת nodes
        this.schemaMap.forEach((entity, entityId) => {
            const connectionCount = (entity.incomingRefs.size + entity.outgoingRefs.size);
            
            ecosystem.nodes.push({
                id: entityId,
                type: entity.type,
                label: entity.properties.name || entity.properties.title || entity.type,
                pageUrl: entity.pageUrl,
                pageTitle: entity.pageTitle,
                connections: connectionCount,
                properties: entity.properties,
                isOrphaned: this.orphanedEntities.has(entityId),
                hasBrokenRefs: this.brokenReferences.has(entityId)
            });

            // עדכון metrics
            ecosystem.metrics.maxConnections = Math.max(ecosystem.metrics.maxConnections, connectionCount);
            if (connectionCount === 0) {
                ecosystem.metrics.isolatedNodes++;
            }
            if (connectionCount >= 3) {
                ecosystem.metrics.stronglyConnected++;
            }
        });

        // יצירת edges
        this.connections.forEach((connectedIds, fromId) => {
            connectedIds.forEach(toId => {
                if (fromId < toId && this.schemaMap.has(toId)) { // למנוע duplicates
                    const fromEntity = this.schemaMap.get(fromId);
                    const toEntity = this.schemaMap.get(toId);
                    
                    ecosystem.edges.push({
                        source: fromId,
                        target: toId,
                        sourceType: fromEntity.type,
                        targetType: toEntity.type,
                        relationship: this.inferRelationshipType(fromEntity, toEntity),
                        isCrossPage: fromEntity.pageUrl !== toEntity.pageUrl,
                        strength: this.calculateConnectionStrength(fromEntity, toEntity)
                    });
                }
            });
        });

        // חישוב average connections
        if (ecosystem.nodes.length > 0) {
            const totalConnections = ecosystem.nodes.reduce((sum, node) => sum + node.connections, 0);
            ecosystem.metrics.avgConnections = totalConnections / ecosystem.nodes.length;
        }

        return ecosystem;
    }

    /**
     * חישוב חוזק הקשר בין entities
     */
    calculateConnectionStrength(fromEntity, toEntity) {
        let strength = 0.5; // base strength
        
        // חוזק לפי mutual properties
        const fromProps = new Set(Object.keys(fromEntity.properties));
        const toProps = new Set(Object.keys(toEntity.properties));
        const commonProps = new Set([...fromProps].filter(x => toProps.has(x)));
        strength += commonProps.size * 0.1;
        
        // חוזק לפי סוג הקשר
        const relationship = this.inferRelationshipType(fromEntity, toEntity);
        if (['author', 'worksFor', 'memberOf'].includes(relationship)) {
            strength += 0.3;
        }
        
        // פנימיות להפחתת חוזק cross-page
        if (fromEntity.pageUrl !== toEntity.pageUrl) {
            strength += 0.2; // cross-page connections are valuable
        }
        
        return Math.min(1.0, strength);
    }

    /**
     * יצירת המלצות לשיפור entities
     * מבוסס על generateIdConsistencyRecommendations
     */
    generateEntityRecommendations() {
        const recommendations = [];

        // המלצות לentities ללא @id
        const entitiesWithoutId = Array.from(this.schemaMap.values())
            .filter(entity => entity.id.startsWith('temp:'));
        
        if (entitiesWithoutId.length > 0) {
            recommendations.push({
                type: 'Missing Entity IDs',
                level: 'high',
                message: `${entitiesWithoutId.length} entities are missing @id properties. This prevents proper cross-referencing.`,
                example: '"@id": "schema:Organization"',
                affectedEntities: entitiesWithoutId.length,
                details: entitiesWithoutId.map(e => `${e.type} on ${e.pageUrl}`)
            });
        }

        // המלצות לreferences שבורים
        if (this.brokenReferences.size > 0) {
            recommendations.push({
                type: 'Broken Entity References',
                level: 'high',
                message: `Found ${this.brokenReferences.size} entities with broken references to other entities.`,
                example: 'Ensure referenced entities exist and have proper @id values',
                affectedEntities: this.brokenReferences.size,
                details: Array.from(this.brokenReferences.entries()).map(([entityId, brokenRefs]) => 
                    `${entityId} references missing: ${brokenRefs.join(', ')}`
                )
            });
        }

        // המלצות לentities מבודדים
        if (this.orphanedEntities.size > 0) {
            recommendations.push({
                type: 'Orphaned Entities',
                level: 'medium',
                message: `${this.orphanedEntities.size} entities have no connections to other entities. Consider adding relevant relationships.`,
                example: 'Add "author", "worksFor", or "memberOf" properties',
                affectedEntities: this.orphanedEntities.size,
                details: Array.from(this.orphanedEntities).map(entityId => {
                    const entity = this.schemaMap.get(entityId);
                    return `${entity.type} on ${entity.pageUrl}`;
                })
            });
        }

        // המלצות לשיפור cross-page connections
        const totalEntities = this.schemaMap.size;
        const crossPageRatio = this.crossPageConnections.size / totalEntities;
        
        if (crossPageRatio < 0.3 && totalEntities > 5) {
            recommendations.push({
                type: 'Limited Cross-Page Connections',
                level: 'medium', 
                message: 'Consider adding more connections between entities on different pages to improve site coherence.',
                example: 'Reference organization entities from multiple pages using consistent @id values',
                affectedEntities: totalEntities,
                details: [`Only ${Math.round(crossPageRatio * 100)}% of entities have cross-page connections`]
            });
        }

        // המלצות positive
        const strongConnections = Array.from(this.schemaMap.values())
            .filter(entity => entity.incomingRefs.size + entity.outgoingRefs.size >= 2);
            
        if (strongConnections.length > 0) {
            recommendations.push({
                type: 'Well-Connected Entities',
                level: 'success',
                message: `Excellent! ${strongConnections.length} entities have strong connections to other entities.`,
                affectedEntities: strongConnections.length
            });
        }

        return recommendations;
    }

    /**
     * חילוץ title מschema
     */
    extractTitleFromSchema(schema) {
        if (schema['@type'] === 'WebPage' && schema.name) {
            return schema.name;
        }
        if (schema['@type'] === 'WebPage' && schema.headline) {
            return schema.headline;
        }
        return null;
    }

    /**
     * איפוס מצב ה-mapper
     */
    reset() {
        this.schemaMap.clear();
        this.connections.clear();
        this.orphanedEntities.clear();
        this.brokenReferences.clear();
        this.entityTypes.clear();
        this.crossPageConnections.clear();
    }

    /**
     * יצוא נתונים לJSON
     */
    exportData() {
        return {
            entities: Object.fromEntries(this.schemaMap),
            connections: Object.fromEntries(
                Array.from(this.connections.entries()).map(([key, set]) => [key, Array.from(set)])
            ),
            orphanedEntities: Array.from(this.orphanedEntities),
            brokenReferences: Object.fromEntries(this.brokenReferences),
            entityTypes: Object.fromEntries(this.entityTypes),
            crossPageConnections: Object.fromEntries(this.crossPageConnections),
            summary: {
                totalEntities: this.schemaMap.size,
                totalConnections: this.connections.size,
                orphanedCount: this.orphanedEntities.size,
                brokenReferencesCount: this.brokenReferences.size
            }
        };
    }
}

module.exports = EntityMapper;
