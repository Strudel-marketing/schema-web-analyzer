// config.js - Configuration Settings for Schema Web Analyzer
// מבוסס על הקוד המקורי עם הגדרות מותאמות

const path = require('path');

/**
 * הגדרות בסיסיות של האפליקציה
 */
const app = {
    name: 'Schema Web Analyzer',
    version: '1.0.0',
    description: 'Advanced schema markup analysis and optimization tool',
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
    
    // URLs and paths
    baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
    apiPath: '/api',
    dashboardPath: '/',
    
    // Rate limiting
    rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Limit each IP to 100 requests per windowMs
        skipSuccessfulRequests: false
    },
    
    // CORS settings
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    }
};

/**
 * הגדרות crawler ו-analysis
 * מבוססות על הקוד המקורי מ-site-schema-mapper.js
 */
const crawler = {
    // Default crawling limits
    maxPages: 50,
    maxDepth: 3,
    crawlDelay: 1000, // 1 second between requests
    timeout: 30000,   // 30 seconds per page
    
    // User agent for requests
    userAgent: 'Schema-Web-Analyzer/1.0 (compatible; Schema markup analyzer)',
    
    // Puppeteer settings
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ],
        timeout: 30000
    },
    
    // URL filtering patterns (from original code)
    skipPatterns: [
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
        // Common excludes
        /\/search\?/,
        /\/tag\//,
        /\/category\//,
        /\/author\//,
        /\/date\//,
        /mailto:/,
        /tel:/,
        /javascript:/
    ],
    
    // Discovery methods for site mapping
    discoveryMethods: ['links', 'sitemap', 'robots', 'common'],
    
    // Common page paths to try
    commonPaths: [
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
    ]
};

/**
 * הגדרות Schema analysis
 * מבוססות על הקוד המקורי מ-schema-engine.js
 */
const schema = {
    // Schema type rankings (from original code)
    ranks: {
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
    },
    
    // Location recommendations (from original code)
    locationRecommendations: {
        "Organization": {
            "suggestedPage": "About page",
            "reason": "Organization schema is best placed on your About or main company information page.",
            "urlPattern": "/about",
            "example": "{\n  \"@type\": \"Organization\",\n  \"@id\": \"schema:Organization\",\n  \"name\": \"Your Company Name\",\n  \"url\": \"https://www.example.com\",\n  \"logo\": \"https://www.example.com/logo.png\",\n  \"description\": \"About your company\"\n}"
        },
        "ContactPage": {
            "suggestedPage": "Contact page",
            "reason": "ContactPage schema should be implemented on your dedicated contact page.",
            "urlPattern": "/contact",
            "example": "{\n  \"@type\": \"ContactPage\",\n  \"@id\": \"schema:ContactPage\",\n  \"name\": \"Contact Us\",\n  \"url\": \"https://www.example.com/contact\"\n}"
        },
        "ContactPoint": {
            "suggestedPage": "Contact page",
            "reason": "ContactPoint schema is most effective when placed on your contact page.",
            "urlPattern": "/contact",
            "example": "{\n  \"@type\": \"ContactPoint\",\n  \"@id\": \"schema:ContactPoint\",\n  \"telephone\": \"+1-234-567-8900\",\n  \"contactType\": \"customer service\"\n}"
        }
    },
    
    // Essential schema properties
    templates: {
        Organization: {
            required: ['@type', '@id', 'name', 'url'],
            recommended: ['logo', 'description', 'contactPoint', 'address', 'sameAs'],
            context: 'https://schema.org',
            seoImpact: 'high'
        },
        Person: {
            required: ['@type', '@id', 'name'],
            recommended: ['jobTitle', 'worksFor', 'url', 'sameAs', 'image'],
            context: 'https://schema.org',
            seoImpact: 'medium'
        },
        Product: {
            required: ['@type', '@id', 'name', 'description'],
            recommended: ['image', 'offers', 'brand', 'review', 'aggregateRating'],
            context: 'https://schema.org',
            seoImpact: 'very high'
        },
        WebPage: {
            required: ['@type', '@id', 'name', 'url'],
            recommended: ['description', 'datePublished', 'dateModified', 'breadcrumb'],
            context: 'https://schema.org',
            seoImpact: 'high'
        },
        Article: {
            required: ['@type', '@id', 'headline', 'author', 'datePublished'],
            recommended: ['image', 'publisher', 'dateModified', 'wordCount', 'articleSection'],
            context: 'https://schema.org',
            seoImpact: 'very high'
        },
        BreadcrumbList: {
            required: ['@type', '@id', 'itemListElement'],
            recommended: ['numberOfItems'],
            context: 'https://schema.org',
            seoImpact: 'high'
        },
        LocalBusiness: {
            required: ['@type', '@id', 'name', 'address', 'telephone'],
            recommended: ['openingHours', 'geo', 'priceRange', 'image', 'review'],
            context: 'https://schema.org',
            seoImpact: 'very high'
        }
    },
    
    // @id validation patterns
    idPatterns: {
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
    },
    
    // Reference properties for entity connections
    referenceProperties: [
        'author', 'editor', 'publisher', 'creator',
        'member', 'employee', 'founder', 'owner',
        'mainEntity', 'about', 'mentions',
        'isPartOf', 'hasPart', 'memberOf',
        'worksFor', 'alumniOf', 'knows',
        'follows', 'sponsor', 'funder'
    ]
};

