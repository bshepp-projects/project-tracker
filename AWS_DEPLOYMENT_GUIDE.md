# AWS Deployment Guide

## 🚀 Deploy Project Tracker to AWS

This guide covers deploying Project Tracker using **AWS Amplify + Route 53** with CI/CD from GitHub.

## 📋 Prerequisites

- AWS Account with appropriate permissions
- GitHub repository access
- Domain name (for Route 53 configuration)
- AWS CLI configured (optional, for advanced configuration)

## 🏗️ Architecture Overview

```
GitHub (aws-deployment branch) → AWS Amplify → Route 53 + CloudFront
                               ↓
                          Docker Container (Node.js + HTML)
```

## 📂 Branch Strategy

- **main**: Local development version
- **aws-deployment**: Production AWS deployment with cloud-specific configurations

## 🚀 Deployment Steps

### Step 1: Push Branch to GitHub

```bash
# Ensure you're on aws-deployment branch
git branch
# > * aws-deployment

# Push to GitHub
git push -u origin aws-deployment
```

### Step 2: Set Up AWS Amplify

1. **Log into AWS Console** → Navigate to **AWS Amplify**

2. **Create New App**:
   - Choose "Host web app"
   - Select "GitHub" as source
   - Authorize GitHub access
   - Select your `project-tracker` repository
   - Choose `aws-deployment` branch

3. **Build Settings**:
   - Amplify will auto-detect `amplify.yml`
   - Review build configuration (should match our `amplify.yml`)
   - **Environment Variables** (Add these):
     ```
     NODE_ENV=production
     PORT=8080
     HOST=0.0.0.0
     PROJECT_TRACKER_ENV=aws
     ```

4. **Deploy**:
   - Click "Save and Deploy"
   - Watch the build process complete
   - Note the generated URL: `https://aws-deployment.d1234abcd.amplifyapp.com`

### Step 3: Configure Custom Domain (Route 53)

#### Option A: Domain in Route 53
1. **AWS Amplify Console** → Your App → **Domain Management**
2. **Add Domain** → Enter your domain (e.g., `project-tracker.yourdomain.com`)
3. **DNS Configuration**: Amplify will provide CNAME records
4. **SSL Certificate**: Automatically provisioned via ACM

#### Option B: External Domain Provider
1. Get CNAME target from Amplify domain settings
2. Create CNAME record with your DNS provider:
   ```
   project-tracker  CNAME  d1234abcd.amplifyapp.com
   ```
3. SSL will be auto-provisioned once DNS propagates

### Step 4: Environment Configuration

**Update Frontend URLs** (if needed):
- Frontend currently uses `http://localhost:3001` for local development
- For AWS deployment, you might want to update the API base URL

**Backend Configuration**:
- Default directories will need to be updated for AWS filesystem
- Consider using environment-based directory configuration

## 🔧 Configuration Files

### `amplify.yml`
- Defines build process for Amplify
- Handles both backend (Node.js) and frontend (HTML files)
- Configures caching for `node_modules`

### `.env.aws`
- Environment variables for AWS production
- Update `CORS_ORIGINS` with your actual domain
- Contains AWS-specific configuration

### `Dockerfile`
- Multi-stage build for optimized container
- Includes health checks for AWS load balancer
- Serves both API and static files

### `.github/workflows/aws-deployment.yml`
- CI/CD pipeline specific to AWS deployment
- Validates build, tests Docker, checks security
- Runs on `aws-deployment` branch only

## 🧪 Testing Your Deployment

1. **Health Check**:
   ```bash
   curl https://your-domain.com/api/health
   ```

2. **Project API**:
   ```bash
   curl https://your-domain.com/api/projects
   ```

3. **Frontend Access**:
   - Navigate to `https://your-domain.com/project-tracker.html`
   - Test all three trackers (Project, Claude, Git)

## 🔄 CI/CD Workflow

1. **Push to `aws-deployment` branch** triggers GitHub Actions
2. **Automated tests** validate HTML, Docker build, security
3. **AWS Amplify** automatically detects branch changes
4. **Auto-deployment** updates your live site

## 🛠️ Customization for AWS

### Directory Scanning
AWS containers have different filesystem structure:
- Update `DEFAULT_SCAN_DIRECTORIES` in `server.js` for AWS paths
- Consider using environment variables for directory configuration

### CORS Configuration
Update CORS origins for your domain:
```javascript
// In server.js
app.use(cors({
  origin: ['https://your-domain.com', 'https://www.your-domain.com']
}));
```

### Static File Serving
For AWS deployment, you might want to serve HTML files from the backend:
```javascript
// Add to server.js
app.use(express.static('public'));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'project-tracker.html')));
```

## 💰 AWS Costs Estimation

**AWS Amplify**:
- Build minutes: $0.01 per minute
- Hosting: $0.15/GB per month + $0.023 per 10,000 requests
- Typical cost: $5-15/month for moderate usage

**Route 53**:
- Hosted zone: $0.50/month
- DNS queries: $0.40 per million queries
- Typical cost: $1-2/month

**Total estimated cost: $6-20/month** depending on traffic

## 🐛 Troubleshooting

### Build Failures
- Check Amplify build logs in AWS console
- Verify `package.json` and dependencies
- Ensure Docker builds locally first

### Domain Issues
- DNS propagation can take 24-48 hours
- Use `dig` or `nslookup` to verify DNS records
- Check SSL certificate status in Amplify console

### Backend API Issues
- Verify environment variables are set in Amplify
- Check CloudWatch logs for server errors
- Test health endpoint first

## 🔄 Updates & Maintenance

### Deploying Updates
1. Make changes on `aws-deployment` branch
2. Commit and push to GitHub
3. AWS Amplify auto-deploys on push
4. Monitor build status in Amplify console

### Rolling Back
1. AWS Amplify Console → Deployments
2. Select previous successful deployment
3. Click "Promote to main"

### Monitoring
- **Amplify Console**: Build status, deployment history
- **CloudWatch**: Application logs and metrics
- **Route 53**: DNS query metrics

## 📚 Additional Resources

- [AWS Amplify Documentation](https://docs.aws.amazon.com/amplify/)
- [Route 53 User Guide](https://docs.aws.amazon.com/route53/)
- [Docker Multi-stage Builds](https://docs.docker.com/develop/dev-best-practices/multistage-build/)

---

*Last updated: August 20, 2025*