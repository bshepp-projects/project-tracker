# Serverless Architecture Design

## 🏗️ Current API Analysis

**12 API Endpoints Identified:**
- `/api/projects/cached` - Get cached projects (fast response)
- `/api/projects` - Full project scan and return
- `/api/claude/projects` - Get Claude-enabled projects only
- `/api/health` - Health check
- `/api/config` - Get configuration
- `/api/directories` - POST/DELETE/PUT directory management
- `/api/git/repos` - Git repository analysis
- `/api/tags` - GET/POST/DELETE tag management

## 🚀 Proposed Lambda Architecture

### **Lambda Functions:**

1. **`project-scanner`** (Heavy lifting)
   - Handles `/api/projects` and `/api/projects/cached`
   - File system scanning logic
   - Project analysis and categorization
   - **Runtime**: Node.js 18.x, 512MB memory, 30s timeout

2. **`claude-analyzer`** (Specialized)
   - Handles `/api/claude/projects`
   - CLAUDE.md detection and analysis
   - **Runtime**: Node.js 18.x, 256MB memory, 15s timeout

3. **`git-analyzer`** (Git operations)
   - Handles `/api/git/repos`
   - Git repository analysis
   - **Runtime**: Node.js 18.x, 512MB memory, 30s timeout

4. **`config-manager`** (CRUD operations)
   - Handles `/api/directories`, `/api/config`
   - DynamoDB read/write operations
   - **Runtime**: Node.js 18.x, 128MB memory, 10s timeout

5. **`tag-manager`** (Tag operations)
   - Handles `/api/tags` endpoints
   - Tag CRUD operations with DynamoDB
   - **Runtime**: Node.js 18.x, 128MB memory, 10s timeout

6. **`health-check`** (Simple status)
   - Handles `/api/health`
   - **Runtime**: Node.js 18.x, 128MB memory, 5s timeout

### **DynamoDB Tables:**

1. **`project-tracker-projects`**
   - Partition Key: `projectPath` (string)
   - Attributes: name, description, technologies, lastModified, etc.
   - TTL: 24 hours (for cache invalidation)

2. **`project-tracker-config`**
   - Partition Key: `configKey` (string)
   - Attributes: directories, settings, lastUpdated

3. **`project-tracker-tags`**
   - Partition Key: `tagName` (string)
   - Sort Key: `projectPath` (string)
   - For many-to-many tag relationships

### **API Gateway:**
- REST API with custom domain
- CORS enabled for frontend
- Lambda proxy integration
- Caching enabled on GET endpoints (5 minutes)

## 💰 Cost Benefits

**Current Container**: $20-50/month (always running)
**Serverless**: $2-8/month (pay per use)
- Lambda: ~$1-3/month (1M requests = $0.20)
- DynamoDB: ~$1-3/month (25GB free tier)
- API Gateway: ~$0.50-2/month (1M requests = $3.50)

## 🎯 Migration Strategy

1. Keep frontend files in Amplify (static hosting)
2. Replace backend API calls with API Gateway endpoints
3. Convert Express routes to Lambda handlers
4. Migrate data persistence to DynamoDB
5. Deploy with SAM/CDK for infrastructure as code