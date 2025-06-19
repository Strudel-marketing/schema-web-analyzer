// insights-generator.js - Advanced Schema Insights Generator
// מייצר תובנות מתקדמות מבוססות על כל המידע שנאסף

/**
 * InsightsGenerator - מנוע יצירת תובנות מתקדמות
 * משלב נתונים מכל המקורות ליצירת המלצות חכמות
 */
class InsightsGenerator {
    constructor() {
        this.insights = [];
        this.patterns = new Map();
        this.opportunities = [];
        this.priorities = [];
        
        // Templates for schema improvements מבוסס על הקוד המקורי
        this.schemaTemplates = {
            Organization: {
                required: ['@type', '@id', 'name', 'url'],
                recommended: ['logo', 'description', 'contactPoint', 'address', 'sameAs'],
                context: 'https://schema.org',
                bestLocation: 'about page or footer',
                seoImpact: 'high'
            },
            Person: {
                required: ['@type', '@id', 'name'],
                recommended: ['jobTitle', 'worksFor', 'url', 'sameAs', 'image'],
                context: 'https://schema.org',
                bestLocation: 'author bio or team page',
                seoImpact: 'medium'
            },
            Product: {
                required: ['@type', '@id', 'name', 'description'],
                recommended: ['image', 'offers', 'brand', 'review', 'aggregateRating'],
                context: 'https://schema.org',
                bestLocation: 'product pages',
                seoImpact: 'very high'
            },
            WebPage: {
                required: ['@type', '@id', 'name', 'url'],
                recommended: ['description', 'datePublished', 'dateModified', 'breadcrumb'],
                context: 'https://schema.org',
                bestLocation: 'every page',
                seoImpact: 'high'
            },
            Article: {
                required: ['@type', '@id', 'headline', 'author', 'datePublished'],
                recommended: ['image', 'publisher', 'dateModified', 'wordCount', 'articleSection'],
                context: 'https://schema.org',
                bestLocation: 'blog posts and articles',
                seoImpact: 'very high'
            },
            BreadcrumbList: {
                required: ['@type', '@id', 'itemListElement'],
                recommended: ['numberOfItems'],
                context: 'https://schema.org',
                bestLocation: 'all pages except homepage',
                seoImpact: 'high'
            },
            LocalBusiness: {
                required: ['@type', '@id', 'name', 'address', 'telephone'],
                recommended: ['openingHours', 'geo', 'priceRange', 'image', 'review'],
                context: 'https://schema.org',
                bestLocation: 'business pages',
                seoImpact: 'very high'
            }
        };

        // SEO impact scoring
        this.seoWeights = {
            'very high': 10,
            'high': 7,
            'medium': 5,
            'low': 3,
            'minimal': 1
        };

        // Content quality indicators
        this.qualityIndicators = {
            completeness: 0.3,    // How complete are the schemas
            consistency: 0.25,    // @id consistency across pages  
            connectivity: 0.2,    // Entity relationships
            coverage: 0.15,       // Schema type coverage
            technical: 0.1        // Technical correctness
        };
    }

    /**
     * יצירת תובנות מתקדמות על בסיס כל הניתוחים
     */
    async generateInsights(analysisData) {
        console.log('🧠 Generating advanced schema insights...');
        
        const insights = {
            overview: this.generateOverview(analysisData),
            seoImpact: this.calculateSEOImpact(analysisData),
            contentQuality: this.assessContentQuality(analysisData),
            technicalHealth: this.assessTechnicalHealth(analysisData),
            opportunities: this.identifyOpportunities(analysisData),
            recommendations: this.generatePrioritizedRecommendations(analysisData),
            competitiveAnalysis: this.generateCompetitiveInsights(analysisData),
            actionPlan: this.createActionPlan(analysisData),
            monitoring: this.generateMonitoringPlan(analysisData)
        };

        console.log('✅ Advanced insights generation complete');
        return insights;
    }

