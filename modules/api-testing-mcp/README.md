# API Testing MCP Module

## Overview

The **API Testing MCP Module** provides AI-powered API testing and validation capabilities. Register REST APIs, run automated tests, and get intelligent analysis powered by multiple AI models (Claude, GPT, Gemini).

## Features

- 🧪 **API Registration** - Register and manage REST API endpoints
- ⚡ **Auto-Testing** - Automatic testing on registration
- 🤖 **AI Analysis** - Multi-model response analysis (Claude, GPT, Gemini)
- 📊 **Test Results** - Store and retrieve test history
- 🎯 **Scenario Generation** - Auto-generate test cases
- 🔍 **Smart Filtering** - SQL-like pattern matching for responses
- 💾 **MySQL Storage** - Persistent API and test data

## Directory Structure

```
modules/api-testing-mcp/
├── index.js                # Module entry point
├── server.js               # MCP server setup
├── routes/
│   ├── mcpRoutes.js       # REST API routes
│   └── mcpConnectorRoutes.js  # MCP connector API
├── middleware/
│   ├── apiCollector.js    # Collect API metadata
│   └── validationMiddleware.js  # Validate requests
├── services/
│   ├── apiTester.js       # API testing logic
│   └── multiModelService.js  # AI analysis
├── config/
│   └── config.js          # Model configuration
└── README.md              # This file
```

## Endpoints

### MCP Protocol (SSE)

```bash
POST /mcp/sse
Content-Type: application/json
```

### Health & Info

```bash
GET /mcp/health
GET /mcp/info
```

### REST API

```bash
# List all registered APIs
GET /api/apis

# Get API by ID
GET /api/apis/:id

# Register new API
POST /api/apis
{
  "name": "My API",
  "endpoint": "https://api.example.com/users",
  "method": "GET",
  "description": "Get users list"
}

# Update API
PUT /api/apis/:id

# Delete API
DELETE /api/apis/:id

# Test API
POST /api/test/:id

# Get test results
GET /api/apis/:id/test-results
```

## Available Tools

### 1. register-api
Register a new API endpoint for testing.

**Parameters:**
```json
{
  "name": "string",
  "endpoint": "string (URL)",
  "method": "GET|POST|PUT|DELETE",
  "request_type": "application/json",
  "request_params": {},
  "description": "string",
  "auth_required": false,
  "auth_type": "bearer|basic|apikey",
  "auth_token": "string"
}
```

### 2. test-api
Test API with scenarios and get AI analysis.

**Parameters:**
```json
{
  "apiId": "number",
  "scenarios": ["success", "error", "edge"]
}
```

### 3. query-api-with-summary
Execute API call and get AI-generated summary.

**Parameters:**
```json
{
  "apiId": "number",
  "params": {
    "path": {},
    "query": {},
    "body": {}
  }
}
```

### 4. list-apis
List all registered APIs.

### 5. get-api
Get API details by ID.

**Parameters:**
```json
{
  "apiId": "number"
}
```

### 6. get-test-results
Get test history for an API.

**Parameters:**
```json
{
  "apiId": "number",
  "limit": 10
}
```

### 7. validate-and-execute-api
Validate parameters and execute API call.

**Parameters:**
```json
{
  "apiId": "number",
  "params": {
    "path": {},
    "query": {},
    "body": {}
  }
}
```

### 8. generate-test-scenarios
Auto-generate test scenarios for an API.

**Parameters:**
```json
{
  "apiId": "number"
}
```

## Usage Examples

### Example 1: Register API

```bash
curl -X POST http://localhost:3000/api/apis \
  -H "Content-Type: application/json" \
  -d '{
    "name": "JSONPlaceholder Users",
    "endpoint": "https://jsonplaceholder.typicode.com/users",
    "method": "GET",
    "description": "Get list of users from JSONPlaceholder"
  }'
```

**Response:**
```json
{
  "success": true,
  "apiId": 1,
  "message": "API registered and tested successfully"
}
```

### Example 2: Test API

