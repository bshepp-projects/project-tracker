# Serverless AWS Deployment Guide

## 🚀 Architecture Overview

**New Serverless Architecture:**
```
Frontend (Amplify) → API Gateway → Lambda Functions → DynamoDB
                                           ↓
                              [6 Specialized Functions]
```

**vs. Previous Container Architecture:**
```
Frontend → Docker Container (Node.js + Express) [193MB, Always Running]
```

## 💰 Cost Comparison

| Component | Container | Serverless | Savings |
|-----------|-----------|------------|---------|
| **Compute** | ECS Fargate: $20-50/month | Lambda: $1-3/month | 85-95% |
| **Storage** | EBS: $5-10/month | DynamoDB: $1-3/month | 70-80% |
| **API** | ALB: $15/month | API Gateway: $0.50-2/month | 90-95% |
| **Total** | **$40-75/month** | **$2.50-8/month** | **🎉 90%+ savings** |

## 🏗️ Lambda Functions

### 1. **project-scanner** (Heavy lifting)
- **Path**: `/api/projects`, `/api/projects/cached`
- **Memory**: 1024MB, **Timeout**: 60s
- **Function**: Full project filesystem scanning and analysis

### 2. **claude-analyzer** (Specialized)
- **Path**: `/api/claude/projects`  
- **Memory**: 512MB, **Timeout**: 30s
- **Function**: Filter projects with CLAUDE.md files

### 3. **config-manager** (CRUD)
- **Path**: `/api/config`, `/api/directories/*`
- **Memory**: 256MB, **Timeout**: 15s
- **Function**: Directory configuration management

### 4. **tag-manager** (Tag operations)
- **Path**: `/api/tags/*`, `/api/projects/*/tags`
- **Memory**: 256MB, **Timeout**: 15s  
- **Function**: Tag CRUD with project relationships

### 5. **health-check** (Simple)
- **Path**: `/api/health`
- **Memory**: 128MB, **Timeout**: 5s
- **Function**: System health status

### 6. **git-analyzer** (Future)
- **Path**: `/api/git/repos`
- **Memory**: 512MB, **Timeout**: 45s
- **Function**: Git repository analysis (to be implemented)

## 📊 DynamoDB Tables

### `project-tracker-projects-{env}`
```json
{
  "projectPath": "string",     // Partition key
  "name": "string",
  "technologies": "string",
  "tags": ["array"],
  "lastModified": "string",
  "ttl": "number"             // 24-hour cache expiration
}
```

### `project-tracker-config-{env}`  
```json
{
  "configKey": "string",      // Partition key  
  "directories": ["array"],
  "lastUpdated": "string"
}
```

### `project-tracker-tags-{env}`
```json
{
  "tagName": "string",        // Partition key
  "projectPath": "string",    // Sort key
  "createdAt": "string"
}
```

## 🚀 Deployment Steps

### Prerequisites
```bash
# Install AWS SAM CLI
pip install aws-sam-cli

# Configure AWS credentials  
aws configure

# Verify access
aws sts get-caller-identity
```

### 1. Deploy Backend (Serverless)
```bash
cd serverless

# Deploy to development
./deploy.sh dev

# Deploy to production  
./deploy.sh prod
```

### 2. Update Frontend Configuration
```bash
# After deployment, get API Gateway URL from output
API_URL="https://abc123.execute-api.us-east-1.amazonaws.com/dev"

# Update frontend files
node update-frontend.js $API_URL
```

### 3. Deploy Frontend (Amplify)
```bash
# Commit updated frontend
git add *.html
git commit -m "feat: Update frontend for serverless API"
git push origin aws-deployment

# In AWS Amplify Console:
# 1. Connect to aws-deployment branch
# 2. Deploy frontend (static files only)
# 3. Configure custom domain
```

## 🧪 Testing Your Deployment

### API Endpoints Testing
```bash
# Get API URL from deployment
API_URL=$(cd serverless && jq -r '.apiUrl' deployment-config.json)

# Test health check
curl "$API_URL/api/health"

# Test cached projects (fast)
curl "$API_URL/api/projects/cached"

# Test full project scan
curl "$API_URL/api/projects"

# Test config
curl "$API_URL/api/config"

# Test Claude projects
curl "$API_URL/api/claude/projects"
```