    /**
     * יצירת סקירה כללית
     */
    generateOverview(data) {
        const totalSchemas = data.schemas?.length || 0;
        const uniqueTypes = new Set(
            data.schemas?.map(s => s['@type']).filter(Boolean) || []
        ).size;
        
        const maturityLevel = this.calculateMaturityLevel(data);
        const overallScore = this.calculateOverallScore(data);
        
        return {
            totalSchemas,
            uniqueTypes,
            maturityLevel,
            overallScore,
            status: this.determineStatus(overallScore),
            keyStrengths: this.identifyKeyStrengths(data),
            criticalIssues: this.identifyCriticalIssues(data),
            summary: this.generateExecutiveSummary(data, overallScore)
        };
    }

    /**
     * חישוב השפעה על SEO
     */
    calculateSEOImpact(data) {
        const seoAnalysis = {
            currentImpact: 0,
            potentialImpact: 0,
            gapAnalysis: {},
            richSnippetsOpportunities: [],
            searchVisibilityScore: 0
        };

        // חישוב השפעה נוכחית
        if (data.schemas) {
            data.schemas.forEach(schema => {
                const type = schema['@type'];
                const template = this.schemaTemplates[type];
                if (template) {
                    const completeness = this.calculateSchemaCompleteness(schema, template);
                    seoAnalysis.currentImpact += 
                        this.seoWeights[template.seoImpact] * completeness;
                }
            });
        }

        // זיהוי הזדמנויות rich snippets
        seoAnalysis.richSnippetsOpportunities = this.identifyRichSnippetOpportunities(data);
        
        // חישוב פוטנציאל
        seoAnalysis.potentialImpact = this.calculateSEOPotential(data);
        
        // gap analysis
        seoAnalysis.gapAnalysis = this.performSEOGapAnalysis(data);
        
        // search visibility score
        seoAnalysis.searchVisibilityScore = this.calculateSearchVisibilityScore(data);

        return seoAnalysis;
    }

    /**
     * הערכת איכות התוכן
     */
    assessContentQuality(data) {
        const quality = {
            overallScore: 0,
            breakdown: {},
            strengths: [],
            weaknesses: [],
            recommendations: []
        };

        // Completeness score
        quality.breakdown.completeness = this.calculateCompletenessScore(data);
        
        // Consistency score  
        quality.breakdown.consistency = data.consistencyAnalysis?.bestPracticeScore || 0;
        
        // Connectivity score
        quality.breakdown.connectivity = this.calculateConnectivityScore(data);
        
        // Coverage score
        quality.breakdown.coverage = this.calculateCoverageScore(data);
        
        // Technical score
        quality.breakdown.technical = this.calculateTechnicalScore(data);

        // חישוב ציון כולל
        quality.overallScore = Object.entries(quality.breakdown)
            .reduce((score, [category, value]) => {
                const weight = this.qualityIndicators[category] || 0;
                return score + (value * weight);
            }, 0);

        // זיהוי חוזקות וחולשות
        quality.strengths = this.identifyContentStrengths(quality.breakdown);
        quality.weaknesses = this.identifyContentWeaknesses(quality.breakdown);
        quality.recommendations = this.generateContentRecommendations(quality.breakdown);

        return quality;
    }

    /**
     * הערכת בריאות טכנית
     */
    assessTechnicalHealth(data) {
        const health = {
            overallHealth: 'good',
            validationErrors: [],
            structuralIssues: [],
            performanceImpact: {},
            complianceScore: 0
        };

        // בדיקות validation
        health.validationErrors = this.findValidationErrors(data);
        
        // בדיקות מבניות
        health.structuralIssues = this.findStructuralIssues(data);
        
        // השפעה על ביצועים
        health.performanceImpact = this.assessPerformanceImpact(data);
        
        // ציון compliance
        health.complianceScore = this.calculateComplianceScore(data);
        
        // קביעת מצב כללי
        health.overallHealth = this.determineHealthStatus(health);

        return health;
    }