/**
 * הגדרות ניקוד והערכה
 */
const scoring = {
    // Consistency scoring weights
    consistencyWeights: {
        idCoverage: 0.4,        // 40% - having @id properties
        patternUsage: 0.3,      // 30% - using good @id patterns
        typeConsistency: 0.2,   // 20% - consistent @id per type
        crossPageReuse: 0.1     // 10% - @id reuse across pages
    },
    
    // Quality scoring weights
    qualityWeights: {
        completeness: 0.3,      // 30% - schema completeness
        consistency: 0.25,      // 25% - @id consistency
        connectivity: 0.2,      // 20% - entity relationships
        coverage: 0.15,         // 15% - schema type coverage
        technical: 0.1          // 10% - technical correctness
    },
    
    // SEO impact weights
    seoWeights: {
        'very high': 10,
        'high': 7,
        'medium': 5,
        'low': 3,
        'minimal': 1
    },
    
    // Score thresholds
    thresholds: {
        excellent: 90,
        veryGood: 80,
        good: 70,
        fair: 60,
        poor: 0
    }
};

/**
 * הגדרות אחסון
 */
const storage = {
    // Data directory structure
    dataDir: path.join(__dirname, '..', 'data'),
    scansDir: path.join(__dirname, '..', 'data', 'scans'),
    cacheDir: path.join(__dirname, '..', 'data', 'cache'),
    templatesDir: path.join(__dirname, '..', 'data', 'templates'),
    
    // File naming patterns
    scanFilePattern: '{scan_id}.json',
    cacheFilePattern: '{url_hash}.json',
    indexFile: 'index.json',
    
    // Cache settings
    cache: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        maxSize: 1000, // Maximum number of cached items
        cleanupInterval: 60 * 60 * 1000 // 1 hour
    },
    
    // File size limits
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxScanResults: 100, // Maximum scan results to keep
    
    // Backup settings
    backup: {
        enabled: true,
        interval: 24 * 60 * 60 * 1000, // Daily backups
        maxBackups: 7, // Keep 7 days of backups
        backupDir: path.join(__dirname, '..', 'data', 'backups')
    }
};

/**
 * הגדרות logging
 */
const logging = {
    level: process.env.LOG_LEVEL || 'info',
    format: 'combined',
    
    // Log file settings
    file: {
        enabled: true,
        filename: path.join(__dirname, '..', 'logs', 'app.log'),
        maxSize: '10MB',
        maxFiles: 5,
        datePattern: 'YYYY-MM-DD'
    },
    
    // Console logging
    console: {
        enabled: true,
        colorize: true,
        timestamp: true
    },
    
    // Error logging
    error: {
        filename: path.join(__dirname, '..', 'logs', 'error.log'),
        level: 'error'
    }
};

