// ui-controller.js - FIXED VERSION - Unified UI Management System for Schema Insights 2.0
console.log('🎨 Loading UI Controller v2.0 (FIXED)...');

class ProgressTracker {
    constructor() {
        this.currentStep = 0;
        this.totalSteps = 8;
        this.currentMessage = 'Initializing...';
        this.startTime = null;
        this.timeout = null;
        
        this.steps = [
            'Initializing Schema Processing',
            'Validating Input Data', 
            'Extracting Page Information',
            'Processing Schema Objects',
            'Ranking Schemas by Importance',
            'Generating Recommendations',
            'Applying Filters and Analysis',
            'Finalizing Display'
        ];
    }
    
    init() {
        this.startTime = Date.now();
        this.currentStep = 0;
        this.updateUI();
        
        this.timeout = setTimeout(() => {
            this.handleTimeout();
        }, 30000);
    }
    
    updateStep(stepIndex, message = null) {
        if (stepIndex >= 0 && stepIndex < this.totalSteps) {
            this.currentStep = stepIndex;
            this.currentMessage = message || this.steps[stepIndex];
            this.updateUI();
            
            console.log(`📊 Progress: ${stepIndex + 1}/${this.totalSteps} - ${this.currentMessage}`);
            
            if (this.timeout) {
                clearTimeout(this.timeout);
                this.timeout = setTimeout(() => this.handleTimeout(), 30000);
            }
        }
    }
    
    complete() {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
        
        this.currentStep = this.totalSteps;
        this.currentMessage = 'Complete!';
        this.updateUI();
        
        setTimeout(() => this.hide(), 1000);
        
        const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
        console.log(`✅ Schema processing completed in ${elapsed} seconds`);
    }
    
    error(message) {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
        
        this.currentMessage = `Error: ${message}`;
        this.updateUI(true);
        
        const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
        console.error(`❌ Schema processing failed after ${elapsed} seconds: ${message}`);
    }
    
    handleTimeout() {
        const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
        const stuckStep = this.steps[this.currentStep] || 'Unknown step';
        
        console.error(`⏰ Processing timeout after ${elapsed} seconds, stuck at: ${stuckStep}`);
        this.error(`Timeout after ${elapsed}s - stuck at: ${stuckStep}`);
    }
    
    updateUI(isError = false) {
        const loadingElement = document.getElementById('loading');
        if (!loadingElement) return;
        
        const percentage = Math.round((this.currentStep / this.totalSteps) * 100);
        const elapsed = this.startTime ? ((Date.now() - this.startTime) / 1000).toFixed(1) : 0;
        
        const progressBarColor = isError ? '#dc3545' : '#007bff';
        const textColor = isError ? '#721c24' : '#495057';
        
        loadingElement.innerHTML = `
            <div class="progress-container">
                <div class="progress-header">
                    <h3 style="color: ${textColor}; margin: 0 0 10px 0;">
                        ${isError ? '❌ Processing Failed' : '🔄 Processing Schemas'}
                    </h3>
                    <div class="progress-stats">
                        <span>Step ${this.currentStep + 1} of ${this.totalSteps}</span>
                        <span>${percentage}%</span>
                        <span>${elapsed}s elapsed</span>
                    </div>
                </div>
                
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${percentage}%; background-color: ${progressBarColor};"></div>
                </div>
                
                <div class="progress-message" style="color: ${textColor};">
                    ${this.currentMessage}
                </div>
                
                ${isError ? `
                    <div class="error-actions">
                        <button onclick="location.reload()" class="retry-btn">🔄 Retry</button>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    hide() {
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }
    
    show() {
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = 'flex';
        }
    }
}

class SchemaEventManager {
    constructor() {
        this.controlsInitialized = false;
        this.searchTimeout = null;
        this.displayedSchemas = []; // Track all displayed schemas for filtering
        this.allSchemaBoxes = []; // Track all schema box elements
    }

    reset() {
        this.controlsInitialized = false;
        this.displayedSchemas = [];
        this.allSchemaBoxes = [];
        document.querySelectorAll('.control-panel').forEach(panel => panel.remove());
        document.body.classList.remove('schema-ranker');
        console.log('🔄 Schema events reset');
    }

