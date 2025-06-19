// api/server.js - Schema Web Analyzer Server
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const fs = require('fs-extra');
const winston = require('winston');
const { RateLimiterMemory } = require('rate-limiter-flexible');

// Import local modules
const config = require('./config');
const apiRoutes = require('./routes/api');
const healthRoutes = require('./routes/health');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

class SchemaWebAnalyzer {
    constructor() {
        this.app = express();
        this.server = null;
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    setupMiddleware() {
        // Security
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "https://d3js.org", "https://cdn.tailwindcss.com"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'"]
                }
            }
        }));

        // CORS
        this.app.use(cors({
            origin: config.ALLOWED_ORIGINS,
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            allowedHeaders: ['Content-Type', 'Authorization']
        }));

        // Compression
        this.app.use(compression());

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Rate limiting
        const rateLimiter = new RateLimiterMemory({
            keyGenerator: (req) => req.ip,
            points: config.RATE_LIMIT.POINTS,
            duration: config.RATE_LIMIT.DURATION
        });

        this.app.use(async (req, res, next) => {
            try {
                await rateLimiter.consume(req.ip);
                next();
            } catch (rejRes) {
                const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
                res.set('Retry-After', String(secs));
                res.status(429).json({
                    error: 'Rate limit exceeded',
                    retryAfter: secs
                });
            }
        });

        // Static files
        this.app.use(express.static(path.join(__dirname, '../dashboard')));
        this.app.use('/assets', express.static(path.join(__dirname, '../assets')));

        // Logging
        this.app.use((req, res, next) => {
            logger.info(`${req.method} ${req.url}`, {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                timestamp: new Date().toISOString()
            });
            next();
        });
    }

    setupRoutes() {
        // Health check
        this.app.use('/health', healthRoutes);

        // API routes
        this.app.use('/api', apiRoutes);

        // Dashboard route
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../dashboard/index.html'));
        });

        // 404 handler
        this.app.use('*', (req, res) => {
            if (req.url.startsWith('/api/')) {
                res.status(404).json({
                    error: 'API endpoint not found',
                    path: req.url,
                    method: req.method
                });
            } else {
                res.status(404).sendFile(path.join(__dirname, '../dashboard/index.html'));
            }
        });
    }

    setupErrorHandling() {
        this.app.use(errorHandler);

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (err) => {
            logger.error('Unhandled Promise Rejection:', err);
            this.shutdown();
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', (err) => {
            logger.error('Uncaught Exception:', err);
            this.shutdown();
        });

        // Graceful shutdown
        process.on('SIGTERM', () => {
            logger.info('SIGTERM received, shutting down gracefully');
            this.shutdown();
        });

        process.on('SIGINT', () => {
            logger.info('SIGINT received, shutting down gracefully');
            this.shutdown();
        });
    }

    async ensureDirectories() {
        const dirs = [
            path.join(__dirname, '../data/scans'),
            path.join(__dirname, '../data/templates'),
            path.join(__dirname, '../data/cache'),
            path.join(__dirname, '../assets/temp')
        ];

        for (const dir of dirs) {
            await fs.ensureDir(dir);
        }

        logger.info('Ensured all required directories exist');
    }

    async loadTemplates() {
        const templatesDir = path.join(__dirname, '../data/templates');
        
        try {
            const templateFiles = await fs.readdir(templatesDir);
            const templates = {};

            for (const file of templateFiles) {
                if (file.endsWith('.json')) {
                    const templateName = path.basename(file, '.json');
                    const templatePath = path.join(templatesDir, file);
                    templates[templateName] = await fs.readJson(templatePath);
                }
            }

            this.templates = templates;
            logger.info(`Loaded ${Object.keys(templates).length} schema templates`);
        } catch (error) {
            logger.warn('Could not load templates:', error.message);
            this.templates = {};
        }
    }

    async start() {
        try {
            await this.ensureDirectories();
            await this.loadTemplates();

            this.server = this.app.listen(config.PORT, config.HOST, () => {
                logger.info(`🚀 Schema Web Analyzer started`);
                logger.info(`📊 Dashboard: http://${config.HOST}:${config.PORT}`);
                logger.info(`🔧 API: http://${config.HOST}:${config.PORT}/api`);
                logger.info(`🌍 Environment: ${config.NODE_ENV}`);
                
                if (config.NODE_ENV === 'development') {
                    logger.info(`📋 API Docs: http://${config.HOST}:${config.PORT}/api/docs`);
                }
            });

            // Cleanup on startup
            this.scheduleCleanup();

        } catch (error) {
            logger.error('Failed to start server:', error);
            process.exit(1);
        }
    }

    scheduleCleanup() {
        // Clean old scan data every 24 hours
        const cron = require('node-cron');
        
        cron.schedule('0 2 * * *', async () => {
            logger.info('Starting scheduled cleanup...');
            
            try {
                const scansDir = path.join(__dirname, '../data/scans');
                const cacheDir = path.join(__dirname, '../data/cache');
                const now = Date.now();
                const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

                // Clean old scans
                const scanFiles = await fs.readdir(scansDir);
                let cleanedScans = 0;

                for (const file of scanFiles) {
                    const filePath = path.join(scansDir, file);
                    const stats = await fs.stat(filePath);
                    
                    if (now - stats.mtime.getTime() > maxAge) {
                        await fs.remove(filePath);
                        cleanedScans++;
                    }
                }

                // Clean old cache
                const cacheFiles = await fs.readdir(cacheDir);
                let cleanedCache = 0;

                for (const file of cacheFiles) {
                    const filePath = path.join(cacheDir, file);
                    const stats = await fs.stat(filePath);
                    
                    if (now - stats.mtime.getTime() > maxAge) {
                        await fs.remove(filePath);
                        cleanedCache++;
                    }
                }

                logger.info(`Cleanup completed: ${cleanedScans} scans, ${cleanedCache} cache files removed`);

            } catch (error) {
                logger.error('Cleanup failed:', error);
            }
        });
    }

    shutdown() {
        if (this.server) {
            this.server.close(() => {
                logger.info('Server shut down gracefully');
                process.exit(0);
            });

            // Force shutdown after 10 seconds
            setTimeout(() => {
                logger.error('Forcing server shutdown');
                process.exit(1);
            }, 10000);
        } else {
            process.exit(0);
        }
    }
}

// Start the server
if (require.main === module) {
    const analyzer = new SchemaWebAnalyzer();
    analyzer.start().catch((error) => {
        console.error('Failed to start Schema Web Analyzer:', error);
        process.exit(1);
    });
}

module.exports = SchemaWebAnalyzer;
