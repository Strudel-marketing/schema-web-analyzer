// consistency-analyzer.js - Schema @id Consistency Analyzer
// מבוסס על הקוד המתקדם מ-results.js

/**
 * ConsistencyAnalyzer - מנוע ניתוח עקביות @id values
 * מיושם בהתבסס על הlogic המתקדם מהקוד המקורי
 */
class ConsistencyAnalyzer {
    constructor() {
        this.idGroups = new Map(); // @id -> array של instances
        this.typeGroups = new Map(); // @type -> Set של @ids
        this.consistentIds = new Map(); // @id -> usage count
        this.inconsistentTypes = new Map(); // @type -> array של @ids שונים
        this.bestPracticeScore = 0;
        this.scoreBreakdown = [];
        this.scoreSummary = {};
        this.recommendations = [];
        
        // Patterns למציאת @id טובים ורעים
        this.patterns = {
            good: [
                /^schema:/,
                /^https?:\/\/schema\.org\//
            ],
            acceptable: [
                /^https?:\/\/.*#[a-zA-Z]/,
                /^#[a-zA-Z]/
            ],
            bad: [
                /^https?:\/\/.*\/.*$/,  // URLs without fragments
                /^[^#]*$/,              // No fragments at all
                /^#\d+$/,               // Just numbers
                /^#$/                   // Empty fragment
            ]
        };
    }

    /**
     * ניתוח עקביות @id עבור schemas
     * מבוסס על analyzeIdConsistencyWithTitles מהקוד המקורי
     */
    async analyzeConsistency(schemas) {
        console.log(`🔍 Analyzing @id consistency for ${schemas.length} schemas...`);
        
        this.reset();
        
        const analysis = {
            idGroups: new Map(),
            typeGroups: new Map(),
            consistentIds: new Map(),
            inconsistentTypes: new Map(),
            bestPracticeScore: 0,
            recommendations: [],
            scoreBreakdown: [],
            scoreSummary: {}
        };

        // Process schemas עם enhanced title fetching
        for (let index = 0; index < schemas.length; index++) {
            const schema = schemas[index];
            await this.processSchemaForConsistency(schema, index);
        }

        // Generate analysis results
        this.findInconsistentTypes();
        this.scoreBreakdown = this.calculateConsistencyScore(schemas);
        this.recommendations = this.generateConsistencyRecommendations(schemas);
        
        // Build final analysis object
        analysis.idGroups = new Map(this.idGroups);
        analysis.typeGroups = new Map(this.typeGroups);
        analysis.consistentIds = new Map(this.consistentIds);
        analysis.inconsistentTypes = new Map(this.inconsistentTypes);
        analysis.bestPracticeScore = this.bestPracticeScore;
        analysis.recommendations = this.recommendations;
        analysis.scoreBreakdown = this.scoreBreakdown;
        analysis.scoreSummary = this.scoreSummary;

        console.log(`✅ Consistency analysis complete: score ${this.bestPracticeScore}/100`);
        return analysis;
    }

    /**
     * עיבוד schema יחיד לניתוח עקביות
     */
    async processSchemaForConsistency(schema, index) {
        const cleanSchema = { ...schema };
        delete cleanSchema._siteMapperInfo;
        
        const schemaId = cleanSchema['@id'];
        const schemaType = Array.isArray(cleanSchema['@type']) ? 
            cleanSchema['@type'][0] : cleanSchema['@type'];
        const pageUrl = schema._siteMapperInfo?.foundOnUrl || 'current-page';
        
        // Enhanced title extraction
        let pageTitle = schema._siteMapperInfo?.pageTitle;
        
        if (!pageTitle && pageUrl !== 'current-page') {
            pageTitle = this.extractTitleFromSchema(cleanSchema);
            
            if (!pageTitle) {
                pageTitle = await this.generateTitleFromUrl(pageUrl);
            }
        }
        
        if (!pageTitle) {
            pageTitle = this.generateTitleFromUrl(pageUrl);
        }

        if (schemaId) {
            // Group by @id
            if (!this.idGroups.has(schemaId)) {
                this.idGroups.set(schemaId, []);
            }
            this.idGroups.get(schemaId).push({
                schema: cleanSchema,
                pageUrl: pageUrl,
                pageTitle: pageTitle,
                index: index,
                type: schemaType
            });
            
            // Count @id usage
            this.consistentIds.set(schemaId, (this.consistentIds.get(schemaId) || 0) + 1);
        }
        
        if (schemaType) {
            // Group by @type to find inconsistencies
            if (!this.typeGroups.has(schemaType)) {
                this.typeGroups.set(schemaType, new Set());
            }
            if (schemaId) {
                this.typeGroups.get(schemaType).add(schemaId);
            }
        }
    }

    /**
     * מציאת types עם @id לא עקבי
     */
    findInconsistentTypes() {
        this.typeGroups.forEach((idSet, schemaType) => {
            if (idSet.size > 1) {
                this.inconsistentTypes.set(schemaType, Array.from(idSet));
            }
        });
    }

    /**
     * חישוב ציון עקביות
     * מבוסס על calculateIdConsistencyScore מהקוד המקורי
     */
    calculateConsistencyScore(schemas) {
        const totalSchemas = schemas.length;
        if (totalSchemas === 0) {
            return { score: 0, breakdown: [], summary: {} };
        }
        
        let score = 0;
        let breakdown = [];
        
        // Category 1: Having @id (up to 40 points)
        const schemasWithId = Array.from(this.idGroups.values())
            .reduce((count, instances) => count + instances.length, 0);
        const idCoverage = (schemasWithId / totalSchemas) * 40;
        score += idCoverage;
        
        breakdown.push({
            category: '@id Coverage',
            description: `${schemasWithId} of ${totalSchemas} schemas have @id properties`,
            points: Math.round(idCoverage),
            maxPoints: 40,
            percentage: Math.round((schemasWithId / totalSchemas) * 100),
            status: schemasWithId === totalSchemas ? 'excellent' : 
                   schemasWithId >= totalSchemas * 0.8 ? 'good' : 'poor',
            issues: totalSchemas - schemasWithId > 0 ? 
                   [`${totalSchemas - schemasWithId} schemas missing @id`] : []
        });
        
        // Category 2: Using schema: pattern (up to 30 points)
        const totalUniqueIds = this.idGroups.size;
        const schemaPatternIds = Array.from(this.idGroups.keys())
            .filter(id => this.isGoodPattern(id)).length;
        const patternScore = totalUniqueIds > 0 ? (schemaPatternIds / totalUniqueIds) * 30 : 0;
        score += patternScore;
        
        const nonStandardIds = Array.from(this.idGroups.keys())
            .filter(id => !this.isGoodPattern(id));
        breakdown.push({
            category: 'Standard Pattern Usage',
            description: `${schemaPatternIds} of ${totalUniqueIds} unique @ids use recommended patterns`,
            points: Math.round(patternScore),
            maxPoints: 30,
            percentage: totalUniqueIds > 0 ? 
                       Math.round((schemaPatternIds / totalUniqueIds) * 100) : 0,
            status: schemaPatternIds === totalUniqueIds ? 'excellent' : 
                   schemaPatternIds >= totalUniqueIds * 0.8 ? 'good' : 'poor',
            issues: nonStandardIds.length > 0 ? 
                   nonStandardIds.map(id => `"${id}" doesn't follow recommended pattern`) : []
        });
        
        // Category 3: Consistency penalty (subtract 5 points per inconsistent type)
        const inconsistentPenalty = this.inconsistentTypes.size * 5;
        score = Math.max(0, score - inconsistentPenalty);
        
        if (this.inconsistentTypes.size > 0) {
            const inconsistentDetails = Array.from(this.inconsistentTypes.entries())
                .map(([type, ids]) => 
                    `${type}: uses ${ids.length} different @ids (${ids.join(', ')})`
                );
            
            breakdown.push({
                category: 'Type Consistency',
                description: `${this.inconsistentTypes.size} schema types use inconsistent @ids`,
                points: -inconsistentPenalty,
                maxPoints: 0,
                percentage: 0,
                status: 'poor',
                issues: inconsistentDetails
            });
        } else {
            breakdown.push({
                category: 'Type Consistency',
                description: 'All schema types use consistent @ids',
                points: 0,
                maxPoints: 0,
                percentage: 100,
                status: 'excellent',
                issues: []
            });
        }
        
        // Category 4: Cross-page consistency bonus (up to 30 points)
        const reusedIds = Array.from(this.consistentIds.values())
            .filter(count => count > 1).length;
        const crossPageBonus = Math.min(30, reusedIds * 5);
        score += crossPageBonus;
        
        breakdown.push({
            category: 'Cross-Page Reuse',
            description: `${reusedIds} @ids are reused across multiple pages`,
            points: crossPageBonus,
            maxPoints: 30,
            percentage: reusedIds > 0 ? Math.round((crossPageBonus / 30) * 100) : 0,
            status: crossPageBonus >= 20 ? 'excellent' : 
                   crossPageBonus >= 10 ? 'good' : 'poor',
            issues: reusedIds === 0 ? ['No @ids are reused across pages'] : []
        });
        
        const finalScore = Math.round(Math.min(100, score));
        
        this.bestPracticeScore = finalScore;
        this.scoreSummary = {
            totalIssues: breakdown.reduce((sum, cat) => sum + cat.issues.length, 0),
            excellentCategories: breakdown.filter(cat => cat.status === 'excellent').length,
            poorCategories: breakdown.filter(cat => cat.status === 'poor').length
        };
        
        return breakdown;
    }

    /**
     * יצירת המלצות לעקביות
     * מבוסס על generateIdConsistencyRecommendations מהקוד המקורי
     */
    generateConsistencyRecommendations(schemas) {
        const recommendations = [];
        
        // Extract base URL for examples
        const baseUrl = this.extractBaseUrl(schemas);
        
        // Check for schemas without @id
        const schemasWithoutId = schemas.filter(schema => {
            const cleanSchema = { ...schema };
            delete cleanSchema._siteMapperInfo;
            return !cleanSchema['@id'];
        });
        
        if (schemasWithoutId.length > 0) {
            recommendations.push({
                type: 'Missing @id',
                level: 'high',
                message: `${schemasWithoutId.length} schemas are missing @id properties. Add consistent @id values using the pattern "schema:EntityType".`,
                example: '"@id": "schema:WebPageElement"',
                affectedSchemas: schemasWithoutId.length,
                fix: this.generateMissingIdFix(schemasWithoutId)
            });
        }
        
        // Check for inconsistent @type usage with dynamic examples
        this.inconsistentTypes.forEach((ids, schemaType) => {
            const badExample = ids.find(id => !this.isGoodPattern(id)) || ids[0];
            recommendations.push({
                type: 'Inconsistent @id Usage',
                level: 'high',
                message: `The schema type "${schemaType}" uses ${ids.length} different @id values. Use a single consistent @id across all pages.`,
                example: `"@id": "schema:${schemaType}"`,
                details: `Found @ids: ${ids.join(', ')}`,
                badExample: `"@id": "${badExample}"`,
                affectedSchemas: ids.length,
                fix: this.generateInconsistencyFix(schemaType, ids)
            });
        });
        
        // Check for non-standard @id patterns with dynamic examples
        this.idGroups.forEach((instances, schemaId) => {
            if (!this.isGoodPattern(schemaId)) {
                const patternType = this.categorizeIdPattern(schemaId);
                recommendations.push({
                    type: 'Non-standard @id Pattern',
                    level: patternType === 'bad' ? 'high' : 'medium',
                    message: `The @id "${schemaId}" doesn't follow recommended patterns. ${this.getPatternAdvice(patternType)}`,
                    example: `"@id": "schema:${instances[0].type}"`,
                    badExample: `"@id": "${schemaId}"`,
                    affectedSchemas: instances.length,
                    fix: this.generatePatternFix(schemaId, instances[0].type)
                });
            }
        });
        
        // Positive reinforcement for good practices
        const goodPractices = [];
        this.idGroups.forEach((instances, schemaId) => {
            if (this.isGoodPattern(schemaId) && instances.length > 1) {
                goodPractices.push({
                    type: 'Excellent Consistency',
                    level: 'success',
                    message: `Great! The @id "${schemaId}" is used consistently across ${instances.length} pages.`,
                    affectedSchemas: instances.length
                });
            }
        });
        
        return [...recommendations, ...goodPractices];
    }

    /**
     * בדיקה אם @id עוקב אחר pattern טוב
     */
    isGoodPattern(id) {
        return this.patterns.good.some(pattern => pattern.test(id));
    }

    /**
     * קטגוריזציה של pattern
     */
    categorizeIdPattern(id) {
        if (this.patterns.good.some(pattern => pattern.test(id))) {
            return 'good';
        }
        if (this.patterns.acceptable.some(pattern => pattern.test(id))) {
            return 'acceptable';
        }
        if (this.patterns.bad.some(pattern => pattern.test(id))) {
            return 'bad';
        }
        return 'unknown';
    }

    /**
     * עצה לפי סוג pattern
     */
    getPatternAdvice(patternType) {
        switch (patternType) {
            case 'bad':
                return 'Use "schema:EntityType" format for better consistency.';
            case 'acceptable':
                return 'Consider using "schema:EntityType" format for improved standardization.';
            default:
                return 'Use a more descriptive and consistent pattern.';
        }
    }

    /**
     * יצירת fix למחסור ב@id
     */
    generateMissingIdFix(schemasWithoutId) {
        const fixes = schemasWithoutId.map(schema => {
            const schemaType = Array.isArray(schema['@type']) ? 
                schema['@type'][0] : schema['@type'];
            return {
                type: schemaType,
                recommendedId: `schema:${schemaType}`,
                currentSchema: schema
            };
        });
        
        return {
            type: 'add_missing_ids',
            fixes: fixes,
            instructions: 'Add @id property to each schema using the recommended pattern'
        };
    }

    /**
     * יצירת fix לinconsistency
     */
    generateInconsistencyFix(schemaType, inconsistentIds) {
        return {
            type: 'fix_inconsistency',
            schemaType: schemaType,
            recommendedId: `schema:${schemaType}`,
            currentIds: inconsistentIds,
            instructions: `Replace all instances with single consistent @id: "schema:${schemaType}"`
        };
    }

    /**
     * יצירת fix לpattern לא תקני
     */
    generatePatternFix(currentId, schemaType) {
        return {
            type: 'fix_pattern',
            currentId: currentId,
            recommendedId: `schema:${schemaType}`,
            instructions: `Replace "${currentId}" with "schema:${schemaType}"`
        };
    }

    /**
     * חילוץ base URL
     */
    extractBaseUrl(schemas) {
        for (const schema of schemas) {
            if (schema._siteMapperInfo?.foundOnUrl) {
                try {
                    const url = new URL(schema._siteMapperInfo.foundOnUrl);
                    return url.origin;
                } catch (e) {
                    continue;
                }
            }
        }
        return 'https://example.com';
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
     * יצירת title מURL
     */
    generateTitleFromUrl(url) {
        if (!url || url === 'current-page') return 'Current Page';
        
        try {
            const urlObj = new URL(url);
            const pathSegments = urlObj.pathname.split('/').filter(Boolean);
            
            if (pathSegments.length === 0) return 'Home Page';
            
            const lastSegment = pathSegments[pathSegments.length - 1];
            return lastSegment
                .replace(/\.(html|php|asp|aspx)$/i, '')
                .replace(/[-_]/g, ' ')
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ') || 'Page';
        } catch (e) {
            return 'Unknown Page';
        }
    }

    /**
     * יצירת connection diagram data
     * מבוסס על generateConnectionDiagram מהקוד המקורי
     */
    generateConnectionDiagram() {
        const diagramData = {
            nodes: [],
            edges: [],
            clusters: new Map(),
            metadata: {
                totalPages: new Set(),
                crossPageConnections: 0,
                isolatedPages: 0
            }
        };

        // Extract unique pages and their @ids
        const pageNodes = new Map();
        const connections = [];

        this.idGroups.forEach((instances, schemaId) => {
            instances.forEach(instance => {
                const pageKey = instance.pageUrl;
                if (!pageNodes.has(pageKey)) {
                    pageNodes.set(pageKey, {
                        url: instance.pageUrl,
                        title: instance.pageTitle || this.generateTitleFromUrl(instance.pageUrl),
                        ids: new Set(),
                        consistency: 0
                    });
                }
                pageNodes.get(pageKey).ids.add(schemaId);
                diagramData.metadata.totalPages.add(pageKey);
            });

            // Create connections between pages that share the same @id
            for (let i = 0; i < instances.length; i++) {
                for (let j = i + 1; j < instances.length; j++) {
                    const connection = {
                        source: instances[i].pageUrl,
                        target: instances[j].pageUrl,
                        schemaId: schemaId,
                        consistent: this.isGoodPattern(schemaId)
                    };
                    connections.push(connection);
                    diagramData.metadata.crossPageConnections++;
                }
            }
        });

        // Calculate positions and consistency scores
        const nodes = Array.from(pageNodes.values());
        nodes.forEach((node, index) => {
            // Calculate consistency score for this page
            const goodIds = Array.from(node.ids).filter(id => this.isGoodPattern(id)).length;
            node.consistency = node.ids.size > 0 ? (goodIds / node.ids.size) : 0;
            
            // Add positioning data for visualization
            const angle = (index / nodes.length) * 2 * Math.PI;
            const radius = 300; // Base radius for circular layout
            node.x = 400 + radius * Math.cos(angle); // Center at 400,400
            node.y = 400 + radius * Math.sin(angle);
            
            diagramData.nodes.push({
                id: node.url,
                label: node.title,
                title: node.title,
                url: node.url,
                ids: Array.from(node.ids),
                consistency: node.consistency,
                x: node.x,
                y: node.y,
                size: Math.max(20, node.ids.size * 5), // Size based on @id count
                color: node.consistency >= 0.8 ? '#28a745' : 
                       node.consistency >= 0.5 ? '#ffc107' : '#dc3545'
            });
        });

        // Add edges
        connections.forEach(conn => {
            const sourceNode = nodes.find(n => n.url === conn.source);
            const targetNode = nodes.find(n => n.url === conn.target);
            
            if (sourceNode && targetNode) {
                diagramData.edges.push({
                    source: conn.source,
                    target: conn.target,
                    schemaId: conn.schemaId,
                    consistent: conn.consistent,
                    color: conn.consistent ? '#28a745' : '#ffc107',
                    width: conn.consistent ? 3 : 2
                });
            }
        });

        // Calculate isolated pages
        diagramData.metadata.isolatedPages = nodes.filter(node => 
            !connections.some(conn => 
                conn.source === node.url || conn.target === node.url
            )
        ).length;

        return diagramData;
    }

    /**
     * Generate detailed consistency report
     */
    generateDetailedReport() {
        return {
            summary: {
                totalSchemas: Array.from(this.idGroups.values())
                    .reduce((sum, instances) => sum + instances.length, 0),
                uniqueIds: this.idGroups.size,
                consistentTypes: this.typeGroups.size - this.inconsistentTypes.size,
                inconsistentTypes: this.inconsistentTypes.size,
                crossPageIds: Array.from(this.consistentIds.values())
                    .filter(count => count > 1).length,
                overallScore: this.bestPracticeScore
            },
            idAnalysis: {
                goodPatterns: Array.from(this.idGroups.keys())
                    .filter(id => this.isGoodPattern(id)),
                badPatterns: Array.from(this.idGroups.keys())
                    .filter(id => !this.isGoodPattern(id)),
                mostUsedIds: Array.from(this.consistentIds.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
            },
            typeAnalysis: {
                consistentTypes: Array.from(this.typeGroups.entries())
                    .filter(([type, ids]) => ids.size === 1),
                inconsistentTypes: Array.from(this.inconsistentTypes.entries())
            },
            recommendations: this.recommendations,
            scoreBreakdown: this.scoreBreakdown
        };
    }

    /**
     * Export consistency data for external use
     */
    exportConsistencyData() {
        return {
            idGroups: Object.fromEntries(
                Array.from(this.idGroups.entries()).map(([key, value]) => [key, value])
            ),
            typeGroups: Object.fromEntries(
                Array.from(this.typeGroups.entries()).map(([key, value]) => [key, Array.from(value)])
            ),
            consistentIds: Object.fromEntries(this.consistentIds),
            inconsistentTypes: Object.fromEntries(this.inconsistentTypes),
            bestPracticeScore: this.bestPracticeScore,
            recommendations: this.recommendations,
            scoreBreakdown: this.scoreBreakdown,
            scoreSummary: this.scoreSummary,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Reset analyzer state
     */
    reset() {
        this.idGroups.clear();
        this.typeGroups.clear();
        this.consistentIds.clear();
        this.inconsistentTypes.clear();
        this.bestPracticeScore = 0;
        this.scoreBreakdown = [];
        this.scoreSummary = {};
        this.recommendations = [];
    }
}

module.exports = ConsistencyAnalyzer;
