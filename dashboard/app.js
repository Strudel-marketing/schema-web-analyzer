// Main Application Logic for Schema Web Analyzer Dashboard

class SchemaAnalyzerApp {
    constructor() {
        this.currentScanId = null;
        this.currentResults = null;
        this.settings = {
            timeout: 30000,
            autoRefresh: false,
            debugMode: false
        };
        
        this.init();
    }

    init() {
        console.log('🚀 Initializing Schema Analyzer Dashboard');
        
        // Load settings from localStorage
        this.loadSettings();
        
        // Apply settings to API client
        window.schemaAPI.setConfig({
            timeout: this.settings.timeout,
            debug: this.settings.debugMode
        });

        // Initialize UI components
        this.initTabs();
        this.initEventListeners();
        this.initModals();
        
        // Check API health
        this.checkAPIHealth();
        
        // Auto-populate with example URL for demo
        this.setExampleURL();
        
        console.log('✅ Dashboard initialized');
    }

    // Initialize tab switching
    initTabs() {
        const singleTab = document.getElementById('singleAnalysisTab');
        const siteTab = document.getElementById('siteAnalysisTab');
        const singlePanel = document.getElementById('singleAnalysisPanel');
        const sitePanel = document.getElementById('siteAnalysisPanel');

        singleTab?.addEventListener('click', () => {
            singleTab.classList.add('active');
            siteTab.classList.remove('active');
            singlePanel.classList.remove('hidden');
            sitePanel.classList.add('hidden');
        });

        siteTab?.addEventListener('click', () => {
            siteTab.classList.add('active');
            singleTab.classList.remove('active');
            sitePanel.classList.remove('hidden');
            singlePanel.classList.add('hidden');
        });
    }

