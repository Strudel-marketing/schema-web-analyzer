// content.js - Enhanced with Page Title Extraction
function extractAllSchemas() {
    console.log('Starting schema extraction...');
    
    // Check for document API availability
    if (!document.querySelectorAll) {
        return {
            success: false,
            error: 'Document API not available',
            schemas: [],
            errors: ['Document not ready']
        };
    }
    
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    console.log(`Found ${scripts.length} JSON-LD scripts`);
    
    const schemas = [];
    const errors = [];
    
    scripts.forEach((script, index) => {
        try {
            const content = script.textContent.trim();
            if (!content) {
                console.warn(`Empty script content at index ${index}`);
                return;
            }
            
            console.log(`Processing script ${index}`);
            const parsed = JSON.parse(content);
            
            // Normalize and validate schemas
            const processSchema = (schema) => {
                if (!schema || typeof schema !== 'object') return false;
                if (!schema['@type']) return false;
                schemas.push(schema);
                return true;
            };

            if (Array.isArray(parsed)) {
                parsed.forEach(item => processSchema(item));
            } else if (parsed && typeof parsed === 'object') {
                if (parsed['@graph'] && Array.isArray(parsed['@graph'])) {
                    parsed['@graph'].forEach(item => processSchema(item));
                } else {
                    processSchema(parsed);
                }
            }
            
        } catch (e) {
            console.error(`Error processing script ${index}:`, e);
            errors.push({ script: index, error: e.message });
        }
    });

    return {
        success: schemas.length > 0,
        schemas: schemas,
        errors: errors,
        count: schemas.length,
        timestamp: Date.now()
    };
}

// NEW: Extract page title using multiple methods
function extractPageTitle() {
    console.log('Extracting page title...');
    
    // Method 1: HTML title tag
    let title = document.title?.trim();
    if (title && title !== '') {
        console.log('Page title from <title> tag:', title);
        return title;
    }
    
    // Method 2: WebPage schema name
    try {
        const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const script of jsonLdScripts) {
            try {
                const data = JSON.parse(script.textContent);
                const schemas = Array.isArray(data) ? data : [data];
                
                for (const schema of schemas) {
                    if (schema['@type'] === 'WebPage' && schema.name) {
                        title = schema.name.trim();
                        console.log('Page title from WebPage schema:', title);
                        return title;
                    }
                    
                    // Check @graph as well
                    if (schema['@graph'] && Array.isArray(schema['@graph'])) {
                        for (const item of schema['@graph']) {
                            if (item['@type'] === 'WebPage' && item.name) {
                                title = item.name.trim();
                                console.log('Page title from WebPage schema in @graph:', title);
                                return title;
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
    const h1 = document.querySelector('h1');
    if (h1 && h1.textContent?.trim()) {
        title = h1.textContent.trim();
        console.log('Page title from <h1>:', title);
        return title;
    }
    
    // Method 4: meta property="og:title"
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && ogTitle.getAttribute('content')?.trim()) {
        title = ogTitle.getAttribute('content').trim();
        console.log('Page title from og:title:', title);
        return title;
    }
    
    // Method 5: Generate from URL
    try {
        const pathSegments = window.location.pathname.split('/').filter(Boolean);
        if (pathSegments.length === 0) {
            title = 'Home Page';
        } else {
            const lastSegment = pathSegments[pathSegments.length - 1];
            title = lastSegment
                .replace(/\.(html|php|asp|aspx)$/i, '')
                .replace(/[-_]/g, ' ')
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ') || 'Page';
        }
        console.log('Page title generated from URL:', title);
        return title;
    } catch (e) {
        console.warn('Error generating title from URL:', e);
    }
    
    // Fallback
    title = 'Unknown Page';
    console.log('Using fallback page title:', title);
    return title;
}

// NEW: Extract links from the page for site mapping
function extractLinksFromPage(baseUrl) {
    console.log('Extracting links for base URL:', baseUrl);
    
    const links = new Set();
    const linkElements = document.querySelectorAll('a[href], area[href]');
    
    linkElements.forEach(link => {
        try {
            const href = link.getAttribute('href');
            if (!href) return;
            
            // Create absolute URL
            const absoluteUrl = new URL(href, window.location.href).href;
            const linkUrl = new URL(absoluteUrl);
            
            // Only include same-domain links
            if (linkUrl.origin === baseUrl) {
                // Clean up the URL
                linkUrl.hash = '';
                linkUrl.search = '';
                const cleanUrl = linkUrl.href;
                
                // Filter out unwanted URLs
                if (!shouldSkipUrl(cleanUrl)) {
                    links.add(cleanUrl);
                }
            }
        } catch (e) {
            // Invalid URL, skip
        }
    });
    
    const linkArray = Array.from(links);
    console.log(`Extracted ${linkArray.length} internal links`);
    return linkArray;
}

// NEW: URL filtering function
function shouldSkipUrl(url) {
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
        /javascript:/
    ];
    
    return skipPatterns.some(pattern => pattern.test(url));
}

// Message listener with enhanced functionality
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);
    
    if (request.action === 'extractSchema' || request.action === 'processSchemas') {
        try {
            console.log('Starting schema extraction...');
            const result = extractAllSchemas();
            console.log('Extraction result:', result);
            
            if (!result.success || !result.schemas || result.schemas.length === 0) {
                console.warn('No schemas found');
                sendResponse({
                    success: false,
                    error: 'No schemas found on page',
                    schemas: []
                });
                return true;
            }
    
            console.log('Sending schemas:', result.schemas);
            sendResponse({
                success: true,
                schemas: result.schemas,
                count: result.schemas.length,
                pageTitle: extractPageTitle() // Include page title
            });
        } catch (error) {
            console.error('Extraction error:', error);
            sendResponse({
                success: false,
                error: error.message,
                schemas: []
            });
        }
        return true;
    }
    
    // NEW: Handle link extraction for site mapping
    if (request.action === 'extractLinks') {
        try {
            const links = extractLinksFromPage(request.baseUrl);
            sendResponse({
                success: true,
                links: links,
                pageTitle: extractPageTitle()
            });
        } catch (error) {
            console.error('Link extraction error:', error);
            sendResponse({
                success: false,
                error: error.message,
                links: []
            });
        }
        return true;
    }
    
    if (request.action === 'getPageContent') {
        try {
            sendResponse({ 
                success: true,
                content: document.documentElement.outerHTML,
                pageTitle: extractPageTitle()
            });
        } catch (error) {
            console.error('Error getting page content:', error);
            sendResponse({
                success: false,
                error: error.message
            });
        }
        return true;
    }

    // Handle unknown actions
    console.warn('Unknown action received:', request.action);
    sendResponse({
        success: false,
        error: 'Unknown action type',
        action: request.action
    });
    return true;
});

console.log('Content script loaded and initialized');