// dashboard/components.js - UI Components for Schema Web Analyzer
class UIComponents {
    constructor() {
        this.toastContainer = document.getElementById('toastContainer');
    }

    /**
     * Create recommendation card
     */
    createRecommendationCard(recommendation, index) {
        const card = document.createElement('div');
        card.className = `recommendation-card border rounded-lg p-4 transition-all hover:shadow-md`;
        card.dataset.recommendationLevel = recommendation.level;
        
        const levelColors = {
            high: 'border-red-200 bg-red-50',
            medium: 'border-yellow-200 bg-yellow-50',
            low: 'border-blue-200 bg-blue-50'
        };
        
        const levelIcons = {
            high: '🚨',
            medium: '⚠️',
            low: 'ℹ️'
        };
        
        card.className += ` ${levelColors[recommendation.level] || levelColors.low}`;
        
        card.innerHTML = `
            <div class="flex items-start justify-between mb-3">
                <div class="flex items-center space-x-2">
                    <span class="text-lg">${levelIcons[recommendation.level] || 'ℹ️'}</span>
                    <h4 class="font-medium text-gray-900">${recommendation.type}</h4>
                </div>
                <span class="px-2 py-1 text-xs font-medium rounded-full ${this.getPriorityBadgeClass(recommendation.level)}">
                    ${recommendation.level?.toUpperCase() || 'INFO'}
                </span>
            </div>
            
            <p class="text-sm text-gray-700 mb-3">${recommendation.message}</p>
            
            ${recommendation.example ? `
                <div class="bg-white border rounded p-3 mb-3">
                    <div class="flex items-center space-x-2 mb-2">
                        <span class="text-green-600">✅</span>
                        <span class="text-xs font-medium text-gray-600">RECOMMENDED</span>
                    </div>
                    <pre class="text-xs text-gray-800 overflow-x-auto"><code>${this.escapeHtml(recommendation.example)}</code></pre>
                </div>
            ` : ''}
            
            ${recommendation.badExample ? `
                <div class="bg-red-50 border border-red-200 rounded p-3 mb-3">
                    <div class="flex items-center space-x-2 mb-2">
                        <span class="text-red-600">❌</span>
                        <span class="text-xs font-medium text-red-600">CURRENT (NEEDS FIX)</span>
                    </div>
                    <pre class="text-xs text-red-800 overflow-x-auto"><code>${this.escapeHtml(recommendation.badExample)}</code></pre>
                </div>
            ` : ''}
            
            ${recommendation.details ? `
                <p class="text-xs text-gray-500 mt-2">${recommendation.details}</p>
            ` : ''}
            
            <div class="flex items-center justify-between mt-4">
                <span class="text-xs text-gray-500">
                    ${recommendation.affectedSchemas ? `Affects ${recommendation.affectedSchemas} schema${recommendation.affectedSchemas === 1 ? '' : 's'}` : ''}
                </span>
                <div class="flex space-x-2">
                    ${recommendation.example ? `
                        <button onclick="copyToClipboard('${this.escapeForJs(recommendation.example)}', this)" 
                                class="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors">
                            📋 Copy Fix
                        </button>
                    ` : ''}
                    <button onclick="toggleDetails(this)" 
                            class="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors">
                        📖 Details
                    </button>
                </div>
            </div>
        `;
        
        return card;
    }

    /**
     * Create schema card
     */
    createSchemaCard(schemaData, index) {
        const card = document.createElement('div');
        card.className = 'schema-card border rounded-lg p-4 transition-all hover:shadow-md';
        card.dataset.schemaType = schemaData.type;
        
        const rankColor = this.getRankColor(schemaData.rank);
        const hasValidId = schemaData.schema['@id'] && schemaData.schema['@id'].startsWith('schema:');
        
        card.innerHTML = `
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-lg ${rankColor} flex items-center justify-center text-white font-bold">
                        ${schemaData.rank || '?'}
                    </div>
                    <div>
                        <h4 class="font-medium text-gray-900">${schemaData.type}</h4>
                        <div class="flex items-center space-x-2 text-xs text-gray-500">
                            <span>Rank: ${schemaData.rank || 0}</span>
                            ${schemaData.completeness ? `<span>• Complete: ${schemaData.completeness}%</span>` : ''}
                            ${hasValidId ? '<span class="text-green-600">• Valid @id</span>' : '<span class="text-red-600">• Invalid @id</span>'}
                        </div>
                    </div>
                </div>
                <div class="flex space-x-2">
                    <button onclick="copySchemaToClipboard(${index}, this)" 
                            class="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors">
                        📋 Copy
                    </button>
                    <button onclick="toggleSchemaContent(${index})" 
                            class="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors">
                        👁️ Toggle
                    </button>
                </div>
            </div>
            
            ${schemaData.schema['@id'] ? `
                <div class="mb-3 p-2 ${hasValidId ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border rounded">
                    <div class="text-xs font-medium ${hasValidId ? 'text-green-700' : 'text-red-700'}">
                        @id: ${schemaData.schema['@id']}
                    </div>
                    ${!hasValidId ? '<div class="text-xs text-red-600 mt-1">💡 Consider using "schema:EntityType" pattern</div>' : ''}
                </div>
            ` : `
                <div class="mb-3 p-2 bg-yellow-50 border-yellow-200 border rounded">
                    <div class="text-xs font-medium text-yellow-700">⚠️ Missing @id property</div>
                    <div class="text-xs text-yellow-600 mt-1">💡 Add: "@id": "schema:${schemaData.type}"</div>
                </div>
            `}
            
            <div class="schema-content collapsed" id="schema-content-${index}">
                <pre class="text-xs bg-gray-50 p-3 rounded border overflow-x-auto"><code>${this.formatJson(schemaData.schema)}</code></pre>
            </div>
        `;
        
        return card;
    }

