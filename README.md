# 🕸️ Schema Web Analyzer

Advanced Schema.org markup analysis tool with @id consistency checking and entity relationship mapping.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)

## ✨ Features

### 🔍 **Deep Schema Analysis**
- **JSON-LD Detection**: Automatically finds and parses all Schema.org markup
- **Schema Validation**: Checks for completeness and correctness
- **SEO Scoring**: Provides actionable SEO scores based on schema quality
- **Entity Recognition**: Identifies and categorizes different schema types

### 🔗 **@id Consistency Analysis** (Based on Chrome Extension)
- **Cross-Page Consistency**: Analyzes @id usage patterns across multiple pages
- **Pattern Recognition**: Detects non-standard @id formats
- **Relationship Mapping**: Maps connections between schema entities
- **Smart Recommendations**: Suggests improvements based on best practices

### 🗺️ **Site-Wide Mapping**
- **Multi-Page Scanning**: Crawls entire websites for comprehensive analysis
- **Sitemap Integration**: Automatically discovers pages via sitemaps
- **Link Following**: Discovers pages through internal link structure
- **Progress Tracking**: Real-time scan progress and statistics

### 📊 **Advanced Visualizations**
- **Entity Relationship Graphs**: Interactive D3.js visualizations
- **Consistency Heat Maps**: Visual representation of @id patterns
- **Issue Prioritization**: Color-coded recommendations by severity
- **Export Capabilities**: JSON and visual export options

## 🚀 Quick Start

### Prerequisites
- **Docker & Docker Compose** (recommended)
- **Node.js 18+** (for development)
- **Modern web browser** (Chrome, Firefox, Safari, Edge)

### 🐳 Docker Installation (Recommended)

```bash
# Clone the repository
git clone <your-repo-url>
cd schema-web-analyzer

# Make setup script executable
chmod +x setup.sh

# Run setup (creates directories, templates, and starts application)
./setup.sh
```

### 📱 Manual Installation

```bash
# Install dependencies
npm install

# Create data directories
mkdir -p data/scans data/templates data/cache

# Start the application
npm start
```

### 🎯 Quick Test

```bash
# Test the API
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"url":"https://schema.org"}'

# Open dashboard
open http://localhost:3000
```

## 📖 Usage Guide

### 🔍 Single Page Analysis

1. **Open the dashboard**: Navigate to `http://localhost:3000`
2. **Enter URL**: Input the page URL you want to analyze
3. **Configure options**:
   - ✅ **Deep Scan**: Comprehensive analysis (recommended)
   - ✅ **Entity Analysis**: Relationship mapping
   - ✅ **@id Consistency**: Consistency checking
   - ✅ **Recommendations**: Get actionable suggestions
4. **Click "Analyze"**: Wait for results

### 🗺️ Site-Wide Scanning

1. **Switch to "Full Site" tab**
2. **Enter website URL**: Base URL (e.g., `https://example.com`)
3. **Configure scan options**:
   - **Max Pages**: Limit scan scope (10-100 pages)
   - **Crawl Depth**: How deep to follow links (1-4 levels)
   - **Include Sitemaps**: Auto-discover via sitemap.xml
4. **Click "Scan Site"**: Monitor progress in real-time

### 📊 Understanding Results

#### **SEO Score Breakdown**
- **Schema Coverage** (40 points): Essential schema types present
- **ID Consistency** (30 points): @id pattern adherence
- **Entity Completeness** (30 points): Relationship richness

#### **Priority Levels**
- 🔴 **High**: Critical SEO impact (fix immediately)
- 🟡 **Medium**: Moderate impact (address soon)
- 🔵 **Low**: Minor improvements (nice to have)

#### **Entity Graph**
- **Green nodes**: Well-connected entities
- **Yellow nodes**: Some connectivity issues
- **Red nodes**: Broken or orphaned entities

## 🔧 API Reference

### `POST /api/analyze`
Single page analysis

```json
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

**Response:**
```json
{
  "scan_id": "uuid-v4",
  "timestamp": "2024-01-15T10:30:00Z",
  "url": "https://example.com/page",
  "status": "completed",
  "results": {
    "seo_score": {
      "overall": 85,
      "schema_coverage": 78,
      "consistency_score": 92,
      "entity_completeness": 67
    },
    "schemas": [...],
    "entities": {...},
    "recommendations": [...],
    "consistency_analysis": {...}
  }
}
```

### `POST /api/scan-site`
Site-wide analysis

```json
{
  "start_url": "https://example.com",
  "options": {
    "max_pages": 50,
    "include_sitemaps": true,
    "crawl_depth": 3
  }
}
```

### `GET /api/results/{scan_id}`
Get scan results

### `GET /api/entity-graph/{scan_id}`
Get entity relationship graph

### `GET /api/health`
API health check

## 🏗️ Architecture

### 📁 Project Structure
```
schema-web-analyzer/
├── api/                     # Backend API
│   ├── server.js           # Express server
│   ├── crawler.js          # Web crawling
│   ├── analyzer.js         # Schema analysis
│   └── ...
├── dashboard/              # Frontend
│   ├── index.html         # Main interface
│   ├── app.js             # Application logic
│   ├── api-client.js      # API communication
│   └── ...
├── data/                   # Data storage
│   ├── scans/             # Scan results
│   ├── templates/         # Schema templates
│   └── cache/             # Cached data
└── chrome-extension-source/ # Original code reference
```

### 🧠 Core Logic (Based on Chrome Extension)

The analyzer uses proven logic from the original Chrome extension:

#### **Schema Engine** (`schema-engine.js`)
- **Ranking System**: SEO-based schema importance scoring
- **Validation**: Schema completeness and correctness
- **Recommendations**: Context-aware suggestions

#### **Consistency Analyzer** (`results.js`)
- **@id Pattern Detection**: Identifies inconsistent patterns
- **Cross-Page Analysis**: Tracks @id usage across pages
- **Scoring Algorithm**: Calculates consistency scores

#### **Site Mapper** (`site-schema-mapper.js`)
- **URL Discovery**: Multiple discovery methods (links, sitemaps, robots.txt)
- **Smart Crawling**: Depth-limited with rate limiting
- **Entity Mapping**: Builds relationship graphs

## 🔧 Configuration

### Environment Variables
```bash
# Server configuration
PORT=3000
NODE_ENV=production