    /**
     * זיהוי הזדמנויות שיפור
     */
    identifyOpportunities(data) {
        const opportunities = [];

        // הזדמנויות לschemas חדשים
        const missingSchemas = this.identifyMissingSchemas(data);
        missingSchemas.forEach(schema => {
            opportunities.push({
                type: 'missing_schema',
                schemaType: schema.type,
                impact: schema.impact,
                effort: schema.effort,
                description: schema.description,
                implementation: schema.implementation,
                roi: this.calculateROI(schema.impact, schema.effort)
            });
        });

        // הזדמנויות לשיפור schemas קיימים
        const improvementOpps = this.identifyImprovementOpportunities(data);
        opportunities.push(...improvementOpps);

        // הזדמנויות לrich snippets
        const richSnippetOpps = this.identifyRichSnippetOpportunities(data);
        opportunities.push(...richSnippetOpps);

        // הזדמנויות לconnectivity
        const connectivityOpps = this.identifyConnectivityOpportunities(data);
        opportunities.push(...connectivityOpps);

        // מיון לפי ROI
        return opportunities.sort((a, b) => (b.roi || 0) - (a.roi || 0));
    }

    /**
     * יצירת המלצות מסודרות לפי עדיפות
     */
    generatePrioritizedRecommendations(data) {
        const recommendations = [];

        // המלצות קריטיות
        const criticalRecs = this.generateCriticalRecommendations(data);
        recommendations.push(...criticalRecs);

        // המלצות השפעה גבוהה
        const highImpactRecs = this.generateHighImpactRecommendations(data);
        recommendations.push(...highImpactRecs);

        // המלצות מהירות (quick wins)
        const quickWins = this.generateQuickWins(data);
        recommendations.push(...quickWins);

        // המלצות ארוכות טווח
        const longTermRecs = this.generateLongTermRecommendations(data);
        recommendations.push(...longTermRecs);

        return this.prioritizeRecommendations(recommendations);
    }

    /**
     * יצירת תובנות תחרותיות
     */
    generateCompetitiveInsights(data) {
        return {
            industryBenchmarks: this.generateIndustryBenchmarks(data),
            competitiveAdvantages: this.identifyCompetitiveAdvantages(data),
            competitiveGaps: this.identifyCompetitiveGaps(data),
            marketOpportunities: this.identifyMarketOpportunities(data),
            differentiationStrategies: this.generateDifferentiationStrategies(data)
        };
    }

    /**
     * יצירת תוכנית פעולה
     */
    createActionPlan(data) {
        const actionPlan = {
            immediate: [],      // 0-2 weeks
            shortTerm: [],      // 2-8 weeks  
            mediumTerm: [],     // 2-6 months
            longTerm: []        // 6+ months
        };

        const allRecommendations = this.generatePrioritizedRecommendations(data);
        
        allRecommendations.forEach(rec => {
            const timeframe = this.determineTimeframe(rec);
            const action = {
                title: rec.title,
                description: rec.description,
                impact: rec.impact,
                effort: rec.effort,
                roi: rec.roi,
                steps: rec.steps || [],
                resources: rec.resources || [],
                timeline: rec.timeline || timeframe,
                dependencies: rec.dependencies || [],
                successMetrics: rec.successMetrics || []
            };
            
            actionPlan[timeframe].push(action);
        });

        return actionPlan;
    }

    /**
     * יצירת תוכנית מעקב
     */
    generateMonitoringPlan(data) {
        return {
            kpis: this.defineKPIs(data),
            monitoring: {
                frequency: 'monthly',
                tools: ['Google Search Console', 'Schema Testing Tool', 'Rich Results Test'],
                alerts: this.generateAlerts(data)
            },
            reporting: {
                dashboards: this.defineDashboards(data),
                reports: this.defineReports(data)
            },
            optimization: {
                tests: this.generateOptimizationTests(data),
                experiments: this.generateExperiments(data)
            }
        };
    }

    // Helper Methods

    calculateMaturityLevel(data) {
        const scores = [
            data.consistencyAnalysis?.bestPracticeScore || 0,
            this.calculateCompletenessScore(data),
            this.calculateConnectivityScore(data),
            this.calculateCoverageScore(data)
        ];
        
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        
        if (avgScore >= 90) return 'advanced';
        if (avgScore >= 70) return 'intermediate';
        if (avgScore >= 50) return 'basic';
        return 'beginner';
    }