    initializeControls() {
        console.log('🎛️ Initializing enhanced controls...');

        if (this.controlsInitialized) {
            console.log('Controls already initialized, resetting first...');
            this.reset();
        }
        
        this.controlsInitialized = true;

        if (!document.body.classList.contains('schema-ranker')) {
            document.body.classList.add('schema-ranker');
        }

        try {
            let mainContent = document.querySelector('.main-content');
            if (!mainContent) {
                mainContent = document.createElement('div');
                mainContent.className = 'main-content';
                if (document.body.firstChild) {
                    document.body.insertBefore(mainContent, document.body.firstChild);
                } else {
                    document.body.appendChild(mainContent);
                }
            }

            let rawSchemas = document.getElementById('rawSchemas');
            if (!rawSchemas) {
                rawSchemas = document.createElement('div');
                rawSchemas.id = 'rawSchemas';
                rawSchemas.className = 'schemas-container';
                mainContent.appendChild(rawSchemas);
            }

            // Create enhanced control panel
            const controlPanel = document.createElement('div');
            controlPanel.className = 'control-panel';
            controlPanel.innerHTML = `
                <div class="controls">
                    <button id="gridViewBtn" type="button" class="active">Grid View</button>
                    <button id="stackViewBtn" type="button">Stack View</button>
                    <button id="expandAllBtn" type="button">Expand All</button>
                    <button id="collapseAllBtn" type="button">Collapse All</button>
                    <select id="schemaFilter">
                        <option value="all">All Schemas</option>
                    </select>
                    <div class="search-container">
                        <div class="search-box">
                            <input type="text" id="schemaSearch" placeholder="Search in schemas...">
                            <button id="clearSearch" type="button">×</button>
                        </div>
                        <div class="search-options">
                            <label><input type="checkbox" id="caseSensitive"> Case sensitive</label>
                            <label><input type="checkbox" id="wholeWord"> Whole word</label>
                            <select id="searchTarget">
                                <option value="both">Search everywhere</option>
                                <option value="schemas">Schemas only</option>
                                <option value="recommendations">Recommendations only</option>
                            </select>
                            <span id="searchResults"></span>
                        </div>
                    </div>
                </div>
            `;
            
            if (mainContent.firstChild) {
                mainContent.insertBefore(controlPanel, mainContent.firstChild);
            } else {
                mainContent.appendChild(controlPanel);
            }

            this.setDefaultView();
            this.attachEventListeners();

            console.log('✅ Enhanced control panel initialized successfully');
            return Promise.resolve();
        } catch (error) {
            console.error('❌ Error creating enhanced control panel:', error);
            this.controlsInitialized = false;
            return Promise.reject(error);
        }
    }

