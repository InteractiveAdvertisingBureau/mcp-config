#!/bin/bash

# Quick Start Script for Modular MCP Server
# This script helps you get started quickly

clear

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║       🚀  MCP Config - Quick Start                          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
  echo -e "${YELLOW}⚠️  .env file not found${NC}"
  echo ""
  echo "Creating .env from .env.example..."

  if [ -f .env.example ]; then
    cp .env.example .env
    echo -e "${GREEN}✓ Created .env file${NC}"
    echo ""
    echo "Please edit .env and add your API keys:"
    echo "  - DB_PASSWORD (for MySQL)"
    echo "  - ANTHROPIC_API_KEY (for Claude)"
    echo "  - OPENAI_API_KEY (for GPT)"
    echo "  - GEMINI_API_KEY (for Gemini)"
    echo ""
    echo "Then run this script again."
    exit 0
  else
    echo -e "❌ .env.example not found. Creating basic .env..."
    cat > .env << EOF
# Server Configuration
PORT=3000
NODE_ENV=development

# Database (for API Testing module)
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=mcp_testing

# AI Providers (for AI Chat module)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=

# Model Selection
OPENAI_MODEL=gpt-4o-mini
GEMINI_MODEL=gemini-2.0-flash-lite

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# MCP Server URL
MCP_SERVER_URL=http://localhost:3000/mcp
EOF
    echo -e "${GREEN}✓ Created basic .env file${NC}"
    echo ""
    echo "Please edit .env and add your credentials."
    echo "Then run this script again."
    exit 0
  fi
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
  echo -e "${YELLOW}⚠️  Dependencies not installed${NC}"
  echo ""
  echo "Installing dependencies..."
  npm install
  echo ""
fi

# Start the server
echo ""
echo -e "${GREEN}Starting MCP server...${NC}"
echo ""
node server.js