    calculateOverallScore(data) {
        const weights = {
            consistency: 0.3,
            completeness: 0.25,
            connectivity: 0.2,
            coverage: 0.15,
            technical: 0.1
        };

        const scores = {
            consistency: data.consistencyAnalysis?.bestPracticeScore || 0,
            completeness: this.calculateCompletenessScore(data),
            connectivity: this.calculateConnectivityScore(data),
            coverage: this.calculateCoverageScore(data),
            technical: this.calculateTechnicalScore(data)
        };

        return Object.entries(weights).reduce((total, [category, weight]) => {
            return total + (scores[category] * weight);
        }, 0);
    }

    determineStatus(score) {
        if (score >= 90) return { level: 'excellent', color: 'green', message: 'Outstanding schema implementation' };
        if (score >= 80) return { level: 'very good', color: 'lightgreen', message: 'Strong schema foundation with minor improvements needed' };
        if (score >= 70) return { level: 'good', color: 'yellow', message: 'Good progress with several optimization opportunities' };
        if (score >= 60) return { level: 'fair', color: 'orange', message: 'Basic implementation with significant room for improvement' };
        return { level: 'needs improvement', color: 'red', message: 'Immediate attention required for schema optimization' };
    }

    identifyKeyStrengths(data) {
        const strengths = [];
        
        // בדיקת עקביות @id
        if (data.consistencyAnalysis?.bestPracticeScore >= 80) {
            strengths.push({
                area: '@id Consistency',
                score: data.consistencyAnalysis.bestPracticeScore,
                description: 'Excellent consistency in @id usage across pages'
            });
        }

        // בדיקת קשרים בין entities
        const connectivityScore = this.calculateConnectivityScore(data);
        if (connectivityScore >= 75) {
            strengths.push({
                area: 'Entity Relationships',
                score: connectivityScore,
                description: 'Strong connections between schema entities'
            });
        }

        // בדיקת כיסוי schemas
        const coverageScore = this.calculateCoverageScore(data);
        if (coverageScore >= 70) {
            strengths.push({
                area: 'Schema Coverage',
                score: coverageScore,
                description: 'Good variety of schema types implemented'
            });
        }

        return strengths;
    }

    identifyCriticalIssues(data) {
        const issues = [];

        // בעיות עקביות
        if (data.consistencyAnalysis?.bestPracticeScore < 50) {
            issues.push({
                type: 'consistency',
                severity: 'critical',
                description: 'Poor @id consistency across pages',
                impact: 'Reduces schema effectiveness and entity relationships'
            });
        }

        // entities מבודדים
        if (data.entityAnalysis?.orphanedEntities > 0) {
            issues.push({
                type: 'connectivity',
                severity: 'high',
                description: `${data.entityAnalysis.orphanedEntities} orphaned entities found`,
                impact: 'Missed opportunities for entity relationships'
            });
        }

        // references שבורים
        if (data.entityAnalysis?.brokenConnections > 0) {
            issues.push({
                type: 'validation',
                severity: 'critical',
                description: `${data.entityAnalysis.brokenConnections} broken entity references`,
                impact: 'Invalid schema markup that may be ignored by search engines'
            });
        }

        return issues;
    }

    generateExecutiveSummary(data, overallScore) {
        const maturityLevel = this.calculateMaturityLevel(data);
        const totalSchemas = data.schemas?.length || 0;
        const keyIssues = this.identifyCriticalIssues(data).length;
        
        let summary = `Your website has ${totalSchemas} schema implementations with an overall score of ${Math.round(overallScore)}/100, indicating ${maturityLevel} level schema maturity.`;
        
        if (keyIssues > 0) {
            summary += ` There are ${keyIssues} critical issues that need immediate attention.`;
        } else {
            summary += ` The implementation shows strong technical foundation.`;
        }

        if (overallScore >= 80) {
            summary += ` Focus on fine-tuning and advanced optimization opportunities.`;
        } else if (overallScore >= 60) {
            summary += ` Priority should be on addressing consistency and completeness gaps.`;
        } else {
            summary += ` Fundamental improvements in schema structure and implementation are needed.`;
        }

        return summary;
    }

