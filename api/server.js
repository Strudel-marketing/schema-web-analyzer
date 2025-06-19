const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');
const helmet = require('helmet');

// Import core modules
const crawler = require('./crawler');
const analyzer = require('./analyzer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false // Allow inline scripts for dashboard
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../dashboard')));

// API Routes

// Health check endpoint - IMPROVED
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'Schema Web Analyzer',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Quick health check with URL validation
app.get('/api/health-check', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({
        error: 'URL parameter is required'
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({
        error: 'Invalid URL format'
      });
    }

    // Perform quick analysis
    const result = await crawler.quickAnalyze(url);
    
    res.json({
      status: result.status,
      quick_stats: result.stats,
      quick_fixes: result.recommendations.slice(0, 3)
    });

  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      error: 'Health check failed',
      message: error.message
    });
  }
});

// Single URL analysis
app.post('/api/analyze', async (req, res) => {
  try {
    const { url, options = {} } = req.body;
    
    if (!url) {
      return res.status(400).json({
        error: 'URL is required'
      });
    }

    // Validate URL
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({
        error: 'Invalid URL format'
      });
    }

    console.log(`🔍 Analyzing URL: ${url}`);
    
    // Perform analysis
    const result = await analyzer.analyzePage(url, options);
    
    // Save result
    const scanId = result.scan_id;
    await saveResult(scanId, result);
    
    console.log(`✅ Analysis completed for ${url}, scan ID: ${scanId}`);
    
    res.json(result);

  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      error: 'Analysis failed',
      message: error.message
    });
  }
});

// Site-wide scanning
app.post('/api/scan-site', async (req, res) => {
  try {
    const { start_url, options = {} } = req.body;
    
    if (!start_url) {
      return res.status(400).json({
        error: 'start_url is required'
      });
    }

    // Validate URL
    try {
      new URL(start_url);
    } catch (error) {
      return res.status(400).json({
        error: 'Invalid URL format'
      });
    }

    console.log(`🗺️ Starting site scan: ${start_url}`);
    
    // Start background scanning
    const scanId = await crawler.startSiteScan(start_url, options);
    
    res.json({
      scan_id: scanId,
      status: 'processing',
      message: 'Site scan started'
    });

  } catch (error) {
    console.error('Site scan error:', error);
    res.status(500).json({
      error: 'Site scan failed',
      message: error.message
    });
  }
});

// Get scan results
app.get('/api/results/:scanId', async (req, res) => {
  try {
    const { scanId } = req.params;
    
    const result = await loadResult(scanId);
    
    if (!result) {
      return res.status(404).json({
        error: 'Scan not found'
      });
    }
    
    res.json(result);

  } catch (error) {
    console.error('Results error:', error);
    res.status(500).json({
      error: 'Failed to load results',
      message: error.message
    });
  }
});

// Get entity graph
app.get('/api/entity-graph/:scanId', async (req, res) => {
  try {
    const { scanId } = req.params;
    
    const result = await loadResult(scanId);
    
    if (!result) {
      return res.status(404).json({
        error: 'Scan not found'
      });
    }

    const graph = analyzer.buildEntityGraph(result);
    
    res.json(graph);

  } catch (error) {
    console.error('Entity graph error:', error);
    res.status(500).json({
      error: 'Failed to build entity graph',
      message: error.message
    });
  }
});

// Serve dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../dashboard/index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  });
});

// Utility functions
async function saveResult(scanId, result) {
  const dataDir = path.join(__dirname, '../data/scans');
  await ensureDir(dataDir);
  
  const filePath = path.join(dataDir, `${scanId}.json`);
  await fs.writeFile(filePath, JSON.stringify(result, null, 2));
  
  // Update index
  await updateIndex(scanId, result);
}

async function loadResult(scanId) {
  try {
    const filePath = path.join(__dirname, '../data/scans', `${scanId}.json`);
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

async function updateIndex(scanId, result) {
  const indexPath = path.join(__dirname, '../data/scans/index.json');
  
  let index = [];
  try {
    const data = await fs.readFile(indexPath, 'utf8');
    index = JSON.parse(data);
  } catch (error) {
    // Index doesn't exist yet
  }
  
  // Add or update entry
  const entry = {
    scan_id: scanId,
    url: result.url,
    timestamp: result.timestamp,
    type: result.type,
    status: result.status
  };
  
  const existingIndex = index.findIndex(item => item.scan_id === scanId);
  if (existingIndex >= 0) {
    index[existingIndex] = entry;
  } else {
    index.unshift(entry);
  }
  
  // Keep only last 100 entries
  index = index.slice(0, 100);
  
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
}

async function ensureDir(dirPath) {
  try {
    await fs.access(dirPath);
  } catch (error) {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Schema Web Analyzer running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔍 API Health: http://localhost:${PORT}/api/health`);
  console.log(`🐳 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
