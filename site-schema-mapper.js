// site-schema-mapper.js - Enhanced with Page Title Extraction
console.log('🗺️ Loading Enhanced Site Schema Mapper...');

class SiteSchemaMapper {
    constructor() {
        this.discoveredPages = new Map(); // URL -> page data
        this.schemaMap = new Map(); // @id -> schema details
        this.connections = new Map(); // @id -> array of connected @ids
        this.scanQueue = [];
        this.scannedUrls = new Set();
        this.maxPages = 50; // Default limit
        this.crawlDelay = 1000; // 1 second between requests
        this.isScanning = false;
        this.onProgress = null;
        this.onComplete = null;
        this.onError = null;
        this.failedUrls = new Set(); // Track failed URLs
        this.discoveryMethods = ['links', 'sitemap', 'robots', 'common']; // Multiple discovery strategies
    }

    /**
     * Start comprehensive site mapping with multiple discovery methods
     */
    async mapSite(startUrl, options = {}) {
        console.log('🗺️ Starting enhanced site schema mapping for:', startUrl);
        
        this.maxPages = options.maxPages || 50;
        this.crawlDelay = options.crawlDelay || 1000;
        this.onProgress = options.onProgress;
        this.onComplete = options.onComplete;
        this.onError = options.onError;
        
        try {
            this.isScanning = true;
            this.reset();
            
            // Start with the base URL
            const baseUrl = new URL(startUrl).origin;
            this.scanQueue.push(startUrl);
            
            // Initial discovery phase - find as many URLs as possible
            await this.discoverUrls(startUrl, baseUrl);
            
            // Begin scanning process
            await this.processScanQueue(baseUrl);
            
            // Analyze connections and build map
            const schemaGraph = this.buildSchemaGraph();
            
            // Generate final results
            const result = {
                baseUrl,
                totalPages: this.discoveredPages.size,
                totalSchemas: this.schemaMap.size,
                connections: this.connections.size,
                pages: Array.from(this.discoveredPages.values()),
                schemaGraph,
                summary: this.generateSummary(),
                discoveryStats: {
                    queued: this.scanQueue.length,
                    failed: this.failedUrls.size,
                    scanned: this.scannedUrls.size
                }
            };
            
            this.isScanning = false;
            
            if (this.onComplete) this.onComplete(result);
            return result;
            
        } catch (error) {
            this.isScanning = false;
            console.error('❌ Site mapping error:', error);
            if (this.onError) this.onError(error);
            throw error;
        }
    }

    /**
     * Enhanced URL discovery using multiple methods
     */
    async discoverUrls(startUrl, baseUrl) {
        console.log('🔍 Starting enhanced URL discovery...');
        
        // Method 1: Scan the starting page for links
        await this.discoverFromPage(startUrl, baseUrl);
        
        // Method 2: Try to find and parse sitemap.xml
        await this.discoverFromSitemap(baseUrl);
        
        // Method 3: Check robots.txt for sitemaps
        await this.discoverFromRobots(baseUrl);
        
        // Method 4: Add common page patterns
        this.discoverCommonPages(baseUrl);
        
        console.log(`🎯 Discovery complete: ${this.scanQueue.length} URLs queued for scanning`);
    }

    /**
     * Discover URLs from the starting page using content script injection
     */
    async discoverFromPage(url, baseUrl) {
        try {
            console.log('📄 Discovering URLs from page:', url);
            
            // Use the current active tab if it matches our target URL
            const tabs = await this.getCurrentTabs();
            let targetTab = null;
            
            for (const tab of tabs) {
                if (tab.url && tab.url.startsWith(baseUrl)) {
                    targetTab = tab;
                    break;
                }
            }
            
            if (targetTab) {
                console.log('🎯 Found matching tab:', targetTab.url);
                const response = await this.extractLinksFromTab(targetTab.id, baseUrl);
                
                if (response.links) {
                    response.links.forEach(link => {
                        if (!this.scannedUrls.has(link) && !this.scanQueue.includes(link)) {
                            this.scanQueue.push(link);
                        }
                    });
                    console.log(`📎 Found ${response.links.length} links from current page`);
                }
            } else {
                console.log('⚠️ No matching tab found, will create new one');
                // Fallback: create new tab
                await this.discoverFromNewTab(url, baseUrl);
            }
            
        } catch (error) {
            console.warn('⚠️ Could not discover URLs from page:', error.message);
        }
    }