    calculateCompletenessScore(data) {
        if (!data.schemas || data.schemas.length === 0) return 0;

        let totalCompleteness = 0;
        let schemaCount = 0;

        data.schemas.forEach(schema => {
            const type = schema['@type'];
            const template = this.schemaTemplates[type];
            if (template) {
                const completeness = this.calculateSchemaCompleteness(schema, template);
                totalCompleteness += completeness;
                schemaCount++;
            }
        });

        return schemaCount > 0 ? (totalCompleteness / schemaCount) * 100 : 0;
    }

    calculateSchemaCompleteness(schema, template) {
        const requiredFields = template.required || [];
        const recommendedFields = template.recommended || [];
        const allFields = [...requiredFields, ...recommendedFields];

        let presentFields = 0;
        let requiredPresent = 0;

        allFields.forEach(field => {
            if (schema[field] !== undefined && schema[field] !== null && schema[field] !== '') {
                presentFields++;
                if (requiredFields.includes(field)) {
                    requiredPresent++;
                }
            }
        });

        // חישוב ציון: 70% לשדות נדרשים, 30% לשדות מומלצים
        const requiredScore = requiredFields.length > 0 ? (requiredPresent / requiredFields.length) * 0.7 : 0.7;
        const recommendedScore = recommendedFields.length > 0 ? 
            ((presentFields - requiredPresent) / recommendedFields.length) * 0.3 : 0.3;

        return Math.min(1, requiredScore + recommendedScore);
    }

    calculateConnectivityScore(data) {
        if (!data.entityAnalysis) return 0;

        const totalEntities = data.entityAnalysis.totalEntities || 0;
        const validConnections = data.entityAnalysis.validConnections || 0;
        const orphanedEntities = data.entityAnalysis.orphanedEntities || 0;
        const crossPageConnections = data.entityAnalysis.crossPageConnections || 0;

        if (totalEntities === 0) return 0;

        // ציון בסיסי: אחוז entities עם קשרים
        const connectedEntities = totalEntities - orphanedEntities;
        let baseScore = (connectedEntities / totalEntities) * 60;

        // בונוס לקשרים cross-page
        const crossPageBonus = Math.min(30, (crossPageConnections / totalEntities) * 100);

        // בונוס לצפיפות קשרים
        const densityBonus = Math.min(10, (validConnections / totalEntities) * 20);

        return Math.min(100, baseScore + crossPageBonus + densityBonus);
    }

    calculateCoverageScore(data) {
        if (!data.schemas || data.schemas.length === 0) return 0;

        const implementedTypes = new Set(
            data.schemas.map(s => s['@type']).filter(Boolean)
        );

        // סוגי schemas בסיסיים שרצוי שיהיו
        const essentialTypes = ['WebPage', 'Organization', 'WebSite'];
        const importantTypes = ['Person', 'Article', 'Product', 'BreadcrumbList'];
        const niceToHaveTypes = ['Event', 'LocalBusiness', 'Review', 'FAQPage'];

        let score = 0;

        // 40 נקודות לtypes חיוניים
        essentialTypes.forEach(type => {
            if (implementedTypes.has(type)) score += 40 / essentialTypes.length;
        });

        // 35 נקודות לtypes חשובים
        importantTypes.forEach(type => {
            if (implementedTypes.has(type)) score += 35 / importantTypes.length;
        });

        // 25 נקודות לtypes נוספים
        niceToHaveTypes.forEach(type => {
            if (implementedTypes.has(type)) score += 25 / niceToHaveTypes.length;
        });

        return Math.min(100, score);
    }

    calculateTechnicalScore(data) {
        let score = 100;

        // קנסות על בעיות טכניות
        const brokenRefs = data.entityAnalysis?.brokenConnections || 0;
        const orphanedEntities = data.entityAnalysis?.orphanedEntities || 0;
        const inconsistentTypes = data.consistencyAnalysis?.inconsistentTypes?.size || 0;

        score -= brokenRefs * 5;      // 5 נקודות לכל reference שבור
        score -= orphanedEntities * 2; // 2 נקודות לכל entity מבודד
        score -= inconsistentTypes * 3; // 3 נקודות לכל type לא עקבי

        return Math.max(0, score);
    }

