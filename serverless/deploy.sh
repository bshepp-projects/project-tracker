#!/bin/bash

# AWS SAM Deployment Script for Project Tracker Serverless Architecture

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
STACK_NAME="project-tracker-serverless"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"
S3_BUCKET="project-tracker-sam-artifacts-$REGION"
ENVIRONMENT="${1:-dev}"  # dev or prod

echo -e "${BLUE}🚀 Project Tracker Serverless Deployment${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Region: ${REGION}${NC}"

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

if ! command -v sam &> /dev/null; then
    echo -e "${RED}❌ AWS SAM CLI not found. Please install it first.${NC}"
    echo "https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html"
    exit 1
fi

if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found. Please install it first.${NC}"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured. Please run 'aws configure'${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Create S3 bucket for SAM artifacts if it doesn't exist
echo -e "${YELLOW}📦 Preparing S3 bucket for artifacts...${NC}"
if ! aws s3 ls "s3://$S3_BUCKET" 2>&1 | grep -q 'NoSuchBucket'; then
    echo "S3 bucket $S3_BUCKET already exists"
else
    if [ "$REGION" = "us-east-1" ]; then
        aws s3 mb "s3://$S3_BUCKET"
    else
        aws s3 mb "s3://$S3_BUCKET" --region "$REGION"
    fi
    echo -e "${GREEN}✅ Created S3 bucket: $S3_BUCKET${NC}"
fi

# Build the SAM application
echo -e "${YELLOW}🏗️  Building SAM application...${NC}"
sam build --template-file template.yaml

# Deploy the application
echo -e "${YELLOW}🚀 Deploying to AWS...${NC}"
sam deploy \
    --stack-name "$STACK_NAME-$ENVIRONMENT" \
    --s3-bucket "$S3_BUCKET" \
    --region "$REGION" \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides \
        Environment="$ENVIRONMENT" \
    --tags \
        Application=ProjectTracker \
        Environment="$ENVIRONMENT" \
        ManagedBy=SAM

# Get outputs
echo -e "${YELLOW}📄 Getting stack outputs...${NC}"
API_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME-$ENVIRONMENT" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
    --output text)

PROJECTS_TABLE=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME-$ENVIRONMENT" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`ProjectsTableName`].OutputValue' \
    --output text)

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo
echo -e "${BLUE}📋 Stack Information:${NC}"
echo -e "Stack Name: $STACK_NAME-$ENVIRONMENT"
echo -e "Region: $REGION"
echo -e "API Gateway URL: ${GREEN}$API_URL${NC}"
echo -e "Projects Table: $PROJECTS_TABLE"
echo
echo -e "${BLUE}🧪 Test your API:${NC}"
echo -e "Health Check: ${YELLOW}curl $API_URL/api/health${NC}"
echo -e "Projects: ${YELLOW}curl $API_URL/api/projects/cached${NC}"
echo
echo -e "${BLUE}📚 Next Steps:${NC}"
echo "1. Test all API endpoints"
echo "2. Update frontend API base URL to: $API_URL"
echo "3. Deploy frontend to AWS Amplify"
echo "4. Configure custom domain if needed"

# Save configuration for future use
cat > deployment-config.json << EOF
{
  "environment": "$ENVIRONMENT",
  "region": "$REGION",
  "stackName": "$STACK_NAME-$ENVIRONMENT",
  "apiUrl": "$API_URL",
  "projectsTable": "$PROJECTS_TABLE",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo -e "${GREEN}💾 Configuration saved to deployment-config.json${NC}"