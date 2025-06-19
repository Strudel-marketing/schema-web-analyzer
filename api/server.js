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

// Enhanced logging
function log(message, data = null) {
  console.log(`[${new Date().toISOString()}] ${message}`, data || '');
}

// Health check endpoint with more details
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'healthy',
    service: 'Schema Web Analyzer',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: {
      node_version: process.version,
      platform: process.platform,
      memory: process.memoryUsage(),
      puppeteer_available: false,
      chromium_path: process.env.PUPPETEER_EXECUTABLE_PATH || 'default'
    }
  };

  // Test Puppeteer availability
  try {
    const puppeteer = require('puppeteer');
    health.environment.puppeteer_available = true;
    health.environment.puppeteer_version = puppeteer.version || 'unknown';
  } catch (error) {
    health.environment.puppeteer_error = error.message;
  }

  log('Health check requested', health);
  res.status(200).json(health);
});

// Test endpoint to check specific URL without Puppeteer
app.post('/api/test-fetch', async (req, res) => {
  try {
    const { url } = req.body;
    log(`Testing simple fetch for: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SchemaAnalyzer/1.0)'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const schemaCount = (html.match(/application\/ld\+json/g) || []).length;

    log(`Fetch successful: ${html.length} bytes, ${schemaCount} potential schemas`);

    res.json({
      success: true,
      url: url,
      status: response.status,
      content_length: html.length,
      potential_schemas: schemaCount,
      headers: Object.fromEntries(response.headers.entries())
    });

  } catch (error) {
    log(`Fetch failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Simplified analysis with fallback methods
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

    log(`Starting analysis for: ${url}`);
    const scanId = `scan-${Date.now()}`;
    const startTime = Date.now();

    let analysisResult;

    // Try Puppeteer first, then fallback to simple fetch
    try {
      analysisResult = await analyzeWithPuppeteer(url);
      log('Analysis completed with Puppeteer');
    } catch (puppeteerError) {
      log(`Puppeteer failed: ${puppeteerError.message}, trying fallback`);
      
      try {
        analysisResult = await analyzeWithFetch(url);
        log('Analysis completed with fetch fallback');
      } catch (fetchError) {
        log(`Fetch fallback also failed: ${fetchError.message}`);
        throw new Error(`Both Puppeteer and fetch failed. Puppeteer: ${puppeteerError.message}, Fetch: ${fetchError.message}`);
      }
    }

    const scanTime = (Date.now() - startTime) / 1000;

    const result = {
      scan_id: scanId,
      timestamp: new Date().toISOString(),
      url: url,
      status: 'completed',
      method: analysisResult.method,
      results: {
        basic_info: {
          page_title: analysisResult.title,
          page_description: analysisResult.description,
          canonical_url: analysisResult.canonical,
          schemas_found: analysisResult.schemas.length,
          load_time: scanTime
        },
        seo_score: calculateSEOScore(analysisResult.schemas),
        schemas: analysisResult.schemas,
        recommendations: generateRecommendations(analysisResult.schemas, url),
        consistency_analysis: analyzeConsistency(analysisResult.schemas)
      }
    };

    log(`Analysis completed successfully: ${analysisResult.schemas.length} schemas found`);
    res.json(result);

  } catch (error) {
    log(`Analysis failed: ${error.message}`, error.stack);
    res.status(500).json({
      error: 'Analysis failed',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Puppeteer analysis function
async function analyzeWithPuppeteer(url) {
  const puppeteer = require('puppeteer');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-extensions'
    ]
  });

  const page = await browser.newPage();
  
  try {
    await page.setUserAgent('Mozilla/5.0 (compatible; SchemaAnalyzer/1.0)');
    
    const response = await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 20000
    });

    if (!response.ok()) {
      throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
    }

    const result = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      const schemas = [];
      
      scripts.forEach((script, index) => {
        try {
          const content = script.textContent.trim();
          if (content) {
            const data = JSON.parse(content);
            const schemaArray = Array.isArray(data) ? data : [data];
            
            schemaArray.forEach(schema => {
              if (schema && schema['@type']) {
                schemas.push(schema);
              }
            });
          }
        } catch (e) {
          console.warn(`Invalid JSON-LD in script ${index}:`, e.message);
        }
      });
      
      return {
        title: document.title || 'No title',
        description: document.querySelector('meta[name="description"]')?.content || '',
        canonical: document.querySelector('link[rel="canonical"]')?.href || window.location.href,
        schemas: schemas,
        method: 'puppeteer'
      };
    });

    await browser.close();
    return result;
    
  } catch (error) {
    await browser.close();
    throw error;
  }
}