    identifyMissingSchemas(data) {
        const implementedTypes = new Set(
            data.schemas?.map(s => s['@type']).filter(Boolean) || []
        );

        const missingSchemas = [];

        // בדיקת schemas חיוניים
        Object.entries(this.schemaTemplates).forEach(([type, template]) => {
            if (!implementedTypes.has(type)) {
                missingSchemas.push({
                    type,
                    impact: this.seoWeights[template.seoImpact],
                    effort: this.estimateImplementationEffort(type),
                    description: `Add ${type} schema to improve ${template.bestLocation}`,
                    implementation: template,
                    roi: this.calculateROI(this.seoWeights[template.seoImpact], this.estimateImplementationEffort(type))
                });
            }
        });

        return missingSchemas;
    }

    estimateImplementationEffort(schemaType) {
        const effortMap = {
            'WebPage': 2,
            'Organization': 3,
            'Person': 2,
            'BreadcrumbList': 4,
            'Article': 3,
            'Product': 5,
            'LocalBusiness': 4,
            'Event': 4,
            'Review': 3
        };

        return effortMap[schemaType] || 3;
    }

    calculateROI(impact, effort) {
        return effort > 0 ? Math.round((impact / effort) * 10) / 10 : 0;
    }

    identifyRichSnippetOpportunities(data) {
        const opportunities = [];

        // Product rich snippets
        if (data.schemas?.some(s => s['@type'] === 'Product')) {
            opportunities.push({
                type: 'rich_snippet',
                snippetType: 'Product',
                impact: 9,
                description: 'Enhance product schemas for rich snippet display',
                requirements: ['offers', 'review', 'aggregateRating']
            });
        }

        // Article rich snippets
        if (data.schemas?.some(s => s['@type'] === 'Article')) {
            opportunities.push({
                type: 'rich_snippet',
                snippetType: 'Article',
                impact: 8,
                description: 'Optimize article schemas for enhanced search display',
                requirements: ['headline', 'image', 'author', 'datePublished']
            });
        }

        // FAQ rich snippets
        const hasQA = data.schemas?.some(s => 
            s['@type'] === 'FAQPage' || s['@type'] === 'Question'
        );
        if (!hasQA) {
            opportunities.push({
                type: 'rich_snippet',
                snippetType: 'FAQ',
                impact: 7,
                description: 'Add FAQ schema for question-based rich snippets',
                requirements: ['mainEntity', 'Question', 'Answer']
            });
        }

        return opportunities;
    }

    // המשך methods נוספים...
    determineTimeframe(recommendation) {
        const effort = recommendation.effort || 3;
        const complexity = recommendation.complexity || 'medium';
        
        if (effort <= 2 && complexity === 'low') return 'immediate';
        if (effort <= 4 && complexity !== 'high') return 'shortTerm';
        if (effort <= 6) return 'mediumTerm';
        return 'longTerm';
    }

    defineKPIs(data) {
        return [
            {
                name: 'Schema Consistency Score',
                current: data.consistencyAnalysis?.bestPracticeScore || 0,
                target: Math.min(100, (data.consistencyAnalysis?.bestPracticeScore || 0) + 20),
                measurement: 'Monthly automated analysis'
            },
            {
                name: 'Entity Connectivity Rate',
                current: this.calculateConnectivityScore(data),
                target: 85,
                measurement: 'Cross-page entity relationships'
            },
            {
                name: 'Rich Snippet Coverage',
                current: this.calculateRichSnippetCoverage(data),
                target: 90,
                measurement: 'Percentage of eligible pages with rich snippet schemas'
            },
            {
                name: 'Schema Completeness',
                current: this.calculateCompletenessScore(data),
                target: 85,
                measurement: 'Average completeness across all schemas'
            }
        ];
    }

    calculateRichSnippetCoverage(data) {
        // חישוב כיסוי rich snippets
        if (!data.schemas || data.schemas.length === 0) return 0;
        
        const richSnippetTypes = ['Product', 'Article', 'Recipe', 'Event', 'Review', 'FAQ'];
        const implementedRichTypes = data.schemas.filter(s => 
            richSnippetTypes.includes(s['@type'])
        ).length;
        
        return Math.round((implementedRichTypes / data.schemas.length) * 100);
    }
}

module.exports = InsightsGenerator;
