#!/bin/bash

# Cloud Run Deployment Script for A2A Client UI
# This script deploys the client UI to Google Cloud Run

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-tl-openx-qa}"
SERVICE_NAME="${SERVICE_NAME:-a2a-client-ui}"
REGION="${REGION:-us-east4}"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}A2A Client UI Deployment${NC}"
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
    containerregistry.googleapis.com

# Build the container image
echo -e "${GREEN}Building container image...${NC}"
gcloud builds submit --tag ${IMAGE_NAME}

# Deploy to Cloud Run
echo -e "${GREEN}Deploying to Cloud Run...${NC}"
gcloud run deploy ${SERVICE_NAME} \
    --image ${IMAGE_NAME} \
    --platform managed \
    --region ${REGION} \
    --allow-unauthenticated \
    --port 8080 \
    --memory 512Mi \
    --cpu 1 \
    --timeout 60 \
    --max-instances 10 \
    --min-instances 0

# Get the service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
    --platform managed \
    --region ${REGION} \
    --format 'value(status.url)')

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Successful!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Service URL: ${YELLOW}${SERVICE_URL}${NC}"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo -e "1. Open ${YELLOW}${SERVICE_URL}${NC} in your browser"
echo -e "2. Enter your A2A agent URL (e.g., https://mcpclient.iabtechlab.com/a2a/buyer)"
echo -e "3. Test the buyer/seller agent functionality"
echo ""
