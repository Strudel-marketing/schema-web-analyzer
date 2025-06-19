const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../dashboard')));

// Schema ranking system (from original extension)
const SCHEMA_RANKS = {
  "Organization": 5,
  "Person": 4,
  "WebSite": 3,
  "WebPage": 2,
  "Article": 4,
  "Product": 5,
  "LocalBusiness": 5,
  "Event": 4,
  "Recipe": 3,
  "Review": 3,
  "FAQPage": 4,
  "HowTo": 4,
  "JobPosting": 3,
  "Course": 3,
  "CreativeWork": 2,
  "BreadcrumbList": 1,
  "ItemList": 1
};

// Browser instance for reuse
let browser = null;

async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
  }
  return browser;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'Schema Web Analyzer',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    features: {
      puppeteer: true,
      analysis: true,
      recommendations: true
    }
  });
});

// Real schema analysis endpoint
app.post('/api/analyze', async (req, res) => {
  try {
    const { url } = req.body;
    
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

    console.log(`🔍 Analyzing: ${url}`);
    
    const startTime = Date.now();
    const scanId = uuidv4();
    
    // Get browser and create page
    const browserInstance = await getBrowser();
    const page = await browserInstance.newPage();
    
    try {
      await page.setUserAgent('Mozilla/5.0 (compatible; SchemaAnalyzer/1.0)');
      
      const response = await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      if (!response.ok()) {
        throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
      }

      // Extract page data
      const pageData = await page.evaluate(() => {
        // Extract schemas
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        const schemas = [];
        
        scripts.forEach((script, index) => {
          try {
            const data = JSON.parse(script.textContent);
            const schemaArray = Array.isArray(data) ? data : [data];
            
            schemaArray.forEach(schema => {
              if (schema && schema['@type']) {
                schemas.push(schema);
              }
            });
          } catch (e) {
            console.warn(`Invalid JSON-LD in script ${index}`);
          }
        });
        
        return {
          title: document.title,
          description: document.querySelector('meta[name="description"]')?.content || '',
          canonical: document.querySelector('link[rel="canonical"]')?.href || window.location.href,
          schemas: schemas
        };
      });

      await page.close();

      // Analyze schemas
      const analysis = analyzeSchemas(pageData.schemas, url);
      
      const scanTime = (Date.now() - startTime) / 1000;

      const result = {
        scan_id: scanId,
        timestamp: new Date().toISOString(),
        url: url,
        status: 'completed',
        results: {
          basic_info: {
            page_title: pageData.title,
            page_description: pageData.description,
            canonical_url: pageData.canonical,
            schemas_found: pageData.schemas.length,
            load_time: scanTime
          },
          seo_score: analysis.seoScore,
          schemas: pageData.schemas,
          recommendations: analysis.recommendations,
          consistency_analysis: analysis.consistency
        }
      };

      console.log(`✅ Analysis completed: ${pageData.schemas.length} schemas found`);
      res.json(result);

    } finally {
      if (page && !page.isClosed()) {
        await page.close();
      }
    }

  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      error: 'Analysis failed',
      message: error.message
    });
  }
});

// Schema analysis function (based on original extension logic)
function analyzeSchemas(schemas, url) {
  const analysis = {
    seoScore: calculateSEOScore(schemas),
    recommendations: generateRecommendations(schemas, url),
    consistency: analyzeConsistency(schemas)
  };
  
  return analysis;
}

function calculateSEOScore(schemas) {
  if (!schemas || schemas.length === 0) {
    return {
      overall: 0,
      schema_coverage: 0,
      consistency_score: 0,
      entity_completeness: 0
    };
  }

  // Schema coverage (40 points)
  const importantTypes = ['Organization', 'WebSite', 'WebPage', 'BreadcrumbList'];
  const foundTypes = schemas.map(s => getSchemaType(s)).filter(Boolean);
  const foundImportant = importantTypes.filter(type => foundTypes.includes(type));
  const coverageScore = (foundImportant.length / importantTypes.length) * 40;

  // ID consistency (30 points)
  const schemasWithId = schemas.filter(s => s['@id']).length;
  const idScore = schemas.length > 0 ? (schemasWithId / schemas.length) * 30 : 0;

  // Entity completeness (30 points)
  const uniqueTypes = new Set(foundTypes).size;
  const completenessScore = Math.min(30, uniqueTypes * 5);

  const overall = Math.round(coverageScore + idScore + completenessScore);

  return {
    overall,
    schema_coverage: Math.round(coverageScore),
    consistency_score: Math.round(idScore),
    entity_completeness: Math.round(completenessScore)
  };
}

