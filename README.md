# 🌐 Schema Web Analyzer

Advanced Schema markup analyzer with entity relationships and consistency checking. Built from the ground up to provide comprehensive SEO insights and schema optimization recommendations.

## ✨ Features

### 🔍 **Advanced Schema Analysis**
- **Single URL Analysis** - Deep scan of individual pages
- **Site-wide Scanning** - Comprehensive multi-page analysis
- **Entity Relationship Mapping** - Visual connections between schema entities
- **@id Consistency Checking** - Cross-page consistency validation
- **SEO Score Calculation** - Overall schema quality assessment

### 📊 **Visual Analytics**
- **Interactive Entity Graph** - D3.js-powered relationship visualization
- **Consistency Scoring** - Real-time quality metrics
- **Issue Prioritization** - High/Medium/Low priority recommendations
- **Export Capabilities** - JSON export for further analysis

### 🚀 **Performance & Reliability**
- **Concurrent Processing** - Multi-threaded page scanning
- **Rate Limiting** - Respectful crawling with configurable delays
- **Error Recovery** - Robust handling of failed requests
- **Caching System** - Optimized performance for repeated scans

## 🏗️ Architecture

```
schema-web-analyzer/
├── 📁 api/                     # Backend API
│   ├── 📄 server.js           # Express server
│   ├── 📄 config.js           # Configuration
│   ├── 📁 services/           # Core services
│   │   ├── 📄 crawler.js      # Web crawling engine
│   │   ├── 📄 schemaAnalyzer.js # Schema analysis
│   │   ├── 📄 entityMapper.js # Entity relationships
│   │   └── 📄 consistencyAnalyzer.js # @id consistency
│   ├── 📁 routes/             # API endpoints
│   └── 📁 utils/              # Helper functions
├── 📁 dashboard/               # Frontend Dashboard
│   ├── 📄 index.html          # Main interface
│   ├── 📄 app.js              # Application logic
│   ├── 📄 api-client.js       # API communication
│   ├── 📄 components.js       # UI components
│   └── 📄 visualizations.js   # D3.js graphs
├── 📁 data/                    # Data storage
│   ├── 📁 scans/              # Analysis results
│   ├── 📁 templates/          # Schema templates
│   └── 📁 cache/              # Cached data
└── 📁 chrome-extension-source/ # Original extension code
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm 8+
- Chrome/Chromium (for Puppeteer)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd schema-web-analyzer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start the server**
   ```bash
   npm start
   ```

5. **Open the dashboard**
   ```
   http://localhost:3000
   ```

## 📖 API Documentation

### Single URL Analysis
```bash
POST /api/analyze
Content-Type: application/json

{
  "url": "https://example.com/page",
  "options": {
    "deep_scan": true,
    "include_recommendations": true,
    "check_consistency": true,
    "analyze_entities": true
  }
}
```

### Site-wide Scan
```bash
POST /api/scan-site
Content-Type: application/json

{
  "start_url": "https://example.com",
  "options": {
    "max_pages": 50,
    "include_sitemaps": true,
    "crawl_depth": 3,
    "follow_external": false
  }
}
```

### Quick Health Check
```bash
GET /api/health-check?url=https://example.com
```

### Get Results
```bash
GET /api/results/{scan_id}
```

### Entity Graph
```bash
GET /api/entity-graph/{scan_id}
```

## 🎯 Key Features Explained

### 🕸️ **Entity Relationship Analysis**
The analyzer automatically detects and maps relationships between schema entities:

- **Connected Entities** - Schemas that reference each other via @id
- **Orphaned Entities** - Isolated schemas without connections
- **Broken References** - @id references pointing to non-existent entities
- **Consistency Patterns** - Usage of standardized @id formats

### 📐 **@id Consistency Scoring**
Advanced scoring system based on:

- **Coverage (40%)** - Percentage of schemas with @id properties
- **Pattern Compliance (30%)** - Usage of "schema:EntityType" format
- **Cross-page Reuse (30%)** - @id values used across multiple pages
- **Penalty System** - Deductions for inconsistent type usage

### 🎨 **Visual Entity Graph**
Interactive D3.js visualization showing:

- **Nodes** - Individual schema entities (color-coded by type)
- **Edges** - Relationships between entities
- **Clusters** - Groups of related entities
- **Filtering** - By entity type, connection status, etc.

### 💡 **Smart Recommendations**
AI-powered suggestions including:

- **Missing Schemas** - Recommended additions based on page type
- **@id Improvements** - Standardization suggestions
- **Relationship Fixes** - Broken reference repairs
- **SEO Optimizations** - Content and structure improvements

## ⚙️ Configuration

### Environment Variables

```bash
# Server Configuration
NODE_ENV=development
HOST=localhost
PORT=3000

