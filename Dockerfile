# Multi-stage build for AWS deployment
FROM node:18-alpine AS backend-builder

WORKDIR /app

# Copy package files
COPY server/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy backend source
COPY server/ ./

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Copy backend from builder
COPY --from=backend-builder /app ./

# Copy frontend files
COPY project-tracker.html ./public/
COPY claude-tracker.html ./public/
COPY git-tracker.html ./public/
COPY favicon*.* ./public/

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set proper permissions
RUN chown -R nodejs:nodejs /app

USER nodejs

# AWS Amplify uses PORT 8080
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); const options = { hostname: 'localhost', port: process.env.PORT || 8080, path: '/api/health', timeout: 2000 }; const req = http.request(options, (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }); req.on('error', () => process.exit(1)); req.end();"

# Environment-based startup
CMD ["npm", "start"]