# Project Tracker Deployment Guide

## Overview

Project Tracker supports two deployment methods:
1. **Local Development** - Run on your computer (recommended for personal use)
2. **AWS Serverless** - Deploy to cloud (recommended for teams/production)

---

## 🏠 Local Development Deployment

### Requirements
- Any modern web browser
- Node.js 16+ (optional, for backend API)

### Quick Start (HTML Only)
```bash
# Clone the repository
git clone https://github.com/bshepp-projects/project-tracker.git
cd project-tracker

# Open in browser (uses fallback project data)
open project-tracker.html  # macOS
start project-tracker.html # Windows
xdg-open project-tracker.html # Linux
```

### With Backend API (Recommended)
```bash
# Clone the repository
git clone https://github.com/bshepp-projects/project-tracker.git
cd project-tracker

# Quick setup
./setup.sh

# Start backend server
cd server && npm start
# Server runs on http://localhost:3001

# Open frontend in browser
open project-tracker.html
```

### Manual Backend Setup
```bash
# Install dependencies
cd server
npm install

# Start server
npm start
# Server will run on http://localhost:3001

# In another terminal, open frontend
cd ..
open project-tracker.html
```

---

## ⚡ AWS Serverless Deployment

### Requirements
- AWS CLI configured with appropriate permissions
- AWS SAM CLI installed
- Node.js 16+

### Step 1: Deploy Backend Infrastructure
```bash
# Clone the repository
git clone https://github.com/bshepp-projects/project-tracker.git
cd project-tracker

# Deploy serverless backend
cd serverless
chmod +x deploy.sh
./deploy.sh dev

# Note the API Gateway URL from output
```

### Step 2: Configure Frontend
```bash
# Update frontend to use your API
node update-frontend.js https://your-api-gateway-url.execute-api.region.amazonaws.com/dev

# Verify configuration
grep "API_BASE_URL" project-tracker.html
```

### Step 3: Deploy Frontend (Optional)
You can serve the frontend files from:
- **AWS Amplify** (static hosting)
- **S3 + CloudFront** 
- **Any static hosting service**
- **Or run locally** pointing to cloud backend

```bash
# For AWS Amplify deployment
git add *.html
git commit -m "Configure for serverless backend"
git push origin main
# Then configure Amplify to deploy from your repo
```

### AWS Resources Created
The serverless deployment creates:
- **6 Lambda Functions**: project-scanner, claude-analyzer, config-manager, tag-manager, health-check, git-analyzer
- **3 DynamoDB Tables**: projects, configuration, tags
- **API Gateway**: REST API with CORS enabled
- **IAM Roles**: Appropriate permissions for Lambda functions

### Cost Estimation
- **Development**: ~$2.50-5/month
- **Production**: ~$5-8/month (depends on usage)
- **Free tier eligible** for first 12 months

---

## 🔄 Environment Management

### Local Development
- Modify `server/directories.json` for project scan paths
- Backend runs on `http://localhost:3001`
- All data stored locally

### AWS Production
- Environment variables managed via AWS Systems Manager
- DynamoDB for persistent data storage
- CloudWatch for logging and monitoring

---

## 🚀 Which Should I Choose?

### Choose Local Development if:
- Personal use only
- Don't need team collaboration
- Want zero cloud costs
- Prefer full data privacy

### Choose AWS Serverless if:
- Multiple team members need access
- Want automatic backups and persistence
- Need high availability
- Want to access from multiple devices
- Building for production use

---

## 🔧 Troubleshooting

### Local Issues
```bash
# Backend not starting
cd server && npm install
PORT=3002 npm start  # Try different port

# Frontend not connecting
# Check browser console for CORS errors
# Ensure backend is running on port 3001
```

### AWS Issues
```bash
# Deployment failures
sam logs -n YourFunctionName --stack-name project-tracker-serverless-dev

# Permission issues
aws sts get-caller-identity  # Verify AWS credentials

# API Gateway issues
curl https://your-api-url.com/dev/api/health
```

---

## 📊 Performance Comparison

| Aspect | Local | AWS Serverless |
|--------|-------|----------------|
| Setup Time | 2 minutes | 10-15 minutes |
| Monthly Cost | $0 | $2.50-8 |
| Scalability | Single user | Unlimited |
| Data Backup | Manual | Automatic |
| Team Access | No | Yes |
| Maintenance | None | Minimal |

---

For questions or issues, see the main [README.md](README.md) or open an issue.