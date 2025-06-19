const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

class SchemaCrawler {
  constructor() {
    this.browser = null;
    this.activeScanners = new Map();
  }

  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
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
    return this.browser;
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  // Quick analysis for health checks
  async quickAnalyze(url) {
    try {
      console.log(`🔍 Quick analyzing: ${url}`);
      
      const browser = await this.initBrowser();
      const page = await browser.newPage();
      
      await page.setUserAgent('Mozilla/5.0 (compatible; SchemaAnalyzer/1.0)');
      
      const response = await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 10000
      });

      if (!response.ok()) {
        throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
      }

      // Extract basic schema info
      const schemas = await page.evaluate(() => {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        const results = [];
        
        scripts.forEach((script, index) => {
          try {
            const data = JSON.parse(script.textContent);
            const schemaArray = Array.isArray(data) ? data : [data];
            
            schemaArray.forEach(schema => {
              if (schema && schema['@type']) {
                results.push({
                  type: Array.isArray(schema['@type']) ? schema['@type'][0] : schema['@type'],
                  hasId: !!schema['@id'],
                  id: schema['@id'] || null
                });
              }
            });
          } catch (e) {
            console.warn(`Invalid JSON-LD in script ${index}`);
          }
        });
        
        return results;
      });

      await page.close();

      // Quick analysis
      const schemaCount = schemas.length;
      const typesWithoutId = schemas.filter(s => !s.hasId).length;
      const inconsistentIds = this.checkIdConsistency(schemas);

      let status = 'healthy';
      let criticalIssues = 0;

      if (schemaCount === 0) {
        status = 'critical';
        criticalIssues = 1;
      } else if (typesWithoutId > schemaCount * 0.5 || inconsistentIds.length > 0) {
        status = 'warning';
        criticalIssues = inconsistentIds.length;
      }

      const seoScore = Math.max(0, 100 - (typesWithoutId * 10) - (inconsistentIds.length * 15));

