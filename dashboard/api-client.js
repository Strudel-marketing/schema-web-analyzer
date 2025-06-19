// dashboard/api-client.js - Schema Web Analyzer API Client
class APIClient {
    constructor() {
        this.baseURL = this.getBaseURL();
        this.timeout = 30000; // 30 seconds default
    }

    /**
     * Get base URL for API calls
     */
    getBaseURL() {
        // In production, use relative URLs
        // In development, you might need to specify the full URL
        return window.location.origin;
    }

    /**
     * Make HTTP request with error handling
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        const config = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            timeout: this.timeout,
            ...options
        };

        try {
            console.log(`🌐 API Request: ${config.method} ${endpoint}`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), config.timeout);
            
            const response = await fetch(url, {
                ...config,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorData.message || errorMessage;
                } catch (e) {
                    // If response is not JSON, use status text
                }
                
                throw new Error(errorMessage);
            }
            
            const data = await response.json();
            console.log(`✅ API Response: ${config.method} ${endpoint}`, data);
            
            return data;
            
        } catch (error) {
            console.error(`❌ API Error: ${config.method} ${endpoint}`, error);
            
            if (error.name === 'AbortError') {
                throw new Error('Request timeout - please try again');
            }
            
            throw error;
        }
    }

    /**
     * Analyze single URL
     */
    async analyze(url, options = {}) {
        return this.request('/api/analyze', {
            method: 'POST',
            body: JSON.stringify({
                url,
                options
            })
        });
    }

    /**
     * Start site-wide scan
     */
    async scanSite(startUrl, options = {}) {
        return this.request('/api/scan-site', {
            method: 'POST',
            body: JSON.stringify({
                start_url: startUrl,
                options
            })
        });
    }

    /**
     * Get scan progress
     */
    async getProgress(scanId) {
        return this.request(`/api/progress/${scanId}`);
    }

    /**
     * Get scan results
     */
    async getResults(scanId) {
        return this.request(`/api/results/${scanId}`);
    }

    /**
     * Get entity relationship graph
     */
    async getEntityGraph(scanId) {
        return this.request(`/api/entity-graph/${scanId}`);
    }

    /**
     * Quick health check
     */
    async healthCheck(url) {
        return this.request(`/api/health-check?url=${encodeURIComponent(url)}`);
    }

    /**
     * Get recent scans
     */
    async getRecentScans(limit = 10, offset = 0) {
        return this.request(`/api/scans?limit=${limit}&offset=${offset}`);
    }

    /**
     * Delete scan
     */
    async deleteScan(scanId) {
        return this.request(`/api/scans/${scanId}`, {
            method: 'DELETE'
        });
    }

    /**
     * Stop active scan
     */
    async stopScan(scanId) {
        return this.request(`/api/scans/${scanId}/stop`, {
            method: 'POST'
        });
    }

    /**
     * Get schema templates
     */
    async getTemplates() {
        return this.request('/api/templates');
    }

    /**
     * Get API documentation
     */
    async getDocs() {
        return this.request('/api/docs');
    }

    /**
     * Set request timeout
     */
    setTimeout(timeout) {
        this.timeout = timeout;
    }
}