/**
 * הגדרות ביצועים ואופטימיזציה
 */
const performance = {
    // Memory limits
    maxMemoryUsage: '512MB',
    
    // Concurrent processing limits
    maxConcurrentScans: 3,
    maxConcurrentPages: 5,
    
    // Timeout settings
    timeouts: {
        pageLoad: 30000,        // 30 seconds
        apiRequest: 60000,      // 60 seconds
        siteMapperScan: 600000, // 10 minutes
        singlePageScan: 30000   // 30 seconds
    },
    
    // Queue settings
    queue: {
        maxSize: 100,
        processingDelay: 1000,
        retryAttempts: 3,
        retryDelay: 5000
    },
    
    // Resource optimization
    optimization: {
        compressResponses: true,
        cacheStatic: true,
        minifyJson: false, // Keep readable for debugging
        enableEtags: true
    }
};

/**
 * הגדרות אבטחה
 */
const security = {
    // Helmet configuration
    helmet: {
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
                scriptSrc: ["'self'", "'unsafe-inline'", "https://d3js.org", "https://cdn.tailwindcss.com"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'"],
                fontSrc: ["'self'", "https:"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"]
            }
        },
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true
        }
    },
    
    // Input validation
    validation: {
        maxUrlLength: 2048,
        maxJsonSize: 5 * 1024 * 1024, // 5MB
        allowedDomains: [], // Empty = allow all
        blockedDomains: [
            'localhost',
            '127.0.0.1',
            '0.0.0.0'
        ]
    },
    
    // Request filtering
    filtering: {
        enableIpFiltering: false,
        allowedIps: [],
        blockedIps: [],
        maxRequestsPerMinute: 60
    }
};

/**
 * הגדרות API
 */
const api = {
    // Response formats
    defaultFormat: 'json',
    supportedFormats: ['json', 'xml'],
    
    // API versioning
    version: 'v1',
    versionHeader: 'X-API-Version',
    
    // Response settings
    response: {
        includeTimestamp: true,
        includeVersion: true,
        prettyPrint: false,
        maxResponseSize: 10 * 1024 * 1024 // 10MB
    },
    
    // Endpoints configuration
    endpoints: {
        analyze: {
            path: '/analyze',
            method: 'POST',
            rateLimit: 10, // per minute
            timeout: 60000
        },
        scanSite: {
            path: '/scan-site',
            method: 'POST',
            rateLimit: 2, // per minute
            timeout: 600000 // 10 minutes
        },
        results: {
            path: '/results/:scanId',
            method: 'GET',
            rateLimit: 30, // per minute
            timeout: 30000
        },
        healthCheck: {
            path: '/health-check',
            method: 'GET',
            rateLimit: 60, // per minute
            timeout: 10000
        },
        entityGraph: {
            path: '/entity-graph/:scanId',
            method: 'GET',
            rateLimit: 20, // per minute
            timeout: 30000
        }
    }
};

/**
 * הגדרות dashboard
 */
const dashboard = {
    // UI settings
    theme: 'light',
    autoRefresh: true,
    refreshInterval: 30000, // 30 seconds
    
    // Chart settings
    charts: {
        defaultHeight: 400,
        defaultWidth: 600,
        animationDuration: 750,
        colorScheme: [
            '#3b82f6', // blue
            '#10b981', // green
            '#f59e0b', // yellow
            '#ef4444', // red
            '#8b5cf6', // purple
            '#06b6d4', // cyan
            '#84cc16', // lime
            '#f97316'  // orange
        ]
    },
    
    // Table settings
    tables: {
        defaultPageSize: 25,
        maxPageSize: 100,
        sortable: true,
        filterable: true
    },
    
    // Export settings
    export: {
        formats: ['json', 'csv', 'pdf'],
        maxExportSize: 50 * 1024 * 1024, // 50MB
        includeCharts: true
    }
};

/**
 * הגדרות מוניטורינג ו-alerts
 */
