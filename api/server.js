const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../dashboard')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'Schema Web Analyzer',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Basic analyze endpoint
app.post('/api/analyze', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        error: 'URL is required'
      });
    }

    // Basic response for now
    res.json({
      scan_id: 'test-' + Date.now(),
      timestamp: new Date().toISOString(),
      url: url,
      status: 'completed',
      results: {
        basic_info: {
          page_title: 'Test Page',
          schemas_found: 3,
          load_time: 1.2
        },
        seo_score: {
          overall: 75,
          schema_coverage: 60,
          consistency_score: 80,
          entity_completeness: 85
        },
        schemas: [
          {
            "@type": "WebPage",
            "@id": "schema:WebPage",
            "name": "Test Page"
          }
        ],
        recommendations: [
          {
            type: "Test Recommendation",
            priority: "medium",
            message: "This is a test recommendation",
            example: '{"@id": "schema:Organization"}'
          }
        ]
      }
    });

  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      error: 'Analysis failed',
      message: error.message
    });
  }
});

// Serve dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../dashboard/index.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Schema Web Analyzer running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔍 API Health: http://localhost:${PORT}/api/health`);
});

module.exports = app;
