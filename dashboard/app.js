// dashboard/app.js - Schema Web Analyzer Main Application
class SchemaWebAnalyzer {
    constructor() {
        this.apiClient = new APIClient();
        this.components = new UIComponents();
        this.visualizations = new Visualizations();
        this.currentResults = null;
        this.activeScan = null;
        this.settings = this.loadSettings();
        
        this.init();
    }

    /**
     * Initialize the application
     */
    init() {
        console.log('🚀 Initializing Schema Web Analyzer');
        
        this.attachEventListeners();
        this.loadRecentScans();
        this.applySettings();
        
        // Auto-populate URL from query parameter
        const urlParams = new URLSearchParams(window.location.search);
        const urlParam = urlParams.get('url');
        if (urlParam) {
            document.getElementById('urlInput').value = urlParam;
        }
        
        console.log('✅ Application initialized');
    }

    /**
     * Attach all event listeners
     */
    attachEventListeners() {
        // Main analysis buttons
        document.getElementById('analyzeBtn').addEventListener('click', () => this.handleAnalyze());
        document.getElementById('quickCheckBtn').addEventListener('click', () => this.handleQuickCheck());
        document.getElementById('deepAnalysisBtn').addEventListener('click', () => this.handleDeepAnalysis());
        document.getElementById('siteAnalysisBtn').addEventListener('click', () => this.showSiteAnalysisModal());

        // URL input enter key
        document.getElementById('urlInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleAnalyze();
            }
        });

        // Settings modal
        document.getElementById('settingsBtn').addEventListener('click', () => this.showSettingsModal());
        document.getElementById('closeSettings').addEventListener('click', () => this.hideSettingsModal());
        document.getElementById('cancelSettings').addEventListener('click', () => this.hideSettingsModal());
        document.getElementById('saveSettings').addEventListener('click', () => this.saveSettings());

        // Help modal
        document.getElementById('helpBtn').addEventListener('click', () => this.showHelpModal());
        document.getElementById('closeHelp').addEventListener('click', () => this.hideHelpModal());
        document.getElementById('closeHelpBtn').addEventListener('click', () => this.hideHelpModal());

        // Site analysis modal
        document.getElementById('closeSiteAnalysis').addEventListener('click', () => this.hideSiteAnalysisModal());
        document.getElementById('cancelSiteAnalysis').addEventListener('click', () => this.hideSiteAnalysisModal());
        document.getElementById('startSiteAnalysis').addEventListener('click', () => this.handleSiteAnalysis());

        // Results filters
        document.getElementById('filterAll').addEventListener('click', () => this.filterRecommendations('all'));
        document.getElementById('filterHigh').addEventListener('click', () => this.filterRecommendations('high'));
        document.getElementById('filterMedium').addEventListener('click', () => this.filterRecommendations('medium'));
        document.getElementById('filterLow').addEventListener('click', () => this.filterRecommendations('low'));

        // Entity graph filters
        document.getElementById('filterAllEntities').addEventListener('click', () => this.filterEntities('all'));
        document.getElementById('filterOrganization').addEventListener('click', () => this.filterEntities('Organization'));
        document.getElementById('filterPerson').addEventListener('click', () => this.filterEntities('Person'));
        document.getElementById('filterProduct').addEventListener('click', () => this.filterEntities('Product'));

        // Graph controls
        document.getElementById('resetZoom').addEventListener('click', () => this.visualizations.resetZoom());
        document.getElementById('centerGraph').addEventListener('click', () => this.visualizations.centerGraph());

        // Schema controls
        document.getElementById('expandAllSchemas').addEventListener('click', () => this.expandAllSchemas());
        document.getElementById('collapseAllSchemas').addEventListener('click', () => this.collapseAllSchemas());
        document.getElementById('exportSchemas').addEventListener('click', () => this.exportSchemas());
        document.getElementById('schemaTypeFilter').addEventListener('change', (e) => this.filterSchemas(e.target.value));

        // Recent scans
        document.getElementById('refreshScans').addEventListener('click', () => this.loadRecentScans());

        // Close modals on background click
        this.attachModalBackgroundListeners();
    }

    /**
     * Attach modal background click listeners
     */
    attachModalBackgroundListeners() {
        const modals = ['settingsModal', 'helpModal', 'siteAnalysisModal'];
        
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                }
            });
        });
    }

    /**
     * Handle main analyze button click
     */
    async handleAnalyze() {
        const url = this.getUrlInput();
        if (!url) return;

        const options = this.getAnalysisOptions();
        await this.performAnalysis(url, options);
    }

    /**
     * Handle quick check
     */
    async handleQuickCheck() {
        const url = this.getUrlInput();
        if (!url) return;

        this.showToast('🔍 Starting quick check...', 'info');
        
        try {
            const result = await this.apiClient.healthCheck(url);
            this.displayQuickCheckResults(result);
            this.showToast('✅ Quick check completed', 'success');
        } catch (error) {
            this.showError('Quick check failed: ' + error.message);
        }
    }

    /**
     * Handle deep analysis
     */
    async handleDeepAnalysis() {
        const url = this.getUrlInput();
        if (!url) return;

        // Enable all options for deep analysis
        document.getElementById('deepScan').checked = true;
        document.getElementById('includeEntities').checked = true;
        document.getElementById('includeRecommendations').checked = true;
        document.getElementById('checkConsistency').checked = true;

        const options = this.getAnalysisOptions();
        await this.performAnalysis(url, options);
    }

    /**
     * Get URL from input with validation
     */
    getUrlInput() {
        const urlInput = document.getElementById('urlInput');
        const url = urlInput.value.trim();
        
        if (!url) {
            this.showError('Please enter a URL to analyze');
            urlInput.focus();
            return null;
        }

        try {
            new URL(url);
            return url;
        } catch (e) {
            this.showError('Please enter a valid URL (including http:// or https://)');
            urlInput.focus();
            return null;
        }
    }

    /**
     * Get analysis options from form
     */
    getAnalysisOptions() {
        return {
            deep_scan: document.getElementById('deepScan').checked,
            include_recommendations: document.getElementById('includeRecommendations').checked,
            check_consistency: document.getElementById('checkConsistency').checked,
            analyze_entities: document.getElementById('includeEntities').checked,
            timeout: parseInt(this.settings.timeout) || 30000
        };
    }

    /**
     * Perform main analysis
     */
    async performAnalysis(url, options) {
        try {
            this.showLoading('Analyzing URL...', 'Extracting schema markup and analyzing structure');
            this.hideResults();

            const result = await this.apiClient.analyze(url, options);
            
            if (result.status === 'completed') {
                this.currentResults = result;
                this.displayResults(result);
                this.showToast('✅ Analysis completed successfully', 'success');
            } else {
                throw new Error('Analysis failed: ' + result.error);
            }

        } catch (error) {
            this.showError('Analysis failed: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Handle site analysis
     */
    async handleSiteAnalysis() {
        const startUrl = document.getElementById('siteStartUrl').value.trim();
        
        if (!startUrl) {
            this.showError('Please enter a start URL for site analysis');
            return;
        }

        try {
            new URL(startUrl);
        } catch (e) {
            this.showError('Please enter a valid start URL');
            return;
        }

        const options = {
            max_pages: parseInt(document.getElementById('siteMaxPages').value) || 25,
            include_sitemaps: document.getElementById('includeSitemaps').checked,
            follow_external: false,
            crawl_delay: 1000
        };

        this.hideSiteAnalysisModal();
        
        try {
            this.showLoading('Starting site analysis...', 'Discovering pages and analyzing schemas');
            
            const scanResult = await this.apiClient.scanSite(startUrl, options);
            
            if (scanResult.scan_id) {
                this.activeScan = scanResult.scan_id;
                this.monitorSiteAnalysis(scanResult.scan_id);
                this.showToast('🗺️ Site analysis started', 'info');
            } else {
                throw new Error('Failed to start site analysis');
            }

        } catch (error) {
            this.showError('Failed to start site analysis: ' + error.message);
            this.hideLoading();
        }
    }

    /**
     * Monitor site analysis progress
     */
    async monitorSiteAnalysis(scanId) {
        const checkInterval = setInterval(async () => {
            try {
                const progress = await this.apiClient.getProgress(scanId);
                
                this.updateProgress(progress.progress.progress, 
                    `Scanning pages: ${progress.progress.completed}/${progress.progress.total}`,
                    `ETA: ${progress.progress.eta_minutes} minutes`);

                if (progress.status === 'completed') {
                    clearInterval(checkInterval);
                    
                    const results = await this.apiClient.getResults(scanId);
                    this.currentResults = results;
                    this.displaySiteResults(results);
                    this.hideLoading();
                    this.showToast('✅ Site analysis completed', 'success');
                    
                } else if (progress.status === 'failed') {
                    clearInterval(checkInterval);
                    this.hideLoading();
                    this.showError('Site analysis failed');
                }

            } catch (error) {
                clearInterval(checkInterval);
                this.hideLoading();
                this.showError('Error monitoring site analysis: ' + error.message);
            }
        }, 2000); // Check every 2 seconds

        // Stop monitoring after 30 minutes
        setTimeout(() => {
            clearInterval(checkInterval);
            if (this.activeScan === scanId) {
                this.hideLoading();
                this.showError('Site analysis timeout - please check results manually');
            }
        }, 30 * 60 * 1000);
    }

    /**
     * Display quick check results
     */
    displayQuickCheckResults(result) {
        const toast = this.components.createToast(
            `Quick Check Results: ${result.status.toUpperCase()}`,
            `Score: ${result.quick_stats.seo_score}/100 | Schemas: ${result.quick_stats.schema_count} | Issues: ${result.quick_stats.critical_issues}`,
            result.status === 'healthy' ? 'success' : result.status === 'warning' ? 'warning' : 'error',
            10000
        );
        
        if (result.quick_fixes && result.quick_fixes.length > 0) {
            const fixesList = result.quick_fixes.join(', ');
            toast.querySelector('.toast-body').innerHTML += `<br><small>Quick fixes: ${fixesList}</small>`;
        }
    }

    /**
     * Display main analysis results
     */
    displayResults(result) {
        this.showResults();
        
        // Update stats cards
        this.updateStatsCards(result);
        
        // Display recommendations
        this.displayRecommendations(result.results.recommendations || []);
        
        // Display entity graph
        if (result.results.entities) {
            this.visualizations.renderEntityGraph(result.results.entities);
        }
        
        // Display schema details
        this.displaySchemaDetails(result.results.schemas || []);
        
        // Update recent scans
        this.loadRecentScans();
    }

    /**
     * Display site analysis results
     */
    displaySiteResults(result) {
        this.showResults();
        
        // Create site-specific stats
        const siteStats = {
            seo_score: result.site_analysis?.seo_score || { overall: 0 },
            entities: result.site_analysis?.entity_ecosystem || { totalEntities: 0, entityTypes: [] },
            consistency: result.site_analysis?.cross_page_consistency || { bestPracticeScore: 0 },
            pages: result.totalPages || 0,
            schemas: result.totalSchemas || 0
        };
        
        this.updateStatsCards({ results: siteStats });
        
        // Display site recommendations
        this.displayRecommendations(result.site_analysis?.site_recommendations || []);
        
        // Display site entity graph
        if (result.site_analysis?.entity_ecosystem) {
            this.visualizations.renderEntityGraph(result.site_analysis.entity_ecosystem);
        }
        
        // Display all schemas from site
        const allSchemas = result.schemas || [];
        this.displaySchemaDetails(allSchemas.map(schema => ({
            type: schema['@type'],
            schema: schema,
            rank: 1
        })));
    }

    /**
     * Update statistics cards
     */
    updateStatsCards(result) {
        const seoScore = result.results?.seo_score?.overall || 0;
        const entities = result.results?.entities || {};
        const consistency = result.results?.consistency_analysis || {};
        const recommendations = result.results?.recommendations || [];

        // SEO Score
        document.getElementById('seoScore').textContent = seoScore;
        document.getElementById('seoGrade').textContent = this.getScoreGrade(seoScore);
        document.getElementById('seoGrade').className = `text-sm font-medium ${this.getScoreColor(seoScore)}`;

        // Entities
        document.getElementById('entitiesCount').textContent = entities.totalEntities || 0;
        document.getElementById('entityTypes').textContent = `${(entities.entityTypes || []).length} types`;

        // Issues
        const highPriorityIssues = recommendations.filter(r => r.level === 'high').length;
        document.getElementById('issuesCount').textContent = highPriorityIssues;
        document.getElementById('issuesSeverity').textContent = this.getIssueSeverityText(recommendations);
        document.getElementById('issuesSeverity').className = `text-sm ${this.getIssueColor(highPriorityIssues)}`;

        // Consistency
        const consistencyScore = consistency.bestPracticeScore || 0;
        document.getElementById('consistencyScore').textContent = `${consistencyScore}/100`;
        document.getElementById('consistencyGrade').textContent = this.getScoreGrade(consistencyScore);
        document.getElementById('consistencyGrade').className = `text-sm font-medium ${this.getScoreColor(consistencyScore)}`;
    }

    /**
     * Display recommendations
     */
    displayRecommendations(recommendations) {
        const container = document.getElementById('recommendationsList');
        
        if (!recommendations || recommendations.length === 0) {
            container.innerHTML = this.components.createEmptyState(
                '✅ No issues found',
                'Your schema markup looks good!',
                'checkmark'
            );
            return;
        }

        container.innerHTML = '';
        
        recommendations.forEach((rec, index) => {
            const element = this.components.createRecommendationCard(rec, index);
            container.appendChild(element);
        });
    }

    /**
     * Display schema details
     */
    displaySchemaDetails(schemas) {
        const container = document.getElementById('schemaDetailsList');
        const filter = document.getElementById('schemaTypeFilter');
        
        if (!schemas || schemas.length === 0) {
            container.innerHTML = this.components.createEmptyState(
                '📄 No schemas found',
                'The analyzed page does not contain schema markup',
                'document'
            );
            return;
        }

        // Update filter options
        this.updateSchemaFilter(schemas);
        
        // Display schemas
        container.innerHTML = '';
        
        schemas.forEach((schemaData, index) => {
            const element = this.components.createSchemaCard(schemaData, index);
            container.appendChild(element);
        });
    }

    /**
     * Update schema filter dropdown
     */
    updateSchemaFilter(schemas) {
        const filter = document.getElementById('schemaTypeFilter');
        const types = [...new Set(schemas.map(s => s.type))].sort();
        
        // Clear existing options except "All"
        filter.innerHTML = '<option value="all">All Schema Types</option>';
        
        types.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            filter.appendChild(option);
        });
    }

    /**
     * Filter recommendations by priority
     */
    filterRecommendations(level) {
        const cards = document.querySelectorAll('[data-recommendation-level]');
        const buttons = document.querySelectorAll('#recommendationsList').parentElement.querySelectorAll('button');
        
        // Update button states
        buttons.forEach(btn => btn.classList.remove('bg-blue-500', 'text-white'));
        event.target.classList.add('bg-blue-500', 'text-white');
        
        cards.forEach(card => {
            if (level === 'all' || card.dataset.recommendationLevel === level) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    /**
     * Filter entities in graph
     */
    filterEntities(type) {
        const buttons = document.querySelectorAll('#entityGraph').parentElement.parentElement.querySelectorAll('button');
        
        // Update button states
        buttons.forEach(btn => btn.classList.remove('bg-blue-500', 'text-white'));
        event.target.classList.add('bg-blue-500', 'text-white');
        
        // Apply filter to visualization
        this.visualizations.filterEntitiesByType(type);
    }

    /**
     * Filter schemas by type
     */
    filterSchemas(type) {
        const cards = document.querySelectorAll('[data-schema-type]');
        
        cards.forEach(card => {
            if (type === 'all' || card.dataset.schemaType === type) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    /**
     * Expand all schema cards
     */
    expandAllSchemas() {
        const cards = document.querySelectorAll('.schema-card .schema-content');
        cards.forEach(card => {
            card.classList.remove('collapsed');
        });
    }

    /**
     * Collapse all schema cards
     */
    collapseAllSchemas() {
        const cards = document.querySelectorAll('.schema-card .schema-content');
        cards.forEach(card => {
            card.classList.add('collapsed');
        });
    }

    /**
     * Export schemas to JSON
     */
    exportSchemas() {
        if (!this.currentResults) {
            this.showError('No analysis results to export');
            return;
        }

        const data = {
            timestamp: new Date().toISOString(),
            url: this.currentResults.url,
            results: this.currentResults.results
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `schema-analysis-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showToast('📥 Results exported successfully', 'success');
    }

    /**
     * Load recent scans
     */
    async loadRecentScans() {
        try {
            const scans = await this.apiClient.getRecentScans();
            this.displayRecentScans(scans.scans || []);
        } catch (error) {
            console.error('Failed to load recent scans:', error);
        }
    }

    /**
     * Display recent scans
     */
    displayRecentScans(scans) {
        const container = document.getElementById('recentScansList');
        
        if (!scans || scans.length === 0) {
            container.innerHTML = this.components.createEmptyState(
                '📚 No recent scans',
                'Your analysis history will appear here',
                'clock'
            );
            return;
        }

        container.innerHTML = '';
        
        scans.slice(0, 5).forEach(scan => {
            const element = this.components.createRecentScanCard(scan);
            container.appendChild(element);
        });
    }

    /**
     * Load scan results by ID
     */
    async loadScanResults(scanId) {
        try {
            this.showLoading('Loading results...', 'Retrieving analysis data');
            
            const results = await this.apiClient.getResults(scanId);
            this.currentResults = results;
            
            if (results.type === 'site_scan') {
                this.displaySiteResults(results);
            } else {
                this.displayResults(results);
            }
            
            this.showToast('✅ Results loaded successfully', 'success');
        } catch (error) {
            this.showError('Failed to load results: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Settings management
     */
    loadSettings() {
        const defaults = {
            timeout: 30000,
            maxPages: 25,
            autoRefresh: false,
            enableNotifications: false
        };

        try {
            const saved = localStorage.getItem('schemaAnalyzerSettings');
            return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
        } catch (e) {
            return defaults;
        }
    }

    saveSettings() {
        const settings = {
            timeout: parseInt(document.getElementById('timeoutSetting').value),
            maxPages: parseInt(document.getElementById('maxPagesSetting').value),
            autoRefresh: document.getElementById('autoRefresh').checked,
            enableNotifications: document.getElementById('enableNotifications').checked
        };

        this.settings = settings;
        localStorage.setItem('schemaAnalyzerSettings', JSON.stringify(settings));
        this.hideSettingsModal();
        this.showToast('⚙️ Settings saved', 'success');
    }

    applySettings() {
        document.getElementById('timeoutSetting').value = this.settings.timeout;
        document.getElementById('maxPagesSetting').value = this.settings.maxPages;
        document.getElementById('autoRefresh').checked = this.settings.autoRefresh;
        document.getElementById('enableNotifications').checked = this.settings.enableNotifications;
    }

    /**
     * Modal management
     */
    showSettingsModal() {
        document.getElementById('settingsModal').classList.remove('hidden');
    }

    hideSettingsModal() {
        document.getElementById('settingsModal').classList.add('hidden');
    }

    showHelpModal() {
        document.getElementById('helpModal').classList.remove('hidden');
    }

    hideHelpModal() {
        document.getElementById('helpModal').classList.add('hidden');
    }

    showSiteAnalysisModal() {
        const urlInput = document.getElementById('urlInput');
        const siteUrlInput = document.getElementById('siteStartUrl');
        
        if (urlInput.value) {
            try {
                const url = new URL(urlInput.value);
                siteUrlInput.value = url.origin;
            } catch (e) {
                // Invalid URL, ignore
            }
        }
        
        document.getElementById('siteAnalysisModal').classList.remove('hidden');
    }

    hideSiteAnalysisModal() {
        document.getElementById('siteAnalysisModal').classList.add('hidden');
    }

    /**
     * UI state management
     */
    showLoading(title = 'Processing...', message = 'Please wait') {
        const loadingState = document.getElementById('loadingState');
        document.getElementById('loadingTitle').textContent = title;
        document.getElementById('loadingMessage').textContent = message;
        loadingState.classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loadingState').classList.add('hidden');
    }

    updateProgress(percentage, title, message) {
        document.getElementById('progressBar').style.width = `${percentage}%`;
        document.getElementById('progressText').textContent = `${percentage}%`;
        
        if (title) document.getElementById('loadingTitle').textContent = title;
        if (message) document.getElementById('loadingMessage').textContent = message;
    }

    showResults() {
        document.getElementById('resultsContainer').classList.remove('hidden');
    }

    hideResults() {
        document.getElementById('resultsContainer').classList.add('hidden');
    }

    /**
     * Utility methods
     */
    getScoreGrade(score) {
        if (score >= 90) return 'A+';
        if (score >= 80) return 'A';
        if (score >= 70) return 'B';
        if (score >= 60) return 'C';
        if (score >= 50) return 'D';
        return 'F';
    }

    getScoreColor(score) {
        if (score >= 80) return 'text-green-600';
        if (score >= 60) return 'text-yellow-600';
        return 'text-red-600';
    }

    getIssueColor(count) {
        if (count === 0) return 'text-green-600';
        if (count <= 2) return 'text-yellow-600';
        return 'text-red-600';
    }

    getIssueSeverityText(recommendations) {
        const high = recommendations.filter(r => r.level === 'high').length;
        const medium = recommendations.filter(r => r.level === 'medium').length;
        
        if (high === 0 && medium === 0) return 'No critical issues';
        if (high === 0) return `${medium} medium priority`;
        return `${high} high, ${medium} medium`;
    }

    showToast(message, type = 'info', duration = 5000) {
        this.components.showToast(message, type, duration);
    }

    showError(message) {
        this.showToast(message, 'error', 8000);
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.schemaAnalyzer = new SchemaWebAnalyzer();
});

// Global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    if (window.schemaAnalyzer) {
        window.schemaAnalyzer.showError('An unexpected error occurred. Please refresh the page.');
    }
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    if (window.schemaAnalyzer) {
        window.schemaAnalyzer.showError('An unexpected error occurred. Please try again.');
    }
});
