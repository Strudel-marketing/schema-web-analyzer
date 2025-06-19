// api/services/crawler.js - Advanced Web Crawler for Schema Analysis
// Based on site-schema-mapper.js and content.js from Chrome extension

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');
const { URL } = require('url');
const config = require('../config');
const logger = require('../utils/logger');
const { delay, sanitizeUrl, generateId } = require('../utils/helpers');

class WebCrawler {
    constructor() {
        this.browser = null;
        this.discoveredPages = new Map();
        this.scannedUrls = new Set();
        this.failedUrls = new Set();
        this.scanQueue = [];
        this.isScanning = false;
        this.maxPages = config.CRAWLING.MAX_PAGES_PER_SCAN;
        this.crawlDelay = config.CRAWLING.CRAWL_DELAY;
        this.maxConcurrent = config.CRAWLING.MAX_CONCURRENT_PAGES;
    }

    /**
     * Initialize browser instance
     */
    async initBrowser() {
        if (this.browser) return this.browser;
        
        try {
            this.browser = await puppeteer.launch({
                headless: config.PUPPETEER.HEADLESS,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            });
            
            logger.info('Browser initialized successfully');
            return this.browser;
            
        } catch (error) {
            logger.error('Failed to initialize browser:', error);
            throw new Error(`Browser initialization failed: ${error.message}`);
        }
    }