      return {
        status,
        stats: {
          schema_count: schemaCount,
          critical_issues: criticalIssues,
          seo_score: seoScore
        },
        recommendations: this.generateQuickFixes(schemas, inconsistentIds)
      };

    } catch (error) {
      console.error('Quick analysis error:', error);
      return {
        status: 'critical',
        stats: {
          schema_count: 0,
          critical_issues: 1,
          seo_score: 0
        },
        recommendations: [`Error analyzing page: ${error.message}`]
      };
    }
  }

  checkIdConsistency(schemas) {
    const typeIdMap = new Map();
    const inconsistencies = [];

    schemas.forEach(schema => {
      if (schema.hasId) {
        const type = schema.type;
        if (!typeIdMap.has(type)) {
          typeIdMap.set(type, new Set());
        }
        typeIdMap.get(type).add(schema.id);
      }
    });

    typeIdMap.forEach((ids, type) => {
      if (ids.size > 1) {
        inconsistencies.push({
          type,
          ids: Array.from(ids),
          message: `${type} schema uses ${ids.size} different @id values`
        });
      }
    });

    return inconsistencies;
  }

  generateQuickFixes(schemas, inconsistencies) {
    const fixes = [];

    const schemasWithoutId = schemas.filter(s => !s.hasId);
    if (schemasWithoutId.length > 0) {
      fixes.push(`Add @id properties to ${schemasWithoutId.length} schemas`);
    }

    inconsistencies.forEach(issue => {
      fixes.push(`Standardize @id for ${issue.type} schemas`);
    });

    const nonStandardIds = schemas.filter(s => s.hasId && !s.id.startsWith('schema:')); 
    if (nonStandardIds.length > 0) {
      fixes.push(`Use "schema:" pattern for ${nonStandardIds.length} @id values`);
    }

    return fixes;
  }

  // Full page analysis
  async analyzePage(url, options = {}) {
    const scanId = uuidv4();
    
    try {
      console.log(`🔍 Full analysis starting for: ${url}`);
      
      const browser = await this.initBrowser();
      const page = await browser.newPage();
      
      await page.setUserAgent('Mozilla/5.0 (compatible; SchemaAnalyzer/1.0)');
      
      const startTime = Date.now();
      const response = await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      if (!response.ok()) {
        throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
      }

      // Extract comprehensive data
      const pageData = await page.evaluate(() => {
        return {
          title: document.title,
          description: document.querySelector('meta[name="description"]')?.content || '',
          canonical: document.querySelector('link[rel="canonical"]')?.href || window.location.href,
          h1: document.querySelector('h1')?.textContent || '',
          schemas: (() => {
            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
            const results = [];
            
            scripts.forEach((script, index) => {
              try {
                const data = JSON.parse(script.textContent);
                const schemaArray = Array.isArray(data) ? data : [data];
                
                schemaArray.forEach(schema => {
                  if (schema && typeof schema === 'object') {
                    results.push(schema);
                  }
                });
              } catch (e) {
                console.warn(`Invalid JSON-LD in script ${index}`);
              }
            });
            
            return results;
          })()
        };
      });

      await page.close();

      const analysisTime = (Date.now() - startTime) / 1000;

      const result = {
        scan_id: scanId,
        timestamp: new Date().toISOString(),
        url: url,
        type: 'single_page',
        status: 'completed',
        metadata: {
          user_agent: 'SchemaAnalyzer/1.0',
          scan_duration: analysisTime,
          options_used: options
        },
        results: {
          basic_info: {
            page_title: pageData.title,
            page_description: pageData.description,
            canonical_url: pageData.canonical,
            schemas_found: pageData.schemas.length,
            load_time: analysisTime
          },
          schemas: pageData.schemas,
          // These will be filled by analyzer.js
          seo_score: null,
          entities: null,
          recommendations: null,
          consistency_analysis: null
        }
      };

      console.log(`✅ Page analysis completed: ${pageData.schemas.length} schemas found`);
      return result;

    } catch (error) {
      console.error('Page analysis error:', error);
      
      return {
        scan_id: scanId,
        timestamp: new Date().toISOString(),
        url: url,
        type: 'single_page',
        status: 'failed',
        error: error.message,
        results: null
      };
    }
  }

  // Start site-wide scanning
  async startSiteScan(startUrl, options = {}) {
    const scanId = uuidv4();
    
    // Start scanning in background
    this.performSiteScan(scanId, startUrl, options).catch(error => {
      console.error(`Site scan ${scanId} failed:`, error);
    });
    
    return scanId;
  }

  async performSiteScan(scanId, startUrl, options = {}) {
    const maxPages = options.max_pages || 25;
    const crawlDepth = options.crawl_depth || 3;
    
    console.log(`🗺️ Starting site scan ${scanId} for: ${startUrl}`);
    
    try {
      const browser = await this.initBrowser();
      const visitedUrls = new Set();
      const toVisit = [{ url: startUrl, depth: 0 }];
      const results = [];

      while (toVisit.length > 0 && results.length < maxPages) {
        const { url, depth } = toVisit.shift();
        
        if (visitedUrls.has(url) || depth > crawlDepth) {
          continue;
        }
        
        visitedUrls.add(url);
        
        try {
          const pageResult = await this.scanSinglePage(browser, url);
          results.push(pageResult);
          
          // Extract internal links if not at max depth
          if (depth < crawlDepth) {
            const links = await this.extractInternalLinks(browser, url, startUrl);
            links.forEach(link => {
              if (!visitedUrls.has(link)) {
                toVisit.push({ url: link, depth: depth + 1 });
              }
            });
          }
          
          console.log(`📄 Scanned: ${url} (${results.length}/${maxPages})`);
          
        } catch (error) {
          console.warn(`Failed to scan ${url}:`, error.message);
        }
      }

      console.log(`✅ Site scan completed: ${results.length} pages scanned`);
      
      // Store scan results would go here
      // This is a simplified version - full implementation would save to data/scans/
      
    } catch (error) {
      console.error(`Site scan ${scanId} failed:`, error);
    }
  }

  async scanSinglePage(browser, url) {
    const page = await browser.newPage();
    
    try {
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 10000 });
      
      const pageData = await page.evaluate(() => {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        const schemas = [];
        
        scripts.forEach((script) => {
          try {
            const data = JSON.parse(script.textContent);
            const schemaArray = Array.isArray(data) ? data : [data];
            schemas.push(...schemaArray);
          } catch (e) {
            // Skip invalid JSON
          }
        });
        
        return {
          title: document.title,
          schemas: schemas.filter(s => s && s['@type'])
        };
      });
      
      return {
        url,
        title: pageData.title,
        schemas: pageData.schemas,
        scanned_at: new Date().toISOString()
      };
      
    } finally {
      await page.close();
    }
  }

  async extractInternalLinks(browser, currentUrl, baseUrl) {
    const page = await browser.newPage();
    
    try {
      await page.goto(currentUrl, { waitUntil: 'networkidle0', timeout: 10000 });
      
      const links = await page.evaluate((baseUrl) => {
        const anchors = document.querySelectorAll('a[href]');
        const urls = new Set();
        
        anchors.forEach(anchor => {
          try {
            const href = anchor.getAttribute('href');
            const url = new URL(href, window.location.href);
            
            // Only include same-domain links
            if (url.origin === new URL(baseUrl).origin) {
              // Clean URL (remove fragments and query params)
              url.hash = '';
              url.search = '';
              
              // Skip common non-content URLs
              const path = url.pathname.toLowerCase();
              if (!path.match(/\.(pdf|jpg|jpeg|png|gif|css|js|xml|ico|zip)$/)) {
                urls.add(url.href);
              }
            }
          } catch (e) {
            // Skip invalid URLs
          }
        });
        
        return Array.from(urls);
      }, baseUrl);
      
      return links;
      
    } finally {
      await page.close();
    }
  }
}

// Create singleton instance
const crawler = new SchemaCrawler();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Closing browser...');
  await crawler.closeBrowser();
});

module.exports = {
  quickAnalyze: (url) => crawler.quickAnalyze(url),
  analyzePage: (url, options) => crawler.analyzePage(url, options),
  startSiteScan: (url, options) => crawler.startSiteScan(url, options)
};