# Puppeteer configuration
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Analysis limits
MAX_PAGES_PER_SCAN=100
CRAWL_TIMEOUT=30000
```

### Docker Configuration
```yaml
# docker-compose.yml
services:
  schema-analyzer:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    volumes:
      - ./data:/app/data
```

## 🛠️ Development

### Local Development Setup
```bash
# Install dependencies
npm install

# Start development server with auto-reload
npm run dev

# Run tests
npm test

# Lint code
npm run lint
```

### Building for Production
```bash
# Build Docker image
npm run docker:build

# Run production container
npm run docker:run

# Or use Docker Compose
npm run docker:compose:prod
```

### Adding New Features

1. **Backend**: Add logic to `api/` modules
2. **Frontend**: Update dashboard components
3. **Analysis**: Extend schema engine capabilities
4. **Tests**: Add test coverage for new features

## 🐛 Troubleshooting

### Common Issues

#### **Docker Build Fails**
```bash
# Clear Docker cache
docker system prune -a

# Rebuild from scratch
docker-compose build --no-cache
```

#### **Puppeteer Errors**
```bash
# Install Chrome dependencies (Linux)
sudo apt-get install -y chromium-browser

# Set correct executable path
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

#### **Analysis Timeouts**
```bash
# Increase timeout in dashboard settings
# Or set environment variable
export ANALYSIS_TIMEOUT=60000
```

#### **Memory Issues**
```bash
# Increase Docker memory limit
docker-compose up --memory=2g

# Or adjust Node.js memory
node --max-old-space-size=4096 api/server.js
```

### Debug Mode

Enable debug logging:
```bash
# Environment variable
DEBUG=schema-analyzer:* npm start

# Or dashboard settings
Settings → Debug Mode ✅
```

### Health Checks

```bash
# API health
curl http://localhost:3000/api/health

# Quick analysis test
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"url":"https://schema.org"}'
```

## 📊 Performance

### Optimization Tips

1. **Limit Scan Scope**: Use reasonable max_pages settings
2. **Cache Results**: Results are automatically cached
3. **Batch Processing**: Site scans are processed efficiently
4. **Rate Limiting**: Built-in delays prevent overwhelming servers

### Benchmarks

- **Single Page**: 2-5 seconds average
- **Site Scan (25 pages)**: 30-60 seconds
- **Memory Usage**: ~200MB typical
- **Concurrent Users**: 10+ supported

## 🔒 Security

### Built-in Protections

- **Input Validation**: All URLs validated
- **Rate Limiting**: Prevents abuse
- **Sandboxing**: Puppeteer runs in sandbox
- **CORS Protection**: Configured for security
- **Helmet.js**: Security headers

### Best Practices

1. **Run in containers**: Isolate from host system
2. **Limit access**: Use firewalls and VPNs
3. **Regular updates**: Keep dependencies current
4. **Monitor usage**: Track API usage patterns

## 📈 Roadmap

### Version 1.1 (Next Release)
- [ ] **Real-time collaboration**: Multi-user analysis
- [ ] **Advanced filtering**: More granular result filtering
- [ ] **Export formats**: PDF and Excel export
- [ ] **API rate limiting**: Per-user limits

### Version 1.2 (Future)
- [ ] **AI recommendations**: ML-powered suggestions
- [ ] **Historical tracking**: Track changes over time
- [ ] **Integration APIs**: Webhook notifications
- [ ] **White-label options**: Custom branding

### Long-term Goals
- [ ] **Plugin system**: Extensible analysis modules
- [ ] **Cloud deployment**: SaaS version
- [ ] **Mobile app**: Native mobile interface
- [ ] **Enterprise features**: Team management

## 🤝 Contributing

### Development Guidelines

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/new-analysis`
3. **Follow code style**: ESLint configuration
4. **Add tests**: Maintain test coverage
5. **Update docs**: Keep documentation current
6. **Submit PR**: Detailed description required

### Code Style
```javascript
// Use modern JavaScript
const analyzer = new SchemaAnalyzer();

// Descriptive variable names
const consistencyScore = calculateConsistency(schemas);

// Error handling
try {
  const result = await analyzer.analyze(url);
} catch (error) {
  logger.error('Analysis failed:', error);
}
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

### Getting Help

1. **Documentation**: Check this README first
2. **Issues**: Create GitHub issue with details
3. **Discussions**: Use GitHub Discussions for questions
4. **Community**: Join our developer community

### Bug Reports

Include:
- **Environment**: OS, Node version, Docker version
- **Steps to reproduce**: Detailed reproduction steps
- **Expected vs actual**: What should vs did happen
- **Logs**: Relevant error messages
- **URLs**: Example URLs that demonstrate issue

### Feature Requests

Use the feature request template and include:
- **Use case**: Why is this needed?
- **Acceptance criteria**: What defines success?
- **Alternatives**: Other solutions considered?
- **Priority**: How important is this?

---

**Built with ❤️ by the Schema Analysis Team**

*Powered by proven Chrome Extension technology, now available as a standalone web application.*