```bash
curl -X POST http://localhost:3000/api/test/1 \
  -H "Content-Type: application/json" \
  -d '{
    "scenarios": ["success", "error"]
  }'
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "scenario": "success",
      "status": 200,
      "responseTime": 245,
      "aiAnalysis": "API returned 10 users successfully. Response structure is valid."
    }
  ]
}
```

### Example 3: Query with AI Summary

```bash
curl -X POST http://localhost:3000/mcp/sse \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "query-api-with-summary",
      "arguments": {
        "apiId": 1,
        "params": {
          "query": { "limit": 5 }
        }
      }
    }
  }'
```

### Example 4: Generate Test Scenarios

```bash
curl -X POST http://localhost:3000/mcp/sse \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "generate-test-scenarios",
      "arguments": {
        "apiId": 1
      }
    }
  }'
```

## AI Analysis

The module supports multiple AI providers for response analysis:

### Supported Models

- **Anthropic Claude** - claude-sonnet-4-5
- **OpenAI GPT** - gpt-4o-mini, gpt-4, gpt-4-turbo
- **Google Gemini** - gemini-2.0-flash-exp

### Analysis Features

- Response structure validation
- Data quality assessment
- Error detection
- Performance metrics
- Recommendations for improvements

## Configuration

Environment variables:

```bash
# Database (MySQL)
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=mcp_testing

# AI Providers
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...
GEMINI_API_KEY=...

# Model Selection
DEFAULT_ANALYSIS_MODEL=openai
OPENAI_MODEL=gpt-4o-mini
GEMINI_MODEL=gemini-2.0-flash-exp

# MCP Configuration
MCP_ENABLE_ADMIN_TOOLS=false
```

Module configuration in `shared/config/index.js`:

```javascript
apiTestingMCP: {
  enabled: true,
  basePath: '/mcp',
  database: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  }
}
```

## Database Schema

```sql
CREATE TABLE registered_apis (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  endpoint TEXT,
  method VARCHAR(10),
  request_type VARCHAR(50),
  request_params JSON,
  description TEXT,
  auth_required BOOLEAN,
  auth_type VARCHAR(50),
  auth_token TEXT,
  status VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE api_test_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  api_id INT,
  scenario_name VARCHAR(100),
  test_params JSON,
  response_status INT,
  response_time_ms INT,
  response_body TEXT,
  response_headers JSON,
  success BOOLEAN,
  error_message TEXT,
  tested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (api_id) REFERENCES registered_apis(id)
);
```

## Testing

### Test Health

```bash
curl http://localhost:3000/mcp/health
```

### Test API Registration

```bash
curl -X POST http://localhost:3000/api/apis \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test API",
    "endpoint": "https://httpbin.org/get",
    "method": "GET"
  }'
```

### Test Database Connection

```bash
# Check if database is accessible
mysql -h localhost -u root -p mcp_testing -e "SHOW TABLES;"
```

## Claude Desktop Integration

```json
{
  "mcpServers": {
    "api-testing-mcp": {
      "url": "http://localhost:3000/mcp/sse",
      "transport": "http"
    }
  }
}
```

## Troubleshooting

### Database Connection Failed

```bash
# Check MySQL is running
mysql -u root -p

# Create database if needed
CREATE DATABASE mcp_testing;

# Update .env with correct credentials
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
```

### AI Analysis Not Working

```bash
# Check API keys are set
echo $OPENAI_API_KEY
echo $ANTHROPIC_API_KEY

# Test AI health
curl http://localhost:3000/api/ai-health
```

### API Test Timeout

```bash
# Check if endpoint is accessible
curl -I https://api.example.com/endpoint

# Increase timeout in config
```

## Development

### Adding New AI Provider

Edit `services/multiModelService.js` to add support for additional AI models.

### Custom Test Scenarios

Edit `services/apiTester.js` to add custom test scenario logic.

### Adding Validation Rules

Edit `middleware/validationMiddleware.js` to add custom validation.

## License

Part of the OpenDirect A2A Agent System - MIT License
