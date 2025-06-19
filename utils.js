// utils.js - Utility Functions for Schema Web Analyzer
// מבוסס על הקוד המקורי עם התאמות ל-Node.js

const crypto = require('crypto');
const { URL } = require('url');
const path = require('path');

/**
 * פונקציות עזר לניתוח URLs
 * מבוססות על הקוד המקורי מ-background.js ו-content.js
 */
class URLUtils {
    /**
     * ניקוי וvalidation של URL
     * מבוסס על sanitizeUrl מהקוד המקורי
     */
    static sanitizeUrl(url) {
        try {
            // Skip schema type names or other non-URL strings
            if (!url || typeof url !== 'string' || url.length < 7) {
                return null;
            }
            
            // Skip if it looks like a schema type (contains colons but not http/https)
            if (url.includes(':') && !url.startsWith('http:') && !url.startsWith('https:')) {
                console.log('Skipping non-URL string:', url);
                return null;
            }
            
            const parsed = new URL(url);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                throw new Error('Invalid protocol');
            }
            return parsed.toString();
        } catch (e) {
            console.log('Invalid URL skipped:', url, e.message);
            return null;
        }
    }

    /**
     * בדיקה אם URL תקין
     * מבוסס על isValidUrl מהקוד המקורי
     */
    static isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    /**
     * חילוץ title מURL
     * מבוסס על extractPageTitle מהקוד המקורי
     */
    static extractTitleFromUrl(url) {
        if (!url || url === 'Current Page') return 'Current Page';
        
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
     * בדיקה אם URL הוא דף בית
     * מבוסס על isHomePage מהקוד המקורי
     */
    static isHomePage(url) {
        try {
            const parsedUrl = new URL(url);
            const path = parsedUrl.pathname;
            const cleanPath = path.endsWith('/') ? path.slice(0, -1) : path;
            
            return cleanPath === '' || 
                   cleanPath.toLowerCase() === '/index.html' ||
                   cleanPath.toLowerCase() === '/index.php';
        } catch (e) {
            console.error('Error parsing URL:', e);
            return false;
        }
    }

    /**
     * בדיקה אם URL צריך להיות מסונן
     * מבוסס על shouldSkipUrl מהקוד המקורי
     */
    static shouldSkipUrl(url) {
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
     * יצירת hash לURL לשימוש בcache
     */
    static createUrlHash(url) {
        return crypto.createHash('md5').update(url).digest('hex');
    }

    /**
     * נרמול URL להשוואה
     */
    static normalizeUrl(url) {
        try {
            const parsed = new URL(url);
            // Remove trailing slash, fragments, and some query params
            parsed.hash = '';
            let pathname = parsed.pathname;
            if (pathname.endsWith('/') && pathname.length > 1) {
                pathname = pathname.slice(0, -1);
            }
            parsed.pathname = pathname;
            
            // Sort query parameters for consistent comparison
            const searchParams = new URLSearchParams(parsed.search);
            const sortedParams = new URLSearchParams();
            [...searchParams.keys()].sort().forEach(key => {
                sortedParams.append(key, searchParams.get(key));
            });
            parsed.search = sortedParams.toString();
            
            return parsed.toString();
        } catch (e) {
            return url;
        }
    }
}

/**
 * פונקציות עזר לעיבוד Schema
 * מבוססות על הקוד המקורי מ-schema-engine.js
 */
class SchemaUtils {
    /**
     * בדיקה אם schema ריק
     * מבוסס על isEmptySchema מהקוד המקורי
     */
    static isEmptySchema(obj) {
        if (!obj || typeof obj !== 'object') return true;
        const keys = Object.keys(obj);
        return keys.length <= 2 && keys.every(key => key === '@type' || key === '@id');
    }

    /**
     * חילוץ סוג schema
     * מבוסס על getSchemaType מהקוד המקורי
     */
    static getSchemaType(schema) {
        if (!schema || typeof schema !== 'object') return null;
        try {
            return Array.isArray(schema['@type']) ? schema['@type'][0] : schema['@type'];
        } catch (error) {
            console.error('Error getting schema type:', error);
            return null;
        }
    }

    /**
     * ניקוי schema מmetadata
     */
    static cleanSchema(schema) {
        if (!schema || typeof schema !== 'object') return null;
        
        const cleaned = { ...schema };
        delete cleaned._siteMapperInfo;
        delete cleaned._metadata;
        delete cleaned._source;
        
        return cleaned;
    }

    /**
     * validation בסיסי של schema
     * מבוסס על validateSchema מהקוד המקורי
     */
    static validateSchema(schema) {
        if (!schema || typeof schema !== 'object') return false;
        
        const type = SchemaUtils.getSchemaType(schema);
        if (!type) return false;
        
        return !SchemaUtils.isEmptySchema(schema);
    }

    /**
     * חילוץ כל הentities מtree של schema
     */
    static extractEntities(schema) {
        const entities = [];
        
        function extractRecursive(obj, path = '') {
            if (!obj || typeof obj !== 'object') return;
            
            if (obj['@type']) {
                entities.push({
                    type: SchemaUtils.getSchemaType(obj),
                    id: obj['@id'] || null,
                    path: path,
                    entity: obj
                });
            }
            
            Object.entries(obj).forEach(([key, value]) => {
                if (key.startsWith('@')) return; // Skip @context, @type, @id
                
                const newPath = path ? `${path}.${key}` : key;
                
                if (Array.isArray(value)) {
                    value.forEach((item, index) => {
                        if (item && typeof item === 'object') {
                            extractRecursive(item, `${newPath}[${index}]`);
                        }
                    });
                } else if (value && typeof value === 'object') {
                    extractRecursive(value, newPath);
                }
            });
        }
        
        extractRecursive(schema);
        return entities;
    }

    /**
     * חיפוש references לentities אחרים
     */
    static findReferences(schema) {
        const references = new Set();
        const referenceProps = [
            'author', 'editor', 'publisher', 'creator',
            'member', 'employee', 'founder', 'owner',
            'mainEntity', 'about', 'mentions',
            'isPartOf', 'hasPart', 'memberOf',
            'worksFor', 'alumniOf', 'knows',
            'follows', 'sponsor', 'funder'
        ];
        
        function findReferencesRecursive(obj) {
            if (!obj || typeof obj !== 'object') return;
            
            Object.entries(obj).forEach(([key, value]) => {
                // Check for reference properties
                if (referenceProps.includes(key)) {
                    if (typeof value === 'string' && (value.startsWith('schema:') || value.startsWith('#'))) {
                        references.add(value);
                    } else if (value && value['@id']) {
                        references.add(value['@id']);
                    }
                }
                
                // Check for @id in nested structures
                if (value && typeof value === 'object') {
                    if (value['@id']) {
                        references.add(value['@id']);
                    }
                    
                    if (Array.isArray(value)) {
                        value.forEach(item => {
                            if (item && typeof item === 'object') {
                                findReferencesRecursive(item);
                            }
                        });
                    } else {
                        findReferencesRecursive(value);
                    }
                }
            });
        }
        
        findReferencesRecursive(schema);
        return Array.from(references);
    }

    /**
     * השוואה בין schemas
     */
    static compareSchemas(schema1, schema2) {
        const clean1 = SchemaUtils.cleanSchema(schema1);
        const clean2 = SchemaUtils.cleanSchema(schema2);
        
        return JSON.stringify(clean1) === JSON.stringify(clean2);
    }

    /**
     * מיזוג schemas
     */
    static mergeSchemas(schema1, schema2) {
        if (!schema1) return schema2;
        if (!schema2) return schema1;
        
        // Simple merge - in practice might need more sophisticated logic
        return { ...schema1, ...schema2 };
    }
}

/**
 * פונקציות עזר לעבודה עם קבצים
 */
class FileUtils {
    /**
     * יצירת שם קובץ בטוח
     */
    static createSafeFilename(name) {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9-_]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    /**
     * יצירת timestamp לשמות קבצים
     */
    static createTimestamp() {
        return new Date().toISOString().replace(/[:.]/g, '-');
    }

    /**
     * יצירת שם קובץ ייחודי
     */
    static createUniqueFilename(baseName, extension = '.json') {
        const timestamp = FileUtils.createTimestamp();
        const safeName = FileUtils.createSafeFilename(baseName);
        return `${safeName}-${timestamp}${extension}`;
    }

    /**
     * בדיקת גודל קובץ JSON
     */
    static calculateJsonSize(data) {
        return Buffer.byteLength(JSON.stringify(data), 'utf8');
    }

    /**
     * דחיסת JSON למקרים של קבצים גדולים
     */
    static compressJson(data) {
        return JSON.stringify(data, null, 0); // No formatting
    }

    /**
     * יפוי JSON לקריאה
     */
    static beautifyJson(data) {
        return JSON.stringify(data, null, 2);
    }
}

/**
 * פונקציות עזר לעבודה עם זמן ותאריכים
 */
class TimeUtils {
    /**
     * פורמט זמן לקריאה
     */
    static formatTime(milliseconds) {
        if (milliseconds < 1000) {
            return `${milliseconds}ms`;
        }
        
        const seconds = Math.floor(milliseconds / 1000);
        if (seconds < 60) {
            return `${seconds}s`;
        }
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    }

    /**
     * יצירת ISO timestamp
     */
    static createTimestamp() {
        return new Date().toISOString();
    }

    /**
     * חישוב גיל של item לפי timestamp
     */
    static getAge(timestamp) {
        const now = new Date();
        const then = new Date(timestamp);
        return now.getTime() - then.getTime();
    }

    /**
     * בדיקה אם timestamp פג תוקפו
     */
    static isExpired(timestamp, maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
        return TimeUtils.getAge(timestamp) > maxAge;
    }

    /**
     * פורמט זמן יחסי (לפני x זמן)
     */
    static formatRelativeTime(timestamp) {
        const age = TimeUtils.getAge(timestamp);
        
        if (age < 60000) { // Less than 1 minute
            return 'just now';
        } else if (age < 3600000) { // Less than 1 hour
            const minutes = Math.floor(age / 60000);
            return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
        } else if (age < 86400000) { // Less than 24 hours
            const hours = Math.floor(age / 3600000);
            return `${hours} hour${hours === 1 ? '' : 's'} ago`;
        } else {
            const days = Math.floor(age / 86400000);
            return `${days} day${days === 1 ? '' : 's'} ago`;
        }
    }
}

/**
 * פונקציות עזר לlogger
 */
class LoggerUtils {
    /**
     * פורמט הודעת log
     */
    static formatLogMessage(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const emoji = LoggerUtils.getLevelEmoji(level);
        
        let formatted = `${emoji} [${timestamp}] ${level.toUpperCase()}: ${message}`;
        
        if (data) {
            formatted += `\n${JSON.stringify(data, null, 2)}`;
        }
        
        return formatted;
    }

    /**
     * emoji לפי רמת log
     */
    static getLevelEmoji(level) {
        const emojis = {
            'info': 'ℹ️',
            'success': '✅',
            'warning': '⚠️',
            'error': '❌',
            'debug': '🐛',
            'trace': '🔍'
        };
        
        return emojis[level.toLowerCase()] || 'ℹ️';
    }

    /**
     * קיצור מידע רגיש ב-logs
     */
    static sanitizeForLog(data) {
        if (typeof data !== 'object' || data === null) {
            return data;
        }
        
        const sanitized = { ...data };
        const sensitiveFields = ['password', 'token', 'key', 'secret', 'auth'];
        
        sensitiveFields.forEach(field => {
            if (sanitized[field]) {
                sanitized[field] = '***redacted***';
            }
        });
        
        return sanitized;
    }
}

/**
 * פונקציות עזר ל-validation
 */
class ValidationUtils {
    /**
     * בדיקת תקינות email
     */
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * בדיקת תקינות מספר טלפון בסיסית
     */
    static isValidPhone(phone) {
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
    }

    /**
     * בדיקת תקינות Schema.org type
     */
    static isValidSchemaType(type) {
        // רשימה חלקית של schema types נפוצים
        const commonTypes = [
            'Thing', 'CreativeWork', 'Event', 'Intangible', 'MedicalEntity',
            'Organization', 'Person', 'Place', 'Product', 'Action',
            'WebPage', 'WebSite', 'Article', 'NewsArticle', 'BlogPosting',
            'Recipe', 'Review', 'Movie', 'Book', 'LocalBusiness',
            'Restaurant', 'Hotel', 'BreadcrumbList', 'ItemList',
            'FAQPage', 'HowTo', 'JobPosting', 'Course', 'Event'
        ];
        
        return commonTypes.includes(type);
    }

    /**
     * בדיקת תקינות @id format
     */
    static isValidSchemaId(id) {
        if (!id || typeof id !== 'string') return false;
        
        // Valid patterns for @id
        const validPatterns = [
            /^schema:/,                    // schema:EntityType
            /^https?:\/\/.*#/,            // URL with fragment
            /^#[a-zA-Z]/,                 // Local fragment
            /^https?:\/\/schema\.org\//   // Schema.org URL
        ];
        
        return validPatterns.some(pattern => pattern.test(id));
    }

    /**
     * נרמול מחרוזת לזיהוי
     */
    static normalizeString(str) {
        if (!str || typeof str !== 'string') return '';
        
        return str
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s-]/g, '');
    }

    /**
     * בדיקת אורך מינימלי למחרוזת
     */
    static hasMinLength(str, minLength = 1) {
        return str && typeof str === 'string' && str.trim().length >= minLength;
    }
}