const monitoring = {
    // Health check settings
    healthCheck: {
        enabled: true,
        interval: 60000, // 1 minute
        endpoints: [
            '/api/health',
            '/api/status'
        ]
    },
    
    // Metrics collection
    metrics: {
        enabled: true,
        collectInterval: 30000, // 30 seconds
        retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
        aggregationInterval: 5 * 60 * 1000 // 5 minutes
    },
    
    // Alerting
    alerts: {
        enabled: false, // Disabled by default
        rules: [
            {
                name: 'High Memory Usage',
                condition: 'memory_usage > 80%',
                severity: 'warning',
                cooldown: 300000 // 5 minutes
            },
            {
                name: 'High Error Rate',
                condition: 'error_rate > 5%',
                severity: 'critical',
                cooldown: 60000 // 1 minute
            }
        ]
    }
};

/**
 * הגדרות development ו-testing
 */
const development = {
    // Debug settings
    debug: process.env.NODE_ENV === 'development',
    verbose: process.env.VERBOSE === 'true',
    
    // Hot reload
    hotReload: process.env.NODE_ENV === 'development',
    
    // Mock data
    useMockData: process.env.USE_MOCK_DATA === 'true',
    mockDataDir: path.join(__dirname, '..', 'test', 'mock-data'),
    
    // Testing
    testing: {
        enabled: process.env.NODE_ENV === 'test',
        timeout: 30000,
        retries: 2,
        coverage: {
            enabled: true,
            threshold: 80
        }
    }
};

/**
 * הגדרות environment-specific
 */
const environments = {
    development: {
        debug: true,
        logging: { level: 'debug' },
        performance: { maxConcurrentScans: 1 },
        security: { validation: { blockedDomains: [] } }
    },
    
    test: {
        debug: false,
        logging: { level: 'error' },
        storage: { cache: { maxAge: 1000 } }, // Short cache for tests
        crawler: { maxPages: 5 } // Limit for tests
    },
    
    production: {
        debug: false,
        logging: { level: 'info' },
        performance: { maxConcurrentScans: 5 },
        security: { 
            helmet: { contentSecurityPolicy: true },
            filtering: { enableIpFiltering: true }
        }
    }
};

/**
 * פונקציה לטעינת הגדרות לפי environment
 */
function getConfig() {
    const env = process.env.NODE_ENV || 'development';
    const baseConfig = {
        app,
        crawler,
        schema,
        scoring,
        storage,
        logging,
        performance,
        security,
        api,
        dashboard,
        monitoring,
        development
    };
    
    // Merge environment-specific settings
    const envConfig = environments[env] || {};
    
    return mergeDeep(baseConfig, envConfig);
}

/**
 * Deep merge utility for configuration
 */
function mergeDeep(target, source) {
    const result = { ...target };
    
    for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = mergeDeep(result[key] || {}, source[key]);
        } else {
            result[key] = source[key];
        }
    }
    
    return result;
}

/**
 * Validation של configuration
 */
function validateConfig(config) {
    const errors = [];
    
    // בדיקות בסיסיות
    if (!config.app.port || config.app.port < 1 || config.app.port > 65535) {
        errors.push('Invalid port number');
    }
    
    if (!config.storage.dataDir) {
        errors.push('Data directory not specified');
    }
    
    if (config.crawler.maxPages < 1 || config.crawler.maxPages > 1000) {
        errors.push('Invalid maxPages value (must be 1-1000)');
    }
    
    if (config.crawler.crawlDelay < 100) {
        errors.push('Crawl delay too low (minimum 100ms)');
    }
    
    if (errors.length > 0) {
        throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
    
    return true;
}

/**
 * יצוא ההגדרות
 */
const config = getConfig();

// Validate configuration on startup
if (process.env.NODE_ENV !== 'test') {
    validateConfig(config);
}

module.exports = config;

// Export individual sections for convenience
module.exports.app = config.app;
module.exports.crawler = config.crawler;
module.exports.schema = config.schema;
module.exports.scoring = config.scoring;
module.exports.storage = config.storage;
module.exports.logging = config.logging;
module.exports.performance = config.performance;
module.exports.security = config.security;
module.exports.api = config.api;
module.exports.dashboard = config.dashboard;
module.exports.monitoring = config.monitoring;
module.exports.development = config.development;