    /**
     * Create recent scan card
     */
    createRecentScanCard(scan) {
        const card = document.createElement('div');
        card.className = 'recent-scan-card border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer';
        
        const timeAgo = this.getTimeAgo(scan.timestamp);
        const statusColor = this.getStatusColor(scan.status);
        
        card.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <div class="flex items-center space-x-2">
                    <span class="text-lg">${scan.type === 'site_scan' ? '🗺️' : '🔍'}</span>
                    <h4 class="font-medium text-gray-900 truncate">${this.getDomainFromUrl(scan.url)}</h4>
                </div>
                <span class="px-2 py-1 text-xs font-medium rounded-full ${statusColor}">
                    ${scan.status}
                </span>
            </div>
            
            <div class="grid grid-cols-2 gap-4 text-xs text-gray-600 mb-3">
                <div>
                    <span class="font-medium">Schemas:</span> ${scan.schemas_found || 0}
                </div>
                <div>
                    <span class="font-medium">Pages:</span> ${scan.pages_scanned || 1}
                </div>
            </div>
            
            <div class="flex items-center justify-between text-xs text-gray-500">
                <span>${timeAgo}</span>
                <div class="flex space-x-2">
                    <button onclick="loadScanResults('${scan.scan_id}')" 
                            class="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors">
                        View
                    </button>
                    ${scan.status === 'completed' ? `
                        <button onclick="deleteScan('${scan.scan_id}')" 
                                class="px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors">
                            Delete
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
        
        // Add click handler to load results
        card.addEventListener('click', (e) => {
            if (!e.target.closest('button')) {
                if (window.schemaAnalyzer) {
                    window.schemaAnalyzer.loadScanResults(scan.scan_id);
                }
            }
        });
        
        return card;
    }

    /**
     * Create empty state component
     */
    createEmptyState(title, message, icon = 'document') {
        const icons = {
            document: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>`,
            checkmark: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>`,
            clock: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>`
        };
        
        return `
            <div class="text-center text-gray-500 py-8">
                <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    ${icons[icon] || icons.document}
                </svg>
                <h3 class="mt-2 text-sm font-medium text-gray-900">${title}</h3>
                <p class="mt-1 text-sm text-gray-500">${message}</p>
            </div>
        `;
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info', duration = 5000) {
        const toast = this.createToast(message, '', type, duration);
        this.toastContainer.appendChild(toast);
        
        // Remove after duration
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, duration);
    }

    /**
     * Create toast element
     */
    createToast(title, body, type = 'info', duration = 5000) {
        const toast = document.createElement('div');
        toast.className = `toast transform transition-all duration-300 ease-in-out ${this.getToastClasses(type)}`;
        
        const icons = {
            success: '✅',
            error: '❌', 
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        toast.innerHTML = `
            <div class="flex items-center">
                <div class="flex-shrink-0">
                    <span class="text-lg">${icons[type] || icons.info}</span>
                </div>
                <div class="ml-3 flex-1">
                    <div class="toast-title text-sm font-medium">${title}</div>
                    ${body ? `<div class="toast-body text-sm mt-1">${body}</div>` : ''}
                </div>
                <div class="ml-4 flex-shrink-0">
                    <button class="text-gray-400 hover:text-gray-600" onclick="this.parentElement.parentElement.remove()">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        
        // Add progress bar for timed toasts
        if (duration > 0) {
            const progressBar = document.createElement('div');
            progressBar.className = 'absolute bottom-0 left-0 h-1 bg-current opacity-30 transition-all ease-linear';
            progressBar.style.width = '100%';
            progressBar.style.transitionDuration = `${duration}ms`;
            toast.appendChild(progressBar);
            
            // Start animation
            setTimeout(() => {
                progressBar.style.width = '0%';
            }, 10);
        }
        
        return toast;
    }

    /**
     * Get toast CSS classes based on type
     */
    getToastClasses(type) {
        const baseClasses = 'relative bg-white border rounded-lg shadow-lg p-4 mb-2 max-w-sm';
        
        const typeClasses = {
            success: 'border-green-200 text-green-800',
            error: 'border-red-200 text-red-800',
            warning: 'border-yellow-200 text-yellow-800',
            info: 'border-blue-200 text-blue-800'
        };
        
        return `${baseClasses} ${typeClasses[type] || typeClasses.info}`;
    }

    /**
     * Get priority badge classes
     */
    getPriorityBadgeClass(level) {
        const classes = {
            high: 'bg-red-100 text-red-800',
            medium: 'bg-yellow-100 text-yellow-800',
            low: 'bg-blue-100 text-blue-800'
        };
        
        return classes[level] || classes.low;
    }

    /**
     * Get rank color based on rank value
     */
    getRankColor(rank) {
        if (rank >= 5) return 'bg-green-500';
        if (rank >= 4) return 'bg-blue-500';
        if (rank >= 3) return 'bg-yellow-500';
        if (rank >= 2) return 'bg-orange-500';
        return 'bg-red-500';
    }

    /**
     * Get status color classes
     */
    getStatusColor(status) {
        const colors = {
            completed: 'bg-green-100 text-green-800',
            processing: 'bg-blue-100 text-blue-800',
            failed: 'bg-red-100 text-red-800',
            stopped: 'bg-gray-100 text-gray-800'
        };
        
        return colors[status] || colors.completed;
    }

    /**
     * Format JSON for display
     */
    formatJson(obj) {
        return JSON.stringify(obj, null, 2);
    }

    /**
     * Escape HTML characters
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Escape text for JavaScript strings
     */
    escapeForJs(text) {
        return text.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
    }

    /**
     * Get domain from URL
     */
    getDomainFromUrl(url) {
        try {
            return new URL(url).hostname;
        } catch (e) {
            return url;
        }
    }

    /**
     * Get time ago string
     */
    getTimeAgo(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diffMs = now - time;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return time.toLocaleDateString();
    }
}

// Global utility functions for onclick handlers
window.copyToClipboard = async function(text, button) {
    try {
        await navigator.clipboard.writeText(text);
        
        const originalText = button.textContent;
        button.textContent = '✅ Copied!';
        button.classList.add('bg-green-100', 'text-green-700');
        
        setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove('bg-green-100', 'text-green-700');
        }, 2000);
        
    } catch (err) {
        console.error('Failed to copy:', err);
        button.textContent = '❌ Failed';
        setTimeout(() => {
            button.textContent = '📋 Copy Fix';
        }, 2000);
    }
};

window.copySchemaToClipboard = function(index, button) {
    const schemaContent = document.getElementById(`schema-content-${index}`);
    if (schemaContent) {
        const code = schemaContent.querySelector('code');
        if (code) {
            copyToClipboard(code.textContent, button);
        }
    }
};

window.toggleSchemaContent = function(index) {
    const content = document.getElementById(`schema-content-${index}`);
    if (content) {
        content.classList.toggle('collapsed');
    }
};

window.toggleDetails = function(button) {
    const card = button.closest('.recommendation-card');
    const details = card.querySelector('.text-xs.text-gray-500');
    
    if (details) {
        details.classList.toggle('hidden');
        button.textContent = details.classList.contains('hidden') ? '📖 Details' : '📖 Hide';
    }
};

window.loadScanResults = function(scanId) {
    if (window.schemaAnalyzer) {
        window.schemaAnalyzer.loadScanResults(scanId);
    }
};

window.deleteScan = async function(scanId) {
    if (confirm('Are you sure you want to delete this scan?')) {
        try {
            if (window.schemaAnalyzer) {
                await window.schemaAnalyzer.apiClient.deleteScan(scanId);
                window.schemaAnalyzer.showToast('🗑️ Scan deleted successfully', 'success');
                window.schemaAnalyzer.loadRecentScans();
            }
        } catch (error) {
            if (window.schemaAnalyzer) {
                window.schemaAnalyzer.showError('Failed to delete scan: ' + error.message);
            }
        }
    }
};