/**
 * פונקציות עזר לעיבוד נתונים
 */
class DataUtils {
    /**
     * deep clone של אובייקט
     */
    static deepClone(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        
        if (obj instanceof Date) {
            return new Date(obj.getTime());
        }
        
        if (obj instanceof Array) {
            return obj.map(item => DataUtils.deepClone(item));
        }
        
        if (typeof obj === 'object') {
            const clonedObj = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clonedObj[key] = DataUtils.deepClone(obj[key]);
                }
            }
            return clonedObj;
        }
    }

    /**
     * מיזוג עמוק של אובייקטים
     */
    static deepMerge(target, source) {
        const result = DataUtils.deepClone(target);
        
        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    result[key] = DataUtils.deepMerge(result[key] || {}, source[key]);
                } else {
                    result[key] = source[key];
                }
            }
        }
        
        return result;
    }

    /**
     * סינון ערכים ריקים מאובייקט
     */
    static removeEmpty(obj) {
        if (Array.isArray(obj)) {
            return obj
                .map(item => DataUtils.removeEmpty(item))
                .filter(item => item !== null && item !== undefined);
        }
        
        if (obj && typeof obj === 'object') {
            const cleaned = {};
            Object.entries(obj).forEach(([key, value]) => {
                const cleanedValue = DataUtils.removeEmpty(value);
                if (cleanedValue !== null && cleanedValue !== undefined && cleanedValue !== '') {
                    cleaned[key] = cleanedValue;
                }
            });
            return Object.keys(cleaned).length > 0 ? cleaned : null;
        }
        
        return obj;
    }

    /**
     * קיבוץ מערך לפי property
     */
    static groupBy(array, key) {
        return array.reduce((groups, item) => {
            const groupKey = typeof key === 'function' ? key(item) : item[key];
            if (!groups[groupKey]) {
                groups[groupKey] = [];
            }
            groups[groupKey].push(item);
            return groups;
        }, {});
    }

    /**
     * ספירת תדירות ערכים
     */
    static countBy(array, key) {
        return array.reduce((counts, item) => {
            const countKey = typeof key === 'function' ? key(item) : item[key];
            counts[countKey] = (counts[countKey] || 0) + 1;
            return counts;
        }, {});
    }

    /**
     * יצירת מערך ייחודי
     */
    static unique(array, key = null) {
        if (!key) {
            return [...new Set(array)];
        }
        
        const seen = new Set();
        return array.filter(item => {
            const keyValue = typeof key === 'function' ? key(item) : item[key];
            if (seen.has(keyValue)) {
                return false;
            }
            seen.add(keyValue);
            return true;
        });
    }

    /**
     * חישוב אחוזים
     */
    static calculatePercentage(part, total, precision = 1) {
        if (!total || total === 0) return 0;
        return Math.round((part / total) * 100 * Math.pow(10, precision)) / Math.pow(10, precision);
    }

    /**
     * נרמול ציון לטווח 0-100
     */
    static normalizeScore(score, min = 0, max = 100) {
        return Math.max(min, Math.min(max, score));
    }
}