    /**
     * Get current browser tabs
     */
    async getCurrentTabs() {
        return new Promise((resolve) => {
            if (chrome && chrome.tabs) {
                chrome.tabs.query({}, (tabs) => {
                    resolve(tabs || []);
                });
            } else {
                resolve([]);
            }
        });
    }

    /**
     * Extract links from an existing tab using content script
     */
    async extractLinksFromTab(tabId, baseUrl) {
        return new Promise((resolve) => {
            if (chrome && chrome.tabs) {
                chrome.tabs.sendMessage(tabId, { 
                    action: 'extractLinks', 
                    baseUrl: baseUrl 
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.warn('Could not extract links from tab:', chrome.runtime.lastError.message);
                        resolve({ links: [] });
                    } else {
                        resolve(response || { links: [] });
                    }
                });
            } else {
                resolve({ links: [] });
            }
        });
    }

    /**
     * Discover URLs by creating a new tab (fallback method)
     */
    async discoverFromNewTab(url, baseUrl) {
        return new Promise((resolve) => {
            if (chrome && chrome.tabs) {
                chrome.tabs.create({ url: url, active: false }, (tab) => {
                    const tabId = tab.id;
                    
                    // Wait for page to load, then extract links
                    setTimeout(() => {
                        chrome.tabs.sendMessage(tabId, { 
                            action: 'extractLinks', 
                            baseUrl: baseUrl 
                        }, (response) => {
                            // Close the tab
                            chrome.tabs.remove(tabId);
                            
                            if (response && response.links) {
                                response.links.forEach(link => {
                                    if (!this.scannedUrls.has(link) && !this.scanQueue.includes(link)) {
                                        this.scanQueue.push(link);
                                    }
                                });
                                console.log(`📎 Found ${response.links.length} links from new tab`);
                            }
                            
                            resolve();
                        });
                    }, 3000);
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Try to discover URLs from sitemap.xml
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
                console.log('🗺️ Checking sitemap:', sitemapUrl);
                const response = await this.fetchWithTimeout(sitemapUrl, 5000);
                
                if (response.ok) {
                    const text = await response.text();
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(text, 'text/xml');
                    
                    // Extract URLs from sitemap
                    const urlElements = xmlDoc.querySelectorAll('url loc, sitemap loc');
                    urlElements.forEach(element => {
                        const url = element.textContent.trim();
                        if (url && url.startsWith(baseUrl) && !this.shouldSkipUrl(url)) {
                            if (!this.scannedUrls.has(url) && !this.scanQueue.includes(url)) {
                                this.scanQueue.push(url);
                            }
                        }
                    });
                    
                    console.log(`🎯 Found ${urlElements.length} URLs in sitemap`);
                    break; // Found a working sitemap
                }
            } catch (error) {
                console.warn(`⚠️ Could not fetch sitemap ${sitemapUrl}:`, error.message);
            }
        }
    }

    /**
     * Check robots.txt for sitemap references
     */
    async discoverFromRobots(baseUrl) {
        try {
            console.log('🤖 Checking robots.txt for sitemaps');
            const robotsUrl = `${baseUrl}/robots.txt`;
            const response = await this.fetchWithTimeout(robotsUrl, 5000);
            
            if (response.ok) {
                const text = await response.text();
                const sitemapMatches = text.match(/Sitemap:\s*(.+)/gi);
                
                if (sitemapMatches) {
                    for (const match of sitemapMatches) {
                        const sitemapUrl = match.replace(/Sitemap:\s*/i, '').trim();
                        console.log('📍 Found sitemap in robots.txt:', sitemapUrl);
                        
                        // Recursively check this sitemap
                        await this.discoverFromSitemap(new URL(sitemapUrl).origin);
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ Could not check robots.txt:', error.message);
        }
    }

    /**
     * Add common page patterns that might exist
     */
    discoverCommonPages(baseUrl) {
        const commonPaths = [
            '/about',
            '/about-us',
            '/contact',
            '/services',
            '/products',
            '/blog',
            '/news',
            '/events',
            '/team',
            '/careers',
            '/privacy',
            '/terms',
            '/help',
            '/support',
            '/faq'
        ];
        
        commonPaths.forEach(path => {
            const url = baseUrl + path;
            if (!this.scannedUrls.has(url) && !this.scanQueue.includes(url)) {
                this.scanQueue.push(url);
            }
        });
        
        console.log(`📋 Added ${commonPaths.length} common page patterns to queue`);
    }

    /**
     * Fetch with timeout
     */
    async fetchWithTimeout(url, timeout = 10000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(url, {
                signal: controller.signal,
                mode: 'cors',
                credentials: 'omit'
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    /**
     * Process the scan queue with enhanced error handling
     */
    async processScanQueue(baseUrl) {
        console.log(`🚀 Processing scan queue: ${this.scanQueue.length} URLs`);
        
        while (this.scanQueue.length > 0 && this.scannedUrls.size < this.maxPages && this.isScanning) {
            const url = this.scanQueue.shift();
            
            if (this.scannedUrls.has(url) || this.failedUrls.has(url)) {
                continue;
            }
            
            try {
                await this.scanPage(url, baseUrl);
                
                // Rate limiting
                if (this.scanQueue.length > 0) {
                    await this.delay(this.crawlDelay);
                }
                
                // Progress update
                if (this.onProgress) {
                    this.onProgress({
                        scanned: this.scannedUrls.size,
                        queued: this.scanQueue.length,
                        found: this.schemaMap.size,
                        failed: this.failedUrls.size
                    });
                }
                
            } catch (error) {
                console.warn(`⚠️ Failed to scan ${url}:`, error.message);
                this.failedUrls.add(url);
            }
        }
        
        console.log(`✅ Scan complete: ${this.scannedUrls.size} scanned, ${this.failedUrls.size} failed`);
    }

    /**
     * Enhanced page scanning with multiple methods and page title extraction
     */
    async scanPage(url, baseUrl) {
        if (this.scannedUrls.has(url)) return;
        
        console.log('📄 Scanning page:', url);
        this.scannedUrls.add(url);
        
        try {
            // Try multiple methods to get page content
            let content = null;
            let pageTitle = null;
            let method = 'unknown';
            
            // Method 1: Direct fetch (works for same-origin or CORS-enabled)
            try {
                const response = await this.fetchWithTimeout(url, 8000);
                if (response.ok) {
                    content = await response.text();
                    method = 'direct-fetch';
                    
                    // Extract title from HTML content
                    pageTitle = this.extractTitleFromHTML(content);
                }
            } catch (fetchError) {
                console.warn(`Direct fetch failed for ${url}:`, fetchError.message);
            }
            
            // Method 2: Content script injection (if direct fetch fails)
            if (!content) {
                try {
                    const contentResponse = await this.fetchPageViaContentScript(url);
                    if (contentResponse.success) {
                        content = contentResponse.content;
                        pageTitle = contentResponse.pageTitle;
                        method = 'content-script';
                    }
                } catch (scriptError) {
                    console.warn(`Content script failed for ${url}:`, scriptError.message);
                }
            }
            
            if (!content) {
                throw new Error(`Could not fetch content using any method`);
            }
            
            console.log(`✅ Got content for ${url} via ${method}`);
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(content, 'text/html');
            
            // Extract schemas from page
            const pageSchemas = this.extractSchemasFromDocument(doc, url);
            
            // Extract additional internal links for further crawling
            const internalLinks = this.extractInternalLinks(doc, url, baseUrl);
            
            // If we don't have a page title yet, try to extract from parsed document
            if (!pageTitle) {
                pageTitle = this.extractTitleFromDocument(doc);
            }
            
            // Store page data with enhanced information
            const pageData = {
                url,
                title: pageTitle || this.generateTitleFromUrl(url),
                schemas: pageSchemas,
                internalLinks: internalLinks.length,
                scannedAt: new Date().toISOString(),
                method: method
            };
            
            this.discoveredPages.set(url, pageData);
            
            // Add schemas to global map and track connections
            this.processPageSchemas(pageSchemas, url);
            
            // Add new URLs to scan queue (limited to prevent infinite crawling)
            const newLinks = internalLinks.slice(0, 10); // Limit new links per page
            newLinks.forEach(link => {
                if (!this.scannedUrls.has(link) && !this.scanQueue.includes(link) && !this.failedUrls.has(link)) {
                    this.scanQueue.push(link);
                }
            });
            
            console.log(`📊 Page scan complete: ${pageSchemas.length} schemas, ${newLinks.length} new links added`);
            
        } catch (error) {
            console.warn(`⚠️ Error scanning ${url}:`, error.message);
            this.failedUrls.add(url);
            
            // Store error page data with fallback title
            this.discoveredPages.set(url, {
                url,
                title: this.generateTitleFromUrl(url),
                schemas: [],
                error: error.message,
                scannedAt: new Date().toISOString()
            });
        }
    }

    /**
     * Extract page title from HTML content string
     */
    extractTitleFromHTML(htmlContent) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');
            return this.extractTitleFromDocument(doc);
        } catch (e) {
            console.warn('Error parsing HTML for title extraction:', e);
            return null;
        }
    }

    /**
     * Extract page title from parsed document using multiple methods
     */
    extractTitleFromDocument(doc) {
        // Method 1: HTML title tag
        let title = doc.title?.trim();
        if (title && title !== '') {
            return title;
        }
        
        // Method 2: WebPage schema name
        try {
            const jsonLdScripts = doc.querySelectorAll('script[type="application/ld+json"]');
            for (const script of jsonLdScripts) {
                try {
                    const data = JSON.parse(script.textContent);
                    const schemas = Array.isArray(data) ? data : [data];
                    
                    for (const schema of schemas) {
                        if (schema['@type'] === 'WebPage' && schema.name) {
                            return schema.name.trim();
                        }
                        
                        // Check @graph as well
                        if (schema['@graph'] && Array.isArray(schema['@graph'])) {
                            for (const item of schema['@graph']) {
                                if (item['@type'] === 'WebPage' && item.name) {
                                    return item.name.trim();
                                }
                            }
                        }
                    }
                } catch (e) {
                    // Skip invalid JSON
                    continue;
                }
            }
        } catch (e) {
            console.warn('Error extracting title from schemas:', e);
        }
        
        // Method 3: h1 tag
        const h1 = doc.querySelector('h1');
        if (h1 && h1.textContent?.trim()) {
            return h1.textContent.trim();
        }
        
        // Method 4: meta property="og:title"
        const ogTitle = doc.querySelector('meta[property="og:title"]');
        if (ogTitle && ogTitle.getAttribute('content')?.trim()) {
            return ogTitle.getAttribute('content').trim();
        }
        
        return null;
    }

    /**
     * Generate page title from URL as fallback
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
     * Fetch page content using content script (enhanced method)
     */
    async fetchPageViaContentScript(url) {
        return new Promise((resolve) => {
            if (!chrome || !chrome.tabs) {
                resolve({ success: false, error: 'Chrome tabs API not available' });
                return;
            }
            
            // Create tab in background
            chrome.tabs.create({ url: url, active: false }, (tab) => {
                const tabId = tab.id;
                let resolved = false;
                
                // Set timeout
                const timeout = setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        chrome.tabs.remove(tabId);
                        resolve({ success: false, error: 'Timeout' });
                    }
                }, 10000);
                
                // Wait for page to load
                setTimeout(() => {
                    if (resolved) return;
                    
                    chrome.tabs.sendMessage(tabId, { action: 'getPageContent' }, (response) => {
                        if (!resolved) {
                            resolved = true;
                            clearTimeout(timeout);
                            chrome.tabs.remove(tabId);
                            
                            if (chrome.runtime.lastError) {
                                resolve({ success: false, error: chrome.runtime.lastError.message });
                            } else {
                                resolve(response || { success: false, error: 'No response' });
                            }
                        }
                    });
                }, 4000); // Wait 4 seconds for page load
            });
        });
    }

    /**
     * Enhanced schema extraction with better error handling
     */
    extractSchemasFromDocument(doc, url) {
        const schemas = [];
        
        try {
            // JSON-LD extraction
            const jsonLdScripts = doc.querySelectorAll('script[type="application/ld+json"]');
            jsonLdScripts.forEach((script, index) => {
                try {
                    const data = JSON.parse(script.textContent);
                    const schemaArray = Array.isArray(data) ? data : [data];
                    
                    schemaArray.forEach((schema, schemaIndex) => {
                        if (schema && schema['@type']) {
                            schemas.push({
                                type: 'JSON-LD',
                                '@type': schema['@type'],
                                '@id': schema['@id'] || `${url}#schema-${index}-${schemaIndex}`,
                                '@context': schema['@context'] || null,
                                data: schema,
                                location: `JSON-LD Script ${index + 1}.${schemaIndex + 1}`,
                                foundOnUrl: url
                            });
                        }
                    });
                } catch (jsonError) {
                    console.warn(`Invalid JSON-LD found on ${url}:`, jsonError.message);
                }
            });

            console.log(`📋 Found ${schemas.length} schemas on ${url}`);
        } catch (error) {
            console.warn(`Error extracting schemas from ${url}:`, error.message);
        }

        return schemas;
    }

    /**
     * Enhanced internal link extraction
     */
    extractInternalLinks(doc, currentUrl, baseUrl) {
        const links = new Set();
        
        try {
            const linkElements = doc.querySelectorAll('a[href], area[href]');
            
            linkElements.forEach(link => {
                try {
                    const href = link.getAttribute('href');
                    if (!href) return;
                    
                    const absoluteUrl = new URL(href, currentUrl).href;
                    const linkUrl = new URL(absoluteUrl);
                    
                    // Only include same-domain links
                    if (linkUrl.origin === baseUrl) {
                        // Remove fragments and normalize
                        linkUrl.hash = '';
                        linkUrl.search = ''; // Also remove query parameters for cleaner URLs
                        const cleanUrl = linkUrl.href;
                        
                        // Exclude common non-content URLs
                        if (!this.shouldSkipUrl(cleanUrl)) {
                            links.add(cleanUrl);
                        }
                    }
                } catch (urlError) {
                    // Invalid URL, skip silently
                }
            });
        } catch (error) {
            console.warn(`Error extracting links from ${currentUrl}:`, error.message);
        }
        
        return Array.from(links);
    }

    /**
     * Enhanced URL filtering
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
            // Feeds and technical
            /\/feed\//,
            /\/rss\//,
            /\/atom\//,
            // Fragments
            /#/,
            // Very long URLs (likely dynamic)
            /.{200,}/,
            // Common excludes
            /\/search\?/,
            /\/tag\//,
            /\/category\//,
            /\/author\//,
            /\/date\//,
            /mailto:/,
            /tel:/,
            /javascript:/
        ];
        
        return skipPatterns.some(pattern => pattern.test(url));
    }

    /**
     * Process schemas found on a page and track connections
     */
    processPageSchemas(schemas, url) {
        schemas.forEach(schema => {
            const schemaId = schema['@id'];
            const schemaType = schema['@type'];
            
            // Store in global schema map
            if (schemaId) {
                if (!this.schemaMap.has(schemaId)) {
                    this.schemaMap.set(schemaId, {
                        '@id': schemaId,
                        '@type': schemaType,
                        foundOn: [url],
                        instances: [schema]
                    });
                } else {
                    // Add to existing schema
                    const existing = this.schemaMap.get(schemaId);
                    existing.foundOn.push(url);
                    existing.instances.push(schema);
                }
                
                // Track connections by analyzing references
                this.trackSchemaConnections(schema, schemaId);
            }
        });
    }

    /**
     * Track connections between schemas based on @id references
     */
    trackSchemaConnections(schema, currentId) {
        const findReferences = (obj) => {
            if (typeof obj !== 'object' || obj === null) return;
            
            Object.entries(obj).forEach(([key, value]) => {
                if (typeof value === 'string' && value.startsWith('schema:')) {
                    if (this.schemaMap.has(value)) {
                        this.addConnection(currentId, value);
                    }
                } else if (typeof value === 'object') {
                    if (value['@id']) {
                        this.addConnection(currentId, value['@id']);
                    }
                    findReferences(value);
                } else if (Array.isArray(value)) {
                    value.forEach(item => {
                        if (typeof item === 'object' && item['@id']) {
                            this.addConnection(currentId, item['@id']);
                        }
                        findReferences(item);
                    });
                }
            });
        };
        
        findReferences(schema.data);
    }

    /**
     * Add bidirectional connection between schemas
     */
    addConnection(fromId, toId) {
        if (fromId === toId) return; // No self-connections
        
        // Add forward connection
        if (!this.connections.has(fromId)) {
            this.connections.set(fromId, new Set());
        }
        this.connections.get(fromId).add(toId);
        
        // Add reverse connection
        if (!this.connections.has(toId)) {
            this.connections.set(toId, new Set());
        }
        this.connections.get(toId).add(fromId);
    }

    /**
     * Build comprehensive schema graph
     */
    buildSchemaGraph() {
        const nodes = [];
        const edges = [];
        
        // Create nodes from schemas
        this.schemaMap.forEach((schema, id) => {
            const node = {
                id: id,
                type: schema['@type'],
                foundOn: schema.foundOn,
                instances: schema.instances.length,
                size: schema.foundOn.length
            };
            nodes.push(node);
        });
        
        // Create edges from connections
        this.connections.forEach((connectedIds, fromId) => {
            connectedIds.forEach(toId => {
                // Only add each edge once (undirected graph)
                if (fromId < toId) {
                    edges.push({
                        source: fromId,
                        target: toId,
                        weight: 1
                    });
                }
            });
        });
        
        return { nodes, edges };
    }

    /**
     * Enhanced summary with discovery statistics
     */
    generateSummary() {
        const schemaTypes = new Map();
        
        this.schemaMap.forEach(schema => {
            const type = Array.isArray(schema['@type']) ? schema['@type'][0] : schema['@type'];
            schemaTypes.set(type, (schemaTypes.get(type) || 0) + 1);
        });
        
        return {
            topSchemaTypes: Array.from(schemaTypes.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 15),
            connectivityMetrics: {
                totalConnections: this.connections.size,
                avgConnectionsPerSchema: this.connections.size > 0 ? 
                    Array.from(this.connections.values())
                        .reduce((sum, conns) => sum + conns.size, 0) / this.connections.size : 0
            },
            discoveryStats: {
                totalPagesFound: this.scannedUrls.size + this.failedUrls.size,
                successfulScans: this.scannedUrls.size,
                failedScans: this.failedUrls.size,
                successRate: this.scannedUrls.size > 0 ? 
                    (this.scannedUrls.size / (this.scannedUrls.size + this.failedUrls.size) * 100).toFixed(1) + '%' : '0%'
            }
        };
    }

    /**
     * Reset mapper state
     */
    reset() {
        this.discoveredPages.clear();
        this.schemaMap.clear();
        this.connections.clear();
        this.scanQueue = [];
        this.scannedUrls.clear();
        this.failedUrls.clear();
    }

    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Stop scanning process
     */
    stopScanning() {
        this.isScanning = false;
        this.scanQueue = [];
        console.log('🛑 Site scanning stopped');
    }
}

// Export for use in extension
if (typeof window !== 'undefined') {
    window.SiteSchemaMapper = SiteSchemaMapper;
}

console.log('🗺️ Enhanced Site Schema Mapper loaded successfully');