# Crawling Settings
MAX_PAGES_PER_SCAN=100
MAX_CONCURRENT_PAGES=5
CRAWL_DELAY=1000

# Security
BLOCKED_DOMAINS=localhost,127.0.0.1
RATE_LIMIT_POINTS=100

# Features
ENABLE_ENTITY_ANALYSIS=true
ENABLE_SITE_MAPPING=true
ENABLE_CACHING=true
```

### Puppeteer Settings

```bash
PUPPETEER_HEADLESS=true
PUPPETEER_TIMEOUT=30000
VIEWPORT_WIDTH=1920
VIEWPORT_HEIGHT=1080
```

## 🔧 Development

### Running in Development Mode
```bash
npm run dev
```

### Running Tests
```bash
npm test
npm run test:watch
```

### Building for Production
```bash
npm run build
npm run start:prod
```

## 📊 Usage Examples

### Analyze a Single Page
```javascript
const response = await fetch('/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://example.com/product',
    options: {
      deep_scan: true,
      analyze_entities: true,
      check_consistency: true
    }
  })
});

const result = await response.json();
console.log('SEO Score:', result.results.seo_score.overall);
console.log('Entities Found:', result.results.entities.totalEntities);
```

### Monitor Site Scan Progress
```javascript
// Start scan
const scanResponse = await fetch('/api/scan-site', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    start_url: 'https://example.com',
    options: { max_pages: 25 }
  })
});

const { scan_id } = await scanResponse.json();

// Monitor progress
const checkProgress = async () => {
  const progress = await fetch(`/api/progress/${scan_id}`);
  const data = await progress.json();
  
  console.log(`Progress: ${data.progress.progress}%`);
  
  if (data.status === 'completed') {
    const results = await fetch(`/api/results/${scan_id}`);
    const finalData = await results.json();
    console.log('Analysis complete:', finalData);
  } else {
    setTimeout(checkProgress, 2000);
  }
};

checkProgress();
```

## 🎨 Dashboard Features

### Main Interface
- **URL Input** - Single URL analysis with options
- **Quick Check** - Fast schema validation
- **Deep Analysis** - Comprehensive examination
- **Site Scan** - Multi-page analysis

### Results Display
- **Statistics Cards** - SEO score, entities, issues, consistency
- **Recommendations Panel** - Prioritized improvement suggestions
- **Entity Graph** - Interactive relationship visualization
- **Schema Details** - Expandable schema inspection

### Filtering & Controls
- **Priority Filters** - High/Medium/Low issue filtering
- **Entity Type Filters** - Organization/Person/Product filtering
- **Schema Type Filters** - Filter by schema @type
- **Export Options** - JSON export of results

## 🔍 Advanced Features

### Custom Schema Templates
Create custom schema templates in `data/templates/`:

```json
{
  "@type": "Product",
  "@id": "schema:Product",
  "name": "{{ PRODUCT_NAME }}",
  "description": "{{ PRODUCT_DESCRIPTION }}",
  "brand": {
    "@type": "Brand",
    "@id": "schema:Brand",
    "name": "{{ BRAND_NAME }}"
  },
  "offers": {
    "@type": "Offer",
    "@id": "schema:Offer",
    "price": "{{ PRICE }}",
    "priceCurrency": "{{ CURRENCY }}"
  }
}
```

### Custom Analysis Rules
Extend the analyzer with custom rules:

```javascript
// api/services/customAnalyzer.js
class CustomAnalyzer extends SchemaAnalyzer {
  generateCustomRecommendations(schemas, pageInfo) {
    const recommendations = [];
    
    // Custom rule: Check for missing Product images
    const products = schemas.filter(s => s['@type'] === 'Product');
    const productsWithoutImages = products.filter(p => !p.image);
    
    if (productsWithoutImages.length > 0) {
      recommendations.push({
        type: 'Missing Product Images',
        level: 'high',
        message: `${productsWithoutImages.length} products are missing image properties`,
        example: '"image": "https://example.com/product-image.jpg"'
      });
    }
    
    return recommendations;
  }
}
```

## 📈 Performance Optimization

### Caching Strategy
- **Page Content Caching** - Avoid re-fetching unchanged pages
- **Analysis Result Caching** - Cache computed analysis results
- **Template Caching** - Pre-load schema templates

### Concurrency Control
```javascript
// Configure concurrent processing
const options = {
  max_concurrent_pages: 3,  // Process 3 pages simultaneously
  crawl_delay: 1500,        // 1.5 second delay between requests
  request_timeout: 10000    // 10 second timeout per request
};
```

### Memory Management
- **Automatic Cleanup** - Old scan results removed after 30 days
- **Cache Size Limits** - Configurable cache size limits
- **Browser Pool Management** - Efficient Puppeteer instance reuse

## 🛠️ Troubleshooting

### Common Issues

**1. Puppeteer fails to launch**
```bash
# Install required dependencies (Ubuntu/Debian)
sudo apt-get install -y chromium-browser

