// API Client for Schema Web Analyzer Dashboard

class SchemaAPIClient {
    constructor() {
        this.baseURL = window.location.origin;
        this.timeout = 30000; // 30 seconds default
        this.debug = false;
    }

    setConfig(config) {
        if (config.timeout) this.timeout = config.timeout;
        if (config.debug !== undefined) this.debug = config.debug;
    }

    log(...args) {
        if (this.debug) {
            console.log('[API Client]', ...args);
        }
    }

    error(...args) {
        console.error('[API Client]', ...args);
    }

    // Generic API request method
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        const config = {
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        this.log(`Making request to: ${url}`, config);

        try {
            // Create abort controller for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), config.timeout);

            const response = await fetch(url, {
                ...config,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                let errorData;
                
                try {
                    errorData = JSON.parse(errorText);
                } catch (e) {
                    errorData = { error: errorText };
                }
                
                throw new APIError(
                    errorData.error || `HTTP ${response.status}`,
                    response.status,
                    errorData
                );
            }

            const data = await response.json();
            this.log('Response received:', data);
            return data;

        } catch (error) {
            if (error.name === 'AbortError') {
                throw new APIError('Request timeout', 408);
            }
            
            if (error instanceof APIError) {
                throw error;
            }
            
            this.error('Request failed:', error);
            throw new APIError(error.message, 0);
        }
    }

    // Health check
    async checkHealth() {
        try {
            const result = await this.request('/api/health');
            return {
                status: 'online',
                data: result
            };
        } catch (error) {
            return {
                status: 'offline',
                error: error.message
            };
        }
    }

    // Quick health check with URL
    async quickHealthCheck(url) {
        if (!url) {
            throw new APIError('URL is required for health check');
        }

        return await this.request(`/api/health-check?url=${encodeURIComponent(url)}`);
    }

    // Single page analysis
    async analyzePage(url, options = {}) {
        if (!url) {
            throw new APIError('URL is required for analysis');
        }

        this.log('Starting page analysis for:', url);

        const requestData = {
            url: url,
            options: {
                deep_scan: options.deepScan || false,
                include_recommendations: options.recommendations || false,
                check_consistency: options.consistencyCheck || false,
                analyze_entities: options.entityAnalysis || false
            }
        };

        return await this.request('/api/analyze', {
            method: 'POST',
            body: JSON.stringify(requestData)
        });
    }

    // Site-wide scanning
    async scanSite(startUrl, options = {}) {
        if (!startUrl) {
            throw new APIError('Start URL is required for site scan');
        }

        this.log('Starting site scan for:', startUrl);

        const requestData = {
            start_url: startUrl,
            options: {
                max_pages: options.maxPages || 25,
                include_sitemaps: options.includeSitemaps || true,
                crawl_depth: options.crawlDepth || 3,
                follow_external: false
            }
        };

        return await this.request('/api/scan-site', {
            method: 'POST',
            body: JSON.stringify(requestData)
        });
    }

    // Get scan results
    async getScanResults(scanId) {
        if (!scanId) {
            throw new APIError('Scan ID is required');
        }

        return await this.request(`/api/results/${scanId}`);
    }

    // Get entity graph
    async getEntityGraph(scanId) {
        if (!scanId) {
            throw new APIError('Scan ID is required for entity graph');
        }

        return await this.request(`/api/entity-graph/${scanId}`);
    }

    // Poll scan progress (for site scans)
    async pollScanProgress(scanId, onProgress, interval = 2000) {
        if (!scanId) {
            throw new APIError('Scan ID is required');
        }

        this.log('Starting poll for scan:', scanId);

        return new Promise((resolve, reject) => {
            const poll = async () => {
                try {
                    const result = await this.getScanResults(scanId);
                    
                    if (onProgress) {
                        onProgress(result);
                    }

                    if (result.status === 'completed') {
                        this.log('Scan completed:', scanId);
                        resolve(result);
                    } else if (result.status === 'failed') {
                        reject(new APIError('Scan failed', 500, result));
                    } else {
                        // Continue polling
                        setTimeout(poll, interval);
                    }
                } catch (error) {
                    this.error('Poll error:', error);
                    reject(error);
                }
            };

            poll();
        });
    }

    // Validate URL format
    isValidURL(string) {
        try {
            const url = new URL(string);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (_) {
            return false;
        }
    }

    // Format API errors for display
    formatError(error) {
        if (error instanceof APIError) {
            switch (error.status) {
                case 400:
                    return `Invalid request: ${error.message}`;
                case 404:
                    return `Resource not found: ${error.message}`;
                case 408:
                    return `Request timeout. Try again or increase timeout in settings.`;
                case 429:
                    return `Rate limit exceeded. Please wait a moment before trying again.`;
                case 500:
                    return `Server error: ${error.message}`;
                default:
                    return error.message;
            }
        }
        
        return error.message || 'Unknown error occurred';
    }

    // Get recent scans (if available)
    async getRecentScans(limit = 10) {
        try {
            return await this.request(`/api/recent-scans?limit=${limit}`);
        } catch (error) {
            // Not all implementations may have this endpoint
            this.log('Recent scans not available:', error.message);
            return { scans: [] };
        }
    }

    // Export results
    async exportResults(scanId, format = 'json') {
        if (!scanId) {
            throw new APIError('Scan ID is required for export');
        }

        const response = await fetch(`${this.baseURL}/api/export/${scanId}?format=${format}`);
        
        if (!response.ok) {
            throw new APIError(`Export failed: ${response.statusText}`, response.status);
        }

        return response.blob();
    }
}

// Custom error class for API errors
class APIError extends Error {
    constructor(message, status = 0, data = null) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.data = data;
    }
}

// Create global instance
window.schemaAPI = new SchemaAPIClient();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SchemaAPIClient, APIError };
}