    /**
     * Close browser instance
     */
    async closeBrowser() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            logger.info('Browser closed');
        }
    }

    /**
     * Analyze single page
     */
    async analyzePage(url, options = {}) {
        logger.info(`Analyzing single page: ${url}`);
        
        try {
            const sanitizedUrl = sanitizeUrl(url);
            if (!sanitizedUrl) {
                throw new Error('Invalid URL provided');
            }

            await this.initBrowser();
            const result = await this.scanPage(sanitizedUrl, options);
            
            return {
                url: sanitizedUrl,
                timestamp: new Date().toISOString(),
                type: 'single_page',
                result
            };
            
        } catch (error) {
            logger.error(`Failed to analyze page ${url}:`, error);
            throw error;
        }
    }

    /**
     * Analyze entire site
     */
    async analyzeSite(startUrl, options = {}) {
        logger.info(`Starting site analysis: ${startUrl}`);
        
        try {
            this.reset();
            this.maxPages = options.maxPages || config.CRAWLING.MAX_PAGES_PER_SCAN;
            this.crawlDelay = options.crawlDelay || config.CRAWLING.CRAWL_DELAY;
            
            const sanitizedUrl = sanitizeUrl(startUrl);
            if (!sanitizedUrl) {
                throw new Error('Invalid start URL provided');
            }

            const baseUrl = new URL(sanitizedUrl).origin;
            this.isScanning = true;
            
            await this.initBrowser();
            
            // Discovery phase
            await this.discoverUrls(sanitizedUrl, baseUrl, options);
            
            // Scanning phase
            await this.processScanQueue(baseUrl, options);
            
            // Build final results
            const results = await this.buildSiteResults(baseUrl);
            
            this.isScanning = false;
            logger.info(`Site analysis completed: ${results.totalPages} pages, ${results.totalSchemas} schemas`);
            
            return results;
            
        } catch (error) {
            this.isScanning = false;
            logger.error(`Site analysis failed for ${startUrl}:`, error);
            throw error;
        }
    }

    /**
     * Discover URLs using multiple methods
     */
    async discoverUrls(startUrl, baseUrl, options = {}) {
        logger.info('Starting URL discovery');
        
        // Add start URL to queue
        this.scanQueue.push(startUrl);
        
        // Method 1: Scan start page for links
        await this.discoverFromPage(startUrl, baseUrl);
        
        // Method 2: Try sitemap.xml
        if (options.includeSitemaps !== false) {
            await this.discoverFromSitemap(baseUrl);
        }
        
        // Method 3: Check robots.txt
        await this.discoverFromRobots(baseUrl);
        
        // Method 4: Add common page patterns
        if (options.includeCommonPages !== false) {
            this.discoverCommonPages(baseUrl);
        }
        
        logger.info(`Discovery complete: ${this.scanQueue.length} URLs queued`);
    }

    /**
     * Discover URLs from a specific page
     */
    async discoverFromPage(url, baseUrl) {
        try {
            logger.info(`Discovering URLs from: ${url}`);
            
            const page = await this.browser.newPage();
            await page.setUserAgent(config.PUPPETEER.USER_AGENT);
            await page.setViewport(config.PUPPETEER.VIEWPORT);
            
            // Set timeout and error handling
            page.setDefaultTimeout(config.PUPPETEER.TIMEOUT);
            
            await page.goto(url, { 
                waitUntil: 'networkidle2',
                timeout: config.PUPPETEER.TIMEOUT 
            });
            
            // Extract links using page evaluation
            const links = await page.evaluate((baseUrl) => {
                const links = [];
                const linkElements = document.querySelectorAll('a[href], area[href]');
                
                linkElements.forEach(element => {
                    try {
                        const href = element.getAttribute('href');
                        if (!href) return;
                        
                        const absoluteUrl = new URL(href, window.location.href).href;
                        const linkUrl = new URL(absoluteUrl);
                        
                        // Only same-domain links
                        if (linkUrl.origin === baseUrl) {
                            linkUrl.hash = '';
                            linkUrl.search = '';
                            const cleanUrl = linkUrl.href;
                            
                            if (!this.shouldSkipUrl(cleanUrl)) {
                                links.push(cleanUrl);
                            }
                        }
                    } catch (e) {
                        // Skip invalid URLs
                    }
                });
                
                return [...new Set(links)]; // Remove duplicates
            }, baseUrl);
            
            // Add discovered links to queue
            links.forEach(link => {
                if (!this.scannedUrls.has(link) && !this.scanQueue.includes(link)) {
                    this.scanQueue.push(link);
                }
            });
            
            await page.close();
            logger.info(`Found ${links.length} links from ${url}`);
            
        } catch (error) {
            logger.warn(`Could not discover URLs from ${url}:`, error.message);
        }
    }

    /**
     * Discover URLs from sitemap.xml
     */
    async discoverFromSitemap(baseUrl) {
        const sitemapUrls = [
            `${baseUrl}/sitemap.xml`,
            `${baseUrl}/sitemap_index.xml`,
            `${baseUrl}/sitemap1.xml`,
            `${baseUrl}/wp-sitemap.xml`
        ];
        
        for (const sitemapUrl of sitemapUrls) {
            try {
                logger.info(`Checking sitemap: ${sitemapUrl}`);
                
                const response = await axios.get(sitemapUrl, {
                    timeout: config.CRAWLING.REQUEST_TIMEOUT,
                    headers: {
                        'User-Agent': config.PUPPETEER.USER_AGENT
                    }
                });
                
                if (response.status === 200) {
                    const $ = cheerio.load(response.data);
                
                // Extract URLs from sitemap
                const urls = [];
                $('url loc, sitemap loc').each((i, element) => {
                    const url = $(element).text().trim();
                    if (url && url.startsWith(baseUrl) && !this.shouldSkipUrl(url)) {
                        urls.push(url);
                    }
                });
                
                // Add to queue
                urls.forEach(url => {
                    if (!this.scannedUrls.has(url) && !this.scanQueue.includes(url)) {
                        this.scanQueue.push(url);
                    }
                });
                
                logger.info(`Found ${urls.length} URLs in sitemap`);
                break; // Found working sitemap
                }
            } catch (error) {
                logger.warn(`Could not fetch sitemap ${sitemapUrl}:`, error.message);
            }
        }
    }

    /**
     * Check robots.txt for additional sitemaps
     */
    async discoverFromRobots(baseUrl) {
        try {
            logger.info('Checking robots.txt for sitemaps');
            
            const robotsUrl = `${baseUrl}/robots.txt`;
            const response = await axios.get(robotsUrl, {
                timeout: config.CRAWLING.REQUEST_TIMEOUT,
                headers: {
                    'User-Agent': config.PUPPETEER.USER_AGENT
                }
            });
            
            if (response.status === 200) {
                const robotsText = response.data;
                const sitemapMatches = robotsText.match(/Sitemap:\s*(.+)/gi);
                
                if (sitemapMatches) {
                    for (const match of sitemapMatches) {
                        const sitemapUrl = match.replace(/Sitemap:\s*/i, '').trim();
                        logger.info(`Found sitemap in robots.txt: ${sitemapUrl}`);
                        
                        // Process this sitemap
                        await this.discoverFromSitemap(new URL(sitemapUrl).origin);
                    }
                }
            }
        } catch (error) {
            logger.warn('Could not check robots.txt:', error.message);
        }
    }

    /**
     * Add common page patterns
     */
    discoverCommonPages(baseUrl) {
        const commonPaths = [
            '/about', '/about-us', '/contact', '/services', '/products',
            '/blog', '/news', '/events', '/team', '/careers',
            '/privacy', '/terms', '/help', '/support', '/faq',
            '/sitemap', '/search'
        ];
        
        commonPaths.forEach(path => {
            const url = baseUrl + path;
            if (!this.scannedUrls.has(url) && !this.scanQueue.includes(url)) {
                this.scanQueue.push(url);
            }
        });
        
        logger.info(`Added ${commonPaths.length} common page patterns`);
    }

    /**
     * Process the scan queue with concurrency control
     */
    async processScanQueue(baseUrl, options = {}) {
        logger.info(`Processing scan queue: ${this.scanQueue.length} URLs`);
        
        const concurrency = Math.min(this.maxConcurrent, this.scanQueue.length);
        const workers = [];
        
        // Create worker promises
        for (let i = 0; i < concurrency; i++) {
            workers.push(this.scanWorker(baseUrl, options));
        }
        
        // Wait for all workers to complete
        await Promise.all(workers);
        
        logger.info(`Scan completed: ${this.scannedUrls.size} scanned, ${this.failedUrls.size} failed`);
    }

    /**
     * Worker function for concurrent scanning
     */
    async scanWorker(baseUrl, options) {
        while (this.scanQueue.length > 0 && this.scannedUrls.size < this.maxPages && this.isScanning) {
            const url = this.scanQueue.shift();
            
            if (!url || this.scannedUrls.has(url) || this.failedUrls.has(url)) {
                continue;
            }
            
            try {
                await this.scanPage(url, baseUrl, options);
                
                // Rate limiting
                if (this.scanQueue.length > 0) {
                    await delay(this.crawlDelay);
                }
                
            } catch (error) {
                logger.warn(`Failed to scan ${url}:`, error.message);
                this.failedUrls.add(url);
            }
        }
    }

    /**
     * Scan individual page for schemas
     */
    async scanPage(url, baseUrl, options = {}) {
        if (this.scannedUrls.has(url)) return;
        
        logger.info(`Scanning page: ${url}`);
        this.scannedUrls.add(url);
        
        try {
            const page = await this.browser.newPage();
            await page.setUserAgent(config.PUPPETEER.USER_AGENT);
            await page.setViewport(config.PUPPETEER.VIEWPORT);
            
            // Set timeout
            page.setDefaultTimeout(config.PUPPETEER.TIMEOUT);
            
            // Navigate to page
            await page.goto(url, { 
                waitUntil: 'networkidle2',
                timeout: config.PUPPETEER.TIMEOUT 
            });
            
            // Extract page content and schemas
            const pageData = await page.evaluate(() => {
                // Extract page title using multiple methods
                const extractPageTitle = () => {
                    // Method 1: HTML title tag
                    let title = document.title?.trim();
                    if (title && title !== '') return title;
                    
                    // Method 2: WebPage schema name
                    try {
                        const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
                        for (const script of jsonLdScripts) {
                            try {
                                const data = JSON.parse(script.textContent);
                                const schemas = Array.isArray(data) ? data : [data];
                                
                                for (const schema of schemas) {
                                    if (schema['@type'] === 'WebPage' && schema.name) {
                                        return schema.name.trim();
                                    }
                                    
                                    if (schema['@graph'] && Array.isArray(schema['@graph'])) {
                                        for (const item of schema['@graph']) {
                                            if (item['@type'] === 'WebPage' && item.name) {
                                                return item.name.trim();
                                            }
                                        }
                                    }
                                }
                            } catch (e) {
                                continue;
                            }
                        }
                    } catch (e) {
                        // Skip
                    }
                    
                    // Method 3: h1 tag
                    const h1 = document.querySelector('h1');
                    if (h1 && h1.textContent?.trim()) {
                        return h1.textContent.trim();
                    }
                    
                    // Method 4: og:title
                    const ogTitle = document.querySelector('meta[property="og:title"]');
                    if (ogTitle && ogTitle.getAttribute('content')?.trim()) {
                        return ogTitle.getAttribute('content').trim();
                    }
                    
                    return 'Untitled Page';
                };
                
                // Extract schemas
                const extractSchemas = () => {
                    const schemas = [];
                    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
                    
                    scripts.forEach((script, index) => {
                        try {
                            const content = script.textContent.trim();
                            if (!content) return;
                            
                            const parsed = JSON.parse(content);
                            const schemaArray = Array.isArray(parsed) ? parsed : [parsed];
                            
                            schemaArray.forEach((schema, schemaIndex) => {
                                if (schema && schema['@type']) {
                                    schemas.push({
                                        ...schema,
                                        _extractedFrom: {
                                            scriptIndex: index,
                                            schemaIndex: schemaIndex,
                                            location: `Script ${index + 1}.${schemaIndex + 1}`
                                        }
                                    });
                                }
                            });
                        } catch (e) {
                            console.warn(`Invalid JSON-LD in script ${index}:`, e);
                        }
                    });
                    
                    return schemas;
                };
                
                // Extract internal links
                const extractInternalLinks = (baseUrl) => {
                    const links = new Set();
                    const linkElements = document.querySelectorAll('a[href], area[href]');
                    
                    linkElements.forEach(element => {
                        try {
                            const href = element.getAttribute('href');
                            if (!href) return;
                            
                            const absoluteUrl = new URL(href, window.location.href).href;
                            const linkUrl = new URL(absoluteUrl);
                            
                            if (linkUrl.origin === baseUrl) {
                                linkUrl.hash = '';
                                linkUrl.search = '';
                                const cleanUrl = linkUrl.href;
                                
                                // Basic URL filtering
                                const skipPatterns = [
                                    /\.(pdf|jpg|jpeg|png|gif|svg|css|js|xml|ico|zip)$/i,
                                    /\/wp-admin\//,
                                    /\/admin\//,
                                    /mailto:/,
                                    /tel:/,
                                    /javascript:/
                                ];
                                
                                if (!skipPatterns.some(pattern => pattern.test(cleanUrl))) {
                                    links.add(cleanUrl);
                                }
                            }
                        } catch (e) {
                            // Skip invalid URLs
                        }
                    });
                    
                    return Array.from(links);
                };
                
                return {
                    title: extractPageTitle(),
                    description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
                    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || window.location.href,
                    schemas: extractSchemas(),
                    internalLinks: extractInternalLinks(window.location.origin),
                    wordCount: document.body?.textContent?.split(/\s+/).length || 0,
                    hasStructuredData: document.querySelectorAll('script[type="application/ld+json"]').length > 0
                };
            });
            
            // Store page data
            this.discoveredPages.set(url, {
                url,
                title: pageData.title,
                description: pageData.description,
                canonical: pageData.canonical,
                schemas: pageData.schemas,
                internalLinks: pageData.internalLinks.length,
                wordCount: pageData.wordCount,
                hasStructuredData: pageData.hasStructuredData,
                scannedAt: new Date().toISOString(),
                method: 'puppeteer'
            });
            
            // Add new links to scan queue (limited)
            if (options.followLinks !== false) {
                const newLinks = pageData.internalLinks.slice(0, 10); // Limit new links per page
                newLinks.forEach(link => {
                    if (!this.scannedUrls.has(link) && 
                        !this.scanQueue.includes(link) && 
                        !this.failedUrls.has(link) &&
                        !this.shouldSkipUrl(link)) {
                        this.scanQueue.push(link);
                    }
                });
            }
            
            await page.close();
            logger.info(`Successfully scanned: ${url} (${pageData.schemas.length} schemas)`);
            
        } catch (error) {
            logger.warn(`Error scanning ${url}:`, error.message);
            
            // Store error page data
            this.discoveredPages.set(url, {
                url,
                title: this.generateTitleFromUrl(url),
                schemas: [],
                error: error.message,
                scannedAt: new Date().toISOString(),
                method: 'failed'
            });
            
            this.failedUrls.add(url);
        }
    }

    /**
     * Check if URL should be skipped
     */
    shouldSkipUrl(url) {
        const skipPatterns = [
            // File extensions
            /\.(pdf|jpg|jpeg|png|gif|svg|css|js|xml|ico|zip|doc|docx|xls|xlsx|ppt|pptx)$/i,
            // Admin areas
            /\/wp-admin\//,
            /\/admin\//,
            /\/dashboard\//,
            /\/login\//,
            /\/register\//,
            // API endpoints
            /\/api\//,
            /\/ajax\//,
            /\/rest\//,
            // Feeds
            /\/feed\//,
            /\/rss\//,
            /\/atom\//,
            // Common excludes
            /\/search\?/,
            /\/tag\//,
            /\/category\//,
            /\/author\//,
            /\/date\//,
            /mailto:/,
            /tel:/,
            /javascript:/,
            // Very long URLs (likely dynamic)
            /.{200,}/
        ];
        
        return skipPatterns.some(pattern => pattern.test(url));
    }

    /**
     * Generate page title from URL
     */
    generateTitleFromUrl(url) {
        try {
            const urlObj = new URL(url);
            const pathSegments = urlObj.pathname.split('/').filter(Boolean);
            
            if (pathSegments.length === 0) {
                return 'Home Page';
            }
            
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
     * Build final site analysis results
     */
    async buildSiteResults(baseUrl) {
        const pages = Array.from(this.discoveredPages.values());
        const allSchemas = [];
        
        // Collect all schemas with page info
        pages.forEach(page => {
            page.schemas.forEach(schema => {
                allSchemas.push({
                    ...schema,
                    _pageInfo: {
                        url: page.url,
                        title: page.title,
                        scannedAt: page.scannedAt
                    }
                });
            });
        });
        
        // Generate summary
        const summary = this.generateSiteSummary(pages, allSchemas);
        
        return {
            scanId: generateId(),
            timestamp: new Date().toISOString(),
            baseUrl,
            type: 'site_scan',
            status: 'completed',
            totalPages: pages.length,
            totalSchemas: allSchemas.length,
            successfulPages: pages.filter(p => !p.error).length,
            failedPages: pages.filter(p => p.error).length,
            summary,
            pages,
            schemas: allSchemas,
            discoveryStats: {
                discovered: this.scannedUrls.size + this.failedUrls.size,
                scanned: this.scannedUrls.size,
                failed: this.failedUrls.size,
                queued: this.scanQueue.length
            }
        };
    }

    /**
     * Generate site summary statistics
     */
    generateSiteSummary(pages, schemas) {
        // Schema type distribution
        const schemaTypes = new Map();
        schemas.forEach(schema => {
            const type = Array.isArray(schema['@type']) ? schema['@type'][0] : schema['@type'];
            schemaTypes.set(type, (schemaTypes.get(type) || 0) + 1);
        });
        
        // Pages with schemas
        const pagesWithSchemas = pages.filter(p => p.schemas && p.schemas.length > 0);
        
        // Common issues
        const issues = [];
        const pagesWithoutSchemas = pages.filter(p => !p.schemas || p.schemas.length === 0);
        if (pagesWithoutSchemas.length > 0) {
            issues.push({
                type: 'Pages without schemas',
                count: pagesWithoutSchemas.length,
                severity: 'medium'
            });
        }
        
        const schemasWithoutIds = schemas.filter(s => !s['@id']);
        if (schemasWithoutIds.length > 0) {
            issues.push({
                type: 'Schemas without @id',
                count: schemasWithoutIds.length,
                severity: 'low'
            });
        }
        
        return {
            schemaDistribution: Array.from(schemaTypes.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([type, count]) => ({ type, count })),
            coverage: {
                pagesWithSchemas: pagesWithSchemas.length,
                pagesWithoutSchemas: pagesWithoutSchemas.length,
                coveragePercentage: pages.length > 0 ? 
                    Math.round((pagesWithSchemas.length / pages.length) * 100) : 0
            },
            averageSchemasPerPage: pages.length > 0 ? 
                Math.round((schemas.length / pages.length) * 10) / 10 : 0,
            commonIssues: issues,
            topSchemaTypes: Array.from(schemaTypes.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
        };
    }

    /**
     * Stop scanning process
     */
    stopScanning() {
        this.isScanning = false;
        this.scanQueue = [];
        logger.info('Scanning stopped by request');
    }

    /**
     * Reset crawler state
     */
    reset() {
        this.discoveredPages.clear();
        this.scannedUrls.clear();
        this.failedUrls.clear();
        this.scanQueue = [];
        this.isScanning = false;
    }

    /**
     * Get scan progress
     */
    getProgress() {
        const total = this.scannedUrls.size + this.failedUrls.size + this.scanQueue.length;
        const completed = this.scannedUrls.size + this.failedUrls.size;
        
        return {
            total,
            completed,
            scanned: this.scannedUrls.size,
            failed: this.failedUrls.size,
            queued: this.scanQueue.length,
            progress: total > 0 ? Math.round((completed / total) * 100) : 0,
            isScanning: this.isScanning
        };
    }
}

module.exports = WebCrawler;