    // NEW: Method to update schema filter dropdown with actual schema types
    updateSchemaFilter(schemas) {
        const filterSelect = document.getElementById('schemaFilter');
        if (!filterSelect || !schemas || !Array.isArray(schemas)) {
            console.warn('Cannot update schema filter - missing elements or invalid schemas');
            return;
        }

        // Extract unique schema types from displayed schemas
        const schemaTypes = new Set();
        schemas.forEach(schema => {
            const schemaData = schema.schema || schema;
            if (schemaData && schemaData['@type']) {
                const type = Array.isArray(schemaData['@type']) ? schemaData['@type'][0] : schemaData['@type'];
                if (type) {
                    schemaTypes.add(type.toLowerCase());
                }
            }
        });

        // Clear existing options except "All Schemas"
        const currentValue = filterSelect.value;
        filterSelect.innerHTML = '<option value="all">All Schemas</option>';

        // Add options for each found schema type
        Array.from(schemaTypes).sort().forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type.charAt(0).toUpperCase() + type.slice(1);
            filterSelect.appendChild(option);
        });

        // Restore previous selection if it still exists
        if (currentValue !== 'all' && schemaTypes.has(currentValue)) {
            filterSelect.value = currentValue;
        }

        console.log(`📋 Updated schema filter with ${schemaTypes.size} types:`, Array.from(schemaTypes));
    }

    setDefaultView() {
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.classList.add('grid-view');
            mainContent.classList.remove('stack-view');
        }

        const gridBtn = document.getElementById('gridViewBtn');
        const stackBtn = document.getElementById('stackViewBtn');
        if (gridBtn) gridBtn.classList.add('active');
        if (stackBtn) stackBtn.classList.remove('active');

        console.log('🎯 Default view set: grid view, collapsed state');
    }

    attachEventListeners() {
        // View controls
        const gridBtn = document.getElementById('gridViewBtn');
        const stackBtn = document.getElementById('stackViewBtn');
        const expandBtn = document.getElementById('expandAllBtn');
        const collapseBtn = document.getElementById('collapseAllBtn');
        const filterSel = document.getElementById('schemaFilter');

        if (gridBtn) gridBtn.addEventListener('click', () => this.toggleView('grid'));
        if (stackBtn) stackBtn.addEventListener('click', () => this.toggleView('stack'));
        if (expandBtn) expandBtn.addEventListener('click', () => this.expandAll());
        if (collapseBtn) collapseBtn.addEventListener('click', () => this.collapseAll());
        if (filterSel) filterSel.addEventListener('change', (e) => this.handleSchemaFilter(e));

        // Search controls
        this.attachSearchListeners();
        
        // Schema box click-to-expand
        this.attachSchemaBoxListeners();
    }

    attachSearchListeners() {
        const searchInput = document.getElementById('schemaSearch');
        const clearButton = document.getElementById('clearSearch');
        const caseSensitive = document.getElementById('caseSensitive');
        const wholeWord = document.getElementById('wholeWord');
        const searchTarget = document.getElementById('searchTarget');

        if (!(searchInput && clearButton && caseSensitive && wholeWord && searchTarget)) {
            console.error('❌ Search elements not found');
            return;
        }

        // FIXED: Use arrow functions to preserve 'this' context
        searchInput.addEventListener('input', () => {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => this.performSearch(), 300);
        });

        clearButton.addEventListener('click', () => {
            searchInput.value = '';
            this.performSearch();
            searchInput.focus();
        });

        caseSensitive.addEventListener('change', () => this.performSearch());
        wholeWord.addEventListener('change', () => this.performSearch());
        searchTarget.addEventListener('change', () => this.performSearch());
    }

    attachSchemaBoxListeners() {
        // REMOVED: We no longer add click listeners here since we have specific functions
        // The click-to-expand is now handled by the onclick attribute in the HTML
    }

    toggleSchemaBox(pre) {
        pre.classList.toggle('expanded');
        if (pre.classList.contains('expanded')) {
            pre.style.maxHeight = 'none';
        } else {
            pre.style.maxHeight = '200px';
        }
    }

    toggleView(type) {
        const mainContent = document.querySelector('.main-content');
        const gridBtn = document.getElementById('gridViewBtn');
        const stackBtn = document.getElementById('stackViewBtn');

        if (mainContent) {
            mainContent.classList.remove('grid-view', 'stack-view');
            mainContent.classList.add(type === 'grid' ? 'grid-view' : 'stack-view');
        }

        if (gridBtn && stackBtn) {
            gridBtn.classList.toggle('active', type === 'grid');
            stackBtn.classList.toggle('active', type === 'stack');
        }

        console.log(`🔄 Switched to ${type} view`);
    }

    expandAll() {
        const schemaBoxes = document.querySelectorAll('.schema-box pre');
        schemaBoxes.forEach(pre => {
            pre.classList.add('expanded');
            pre.style.maxHeight = 'none';
        });
        console.log('📖 Expanded all schema boxes');
    }

    collapseAll() {
        const schemaBoxes = document.querySelectorAll('.schema-box pre');
        schemaBoxes.forEach(pre => {
            pre.classList.remove('expanded');
            pre.style.maxHeight = '200px';
        });
        console.log('📕 Collapsed all schema boxes');
    }

    // FIXED: Complete rewrite of schema filter functionality
    handleSchemaFilter(event) {
        const value = event.target.value.toLowerCase();
        const schemaBoxes = document.querySelectorAll('.schema-box');
        let visibleCount = 0;

        console.log(`🔍 Applying filter: "${value}"`);

        schemaBoxes.forEach(box => {
            if (value === 'all') {
                // Show all schemas
                box.style.display = '';
                box.classList.remove('highlighted');
                visibleCount++;
            } else {
                // Get the schema title to determine type
                const titleElement = box.querySelector('.schema-title, h2, h3');
                const titleText = titleElement ? titleElement.textContent.toLowerCase() : '';
                
                // Also check the JSON content for @type
                const preElement = box.querySelector('pre');
                const jsonContent = preElement ? preElement.textContent.toLowerCase() : '';
                
                // Check if the schema matches the filter
                const matchesTitle = titleText.includes(value);
                const matchesType = jsonContent.includes(`"@type"`) && jsonContent.includes(`"${value}"`);
                const matches = matchesTitle || matchesType;

                if (matches) {
                    box.style.display = '';
                    box.classList.add('highlighted');
                    visibleCount++;
                } else {
                    box.style.display = 'none';
                    box.classList.remove('highlighted');
                }
            }
        });

        // Update results display
        const resultSpan = document.getElementById('searchResults');
        if (resultSpan) {
            if (value === 'all') {
                resultSpan.textContent = '';
            } else {
                resultSpan.textContent = `${visibleCount} schema${visibleCount === 1 ? '' : 's'} match filter`;
            }
        }

        console.log(`📊 Filter applied: showing ${visibleCount} of ${schemaBoxes.length} schemas`);
    }

    // FIXED: Complete rewrite of search functionality
    performSearch() {
        const searchInput = document.getElementById('schemaSearch');
        const caseSensitive = document.getElementById('caseSensitive');
        const wholeWord = document.getElementById('wholeWord');
        const searchTarget = document.getElementById('searchTarget');
        const resultSpan = document.getElementById('searchResults');

        if (!(searchInput && caseSensitive && wholeWord && searchTarget && resultSpan)) {
            console.error('❌ Search elements not found');
            return;
        }

        const searchTerm = searchInput.value.trim();
        
        // Clear previous highlights
        this.clearHighlights();

        if (!searchTerm) {
            resultSpan.textContent = '';
            console.log('🔍 Search cleared');
            return;
        }

        console.log(`🔍 Performing search for: "${searchTerm}"`);

        // Build search regex
        let pattern;
        try {
            // Escape special regex characters
            const escapedTerm = searchTerm.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
            
            if (wholeWord.checked) {
                pattern = `\\b${escapedTerm}\\b`;
            } else {
                pattern = escapedTerm;
            }
            
            const flags = caseSensitive.checked ? 'g' : 'gi';
            var searchRegex = new RegExp(pattern, flags);
        } catch (e) {
            console.error('Invalid search pattern:', e);
            resultSpan.textContent = 'Invalid search pattern';
            return;
        }

        let totalMatches = 0;
        const targetValue = searchTarget.value;

        // Search in schemas
        if (targetValue === 'both' || targetValue === 'schemas') {
            const schemaBoxes = document.querySelectorAll('.schema-box');
            schemaBoxes.forEach(box => {
                const matches = this.highlightTextInElement(box, searchRegex);
                totalMatches += matches;
            });
        }

        // Search in recommendations
        if (targetValue === 'both' || targetValue === 'recommendations') {
            const recommendationsDiv = document.getElementById('recommendations');
            if (recommendationsDiv) {
                const matches = this.highlightTextInElement(recommendationsDiv, searchRegex);
                totalMatches += matches;
            }
        }

        // Update results
        if (totalMatches > 0) {
            resultSpan.textContent = `${totalMatches} match${totalMatches === 1 ? '' : 'es'} found`;
            
            // Scroll to first match
            const firstMatch = document.querySelector('.search-highlight');
            if (firstMatch) {
                firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } else {
            resultSpan.textContent = 'No matches found';
        }

        console.log(`🔍 Search completed: ${totalMatches} matches found`);
    }

    // NEW: Improved text highlighting function
    highlightTextInElement(element, regex) {
        let matchCount = 0;
        
        // Get all text nodes
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    // Skip nodes that are already highlighted or in script/style tags
                    if (node.parentNode.tagName === 'MARK' || 
                        node.parentNode.tagName === 'SCRIPT' || 
                        node.parentNode.tagName === 'STYLE') {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            },
            false
        );

        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
            textNodes.push(node);
        }

        // Process each text node
        textNodes.forEach(textNode => {
            const text = textNode.textContent;
            if (!regex.test(text)) return;

            // Reset regex lastIndex for global matching
            regex.lastIndex = 0;
            
            const fragment = document.createDocumentFragment();
            let lastIndex = 0;
            let match;

            while ((match = regex.exec(text)) !== null) {
                // Add text before match
                if (match.index > lastIndex) {
                    fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
                }

                // Add highlighted match
                const mark = document.createElement('mark');
                mark.className = 'search-highlight';
                mark.textContent = match[0];
                fragment.appendChild(mark);
                
                matchCount++;
                lastIndex = match.index + match[0].length;

                // Prevent infinite loops with zero-length matches
                if (match.index === regex.lastIndex) {
                    regex.lastIndex++;
                }
            }

            // Add remaining text
            if (lastIndex < text.length) {
                fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
            }

            // Replace the original text node
            textNode.parentNode.replaceChild(fragment, textNode);
        });

        return matchCount;
    }

    clearHighlights() {
        const highlights = document.querySelectorAll('mark.search-highlight');
        highlights.forEach(mark => {
            const parent = mark.parentNode;
            if (parent) {
                parent.replaceChild(document.createTextNode(mark.textContent), mark);
                // Normalize adjacent text nodes
                parent.normalize();
            }
        });
    }
}