    // Initialize event listeners
    initEventListeners() {
        // Main analysis buttons
        document.getElementById('analyzeBtn')?.addEventListener('click', () => {
            this.startSinglePageAnalysis();
        });

        document.getElementById('scanSiteBtn')?.addEventListener('click', () => {
            this.startSiteAnalysis();
        });

        // URL input enter key
        document.getElementById('urlInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.startSinglePageAnalysis();
            }
        });

        document.getElementById('siteUrlInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.startSiteAnalysis();
            }
        });

        // Settings button
        document.getElementById('settingsBtn')?.addEventListener('click', () => {
            this.showSettingsModal();
        });

        // Retry button
        document.getElementById('retryBtn')?.addEventListener('click', () => {
            this.retryAnalysis();
        });

        // Filter buttons
        this.initFilterButtons();
    }

    // Initialize filter buttons
    initFilterButtons() {
        // Priority filters
        document.querySelectorAll('.filter-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const filter = e.target.dataset.filter;
                this.filterRecommendations(filter);
                
                // Update active state
                document.querySelectorAll('.filter-button').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });

        // Graph filters
        document.querySelectorAll('.graph-filter-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const filter = e.target.dataset.filter;
                this.filterEntityGraph(filter);
                
                // Update active state
                document.querySelectorAll('.graph-filter-button').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });
    }

    // Initialize modals
    initModals() {
        // Close modal handlers
        document.querySelectorAll('.modal-close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                this.hideModal(modal);
            });
        });

        // Close modal on background click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal(modal);
                }
            });
        });

        // Settings modal save
        document.getElementById('settingsModal')?.querySelector('.modal-content')?.addEventListener('change', () => {
            this.saveSettings();
        });
    }

    // Check API health status
    async checkAPIHealth() {
        try {
            const health = await window.schemaAPI.checkHealth();
            this.updateStatusIndicator(health.status, health.data);
        } catch (error) {
            console.error('Health check failed:', error);
            this.updateStatusIndicator('offline', { error: error.message });
        }
    }

    // Update status indicator
    updateStatusIndicator(status, data) {
        const indicator = document.getElementById('statusIndicator');
        if (!indicator) return;

        const dot = indicator.querySelector('span');
        const text = indicator.querySelector('span').nextSibling;

        if (status === 'online') {
            dot.className = 'inline-block w-2 h-2 bg-green-500 rounded-full mr-2';
            indicator.lastChild.textContent = 'API Ready';
        } else {
            dot.className = 'inline-block w-2 h-2 bg-red-500 rounded-full mr-2';
            indicator.lastChild.textContent = 'API Offline';
        }
    }

    // Set example URL for demo
    setExampleURL() {
        const urlInput = document.getElementById('urlInput');
        if (urlInput && !urlInput.value) {
            urlInput.value = 'https://schema.org';
        }
    }

    // Start single page analysis
    async startSinglePageAnalysis() {
        const urlInput = document.getElementById('urlInput');
        const url = urlInput?.value?.trim();

        if (!url) {
            this.showError('Please enter a URL to analyze');
            return;
        }

        if (!window.schemaAPI.isValidURL(url)) {
            this.showError('Please enter a valid URL (including http:// or https://)');
            return;
        }

        console.log('🔍 Starting analysis for:', url);

        // Get analysis options
        const options = {
            deepScan: document.getElementById('deepScan')?.checked || false,
            entityAnalysis: document.getElementById('entityAnalysis')?.checked || false,
            consistencyCheck: document.getElementById('consistencyCheck')?.checked || false,
            recommendations: document.getElementById('recommendations')?.checked || false
        };

        try {
            this.showLoading('Analyzing page...', 0);
            
            const result = await window.schemaAPI.analyzePage(url, options);
            
            if (result.status === 'completed') {
                this.currentScanId = result.scan_id;
                this.currentResults = result;
                this.displayResults(result);
                this.updateLastUpdate();
            } else {
                throw new Error(result.error || 'Analysis failed');
            }

        } catch (error) {
            console.error('Analysis failed:', error);
            this.showError(window.schemaAPI.formatError(error));
        }
    }

    // Start site analysis
    async startSiteAnalysis() {
        const urlInput = document.getElementById('siteUrlInput');
        const url = urlInput?.value?.trim();

        if (!url) {
            this.showError('Please enter a website URL to scan');
            return;
        }

        if (!window.schemaAPI.isValidURL(url)) {
            this.showError('Please enter a valid URL (including http:// or https://)');
            return;
        }

        console.log('🗺️ Starting site scan for:', url);

        // Get scan options
        const options = {
            maxPages: parseInt(document.getElementById('maxPages')?.value) || 25,
            crawlDepth: parseInt(document.getElementById('crawlDepth')?.value) || 3,
            includeSitemaps: document.getElementById('includeSitemaps')?.checked || true
        };

        try {
            this.showLoading('Starting site scan...', 0);
            
            const scanResponse = await window.schemaAPI.scanSite(url, options);
            
            if (scanResponse.scan_id) {
                this.currentScanId = scanResponse.scan_id;
                
                // Start polling for results
                await this.pollScanProgress(scanResponse.scan_id);
            } else {
                throw new Error('Failed to start site scan');
            }

        } catch (error) {
            console.error('Site scan failed:', error);
            this.showError(window.schemaAPI.formatError(error));
        }
    }

    // Poll scan progress
    async pollScanProgress(scanId) {
        try {
            const result = await window.schemaAPI.pollScanProgress(
                scanId,
                (progress) => {
                    // Update progress
                    const message = progress.status === 'processing' ? 
                        `Scanning... (${progress.progress?.scanned || 0} pages scanned)` :
                        'Processing results...';
                    
                    const percentage = progress.progress ? 
                        (progress.progress.scanned / (progress.progress.scanned + progress.progress.queued)) * 100 :
                        0;
                    
                    this.showLoading(message, percentage);
                },
                3000 // Poll every 3 seconds
            );

            this.currentResults = result;
            this.displayResults(result);
            this.updateLastUpdate();

        } catch (error) {
            console.error('Scan progress polling failed:', error);
            this.showError(window.schemaAPI.formatError(error));
        }
    }

    // Display analysis results
    displayResults(results) {
        console.log('📊 Displaying results:', results);

        this.hideLoading();
        this.hideError();
        this.showResults();

        // Update summary cards
        this.updateSummaryCards(results);

        // Display recommendations
        this.displayRecommendations(results.results.recommendations || []);

        // Display schema breakdown
        this.displaySchemaBreakdown(results.results.schemas || []);

        // Display consistency analysis
        this.displayConsistencyAnalysis(results.results.consistency_analysis || {});

        // Create entity graph
        this.createEntityGraph(results.results.entities || { found: [], connections: [] });
    }

    // Update summary cards
    updateSummaryCards(results) {
        const seoScore = results.results.seo_score?.overall || 0;
        const entities = results.results.entities?.found || [];
        const recommendations = results.results.recommendations || [];
        const consistency = results.results.consistency_analysis?.score || 0;

        // SEO Score
        document.getElementById('seoScore').textContent = seoScore;
        const seoTrend = document.getElementById('seoTrend');
        if (seoTrend) {
            seoTrend.textContent = `${this.getScoreLabel(seoScore)} • out of 100`;
        }

        // Entity Count
        document.getElementById('entityCount').textContent = entities.length;
        const entityDetails = document.getElementById('entityDetails');
        if (entityDetails) {
            entityDetails.textContent = `${entities.length === 1 ? 'type' : 'types'} found`;
        }

        // Issue Count
        const highPriorityIssues = recommendations.filter(r => r.priority === 'high').length;
        document.getElementById('issueCount').textContent = highPriorityIssues;
        const issueDetails = document.getElementById('issueDetails');
        if (issueDetails) {
            issueDetails.textContent = highPriorityIssues === 0 ? 'none found' : 'to fix';
        }

        // Consistency Score
        document.getElementById('consistencyScore').textContent = consistency;
        const consistencyDetails = document.getElementById('consistencyDetails');
        if (consistencyDetails) {
            consistencyDetails.textContent = `${this.getScoreLabel(consistency)} • out of 100`;
        }
    }

    // Get score label
    getScoreLabel(score) {
        if (score >= 80) return 'Excellent';
        if (score >= 60) return 'Good';
        if (score >= 40) return 'Fair';
        return 'Needs Work';
    }

    // Display recommendations
    displayRecommendations(recommendations) {
        const container = document.getElementById('recommendationsList');
        if (!container) return;

        if (!recommendations || recommendations.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-green-600">
                    <div class="text-4xl mb-2">✅</div>
                    <p class="font-medium">Great job! No issues found.</p>
                    <p class="text-sm text-gray-600">Your schema markup looks good.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = recommendations.map((rec, index) => `
            <div class="recommendation-item ${rec.priority}" data-priority="${rec.priority}">
                <div class="flex items-start justify-between mb-3">
                    <div class="flex-1">
                        <div class="flex items-center space-x-2 mb-1">
                            <span class="priority-badge ${rec.priority}">${rec.priority.toUpperCase()}</span>
                            <h3 class="font-medium text-gray-900">${rec.type}</h3>
                        </div>
                        <p class="text-sm text-gray-700">${rec.message}</p>
                        ${rec.details ? `<p class="text-xs text-gray-500 mt-1">${rec.details}</p>` : ''}
                    </div>
                </div>
                
                ${rec.example ? `
                    <div class="mt-3">
                        <p class="text-xs font-medium text-gray-700 mb-2">Recommended fix:</p>
                        <div class="code-block fix">
                            <pre><code>${this.escapeHtml(rec.example)}</code></pre>
                        </div>
                        <div class="flex space-x-2 mt-2">
                            <button onclick="app.copyToClipboard('${this.escapeForJs(rec.example)}', this)" 
                                    class="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">
                                📋 Copy Fix
                            </button>
                            <button onclick="app.showSchemaModal('${this.escapeForJs(rec.type)}', '${this.escapeForJs(rec.example)}')" 
                                    class="text-xs px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700">
                                👁️ View Details
                            </button>
                        </div>
                    </div>
                ` : ''}
            </div>
        `).join('');
    }

    // Display schema breakdown
    displaySchemaBreakdown(schemas) {
        const container = document.getElementById('schemaBreakdown');
        if (!container) return;

        if (!schemas || schemas.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <div class="text-2xl mb-2">📭</div>
                    <p>No schemas found</p>
                </div>
            `;
            return;
        }

        // Count schema types
        const typeCounts = {};
        schemas.forEach(schema => {
            const type = Array.isArray(schema['@type']) ? schema['@type'][0] : schema['@type'];
            typeCounts[type] = (typeCounts[type] || 0) + 1;
        });

        container.innerHTML = Object.entries(typeCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => `
                <div class="schema-item">
                    <div class="flex items-center space-x-2">
                        <span class="schema-type">${type}</span>
                        <span class="schema-count">${count}</span>
                    </div>
                    <button onclick="app.showSchemasByType('${type}')" 
                            class="text-xs text-blue-600 hover:text-blue-800">
                        View →
                    </button>
                </div>
            `).join('');
    }

    // Display consistency analysis
    displayConsistencyAnalysis(analysis) {
        const container = document.getElementById('consistencyAnalysis');
        if (!container) return;

        if (!analysis || !analysis.idGroups) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <div class="text-2xl mb-2">🔗</div>
                    <p>No consistency data</p>
                </div>
            `;
            return;
        }

        const items = [];

        // Good consistency items
        if (analysis.idGroups) {
            const goodIds = Array.from(Object.entries(analysis.idGroups))
                .filter(([id, instances]) => id.startsWith('schema:') && instances.length > 1);
            
            goodIds.forEach(([id, instances]) => {
                items.push(`
                    <div class="consistency-item good">
                        <div class="flex items-center justify-between">
                            <span class="font-medium text-green-800">✅ ${id}</span>
                            <span class="text-xs text-green-600">${instances.length} uses</span>
                        </div>
                        <p class="text-xs text-green-700 mt-1">Good consistency pattern</p>
                    </div>
                `);
            });
        }

        // Issues
        if (analysis.issues && analysis.issues.length > 0) {
            analysis.issues.forEach(issue => {
                items.push(`
                    <div class="consistency-item error">
                        <div class="flex items-center justify-between">
                            <span class="font-medium text-red-800">❌ Issue Found</span>
                        </div>
                        <p class="text-xs text-red-700 mt-1">${issue}</p>
                    </div>
                `);
            });
        }

        if (items.length === 0) {
            items.push(`
                <div class="text-center py-4 text-gray-500">
                    <p>No consistency analysis available</p>
                </div>
            `);
        }

        container.innerHTML = items.join('');
    }

    // Create entity graph visualization
    createEntityGraph(entities) {
        if (window.createEntityVisualization) {
            window.createEntityVisualization(entities);
        } else {
            console.warn('Entity visualization not available');
        }
    }

    // Filter recommendations
    filterRecommendations(priority) {
        const items = document.querySelectorAll('.recommendation-item');
        
        items.forEach(item => {
            if (priority === 'all' || item.dataset.priority === priority) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    }

    // Filter entity graph
    filterEntityGraph(filter) {
        // This would be implemented in visualizations.js
        if (window.filterEntityGraph) {
            window.filterEntityGraph(filter);
        }
    }

    // Show/hide sections
    showLoading(message = 'Loading...', progress = 0) {
        document.getElementById('resultsSection')?.classList.add('hidden');
        document.getElementById('errorState')?.classList.add('hidden');
        
        const loadingState = document.getElementById('loadingState');
        if (loadingState) {
            loadingState.classList.remove('hidden');
            
            const messageEl = document.getElementById('loadingMessage');
            if (messageEl) messageEl.textContent = message;
            
            const progressBar = document.getElementById('progressBar');
            if (progressBar) progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
        }
    }

    hideLoading() {
        document.getElementById('loadingState')?.classList.add('hidden');
    }

    showResults() {
        document.getElementById('resultsSection')?.classList.remove('hidden');
        document.getElementById('errorState')?.classList.add('hidden');
    }

    showError(message) {
        document.getElementById('loadingState')?.classList.add('hidden');
        document.getElementById('resultsSection')?.classList.add('hidden');
        
        const errorState = document.getElementById('errorState');
        if (errorState) {
            errorState.classList.remove('hidden');
            
            const messageEl = document.getElementById('errorMessage');
            if (messageEl) messageEl.textContent = message;
        }
    }

    hideError() {
        document.getElementById('errorState')?.classList.add('hidden');
    }

    // Modal functions
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
        }
    }

    hideModal(modal) {
        if (modal) {
            modal.classList.remove('show');
        }
    }

    showSettingsModal() {
        // Load current settings into modal
        const modal = document.getElementById('settingsModal');
        if (modal) {
            const timeoutSelect = modal.querySelector('#apiTimeout');
            const autoRefreshCheck = modal.querySelector('#autoRefresh');
            const debugCheck = modal.querySelector('#debugMode');
            
            if (timeoutSelect) timeoutSelect.value = this.settings.timeout;
            if (autoRefreshCheck) autoRefreshCheck.checked = this.settings.autoRefresh;
            if (debugCheck) debugCheck.checked = this.settings.debugMode;
            
            this.showModal('settingsModal');
        }
    }

    showSchemaModal(title, content) {
        const modal = document.getElementById('schemaModal');
        if (modal) {
            const titleEl = modal.querySelector('#schemaModalTitle');
            const contentEl = modal.querySelector('#schemaModalContent');
            
            if (titleEl) titleEl.textContent = title;
            if (contentEl) {
                contentEl.innerHTML = `
                    <div class="code-block">
                        <pre><code>${this.escapeHtml(content)}</code></pre>
                    </div>
                `;
            }
            
            this.showModal('schemaModal');
        }
    }

    // Utility functions
    copyToClipboard(text, button) {
        navigator.clipboard.writeText(text).then(() => {
            const originalText = button.textContent;
            button.textContent = '✅ Copied!';
            button.classList.add('copy-success');
            
            setTimeout(() => {
                button.textContent = originalText;
                button.classList.remove('copy-success');
            }, 2000);
        }).catch(err => {
            console.error('Copy failed:', err);
            alert('Copy failed. Please try again.');
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    escapeForJs(text) {
        return text.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
    }

    // Settings management
    loadSettings() {
        try {
            const saved = localStorage.getItem('schemaAnalyzerSettings');
            if (saved) {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            }
        } catch (error) {
            console.warn('Could not load settings:', error);
        }
    }

    saveSettings() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            const timeout = modal.querySelector('#apiTimeout')?.value;
            const autoRefresh = modal.querySelector('#autoRefresh')?.checked;
            const debugMode = modal.querySelector('#debugMode')?.checked;
            
            this.settings = {
                timeout: parseInt(timeout) || 30000,
                autoRefresh: autoRefresh || false,
                debugMode: debugMode || false
            };
            
            try {
                localStorage.setItem('schemaAnalyzerSettings', JSON.stringify(this.settings));
                
                // Apply to API client
                window.schemaAPI.setConfig({
                    timeout: this.settings.timeout,
                    debug: this.settings.debugMode
                });
                
                console.log('Settings saved:', this.settings);
            } catch (error) {
                console.error('Could not save settings:', error);
            }
        }
    }

    updateLastUpdate() {
        const lastUpdateEl = document.getElementById('lastUpdate');
        if (lastUpdateEl) {
            lastUpdateEl.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
        }
    }

    retryAnalysis() {
        // Determine which type of analysis to retry
        const singlePanel = document.getElementById('singleAnalysisPanel');
        const sitePanel = document.getElementById('siteAnalysisPanel');
        
        if (singlePanel && !singlePanel.classList.contains('hidden')) {
            this.startSinglePageAnalysis();
        } else if (sitePanel && !sitePanel.classList.contains('hidden')) {
            this.startSiteAnalysis();
        }
    }

    showSchemasByType(type) {
        if (this.currentResults && this.currentResults.results.schemas) {
            const schemas = this.currentResults.results.schemas.filter(schema => {
                const schemaType = Array.isArray(schema['@type']) ? schema['@type'][0] : schema['@type'];
                return schemaType === type;
            });
            
            const content = schemas.map(schema => JSON.stringify(schema, null, 2)).join('\n\n---\n\n');
            this.showSchemaModal(`${type} Schemas (${schemas.length})`, content);
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new SchemaAnalyzerApp();
});

// Export for global access
window.SchemaAnalyzerApp = SchemaAnalyzerApp;