### Load Testing
```bash
# Install artillery for load testing
npm install -g artillery

# Test with 50 concurrent users for 2 minutes
artillery quick --count 50 --num 120 "$API_URL/api/projects/cached"
```

## 📈 Performance Benefits

### Response Times
- **Container**: 200-500ms (cold start penalty)
- **Lambda Cached**: 50-100ms (DynamoDB read)  
- **Lambda Fresh**: 2-5s (filesystem scan)

### Scalability  
- **Container**: Fixed capacity, manual scaling
- **Lambda**: Auto-scales 0→1000+ concurrent executions

### Cold Start Mitigation
- **Provisioned Concurrency**: Keep functions warm (extra cost)
- **Cache-First Strategy**: Use `/api/projects/cached` for speed
- **Background Refresh**: Scheduled Lambda to refresh cache

## 🔧 Configuration Management

### Environment Variables
```bash
# Development
export ENVIRONMENT=dev
export PROJECTS_TABLE=project-tracker-projects-dev

# Production  
export ENVIRONMENT=prod
export PROJECTS_TABLE=project-tracker-projects-prod
```

### Directory Configuration
Update scan directories via API:
```bash
curl -X POST "$API_URL/api/directories" \
  -H "Content-Type: application/json" \
  -d '{"directory": "/new/project/path"}'
```

## 🚨 Troubleshooting

### Lambda Function Errors
```bash
# Check CloudWatch logs
aws logs tail /aws/lambda/project-tracker-scanner-dev --follow

# Get latest error
aws logs filter-log-events \
  --log-group-name /aws/lambda/project-tracker-scanner-dev \
  --filter-pattern "ERROR"
```

### DynamoDB Issues
```bash
# Check table status
aws dynamodb describe-table --table-name project-tracker-projects-dev

# Query recent items
aws dynamodb scan --table-name project-tracker-projects-dev --limit 5
```

### API Gateway Problems
```bash
# Test specific endpoint
aws apigateway test-invoke-method \
  --rest-api-id abc123 \
  --resource-id def456 \
  --http-method GET
```

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow
- **Trigger**: Push to `aws-deployment` branch
- **Steps**: Validate → Build → Deploy → Test
- **Environments**: Development (auto), Production (manual)

### Rollback Strategy
```bash
# List previous deployments
aws cloudformation describe-stack-events \
  --stack-name project-tracker-serverless-dev

# Rollback to previous version
aws cloudformation cancel-update-stack \
  --stack-name project-tracker-serverless-dev
```

## 🔐 Security Considerations

### IAM Permissions
- **Lambda Functions**: Minimal DynamoDB read/write permissions
- **API Gateway**: CORS configured for frontend domains
- **DynamoDB**: Encryption at rest enabled

### Network Security
- **VPC**: Not required for DynamoDB access
- **HTTPS**: API Gateway enforces HTTPS only
- **Rate Limiting**: API Gateway throttling enabled

## 📊 Monitoring & Observability

### CloudWatch Metrics
- **Lambda**: Invocations, duration, errors, throttles
- **DynamoDB**: Read/write capacity, throttled requests  
- **API Gateway**: Request count, latency, 4xx/5xx errors

### Alerts Setup
```bash
# High error rate alert
aws cloudwatch put-metric-alarm \
  --alarm-name "ProjectTracker-HighErrorRate" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold
```

## 🎯 Migration Benefits Summary

✅ **90%+ cost reduction** ($40-75/month → $2.50-8/month)  
✅ **Zero server management** - fully managed services  
✅ **Automatic scaling** - handles traffic spikes gracefully  
✅ **Improved reliability** - multi-AZ redundancy built-in  
✅ **Better performance** - cached responses <100ms  
✅ **Enhanced security** - AWS managed infrastructure  

## 🚀 Future Enhancements

1. **Scheduled Cache Refresh**: CloudWatch Events → Lambda
2. **Advanced Monitoring**: X-Ray tracing, custom metrics
3. **Multi-Region**: Global API with Route 53 health checks  
4. **GraphQL API**: AppSync for more flexible queries
5. **Real-time Updates**: WebSocket API for live project updates

---

*Ready to go serverless! 🎉*