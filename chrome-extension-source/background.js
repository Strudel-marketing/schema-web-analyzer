// Service worker context
self.addEventListener('error', (event) => { 
  console.error('Service worker error:', event.error);
}); 

// Initialize cache and state
const urlStatusCache = new Map(); 
let originalTabUrl = ''; 
let originalTabId = null;

// Cache cleanup
const CACHE_CLEANUP_INTERVAL = 3600000;
setInterval(() => {
  console.log('Clearing URL status cache');
  urlStatusCache.clear();
}, CACHE_CLEANUP_INTERVAL); 

// Utility functions
// Updated sanitizeUrl function in background.js

function sanitizeUrl(url) { 
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

async function getCachedUrlStatus(url) { 
  const sanitizedUrl = sanitizeUrl(url);
  if (!sanitizedUrl) {
    return { status: 'Error', error: 'Invalid URL' };
  }

  if (urlStatusCache.has(sanitizedUrl)) { 
    return urlStatusCache.get(sanitizedUrl); 
  } 

  try {
    const status = await checkUrlStatusWithTimeout(sanitizedUrl); 
    urlStatusCache.set(sanitizedUrl, status); 
    return status;
  } catch (error) {
    console.error('Error checking URL status:', error);
    return { status: 'Error', error: error.message };
  }
}

async function checkUrlStatusWithTimeout(url, timeout = 5000) { 
  const controller = new AbortController(); 
  const timeoutId = setTimeout(() => controller.abort(), timeout); 
  
  try { 
    const response = await self.fetch(url, { 
      method: 'HEAD', 
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    }); 
    return { status: response.status }; 
  } catch (error) { 
    if (error.name === 'AbortError') { 
      return { status: 'Timeout', error: 'Request timed out' }; 
    } 
    return { status: 'Error', error: error.message }; 
  } finally { 
    clearTimeout(timeoutId); 
  } 
}

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => { 
  console.log('Background script received message:', request.action);

  // Clean up any existing listeners
  if (request.action === 'cleanup') {
      chrome.runtime.onMessage.removeListener(arguments.callee);
      sendResponse({ success: true });
      return false;
  }
  switch (request.action) {
    case 'checkUrlStatus': 
      handleUrlStatusCheck(request, sendResponse);
      break;
    
    case 'setOriginalTabUrl':
      handleSetOriginalUrl(request, sender, sendResponse);
      break;
    
    case 'getOriginalTabUrl': 
      handleGetOriginalUrl(sender, sendResponse);
      break;
      
    case 'fetchPageTitle':
      handleFetchPageTitle(request, sendResponse);
      break;
    
    case 'processSchemas':
    case 'rankSchemas':
      handleSchemaAction(request, sender, sendResponse);
      break;

    default:
      console.warn('Unknown message action:', request.action);
      sendResponse({ error: 'Unknown action' });
      return false;
  }

  return true; // Keep message channel open for async responses
});

// Message handlers
function handleSetOriginalUrl(request, sender, sendResponse) {
  if (!request.url) {
    sendResponse({ success: false, error: 'No URL provided' });
    return;
  }

  try {
    const url = new URL(request.url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Invalid URL protocol');
    }
    originalTabUrl = url.toString();
    originalTabId = sender.tab?.id;
    console.log('Original tab URL set to:', originalTabUrl);
    console.log('Original tab ID set to:', originalTabId);
    sendResponse({ 
      success: true, 
      url: originalTabUrl,
      tabId: originalTabId 
    });
  } catch (error) {
    console.error('Error setting original URL:', error);
    sendResponse({ success: false, error: error.message });
  }
}

function handleGetOriginalUrl(sender, sendResponse) {
  if (!originalTabUrl) {
    sendResponse({ 
      success: false, 
      error: 'No URL stored',
      url: null,
      tabId: null 
    });
    return;
  }
  
  sendResponse({ 
    success: true,
    url: originalTabUrl,
    tabId: originalTabId
  });
}

async function handleUrlStatusCheck(request, sendResponse) {
  try {
    const status = await getCachedUrlStatus(request.url);
    sendResponse(status);
  } catch (error) {
    console.error('Error checking URL status:', error);
    sendResponse({ status: 'Error', error: error.message });
  }
}

// NEW: Handle page title fetching
async function handleFetchPageTitle(request, sendResponse) {
  try {
    const url = sanitizeUrl(request.url);
    if (!url) {
      sendResponse({ success: false, error: 'Invalid URL' });
      return;
    }
    
    // Try to fetch the page and extract title
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Schema-Extension)',
        }
      });
      
      if (response.ok) {
        const html = await response.text();
        
        // Extract title from HTML
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : null;
        
        if (title) {
          sendResponse({ success: true, title: title });
        } else {
          sendResponse({ success: false, error: 'No title found' });
        }
      } else {
        sendResponse({ success: false, error: `HTTP ${response.status}` });
      }
    } catch (fetchError) {
      console.warn('Could not fetch page title:', fetchError.message);
      sendResponse({ success: false, error: fetchError.message });
    } finally {
      clearTimeout(timeoutId);
    }
    
  } catch (error) {
    console.error('Error in handleFetchPageTitle:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleSchemaAction(request, sender, sendResponse) {
  try {
    if (!originalTabUrl || !originalTabId) {
      throw new Error('Original tab information not found');
    }

    // Send response with both URL and tab ID
    sendResponse({
      success: true,
      url: originalTabUrl,
      tabId: originalTabId,
      data: request.data
    });
  } catch (error) {
    console.error('Error handling schema action:', error);
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

// Tab handling
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === originalTabId) {
    console.log('Original tab closed, clearing stored data');
    originalTabUrl = '';
    originalTabId = null;
  }
});

// Installation and update handling
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(clients.claim());
});

console.log('Background service worker loaded');