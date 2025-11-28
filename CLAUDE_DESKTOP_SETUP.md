# Connecting MCP Server to Claude Desktop

## Overview
Your API Testing MCP server can be integrated with Claude Desktop to enable AI-powered API testing directly from Claude's interface.

## Server Architecture

Your project has **two MCP server implementations**:

1. **stdio MCP Server** (`mcpServer.js`) - For Claude Desktop integration
2. **HTTP MCP Server** (`mcpServerHttp.js`) - For web/network applications

## Available Tools

Your MCP server exposes 11 powerful tools:

- `register-api` - Register new API endpoints
- `test-api` - Test APIs with multiple scenarios
- `get-api` - Retrieve API details by ID
- `list-apis` - List all registered APIs (with filters)
- `get-test-results` - Get test results for an API
- `get-api-statistics` - Get performance metrics
- `update-api` - Update API configuration
- `delete-api` - Delete an API
- `generate-test-scenarios` - Auto-generate test scenarios
- `query-api-with-summary` - Execute API and get AI summary
- `validate-and-execute-api` - Validate and execute with full checks

## Available Resources

MCP resources for querying data:

- `api://registered/{id}` - API details
- `api://statistics/{id}` - API performance stats
- `api://all-statistics` - All API statistics
- `api://metadata/{id}` - AI-generated metadata
- `api://all-metadata` - All API metadata

---

## Method 1: Claude Desktop Integration (Stdio)

### Step 1: Locate Claude Desktop Configuration

The configuration file location depends on your OS:

**macOS:**
```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**
```bash
%APPDATA%\Claude\claude_desktop_config.json
```

**Linux:**
```bash
~/.config/Claude/claude_desktop_config.json
```

### Step 2: Add Your MCP Server Configuration

Edit the `claude_desktop_config.json` file:

```json
{
  "mcpServers": {
    "api-testing": {
      "command": "node",
      "args": [
        "/Users/sirajworkspace/Desktop/iabtechlab/crawlers/mcp-config/mcpServer.js"
      ],
      "env": {
        "NODE_ENV": "production",
        "DB_HOST": "localhost",
        "DB_USER": "root",
        "DB_PASSWORD": "your_password",
        "DB_NAME": "api_testing",
        "OPENAI_API_KEY": "your_openai_key_here",
        "GEMINI_API_KEY": "your_gemini_key_here"
      }
    }
  }
}
```

**Important Configuration Notes:**

1. **Replace the absolute path** with your actual project directory
2. **Add your database credentials** (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME)
3. **Add your AI API keys** (OPENAI_API_KEY or GEMINI_API_KEY)
4. Ensure MySQL server is running before starting Claude Desktop

### Step 3: Restart Claude Desktop

1. Quit Claude Desktop completely
2. Reopen Claude Desktop
3. Your MCP server should now be available

### Step 4: Verify Connection

In Claude Desktop, you can now use commands like:

```
List all registered APIs
```

```
Register a new API: https://api.github.com/users/octocat with method GET
```

```
Test API ID 1 with scenarios
```

---

## Method 2: HTTP/SSE Integration (For Web Applications)

### Step 1: Start the HTTP Server

Your main server already exposes the MCP endpoint at:

```bash
npm start
```

The MCP HTTP endpoint will be available at:
```
http://localhost:3000/mcp/sse
```

### Step 2: Configure External MCP Client

For applications that support HTTP-based MCP (not Claude Desktop):

```json
{
  "mcpServers": {
    "api-testing-http": {
      "url": "http://localhost:3000/mcp/sse",
      "transport": "sse"
    }
  }
}
```

### Step 3: Network Access Configuration

To expose your MCP server over the network:

**a) Update CORS settings in `app.js`:**

Already configured! Your server accepts:
- `http://localhost:3000`
- `http://127.0.0.1:3000`
- Add more origins in `.env`:

```env
ALLOWED_ORIGINS=http://localhost:3000,http://192.168.1.100:3000
```

**b) For remote access, use ngrok or similar:**

```bash
ngrok http 3000
```

Then use the ngrok URL:
```
https://abc123.ngrok.io/mcp/sse
```

---

## Context-Aware Usage Examples

Once connected to Claude Desktop, you can interact naturally:

### Basic Commands

```
Register the GitHub API at https://api.github.com/users/{username}
```

```
List all my registered APIs
```

```
Test the API with ID 5
```

### Advanced Context-Aware Queries

```
Query the first API and give me a summary
```

```
Validate that API with authentication headers
```

```
Show me statistics for all APIs
```

