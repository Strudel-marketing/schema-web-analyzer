// api/config.js - Schema Web Analyzer Configuration

const config = {
    // Server configuration
    NODE_ENV: process.env.NODE_ENV || 'development',
    HOST: process.env.HOST || 'localhost',
    PORT: parseInt(process.env.PORT) || 3000,

    // CORS settings
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS 
        ? process.env.ALLOWED_ORIGINS.split(',')
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],

    // Rate limiting
    RATE_LIMIT: {
        POINTS: parseInt(process.env.RATE_LIMIT_POINTS) || 100,
        DURATION: parseInt(process.env.RATE_LIMIT_DURATION) || 60
    },

    // Puppeteer settings
    PUPPETEER: {
        HEADLESS: process.env.PUPPETEER_HEADLESS !== 'false',
        TIMEOUT: parseInt(process.env.PUPPETEER_TIMEOUT) || 30000,
        VIEWPORT: {
            width: parseInt(process.env.VIEWPORT_WIDTH) || 1920,
            height: parseInt(process.env.VIEWPORT_HEIGHT) || 1080
        },
        USER_AGENT: process.env.USER_AGENT || 'Schema-Web-Analyzer/1.0 (+https://schema-analyzer.com/bot)'
    },

    // Crawling limits
    CRAWLING: {
        MAX_PAGES_PER_SCAN: parseInt(process.env.MAX_PAGES_PER_SCAN) || 100,
        MAX_CONCURRENT_PAGES: parseInt(process.env.MAX_CONCURRENT_PAGES) || 5,
        CRAWL_DELAY: parseInt(process.env.CRAWL_DELAY) || 1000,
        REQUEST_TIMEOUT: parseInt(process.env.REQUEST_TIMEOUT) || 15000,
        MAX_DEPTH: parseInt(process.env.MAX_CRAWL_DEPTH) || 3
    },

    // Schema analysis settings
    ANALYSIS: {
        SCHEMA_RANKS: {
            'Organization': 5,
            'Person': 4,
            'WebSite': 3,
            'WebPage': 2,
            'Article': 4,
            'Product': 5,
            'LocalBusiness': 5,
            'Event': 4,
            'Recipe': 3,
            'Review': 3,
            'FAQPage': 4,
            'HowTo': 4,
            'JobPosting': 3,
            'Course': 3,
            'CreativeWork': 2,
            'BreadcrumbList': 1,
            'ItemList': 1,
            'Footer': 5,
            'Header': 5,
            'VideoObject': 3,
            'ImageObject': 2,
            'Service': 4,
            'Offer': 3,
            'ContactPoint': 3,
            'Address': 2,
            'Place': 3,
            'WebPageElement': 2,
            'SiteNavigationElement': 2
        },
        LOCATION_RECOMMENDATIONS: {
            'Organization': {
                suggestedPage: 'About page',
                reason: 'Organization schema is best placed on your About or main company information page.',
                urlPattern: '/about'
            },
            'ContactPage': {
                suggestedPage: 'Contact page', 
                reason: 'ContactPage schema should be implemented on your dedicated contact page.',
                urlPattern: '/contact'
            },
            'ContactPoint': {
                suggestedPage: 'Contact page',
                reason: 'ContactPoint schema is most effective when placed on your contact page.',
                urlPattern: '/contact'
            }
        }
    },

    // Consistency analysis
    CONSISTENCY: {
        ID_PATTERN_SCORE_WEIGHTS: {
            ID_COVERAGE: 40,        // % schemas with @id
            PATTERN_COMPLIANCE: 30, // % using schema: pattern
            TYPE_CONSISTENCY: 0,    // Penalty for inconsistent types
            CROSS_PAGE_REUSE: 30    // Bonus for reused @ids
        },
        RECOMMENDED_ID_PATTERN: 'schema:',
        MAX_INCONSISTENCY_PENALTY: 25
    },

    // File storage
    STORAGE: {
        SCANS_DIR: process.env.SCANS_DIR || 'data/scans',
        CACHE_DIR: process.env.CACHE_DIR || 'data/cache',
        TEMPLATES_DIR: process.env.TEMPLATES_DIR || 'data/templates',
        MAX_SCAN_AGE_DAYS: parseInt(process.env.MAX_SCAN_AGE_DAYS) || 30,
        MAX_CACHE_SIZE_MB: parseInt(process.env.MAX_CACHE_SIZE_MB) || 500
    },

    // Logging
    LOGGING: {
        LEVEL: process.env.LOG_LEVEL || 'info',
        FILE: process.env.LOG_FILE || 'logs/app.log',
        MAX_FILES: parseInt(process.env.LOG_MAX_FILES) || 5,
        MAX_SIZE: process.env.LOG_MAX_SIZE || '20m'
    },

    // Security
    SECURITY: {
        ALLOWED_DOMAINS: process.env.ALLOWED_DOMAINS 
            ? process.env.ALLOWED_DOMAINS.split(',')
            : [], // Empty = allow all domains
        BLOCKED_DOMAINS: process.env.BLOCKED_DOMAINS
            ? process.env.BLOCKED_DOMAINS.split(',')
            : ['localhost', '127.0.0.1', '0.0.0.0'],
        MAX_URL_LENGTH: parseInt(process.env.MAX_URL_LENGTH) || 2048
    },

    // Performance monitoring
    MONITORING: {
        ENABLE_METRICS: process.env.ENABLE_METRICS === 'true',
        METRICS_INTERVAL: parseInt(process.env.METRICS_INTERVAL) || 60000
    },

    // Feature flags
    FEATURES: {
        ENABLE_CACHING: process.env.ENABLE_CACHING !== 'false',
        ENABLE_COMPRESSION: process.env.ENABLE_COMPRESSION !== 'false',
        ENABLE_RATE_LIMITING: process.env.ENABLE_RATE_LIMITING !== 'false',
        ENABLE_ENTITY_ANALYSIS: process.env.ENABLE_ENTITY_ANALYSIS !== 'false',
        ENABLE_SITE_MAPPING: process.env.ENABLE_SITE_MAPPING !== 'false'
    }
};

// Validation
const requiredEnvVars = [];

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`Required environment variable ${envVar} is not set`);
    }
}

// Export configuration
module.exports = config;

// Export individual sections for easier importing
module.exports.PUPPETEER = config.PUPPETEER;
module.exports.CRAWLING = config.CRAWLING;
module.exports.ANALYSIS = config.ANALYSIS;
module.exports.CONSISTENCY = config.CONSISTENCY;
module.exports.STORAGE = config.STORAGE;
module.exports.SECURITY = config.SECURITY;