class SchemaDisplayManager {
    constructor() {
        this.defaultCollapsed = true;
    }

    displayRawSchemas(schemas) {
        console.log('🎨 Displaying raw schemas with enhanced UI:', schemas);
        
        const rawSchemasElem = document.getElementById('rawSchemas');
        if (!rawSchemasElem) {
            console.error('❌ Raw schemas element not found');
            return;
        }

        rawSchemasElem.innerHTML = '';
        
        if (!schemas || !Array.isArray(schemas) || schemas.length === 0) {
            rawSchemasElem.innerHTML = `
                <div class="error-message">
                    <h3>No Schemas Found</h3>
                    <p>No schema markup was found on this page.</p>
                </div>
            `;
            return;
        }

        rawSchemasElem.classList.remove('error');

        // Sort schemas by rank (highest first)
        const sortedSchemas = schemas.sort((a, b) => {
            const rankA = a.rank !== undefined ? a.rank : 0;
            const rankB = b.rank !== undefined ? b.rank : 0;
            return rankB - rankA;
        });

        sortedSchemas.forEach((schema, index) => {
            const schemaBox = document.createElement('div');
            schemaBox.className = 'schema-box';
            
            // ENHANCED: Better schema type detection with WebPageElement special handling
            const schemaData = schema.schema || schema;
            let schemaType = schema.type || (schemaData && schemaData['@type']) || 'Unknown';
            let additionalInfo = '';
            
            // Special handling for WebPageElement - show the more specific type
            if (schemaType === 'WebPageElement' && schemaData) {
                const allTypes = Array.isArray(schemaData['@type']) ? schemaData['@type'] : [schemaData['@type']];
                const specificType = allTypes.find(type => type !== 'WebPageElement');
                if (specificType) {
                    additionalInfo = ` - ${specificType}`;
                }
            }
            
            const schemaRank = schema.rank !== undefined ? ` (Rank: ${schema.rank})` : '';
            const formattedJson = JSON.stringify(schemaData, null, 2);
            
            schemaBox.innerHTML = `
                <h3 class="schema-title">
                    <span class="title-text">Schema ${index + 1} - ${schemaType}${additionalInfo}${schemaRank}</span>
                    <div class="schema-actions">
                        <button class="copy-btn" onclick="copySchemaToClipboard(this)" title="Copy Schema">
                            📋 Copy
                        </button>
                    </div>
                </h3>
                <pre class="schema-content" onclick="toggleSchemaBox(this)">${formattedJson}</pre>
            `;
            
            rawSchemasElem.appendChild(schemaBox);
        });

        this.applyDefaultCollapsedState();
        
        // UPDATE: Update the schema filter dropdown with actual schema types
        if (window.uiController && window.uiController.eventManager) {
            window.uiController.eventManager.updateSchemaFilter(sortedSchemas);
        }
        
        console.log(`✅ Displayed ${sortedSchemas.length} schemas in enhanced UI`);
    }

