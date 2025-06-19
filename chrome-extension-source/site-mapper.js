// site-mapper.js - Updated to redirect to results.html after scan
console.log('🗺️ Loading Site Mapper Interface...');

// Enhanced Error Logger (same as before)
class SiteMapperLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 100;
    }
    
    log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            data: data ? JSON.stringify(data, null, 2) : null
        };
        
        this.logs.unshift(logEntry);
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(0, this.maxLogs);
        }
        
        // Console output with emojis
        const emoji = {
            'info': 'ℹ️',
            'success': '✅',
            'warning': '⚠️',
            'error': '❌',
            'debug': '🐛'
        }[level] || 'ℹ️';
        
        console.log(`${emoji} [${timestamp}] ${message}`, data || '');
    }
    
    info(message, data) { this.log('info', message, data); }
    success(message, data) { this.log('success', message, data); }
    warning(message, data) { this.log('warning', message, data); }
    error(message, data) { this.log('error', message, data); }
    debug(message, data) { this.log('debug', message, data); }
}

// Global logger instance
const logger = new SiteMapperLogger();

// Global site mapper instance
let siteMapper = null;
let isScanning = false;
let scanStartTime = null;
let timerInterval = null;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    logger.info('Site mapper DOM loaded');
    initializeSiteMapper();
    attachEventListeners();
});

function attachEventListeners() {
    logger.debug('Attaching event listeners');
    
    // Main action buttons
    const closeBtn = document.getElementById('closeMapperBtn');
    const startBtn = document.getElementById('startScanBtn');
    const stopBtn = document.getElementById('stopScanBtn');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeSiteMapper);
        logger.debug('Close button listener attached');
    }
    
    if (startBtn) {
        startBtn.addEventListener('click', startSiteMapperScan);
        logger.debug('Start scan button listener attached');
    }
    
    if (stopBtn) {
        stopBtn.addEventListener('click', stopSiteMapperScan);
        logger.debug('Stop scan button listener attached');
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    logger.success('All event listeners attached successfully');
}

function handleKeyboardShortcuts(e) {
    // Escape to close
    if (e.key === 'Escape') {
        logger.debug('Escape key pressed - closing mapper');
        closeSiteMapper();
    }
    
    // Ctrl/Cmd + Enter to start scan
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isScanning) {
            logger.debug('Ctrl+Enter pressed - starting scan');
            startSiteMapperScan();
        }
    }
}

function initializeSiteMapper() {
    logger.info('Initializing site mapper');
    
    try {
        // Get URL from chrome runtime
        if (chrome && chrome.runtime) {
            chrome.runtime.sendMessage({ action: 'getOriginalTabUrl' }, (response) => {
                if (chrome.runtime.lastError) {
                    logger.warning('Could not get original URL', chrome.runtime.lastError);
                } else if (response && response.url) {
                    logger.info('Retrieved original URL', response.url);
                    setDefaultUrl(response.url);
                } else {
                    logger.warning('No URL in response', response);
                }
            });
        } else {
            logger.error('Chrome runtime not available');
        }
    } catch (error) {
        logger.error('Error in initializeSiteMapper', error.message);
    }
}

function setDefaultUrl(url) {
    const urlInput = document.getElementById('mapperUrl');
    if (urlInput && url) {
        try {
            const parsedUrl = new URL(url);
            urlInput.value = parsedUrl.origin;
            logger.success('Default URL set', parsedUrl.origin);
        } catch (e) {
            logger.warning('Could not parse URL', { url, error: e.message });
        }
    } else {
        logger.warning('URL input not found or no URL provided', { urlInput: !!urlInput, url });
    }
}

function closeSiteMapper() {
    logger.info('Closing site mapper');
    
    // Stop any ongoing scan
    if (isScanning) {
        logger.info('Stopping ongoing scan before closing');
        stopSiteMapperScan();
    }
    
    // Close the window/tab
    try {
        if (window.opener) {
            logger.info('Closing via window.opener');
            window.close();
        } else {
            logger.info('Closing via history or direct close');
            if (history.length > 1) {
                history.back();
            } else {
                window.close();
            }
        }
    } catch (error) {
        logger.error('Error closing window', error.message);
    }
}

async function startSiteMapperScan() {
    const urlInput = document.getElementById('mapperUrl');
    const url = urlInput ? urlInput.value.trim() : '';
    
    logger.info('Starting site mapper scan', { url });
    
    if (!url) {
        logger.error('No URL provided');
        alert('Please enter a website URL');
        if (urlInput) urlInput.focus();
        return;
    }

    // Validate URL
    try {
        new URL(url);
        logger.success('URL validation passed', url);
    } catch (e) {
        logger.error('URL validation failed', { url, error: e.message });
        alert('Please enter a valid URL (including http:// or https://)');
        if (urlInput) urlInput.focus();
        return;
    }

    try {
        // Check if SiteSchemaMapper is available
        if (!window.SiteSchemaMapper) {
            throw new Error('Site Schema Mapper not loaded. Please refresh the page and try again.');
        }
        logger.success('SiteSchemaMapper class found');

        siteMapper = new window.SiteSchemaMapper();
        isScanning = true;
        scanStartTime = Date.now();

        // Get options from form
        const maxPages = parseInt(document.getElementById('maxPages')?.value) || 25;
        const crawlDelay = parseInt(document.getElementById('crawlDelay')?.value) || 1500;
        
        logger.info('Scan options configured', { maxPages, crawlDelay });

        // Show progress
        const progressEl = document.getElementById('mapperProgress');
        if (progressEl) {
            progressEl.classList.add('active');
            logger.debug('Progress element shown');
        }

        // Start timer
        startTimer();

        const options = {
            maxPages: maxPages,
            crawlDelay: crawlDelay,
            onProgress: (progress) => {
                logger.debug('Scan progress update', progress);
                updateProgress(progress);
            },
            onComplete: (results) => {
                logger.success('Scan completed', { 
                    totalPages: results.totalPages, 
                    totalSchemas: results.totalSchemas 
                });
                handleResults(results);
            },
            onError: (error) => {
                logger.error('Scan error', error.message);
                handleError(error);
            }
        };

        logger.info('Starting site mapping with options', options);
        await siteMapper.mapSite(url, options);

    } catch (error) {
        logger.error('Critical error in startSiteMapperScan', error.message);
        handleError(error);
    }
}