# Or use bundled Chromium
npm install puppeteer
```

**2. Memory usage too high**
```bash
# Reduce concurrent pages
MAX_CONCURRENT_PAGES=2

# Enable memory monitoring
ENABLE_METRICS=true
```

**3. Analysis timeouts**
```bash
# Increase timeouts
PUPPETEER_TIMEOUT=60000
REQUEST_TIMEOUT=30000
```

### Debug Mode
```bash
# Enable debug logging
LOG_LEVEL=debug
NODE_ENV=development

# Show browser window
PUPPETEER_HEADLESS=false
```

## 🔐 Security Considerations

### Domain Restrictions
```javascript
// Block internal networks
BLOCKED_DOMAINS=localhost,127.0.0.1,0.0.0.0,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16

// Allow only specific domains (optional)
ALLOWED_DOMAINS=example.com,trusted-site.org
```

### Rate Limiting
```javascript
// API rate limiting
RATE_LIMIT_POINTS=100    // 100 requests
RATE_LIMIT_DURATION=60   // per 60 seconds

// Crawling rate limiting
CRAWL_DELAY=1000         // 1 second between pages
```

### Input Validation
All inputs are validated using Joi schemas:
- URL format validation
- Parameter range checking
- Content-type verification
- XSS prevention

## 📝 API Response Examples

### Single URL Analysis Response
```json
{
  "scan_id": "uuid-v4",
  "timestamp": "2024-01-15T10:30:00Z",
  "url": "https://example.com/page",
  "status": "completed",
  "results": {
    "basic_info": {
      "page_title": "Example Page",
      "schemas_found": 5,
      "load_time": 2.3
    },
    "seo_score": {
      "overall": 85,
      "breakdown": {
        "schemaQuality": 78,
        "consistency": 92,
        "completeness": 67,
        "entityConnectivity": 45
      }
    },
    "schemas": [
      {
        "type": "Organization",
        "rank": 5,
        "schema": { "@type": "Organization", "@id": "schema:Organization" }
      }
    ],
    "entities": {
      "totalEntities": 5,
      "entityTypes": ["Organization", "Person", "WebPage"],
      "relationships": [],
      "orphanedEntities": [],
      "brokenReferences": []
    },
    "recommendations": [
      {
        "type": "Missing @id",
        "level": "high",
        "message": "Add @id properties to improve entity consistency",
        "example": "\"@id\": \"schema:Organization\""
      }
    ]
  }
}
```

### Site Scan Response
```json
{
  "scan_id": "uuid-v4",
  "timestamp": "2024-01-15T10:30:00Z",
  "baseUrl": "https://example.com",
  "type": "site_scan",
  "status": "completed",
  "totalPages": 23,
  "totalSchemas": 145,
  "summary": {
    "schemaDistribution": [
      { "type": "WebPage", "count": 23 },
      { "type": "Organization", "count": 1 },
      { "type": "BreadcrumbList", "count": 20 }
    ],
    "coverage": {
      "pagesWithSchemas": 20,
      "pagesWithoutSchemas": 3,
      "coveragePercentage": 87
    }
  },
  "site_analysis": {
    "cross_page_consistency": {
      "bestPracticeScore": 78,
      "recommendations": []
    },
    "entity_ecosystem": {
      "totalEntities": 45,
      "relationships": [],
      "connectivityScore": 65
    }
  }
}
```

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make changes and test thoroughly
4. Commit changes: `git commit -m 'Add amazing feature'`
5. Push to branch: `git push origin feature/amazing-feature`
6. Create a Pull Request

### Code Style
- Use ESLint configuration provided
- Follow JSDoc commenting standards
- Write tests for new features
- Maintain backwards compatibility

### Testing
```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --grep "SchemaAnalyzer"

# Run with coverage
npm run test:coverage
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

This project builds upon the advanced schema analysis capabilities originally developed in a Chrome extension. Key components have been adapted and enhanced for web-based deployment:

- **Schema Engine** - Core analysis logic from `schema-engine.js`
- **Site Mapper** - Multi-page crawling from `site-schema-mapper.js`
- **Consistency Analyzer** - @id pattern analysis from `results.js`
- **UI Components** - Interface patterns from `ui-controller.js`

## 📞 Support

- **Documentation**: Check the `/docs` folder for detailed guides
- **API Reference**: Visit `/api/docs` when server is running
- **Issues**: Report bugs via GitHub Issues
- **Discussions**: Join GitHub Discussions for questions

---

**Made with ❤️ for better Schema markup and SEO optimization**
