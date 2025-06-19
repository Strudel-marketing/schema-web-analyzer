// api/routes/api.js - Schema Web Analyzer API Routes
const express = require('express');
const router = express.Router();
const Joi = require('joi');
const fs = require('fs-extra');
const path = require('path');

// Import services
const WebCrawler = require('../services/crawler');
const SchemaAnalyzer = require('../services/schemaAnalyzer');
const EntityMapper = require('../services/entityMapper');
const ConsistencyAnalyzer = require('../services/consistencyAnalyzer');
const logger = require('../utils/logger');
const { generateId, sanitizeUrl } = require('../utils/helpers');
const config = require('../config');

// Validation schemas
const analyzeUrlSchema = Joi.object({
    url: Joi.string().uri().required(),
    options: Joi.object({
        deep_scan: Joi.boolean().default(true),
        include_recommendations: Joi.boolean().default(true),
        check_consistency: Joi.boolean().default(true),
        analyze_entities: Joi.boolean().default(true),
        timeout: Joi.number().min(5000).max(60000).default(30000)
    }).default({})
});

const scanSiteSchema = Joi.object({
    start_url: Joi.string().uri().required(),
    options: Joi.object({
        max_pages: Joi.number().min(1).max(config.CRAWLING.MAX_PAGES_PER_SCAN).default(25),
        include_sitemaps: Joi.boolean().default(true),
        crawl_depth: Joi.number().min(1).max(config.CRAWLING.MAX_DEPTH).default(3),
        follow_external: Joi.boolean().default(false),
        crawl_delay: Joi.number().min(500).max(5000).default(config.CRAWLING.CRAWL_DELAY)
    }).default({})
});

// In-memory storage for active scans
const activeScans = new Map();
const scanResults = new Map();

/**
 * POST /api/analyze - Analyze single URL
 */