    applyDefaultCollapsedState() {
        const schemaBoxes = document.querySelectorAll('.schema-box pre');
        schemaBoxes.forEach(pre => {
            pre.classList.remove('expanded');
            pre.style.maxHeight = '200px';
            pre.style.cursor = 'pointer';
        });
        
        console.log('🔒 Applied default collapsed state to all schema boxes');
    }

    displayRecommendations(recommendations) {
        console.log('💡 Displaying enhanced recommendations:', recommendations);
        
        let recommendationsElem = document.getElementById('recommendations');
        if (!recommendationsElem) {
            recommendationsElem = document.createElement('div');
            recommendationsElem.id = 'recommendations';
            
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.appendChild(recommendationsElem);
            } else {
                document.body.appendChild(recommendationsElem);
            }
        }

        recommendationsElem.innerHTML = '<h2>📋 SEO Recommendations</h2>';

        if (!recommendations || recommendations.length === 0) {
            recommendationsElem.innerHTML += `
                <div class="recommendation-box">
                    <h3>✅ Great Job!</h3>
                    <p>Your schema markup looks good! No specific recommendations at this time.</p>
                </div>
            `;
            return;
        }

        // Sort recommendations by priority
        const sortedRecommendations = recommendations.sort((a, b) => {
            const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
            return (priorityOrder[b.priority] || 1) - (priorityOrder[a.priority] || 1);
        });