function stopSiteMapperScan() {
    logger.info('Stopping site mapper scan');
    
    if (siteMapper && isScanning) {
        siteMapper.stopScanning();
        isScanning = false;
        
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
            logger.debug('Timer interval cleared');
        }
        
        const progressEl = document.getElementById('mapperProgress');
        if (progressEl) {
            progressEl.classList.remove('active');
            logger.debug('Progress element hidden');
        }
        
        logger.success('Site scan stopped by user');
    } else {
        logger.warning('Attempted to stop scan but no active scan found');
    }
}

function updateProgress(progress) {
    const total = progress.scanned + progress.queued;
    const percentage = total > 0 ? (progress.scanned / total) * 100 : 0;
    
    const progressFill = document.getElementById('mapperProgressFill');
    if (progressFill) {
        progressFill.style.width = percentage + '%';
    }
    
    const statsEl = document.getElementById('mapperStats');
    if (statsEl) {
        const elapsed = Date.now() - scanStartTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        
        statsEl.textContent = 
            `Scanned: ${progress.scanned}, Queued: ${progress.queued}, Schemas: ${progress.found} | Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

function startTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        logger.debug('Previous timer cleared');
    }
    
    timerInterval = setInterval(() => {
        if (!isScanning) {
            clearInterval(timerInterval);
            logger.debug('Timer stopped - scan no longer active');
            return;
        }
        
        const elapsed = Date.now() - scanStartTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        
        const statsEl = document.getElementById('mapperStats');
        if (statsEl && isScanning) {
            const currentText = statsEl.textContent;
            const baseText = currentText.split(' | Time:')[0];
            statsEl.textContent = baseText + ` | Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }, 1000);
    
    logger.debug('Timer started');
}

// UPDATED: Handle results by redirecting to results.html
async function handleResults(results) {
    logger.info('Handling scan results - redirecting to results page', {
        pages: results.totalPages,
        schemas: results.totalSchemas,
        connections: results.connections
    });
    
    isScanning = false;
    
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        logger.debug('Timer cleared after completion');
    }

    try {
        // Convert site mapper results to schema format for results.html
        const schemasForResults = [];
        
        results.pages.forEach(page => {
            page.schemas.forEach((schema, index) => {
                schemasForResults.push({
                    ...schema.data,
                    _siteMapperInfo: {
                        foundOnUrl: page.url,
                        pageTitle: page.title,
                        schemaIndex: index,
                        location: schema.location
                    }
                });
            });
        });

        // Store results for the results page
        await chrome.storage.local.set({
            pendingSchemas: {
                schemas: schemasForResults,
                originalUrl: results.baseUrl,
                timestamp: Date.now(),
                siteMapperResults: results, // Store complete site mapper results
                isSiteMapperResults: true
            }
        });

        logger.success('Results stored, opening results page');

        // Open results page
        const resultsUrl = chrome.runtime.getURL('results.html');
        const newTab = await chrome.tabs.create({
            url: resultsUrl,
            active: true
        });

        logger.success('Results page opened in new tab:', newTab.id);
        
        // Close the site mapper after a short delay to show completion
        setTimeout(() => {
            closeSiteMapper();
        }, 1000);

    } catch (error) {
        logger.error('Error handling results', error.message);
        // Fallback to showing error
        handleError(new Error('Failed to display results: ' + error.message));
    }
}

function handleError(error) {
    logger.error('Handling scan error', error.message);
    
    isScanning = false;
    
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        logger.debug('Timer cleared after error');
    }

    const progressEl = document.getElementById('mapperProgress');
    if (progressEl) {
        progressEl.classList.remove('active');
        logger.debug('Progress hidden after error');
    }
    
    alert(`Scan Error: ${error.message}\n\nPlease check the URL and try again.`);
}

// Global error handler
window.onerror = function(msg, url, line, col, error) {
    logger.error('Global JavaScript error', {
        message: msg,
        url: url,
        line: line,
        column: col,
        error: error ? error.stack : 'No stack trace'
    });
    return false;
};

window.addEventListener('unhandledrejection', function(event) {
    logger.error('Unhandled promise rejection', event.reason);
});

logger.success('Site Mapper Interface loaded successfully');

// Make logger globally available for console debugging
window.siteMapperLogger = logger;