router.post('/analyze', async (req, res) => {
    try {
        // Validate request
        const { error, value } = analyzeUrlSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                error: 'Validation failed',
                details: error.details.map(d => d.message)
            });
        }

        const { url, options } = value;
        const scanId = generateId();
        
        logger.info(`Starting single URL analysis: ${url}`, { scanId });

        // Security check
        if (config.SECURITY.BLOCKED_DOMAINS.some(domain => url.includes(domain))) {
            return res.status(403).json({
                error: 'Domain not allowed',
                message: 'This domain is not permitted for analysis'
            });
        }

        // Initialize services
        const crawler = new WebCrawler();
        const analyzer = new SchemaAnalyzer();
        
        try {
            // Step 1: Crawl the page
            const crawlResult = await crawler.analyzePage(url, options);
            
            if (!crawlResult.result || !crawlResult.result.schemas) {
                return res.status(422).json({
                    error: 'No schemas found',
                    message: 'The specified URL does not contain any structured data'
                });
            }

            // Step 2: Analyze schemas
            const analysisResult = await analyzer.analyzeSchemas(
                crawlResult.result.schemas,
                {
                    url: crawlResult.url,
                    title: crawlResult.result.title,
                    description: crawlResult.result.description
                }
            );

            // Step 3: Entity analysis (if requested)
            let entityAnalysis = null;
            if (options.analyze_entities) {
                const entityMapper = new EntityMapper();
                entityAnalysis = await entityMapper.analyzeEntities(crawlResult.result.schemas);
            }

            // Step 4: Consistency analysis (if requested)
            let consistencyAnalysis = null;
            if (options.check_consistency) {
                const consistencyAnalyzer = new ConsistencyAnalyzer();
                consistencyAnalysis = await consistencyAnalyzer.analyzeConsistency([crawlResult]);
            }

            // Build final result
            const result = {
                scan_id: scanId,
                timestamp: new Date().toISOString(),
                url: crawlResult.url,
                status: 'completed',
                results: {
                    basic_info: {
                        page_title: crawlResult.result.title,
                        schemas_found: crawlResult.result.schemas.length,
                        load_time: crawlResult.result.loadTime || 0,
                        has_structured_data: crawlResult.result.hasStructuredData
                    },
                    seo_score: analysisResult.results.seoScore,
                    schemas: analysisResult.results.ranking,
                    entities: entityAnalysis,
                    recommendations: analysisResult.results.recommendations,
                    consistency_analysis: consistencyAnalysis
                }
            };

            // Store result
            await saveAnalysisResult(scanId, result);
            
            // Cleanup
            await crawler.closeBrowser();
            
            logger.info(`Single URL analysis completed: ${url}`, { 
                scanId, 
                schemasFound: crawlResult.result.schemas.length 
            });

            res.json(result);

        } catch (analysisError) {
            await crawler.closeBrowser();
            throw analysisError;
        }

    } catch (error) {
        logger.error('Single URL analysis failed:', error);
        
        res.status(500).json({
            error: 'Analysis failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * POST /api/scan-site - Start site-wide scan
 */
router.post('/scan-site', async (req, res) => {
    try {
        // Validate request
        const { error, value } = scanSiteSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                error: 'Validation failed',
                details: error.details.map(d => d.message)
            });
        }

        const { start_url, options } = value;
        const scanId = generateId();
        
        logger.info(`Starting site scan: ${start_url}`, { scanId, options });

        // Security check
        if (config.SECURITY.BLOCKED_DOMAINS.some(domain => start_url.includes(domain))) {
            return res.status(403).json({
                error: 'Domain not allowed',
                message: 'This domain is not permitted for scanning'
            });
        }

        // Initialize crawler
        const crawler = new WebCrawler();
        
        // Store active scan
        activeScans.set(scanId, {
            scanId,
            startUrl: start_url,
            status: 'processing',
            startTime: new Date().toISOString(),
            crawler,
            options
        });

        // Start scanning in background
        setImmediate(async () => {
            try {
                const result = await crawler.analyzeSite(start_url, options);
                
                // Analyze all schemas
                const analyzer = new SchemaAnalyzer();
                const allSchemas = result.schemas || [];
                
                if (allSchemas.length > 0) {
                    const analysisResult = await analyzer.analyzeSchemas(allSchemas, {
                        url: start_url,
                        title: `Site Analysis - ${new URL(start_url).hostname}`,
                        description: `Site-wide schema analysis`
                    });
                    
                    // Entity analysis
                    const entityMapper = new EntityMapper();
                    const entityAnalysis = await entityMapper.analyzeEntities(allSchemas);
                    
                    // Cross-page consistency analysis
                    const consistencyAnalyzer = new ConsistencyAnalyzer();
                    const consistencyAnalysis = await consistencyAnalyzer.analyzeConsistency(result.pages);
                    
                    // Build comprehensive result
                    const finalResult = {
                        ...result,
                        scan_id: scanId,
                        status: 'completed',
                        site_analysis: {
                            schema_distribution: result.summary.schemaDistribution,
                            entity_ecosystem: entityAnalysis,
                            cross_page_consistency: consistencyAnalysis,
                            seo_score: analysisResult.results.seoScore,
                            site_recommendations: analysisResult.results.recommendations
                        }
                    };
                    
                    // Store result
                    scanResults.set(scanId, finalResult);
                    await saveAnalysisResult(scanId, finalResult);
                }
                
                // Update scan status
                const scanInfo = activeScans.get(scanId);
                if (scanInfo) {
                    scanInfo.status = 'completed';
                    scanInfo.completedAt = new Date().toISOString();
                }
                
                await crawler.closeBrowser();
                logger.info(`Site scan completed: ${start_url}`, { scanId });
                
            } catch (scanError) {
                logger.error(`Site scan failed: ${start_url}`, { scanId, error: scanError.message });
                
                const scanInfo = activeScans.get(scanId);
                if (scanInfo) {
                    scanInfo.status = 'failed';
                    scanInfo.error = scanError.message;
                    scanInfo.failedAt = new Date().toISOString();
                }
                
                await crawler.closeBrowser();
            }
        });

        // Return immediate response
        res.json({
            scan_id: scanId,
            status: 'processing',
            message: 'Site scan started. Use /api/results/{scan_id} to check progress.',
            progress_url: `/api/progress/${scanId}`,
            results_url: `/api/results/${scanId}`
        });

    } catch (error) {
        logger.error('Failed to start site scan:', error);
        
        res.status(500).json({
            error: 'Scan initialization failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/progress/{scan_id} - Get scan progress
 */
router.get('/progress/:scanId', (req, res) => {
    const { scanId } = req.params;
    
    const scanInfo = activeScans.get(scanId);
    if (!scanInfo) {
        return res.status(404).json({
            error: 'Scan not found',
            scan_id: scanId
        });
    }
    
    const progress = scanInfo.crawler ? scanInfo.crawler.getProgress() : {
        total: 0,
        completed: 0,
        progress: 0,
        isScanning: false
    };
    
    res.json({
        scan_id: scanId,
        status: scanInfo.status,
        start_time: scanInfo.startTime,
        progress: {
            ...progress,
            eta_minutes: progress.isScanning && progress.total > progress.completed ? 
                Math.ceil((progress.total - progress.completed) * (scanInfo.options.crawl_delay / 1000) / 60) : 0
        }
    });
});

/**
 * GET /api/results/{scan_id} - Get scan results
 */
router.get('/results/:scanId', async (req, res) => {
    try {
        const { scanId } = req.params;
        
        // Check in memory first
        let result = scanResults.get(scanId);
        
        // Check file storage
        if (!result) {
            const resultPath = path.join(__dirname, '../../data/scans', `${scanId}.json`);
            if (await fs.pathExists(resultPath)) {