/**
 * פונקציות עזר לטיפול בשגיאות
 */
class ErrorUtils {
    /**
     * יצירת שגיאה מותאמת אישית
     */
    static createError(message, type = 'Error', details = {}) {
        const error = new Error(message);
        error.name = type;
        error.details = details;
        error.timestamp = new Date().toISOString();
        return error;
    }

    /**
     * בדיקה אם שגיאה מסוג מסוים
     */
    static isErrorType(error, type) {
        return error && error.name === type;
    }

    /**
     * עיבוד מידע שגיאה לlog
     */
    static formatErrorForLog(error) {
        return {
            name: error.name || 'Error',
            message: error.message,
            stack: error.stack,
            details: error.details || {},
            timestamp: error.timestamp || new Date().toISOString()
        };
    }

    /**
     * יצירת שגיאת validation
     */
    static createValidationError(field, value, expected) {
        return ErrorUtils.createError(
            `Validation failed for field '${field}'`,
            'ValidationError',
            { field, value, expected }
        );
    }

    /**
     * יצירת שגיאת network
     */
    static createNetworkError(url, statusCode, message) {
        return ErrorUtils.createError(
            `Network error: ${message}`,
            'NetworkError',
            { url, statusCode }
        );
    }
}

/**
 * פונקציות עזר לביצועים
 */
class PerformanceUtils {
    /**
     * מדידת זמן ביצוע
     */
    static async measureTime(fn, label = 'Operation') {
        const start = Date.now();
        let result;
        let error;
        
        try {
            result = await fn();
        } catch (e) {
            error = e;
        }
        
        const duration = Date.now() - start;
        console.log(`⏱️ ${label}: ${TimeUtils.formatTime(duration)}`);
        
        if (error) throw error;
        return result;
    }

    /**
     * debounce function
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * throttle function
     */
    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * יצירת retry mechanism
     */
    static async retry(fn, maxAttempts = 3, delay = 1000) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (error) {
                if (attempt === maxAttempts) {
                    throw error;
                }
                console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
}

// Export all utilities
module.exports = {
    URLUtils,
    SchemaUtils,
    FileUtils,
    TimeUtils,
    LoggerUtils,
    ValidationUtils,
    DataUtils,
    ErrorUtils,
    PerformanceUtils
};
