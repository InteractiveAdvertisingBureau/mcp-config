#!/bin/bash

# Cloud Run Deployment Script for Crawler Automation
# This script deploys the application to Google Cloud Run

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-tl-openx-qa}"
SERVICE_NAME="${SERVICE_NAME:-mcp-api-testing}"
REGION="${REGION:-us-east4}"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Cloud SQL Configuration (update these if using Cloud SQL)
CLOUD_SQL_INSTANCE="${CLOUD_SQL_INSTANCE:-}"  # Format: project:region:instance
USE_CLOUD_SQL="${USE_CLOUD_SQL:-false}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Cloud Run Deployment Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Project ID: ${YELLOW}${PROJECT_ID}${NC}"
echo -e "Service Name: ${YELLOW}${SERVICE_NAME}${NC}"
echo -e "Region: ${YELLOW}${REGION}${NC}"
echo -e "Image: ${YELLOW}${IMAGE_NAME}${NC}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed${NC}"
    echo "Please install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if user is logged in
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
    echo -e "${YELLOW}Please login to gcloud${NC}"
    gcloud auth login
fi

# Set project
echo -e "${GREEN}Setting project...${NC}"
gcloud config set project ${PROJECT_ID}

# Enable required APIs
echo -e "${GREEN}Enabling required APIs...${NC}"
gcloud services enable cloudbuild.googleapis.com \
    run.googleapis.com \
    containerregistry.googleapis.com \
    secretmanager.googleapis.com

# Build the container image
echo -e "${GREEN}Building container image...${NC}"
gcloud builds submit --tag ${IMAGE_NAME}

# Read environment variables from .env file
echo -e "${GREEN}Preparing environment variables from .env...${NC}"

if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found${NC}"
    exit 1
fi

# Create temporary YAML file for env vars
ENV_FILE=$(mktemp)
echo "# Generated environment variables" > ${ENV_FILE}

while IFS='=' read -r key value; do
    # Skip comments and empty lines
    [[ $key =~ ^#.*$ ]] && continue
    [[ -z $key ]] && continue

    # Trim whitespace
    key=$(echo "$key" | xargs)
    value=$(echo "$value" | xargs)

    # Remove quotes from value
    value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")

    # Skip PORT (Cloud Run sets this automatically) and NODE_ENV (we set it below)
    [[ $key == "PORT" ]] && continue
    [[ $key == "NODE_ENV" ]] && continue

    # Skip GOOGLE_APPLICATION_CREDENTIALS (use service account instead)
    if [[ $key == "GOOGLE_APPLICATION_CREDENTIALS" ]]; then
        echo -e "${YELLOW}⚠️  Skipping GOOGLE_APPLICATION_CREDENTIALS (using service account)${NC}"
        continue
    fi

    # Warn about sensitive data
    if [[ $key =~ (PASSWORD|SECRET|KEY|TOKEN) ]]; then
        echo -e "${YELLOW}⚠️  Including sensitive env var: ${key}${NC}"
    fi

    # Add to YAML file with quoted value
    echo "${key}: \"${value}\"" >> ${ENV_FILE}
done < .env

# Add production NODE_ENV
echo "NODE_ENV: \"production\"" >> ${ENV_FILE}

echo -e "${GREEN}Environment variables prepared from .env${NC}"

# Deploy to Cloud Run
echo -e "${GREEN}Deploying to Cloud Run...${NC}"
gcloud run deploy ${SERVICE_NAME} \
    --image ${IMAGE_NAME} \
    --platform managed \
    --region ${REGION} \
    --allow-unauthenticated \
    --port 8080 \
    --memory 1Gi \
    --cpu 2 \
    --timeout 300 \
    --max-instances 10 \
    --min-instances 0 \
    --env-vars-file ${ENV_FILE} \
    --service-account="crawler-cloud-functions-sa@tl-openx-qa.iam.gserviceaccount.com"

# Clean up temp file
rm -f ${ENV_FILE}

# Get the service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --platform managed --region ${REGION} --format 'value(status.url)')

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Service URL: ${YELLOW}${SERVICE_URL}${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Test the deployment: ${SERVICE_URL}/api/health"
echo "2. Access the UI: ${SERVICE_URL}"
echo "3. Check logs: gcloud run services logs read ${SERVICE_NAME} --region ${REGION}"
echo ""
