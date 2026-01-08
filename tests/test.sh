#!/bin/bash

# Test script for MCP server
# This script verifies all modules are working correctly

echo "🧪 Testing MCP Server"
echo "====================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Base URL
BASE_URL="http://localhost:3000"

# Function to test endpoint
test_endpoint() {
  local name=$1
  local url=$2

  echo -n "Testing $name... "

  response=$(curl -s -o /dev/null -w "%{http_code}" "$url")

  if [ "$response" = "200" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
    return 0
  else
    echo -e "${RED}✗ FAIL (HTTP $response)${NC}"
    return 1
  fi
}

# Check if server is running
echo -n "Checking if server is running... "
if curl -s "$BASE_URL/health" > /dev/null; then
  echo -e "${GREEN}✓ Server is running${NC}"
else
  echo -e "${RED}✗ Server is not running${NC}"
  echo ""
  echo "Please start the server first:"
  echo "  node server.js"
  exit 1
fi

echo ""

# Test main endpoints
echo "Testing Main Endpoints:"
echo "-----------------------"
test_endpoint "Health check" "$BASE_URL/health"
echo ""

# Test API Testing MCP
echo "Testing API Testing MCP Module:"
echo "--------------------------------"
test_endpoint "MCP health" "$BASE_URL/mcp/health"
test_endpoint "MCP info" "$BASE_URL/mcp/info"
echo ""

# Test OpenDirect MCP
echo "Testing OpenDirect MCP Module:"
echo "------------------------------"
test_endpoint "OpenDirect health" "$BASE_URL/agenticdirect/mcp/health"
test_endpoint "OpenDirect info" "$BASE_URL/agenticdirect/mcp/info"
echo ""

# Test Schema-Driven MCP
echo "Testing Schema-Driven MCP Module:"
echo "----------------------------------"
test_endpoint "Schema MCP health" "$BASE_URL/schema/mcp/health"
test_endpoint "Schema MCP info" "$BASE_URL/schema/mcp/info"
test_endpoint "Schema MCP tools" "$BASE_URL/schema/mcp/tools"
test_endpoint "Schema MCP resources" "$BASE_URL/schema/mcp/resources"
echo ""

# Test A2A Protocol
echo "Testing A2A Protocol Module:"
echo "----------------------------"
test_endpoint "A2A agents discovery" "$BASE_URL/a2a/agents"
echo ""

# Test AI Chat
echo "Testing AI Chat Module:"
echo "-----------------------"
test_endpoint "AI health check" "$BASE_URL/api/ai-health"
echo ""

# Test Schema API
echo "Testing Schema Management API:"
echo "------------------------------"
test_endpoint "Get current schema" "$BASE_URL/api/schema/current"
test_endpoint "Get schema history" "$BASE_URL/api/schema/history"
echo ""

echo "=============================="
echo "✅ All tests completed!"
echo ""