```
Generate test scenarios for API 3
```

### Natural Language Understanding

The MCP server integrates with AI to understand context:

```
Test that one with Bearer token authentication
```

```
What's the performance of the GitHub API?
```

```
Execute the last registered API and analyze the response
```

---

## Troubleshooting

### Issue: MCP Server Not Showing in Claude Desktop

**Solutions:**
1. Check the JSON syntax in `claude_desktop_config.json`
2. Verify the absolute path to `mcpServer.js` is correct
3. Ensure MySQL is running
4. Check Claude Desktop logs:
   - macOS: `~/Library/Logs/Claude/`
   - Windows: `%APPDATA%\Claude\logs\`

### Issue: Database Connection Failed

**Solutions:**
1. Verify MySQL is running:
   ```bash
   mysql -u root -p
   ```

2. Check database exists:
   ```sql
   SHOW DATABASES LIKE 'api_testing';
   ```

3. Verify credentials in config

### Issue: AI Features Not Working

**Solutions:**
1. Verify API keys in `claude_desktop_config.json` env section
2. Check `.env` file has valid keys:
   ```
   OPENAI_API_KEY=sk-...
   GEMINI_API_KEY=AI...
   ```

### Issue: Port Already in Use

**Solutions:**
1. Change port in `.env`:
   ```
   PORT=3001
   ```

2. Update MCP HTTP URL accordingly

---

## Architecture Details

### stdio Transport (Claude Desktop)
```
Claude Desktop → Node Process (mcpServer.js) → MySQL Database
     ↑                                              ↓
     └────────────── JSON-RPC 2.0 ─────────────────┘
```

### HTTP/SSE Transport (Web Applications)
```
MCP Client → HTTP POST /mcp/sse → Express Server → MySQL Database
     ↑                                                    ↓
     └──────────── Server-Sent Events (SSE) ─────────────┘
```

---

## Security Considerations

### For Production Deployment:

1. **Use environment variables** for sensitive data (never commit .env)
2. **Enable authentication** on the HTTP endpoint
3. **Use HTTPS** for network access
4. **Implement rate limiting** (already configured: 100 req/min)
5. **Validate domains** (already configured via middleware)
6. **Use secure tokens** for API authentication

### Example Production Config:

```json
{
  "mcpServers": {
    "api-testing-prod": {
      "url": "https://your-domain.com/mcp/sse",
      "transport": "sse",
      "headers": {
        "Authorization": "Bearer YOUR_SECRET_TOKEN"
      }
    }
  }
}
```

---

## Testing Your Setup

### Test 1: List APIs (Basic Connectivity)
```
Claude, list all registered APIs
```

### Test 2: Register API (Tool Invocation)
```
Register a test API: https://jsonplaceholder.typicode.com/posts with GET method
```

### Test 3: Test with Scenarios (Complex Operation)
```
Test API ID 1 with multiple scenarios
```

### Test 4: Context-Aware Query (AI Integration)
```
Query the GitHub API and summarize the response
```

If all tests pass, your MCP integration is working perfectly!

---

## Advanced: Multiple MCP Servers

You can run multiple instances:

```json
{
  "mcpServers": {
    "api-testing-dev": {
      "command": "node",
      "args": ["./mcpServer.js"],
      "env": {
        "NODE_ENV": "development",
        "PORT": "3000"
      }
    },
    "api-testing-staging": {
      "url": "https://staging.example.com/mcp/sse",
      "transport": "sse"
    },
    "api-testing-prod": {
      "url": "https://prod.example.com/mcp/sse",
      "transport": "sse"
    }
  }
}
```

---

## Next Steps

1. **Start with stdio integration** (easiest for Claude Desktop)
2. **Test basic commands** to verify connectivity
3. **Explore AI-powered features** (summaries, validation, context-aware queries)
4. **Set up HTTP endpoint** for web application integration
5. **Deploy to production** with proper security measures

---

## Useful Commands

### Start Main Server (HTTP + Web UI)
```bash
npm start
```

### Start MCP stdio Server (Direct)
```bash
npm run mcp
```

### Start MCP HTTP Server (Standalone)
```bash
npm run mcp:http
```

### Development Mode (Auto-restart)
```bash
npm run dev
```

---

## Support & Documentation

- **MCP Protocol:** https://modelcontextprotocol.io/
- **Claude Desktop:** https://claude.ai/download
- **Project Issues:** Your GitHub repository

---

**Last Updated:** 2025-11-27
**Server Version:** 1.0.0
**MCP SDK Version:** ^1.21.1
