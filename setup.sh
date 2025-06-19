#!/bin/bash

# Schema Web Analyzer - Quick Setup Script
echo "🚀 Setting up Schema Web Analyzer..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create project directory structure
echo "📁 Creating directory structure..."
mkdir -p data/scans data/templates data/cache
mkdir -p dashboard/assets/icons
mkdir -p chrome-extension-source

# Create .gitkeep files for empty directories
touch data/scans/.gitkeep
touch data/cache/.gitkeep

# Create basic template files
echo "📄 Creating template files..."

# Organization template
cat > data/templates/organization.json << 'EOF'
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "schema:Organization",
  "name": "Your Organization Name",
  "url": "https://example.com",
  "logo": "https://example.com/logo.png",
  "description": "Description of your organization",
  "contactPoint": {
    "@type": "ContactPoint",
    "@id": "schema:ContactPoint",
    "telephone": "+1-234-567-8900",
    "contactType": "customer service"
  }
}
EOF

# Person template
cat > data/templates/person.json << 'EOF'
{
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": "schema:Person",
  "name": "Person Name",
  "jobTitle": "Job Title",
  "worksFor": {
    "@id": "schema:Organization"
  },
  "url": "https://example.com/about/person",
  "sameAs": [
    "https://linkedin.com/in/person",
    "https://twitter.com/person"
  ]
}
EOF

# Product template
cat > data/templates/product.json << 'EOF'
{
  "@context": "https://schema.org",
  "@type": "Product",
  "@id": "schema:Product",
  "name": "Product Name",
  "description": "Product description",
  "brand": {
    "@id": "schema:Organization"
  },
  "offers": {
    "@type": "Offer",
    "@id": "schema:Offer",
    "price": "99.99",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock"
  }
}
EOF

echo "✅ Template files created"

# Build and start the application
echo "🔨 Building Docker image..."
docker-compose build

echo "🚀 Starting application..."
docker-compose up -d

# Wait for the application to start
echo "⏳ Waiting for application to start..."
sleep 10

# Check if the application is running
if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ Schema Web Analyzer is running!"
    echo "📊 Dashboard: http://localhost:3000"
    echo "🔍 API Health: http://localhost:3000/api/health"
    echo ""
    echo "🎯 Quick test:"
    echo "curl -X POST http://localhost:3000/api/analyze -H 'Content-Type: application/json' -d '{\"url\":\"https://schema.org\"}'"
else
    echo "❌ Application failed to start. Check logs with:"
    echo "docker-compose logs"
fi

echo ""
echo "📖 For more information, see README.md"
echo "🐛 To stop: docker-compose down"
echo "🔄 To restart: docker-compose restart"