        sortedRecommendations.forEach((rec, index) => {
            const recBox = document.createElement('div');
            recBox.className = 'recommendation-box';
            
            if (rec.priority === 'high') {
                recBox.classList.add('high-priority');
            }
            
            const priorityIcon = rec.priority === 'high' ? '🔴' : 
                               rec.priority === 'medium' ? '🟡' : '🟢';
            
            recBox.innerHTML = `
                <h3>${priorityIcon} ${rec.type || `Recommendation ${index + 1}`}</h3>
                <p>${rec.message || 'No message provided'}</p>
                ${rec.example ? `<pre><code>${rec.example}</code></pre>` : ''}
                ${rec.priority ? `<small class="priority-label">Priority: ${rec.priority.toUpperCase()}</small>` : ''}
            `;
            
            recommendationsElem.appendChild(recBox);
        });
        
        console.log(`✅ Displayed ${sortedRecommendations.length} recommendations`);
    }

    showError(elementId, message) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <h3>❌ Error</h3>
            <p>${message}</p>
            <button onclick="window.location.reload()">🔄 Retry</button>
        `;
        
        element.innerHTML = '';
        element.appendChild(errorDiv);
        
        console.error('❌ Schema UI Error:', message);
    }

    showLoading(elementId) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        element.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p>Processing schemas...</p>
            </div>
        `;
    }
}

class UIUtils {
    static ensureElements(...elementIds) {
        const missing = elementIds.filter(id => !document.getElementById(id));
        if (missing.length > 0) {
            console.error('❌ Missing required elements:', missing);
            throw new Error(`Required elements not found: ${missing.join(', ')}`);
        }
    }

    static debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    static validateSchemas(schemas) {
        if (!schemas) {
            throw new Error('No schemas provided');
        }
        
        const schemasArray = Array.isArray(schemas) ? schemas : [schemas];
        
        if (schemasArray.length === 0) {
            throw new Error('No schemas found');
        }

        const validSchemas = schemasArray.filter(schema => 
            schema && 
            typeof schema === 'object' && 
            schema['@type']
        );

        if (validSchemas.length === 0) {
            throw new Error('No valid schemas found');
        }

        return validSchemas;
    }