// Fetch fallback analysis function
async function analyzeWithFetch(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SchemaAnalyzer/1.0)'
    }
  });

  if (!response.ok()) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  
  // Simple regex-based schema extraction
  const schemaRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis;
  const schemas = [];
  let match;

  while ((match = schemaRegex.exec(html)) !== null) {
    try {
      const content = match[1].trim();
      if (content) {
        const data = JSON.parse(content);
        const schemaArray = Array.isArray(data) ? data : [data];
        
        schemaArray.forEach(schema => {
          if (schema && schema['@type']) {
            schemas.push(schema);
          }
        });
      }
    } catch (e) {
      console.warn('Invalid JSON-LD found:', e.message);
    }
  }

  // Extract basic page info
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);

  return {
    title: titleMatch ? titleMatch[1].trim() : 'No title',
    description: descMatch ? descMatch[1].trim() : '',
    canonical: canonicalMatch ? canonicalMatch[1].trim() : url,
    schemas: schemas,
    method: 'fetch'
  };
}

// Analysis functions (same as before but with better error handling)
function calculateSEOScore(schemas) {
  if (!schemas || schemas.length === 0) {
    return {
      overall: 0,
      schema_coverage: 0,
      consistency_score: 0,
      entity_completeness: 0
    };
  }

  try {
    const importantTypes = ['Organization', 'WebSite', 'WebPage', 'BreadcrumbList'];
    const foundTypes = schemas.map(s => getSchemaType(s)).filter(Boolean);
    const foundImportant = importantTypes.filter(type => foundTypes.includes(type));
    const coverageScore = (foundImportant.length / importantTypes.length) * 40;

    const schemasWithId = schemas.filter(s => s['@id']).length;
    const idScore = schemas.length > 0 ? (schemasWithId / schemas.length) * 30 : 0;

    const uniqueTypes = new Set(foundTypes).size;
    const completenessScore = Math.min(30, uniqueTypes * 5);

    const overall = Math.round(coverageScore + idScore + completenessScore);

    return {
      overall,
      schema_coverage: Math.round(coverageScore),
      consistency_score: Math.round(idScore * (30/30) * 100), // Normalize to 100
      entity_completeness: Math.round(completenessScore)
    };
  } catch (error) {
    log(`SEO score calculation error: ${error.message}`);
    return { overall: 0, schema_coverage: 0, consistency_score: 0, entity_completeness: 0 };
  }
}

function generateRecommendations(schemas, url) {
  const recommendations = [];

  try {
    if (!schemas || schemas.length === 0) {
      recommendations.push({
        type: 'No Schemas Found',
        priority: 'high',
        message: 'No Schema.org markup was detected on this page. Add structured data to improve SEO.',
        example: '{"@type": "WebPage", "@id": "schema:WebPage", "name": "Page Title"}'
      });
      return recommendations;
    }

    // Check for missing @id properties
    const schemasWithoutId = schemas.filter(schema => !schema['@id']);
    if (schemasWithoutId.length > 0) {
      recommendations.push({
        type: 'Missing @id Properties',
        priority: 'high',
        message: `${schemasWithoutId.length} schemas are missing @id properties.`,
        example: '{"@id": "schema:WebPageElement"}'
      });
    }

    // Check for missing important schemas
    const foundTypes = schemas.map(s => getSchemaType(s));
    
    if (!foundTypes.includes('WebPage')) {
      recommendations.push({
        type: 'Missing WebPage Schema',
        priority: 'high',
        message: 'Add WebPage schema to improve page indexing.',
        example: `{"@type": "WebPage", "@id": "schema:WebPage", "name": "Page Title", "url": "${url}"}`
      });
    }

    return recommendations;
  } catch (error) {
    log(`Recommendations generation error: ${error.message}`);
    return [{
      type: 'Analysis Error',
      priority: 'high',
      message: `Error generating recommendations: ${error.message}`,
      example: ''
    }];
  }
}

function analyzeConsistency(schemas) {
  try {
    const idGroups = {};
    const issues = [];

    schemas.forEach(schema => {
      const schemaId = schema['@id'];
      if (schemaId) {
        if (!idGroups[schemaId]) {
          idGroups[schemaId] = [];
        }
        idGroups[schemaId].push(schema);

        if (!schemaId.startsWith('schema:')) {
          issues.push(`Non-standard @id pattern: "${schemaId}"`);
        }
      }
    });

    const score = Math.max(0, 100 - (issues.length * 15));

    return {
      score,
      issues,
      idGroups
    };
  } catch (error) {
    log(`Consistency analysis error: ${error.message}`);
    return { score: 0, issues: [`Analysis error: ${error.message}`], idGroups: {} };
  }
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
  log(`🌐 Schema Web Analyzer running on port ${PORT}`);
  log(`📊 Dashboard: http://localhost:${PORT}`);
  log(`🔍 API Health: http://localhost:${PORT}/api/health`);
});

module.exports = app;