function generateRecommendations(schemas, url) {
  const recommendations = [];

  // Check for missing @id properties
  const schemasWithoutId = schemas.filter(schema => !schema['@id']);
  if (schemasWithoutId.length > 0) {
    recommendations.push({
      type: 'Missing @id Properties',
      priority: 'high',
      message: `${schemasWithoutId.length} schemas are missing @id properties. Add consistent @id values using the pattern "schema:EntityType".`,
      example: '{"@id": "schema:WebPageElement"}',
      affectedSchemas: schemasWithoutId.length
    });
  }

  // Check for missing important schemas
  const foundTypes = schemas.map(s => getSchemaType(s));
  
  if (!foundTypes.includes('WebPage')) {
    recommendations.push({
      type: 'Missing WebPage Schema',
      priority: 'high',
      message: 'Add WebPage schema to improve page indexing and search appearance.',
      example: '{"@type": "WebPage", "@id": "schema:WebPage", "name": "Page Title", "url": "' + url + '"}',
      affectedSchemas: 0
    });
  }

  if (!foundTypes.includes('Organization')) {
    recommendations.push({
      type: 'Missing Organization Schema',
      priority: 'medium',
      message: 'Consider adding Organization schema for better brand recognition.',
      example: '{"@type": "Organization", "@id": "schema:Organization", "name": "Your Company", "url": "https://example.com"}',
      affectedSchemas: 0
    });
  }

  // Check @id consistency
  const idConsistency = analyzeIdConsistency(schemas);
  if (idConsistency.issues.length > 0) {
    recommendations.push({
      type: 'ID Consistency Issues',
      priority: 'medium',
      message: `Found ${idConsistency.issues.length} @id consistency issues. Use standard "schema:EntityType" pattern.`,
      example: '{"@id": "schema:Organization"}',
      affectedSchemas: idConsistency.issues.length
    });
  }

  return recommendations;
}

function analyzeConsistency(schemas) {
  return analyzeIdConsistency(schemas);
}

function analyzeIdConsistency(schemas) {
  const idGroups = new Map();
  const typeGroups = new Map();
  const issues = [];

  schemas.forEach(schema => {
    const schemaId = schema['@id'];
    const schemaType = getSchemaType(schema);
    
    if (schemaId) {
      if (!idGroups.has(schemaId)) {
        idGroups.set(schemaId, []);
      }
      idGroups.get(schemaId).push(schema);
      
      if (schemaType) {
        if (!typeGroups.has(schemaType)) {
          typeGroups.set(schemaType, new Set());
        }
        typeGroups.get(schemaType).add(schemaId);
      }
    }
  });

  // Find inconsistent @type usage
  typeGroups.forEach((idSet, schemaType) => {
    if (idSet.size > 1) {
      issues.push(`${schemaType} schema uses ${idSet.size} different @id values`);
    }
  });

  // Check for non-standard patterns
  idGroups.forEach((instances, schemaId) => {
    if (!schemaId.startsWith('schema:')) {
      issues.push(`Non-standard @id pattern: "${schemaId}"`);
    }
  });

  const score = Math.max(0, 100 - (issues.length * 15));

  return {
    score,
    issues,
    idGroups: Object.fromEntries(idGroups),
    typeGroups: Object.fromEntries(Array.from(typeGroups.entries()).map(([k, v]) => [k, Array.from(v)]))
  };
}

function getSchemaType(schema) {
  if (!schema || !schema['@type']) return null;
  return Array.isArray(schema['@type']) ? schema['@type'][0] : schema['@type'];
}

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

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Schema Web Analyzer running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔍 API Health: http://localhost:${PORT}/api/health`);
});

module.exports = app;