    static sanitizeSchema(schema) {
        if (!schema || typeof schema !== 'object') {
            return null;
        }

        return Object.fromEntries(
            Object.entries(schema)
                .filter(([_, value]) => value !== undefined && value !== null)
                .map(([key, value]) => {
                    if (Array.isArray(value)) {
                        return [key, value.filter(item => item !== null && item !== undefined)];
                    }
                    if (typeof value === 'object') {
                        return [key, UIUtils.sanitizeSchema(value)];
                    }
                    return [key, value];
                })
        );
    }
}

// Main UI Controller Class
class UIController {
    constructor() {
        this.progressTracker = new ProgressTracker();
        this.eventManager = new SchemaEventManager();
        this.displayManager = new SchemaDisplayManager();
        this.initialized = false;
    }

    async initialize(mode = 'ranker') {
        console.log(`🚀 Initializing UI Controller in ${mode} mode...`);
        
        try {
            if (mode === 'ranker') {
                await this.eventManager.initializeControls();
            }
            
            this.initialized = true;
            console.log('✅ UI Controller initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ UI Controller initialization failed:', error);
            throw error;
        }
    }

    displaySchemas(schemas) {
        return this.displayManager.displayRawSchemas(schemas);
    }

    displayRecommendations(recommendations) {
        return this.displayManager.displayRecommendations(recommendations);
    }

    showError(elementId, message) {
        return this.displayManager.showError(elementId, message);
    }

    showLoading(elementId) {
        return this.displayManager.showLoading(elementId);
    }

    reset() {
        this.eventManager.reset();
        this.initialized = false;
    }
}

// Create global instances
window.ProgressTracker = ProgressTracker;
window.UIController = UIController;
window.uiController = new UIController();

// Backward compatibility exports
window.schemaEvents = window.uiController.eventManager;
window.schemaUI = {
    displayRawSchemas: (schemas) => window.uiController.displaySchemas(schemas),
    displayRecommendations: (recommendations) => window.uiController.displayRecommendations(recommendations),
    displaySplitView: (schemas) => window.uiController.displaySchemas(schemas),
    schemaError: (elementId, message) => window.uiController.showError(elementId, message),
    showLoading: (elementId) => window.uiController.showLoading(elementId),
    hideLoading: (elementId) => {
        const element = document.getElementById(elementId);
        if (element) {
            const loadingDiv = element.querySelector('.loading');
            if (loadingDiv) loadingDiv.remove();
        }
    }
};
window.uiUtils = UIUtils;

// GLOBAL FUNCTIONS for HTML onclick handlers
window.toggleSchemaBox = function(pre) {
    pre.classList.toggle('expanded');
    if (pre.classList.contains('expanded')) {
        pre.style.maxHeight = 'none';
    } else {
        pre.style.maxHeight = '200px';
    }
};

window.copySchemaToClipboard = function(button) {
    // Prevent the click from bubbling up to the schema box
    event.stopPropagation();
    
    // Find the pre element that contains the schema
    const schemaBox = button.closest('.schema-box');
    const preElement = schemaBox.querySelector('pre');
    const schemaText = preElement.textContent;
    
    // Copy to clipboard
    if (navigator.clipboard) {
        navigator.clipboard.writeText(schemaText).then(() => {
            // Visual feedback
            const originalText = button.textContent;
            button.textContent = '✅ Copied!';
            button.style.background = '#28a745';
            
            setTimeout(() => {
                button.textContent = originalText;
                button.style.background = '';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy: ', err);
            fallbackCopyTextToClipboard(schemaText, button);
        });
    } else {
        // Fallback for older browsers
        fallbackCopyTextToClipboard(schemaText, button);
    }
};

// Fallback copy function for older browsers
function fallbackCopyTextToClipboard(text, button) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        // Visual feedback
        const originalText = button.textContent;
        button.textContent = '✅ Copied!';
        button.style.background = '#28a745';
        
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '';
        }, 2000);
    } catch (err) {
        console.error('Fallback: Could not copy text: ', err);
        button.textContent = '❌ Failed';
        setTimeout(() => {
            button.textContent = '📋 Copy';
        }, 2000);
    }
    
    document.body.removeChild(textArea);
}

console.log('✅ UI Controller v2.0 (FIXED) loaded successfully');