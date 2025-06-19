# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Install system dependencies for Puppeteer and healthcheck
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    curl \
    git \
    && rm -rf /var/cache/apk/*

# Tell Puppeteer to skip installing Chromium. We'll be using the installed package.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Create app directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy package files first for better caching
COPY package*.json ./

# Debug: Check if package.json exists
RUN ls -la && cat package.json

# Install dependencies with better error handling
RUN npm install --production --no-audit --no-fund && \
    npm cache clean --force

# Copy application code
COPY --chown=nextjs:nodejs . .

# Create data directories with proper permissions
RUN mkdir -p data/scans data/templates data/cache && \
    chown -R nextjs:nodejs data/ && \
    chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Start the application
CMD ["npm", "start"]
