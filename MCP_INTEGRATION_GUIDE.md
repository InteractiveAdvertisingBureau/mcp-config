# MCP Integration Guide

## Quick Answer to Your Question

**"How can we connect this MCP in any other application like Claude Desktop or any other application and serve based on context?"**

Your MCP server is **already built** to connect to external applications! You have two integration methods:

### 1. **Claude Desktop Integration** (stdio transport)
- Uses `mcpServer.js` with stdio communication
- Best for: Claude Desktop application
- Protocol: JSON-RPC 2.0 over stdin/stdout
- **Status: ✅ Ready to use**

### 2. **Web/Network Integration** (HTTP/SSE transport)
- Uses `mcpServerHttp.js` with Server-Sent Events
- Best for: Web apps, mobile apps, remote clients
- Protocol: HTTP POST to `/mcp/sse` endpoint
- **Status: ✅ Already running at http://localhost:3000/mcp/sse**

---

## What is MCP (Model Context Protocol)?

MCP is Anthropic's standard protocol that allows AI applications to:
- **Discover tools** your server provides
- **Invoke tools** with parameters
- **Access resources** (data, APIs, files)
- **Maintain context** across conversations

Think of it as a standardized way for AI assistants to interact with your API testing system.

---

## Your MCP Server Capabilities

### 11 Available Tools

Your server exposes these tools to any MCP client:

1. **register-api** - Register new API endpoints for testing
2. **test-api** - Execute comprehensive API tests with scenarios
3. **get-api** - Retrieve API details by ID
4. **list-apis** - List all registered APIs with filtering
5. **get-test-results** - View historical test results
6. **get-api-statistics** - Get performance metrics
7. **update-api** - Modify API configuration
8. **delete-api** - Remove APIs from registry
9. **generate-test-scenarios** - Auto-generate test cases using AI
10. **query-api-with-summary** - Execute API call and get AI-powered summary
11. **validate-and-execute-api** - Full validation before execution

### 5 Available Resources

Resources provide read-only access to data:

1. **api://registered/{id}** - API details
2. **api://statistics/{id}** - Performance statistics
3. **api://all-statistics** - System-wide stats
4. **api://metadata/{id}** - AI-generated metadata
5. **api://all-metadata** - All metadata records

---

## Integration Option 1: Claude Desktop

### Quick Setup (5 minutes)

1. **Find your Claude Desktop config file:**

   **macOS:**
   ```bash
   ~/Library/Application Support/Claude/claude_desktop_config.json
   ```

   **Windows:**
   ```
   %APPDATA%\Claude\claude_desktop_config.json
   ```

   **Linux:**
   ```bash
   ~/.config/Claude/claude_desktop_config.json
   ```

2. **Copy the example config:**

   ```bash
   # Copy the example configuration
   cp claude_desktop_config.example.json ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

   Or manually create the file with this content:

   ```json
   {
     "mcpServers": {
       "api-testing": {
         "command": "node",
         "args": ["/ABSOLUTE/PATH/TO/mcpServer.js"],
         "env": {
           "DB_HOST": "localhost",
           "DB_USER": "root",
           "DB_PASSWORD": "your_password",
           "DB_NAME": "api_testing",
           "OPENAI_API_KEY": "sk-...",
           "GEMINI_API_KEY": "..."
         }
       }
     }
   }
   ```

3. **Update the configuration:**
   - Replace `/ABSOLUTE/PATH/TO/` with your actual project path
   - Add your database credentials
   - Add your AI API keys

4. **Restart Claude Desktop**

5. **Test it:**
   ```
   List all my registered APIs
   ```

### How It Works

```
┌─────────────────┐
│ Claude Desktop  │
│   (MCP Client)  │
└────────┬────────┘
         │ JSON-RPC 2.0
         │ via stdio
         ▼
┌─────────────────┐      ┌──────────────┐
│  mcpServer.js   │ ───► │    MySQL     │
│ (MCP Server)    │      │   Database   │
└─────────────────┘      └──────────────┘
```

Claude Desktop launches your `mcpServer.js` as a subprocess and communicates via stdin/stdout using JSON-RPC 2.0 protocol.

---

## Integration Option 2: HTTP/SSE (Web & Network)

### Quick Setup

1. **Start your main server:**
   ```bash
   npm start
   ```

2. **MCP endpoint is available at:**
   ```
   http://localhost:3000/mcp/sse
   ```

3. **For remote access, use ngrok:**
   ```bash
   ngrok http 3000
   ```

   Then use:
   ```
   https://abc123.ngrok.io/mcp/sse
   ```

### How It Works

```
┌─────────────────┐
│   MCP Client    │
│ (Web/Mobile App)│
└────────┬────────┘
         │ HTTP POST
         │ Server-Sent Events (SSE)
         ▼
┌─────────────────┐      ┌──────────────┐
│ mcpServerHttp.js│ ───► │    MySQL     │
│  (Express App)  │      │   Database   │
└─────────────────┘      └──────────────┘
```

The HTTP server exposes the MCP protocol over HTTP with Server-Sent Events for real-time updates.

### Example HTTP Client Configuration

For applications that support HTTP-based MCP servers:

```json
{
  "mcpServers": {
    "api-testing-http": {
      "url": "http://localhost:3000/mcp/sse",
      "transport": "sse",
      "headers": {
        "Content-Type": "application/json"
      }
    }
  }
}
```

---

## Context-Aware Serving

### What is Context-Aware Serving?

Your MCP server **already implements context awareness**! This means AI clients can:

1. **Reference previous conversations**
   ```
   User: "Test the GitHub API"
   AI: [Tests API ID 5]
   User: "Now show me statistics for that one"
   AI: [Shows statistics for API 5]
   ```

2. **Use natural language**
   ```
   "Query the first API in my list"
   "Test that one with authentication"
   "What's the performance like?"
   ```

3. **Maintain state across queries**
   - Current API in context
   - Recently accessed APIs
   - Last action performed
   - Conversation history

### How Context Works

Your `/api/ai-query` endpoint (routes/mcpRoutes.js:778-1023) implements context-aware processing:

```javascript
// Context structure
{
  "query": "Test that API",
  "context": {
    "currentAPI": 5,              // Currently focused API
    "lastAction": "query_api",    // Last operation
    "recentAPIs": [5, 3, 1],      // Recently mentioned
    "conversationHistory": [...]  // Past messages
  }
}
```

The AI resolves references like "that one", "it", "the first API" using this context.

---

## Testing Your Setup

### Automated Testing

Run the comprehensive test suite:

```bash
npm test
```

Or:

```bash
npm run test:mcp
```

This tests:
- ✅ HTTP server connectivity
- ✅ Stdio server startup
- ✅ Database connection
- ✅ AI integration
- ✅ Claude Desktop configuration

### Manual Testing

#### Test 1: HTTP Endpoint
```bash
curl http://localhost:3000/api/health
```

Expected:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-27T..."
}
```

#### Test 2: Register API
```bash
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "JSONPlaceholder",
    "endpoint": "https://jsonplaceholder.typicode.com/posts",
    "method": "GET"
  }'
```

#### Test 3: List APIs
```bash
curl http://localhost:3000/api/apis
```

#### Test 4: Claude Desktop

Open Claude Desktop and type:
```
List all registered APIs
```

If configured correctly, Claude will invoke the `list-apis` tool.

---

## Real-World Usage Examples

### Example 1: Testing GitHub API

**In Claude Desktop:**

```
Register the GitHub user API: https://api.github.com/users/octocat
```

Claude will:
1. Invoke `register-api` tool
2. Auto-generate test scenarios
3. Run initial tests
4. Store results in database

Then:
```
Query that API and summarize the response
```

Claude will:
1. Invoke `query-api-with-summary` tool
2. Execute the API call
3. Analyze response with AI
4. Provide human-readable summary

### Example 2: Monitoring API Performance

```
Show me statistics for all my APIs
```

Claude accesses the `api://all-statistics` resource and presents formatted data.

### Example 3: Context-Aware Testing

```
Test my first three APIs with authentication
```

Claude:
1. Lists APIs
2. Identifies first three
3. Checks auth requirements
4. Executes tests with proper tokens
5. Reports results

---

## Architecture Overview

### System Components

```
┌────────────────────────────────────────────────────────┐
│                    MCP Integration Layer               │
├────────────────────────────────────────────────────────┤
│                                                        │
│  ┌──────────────┐              ┌─────────────────┐   │
│  │   stdio MCP  │              │   HTTP/SSE MCP  │   │
│  │ mcpServer.js │              │mcpServerHttp.js │   │
│  └──────┬───────┘              └────────┬────────┘   │
│         │                               │            │
│         └───────────────┬───────────────┘            │
│                         ▼                            │
│         ┌───────────────────────────┐                │
│         │     Core Services         │                │
│         │  • apiService.js          │                │
│         │  • apiTester.js           │                │
│         │  • multiModelService.js   │                │
│         └───────────┬───────────────┘                │
│                     ▼                                │
│         ┌───────────────────────────┐                │
│         │      MySQL Database       │                │
│         │  • api_registry           │                │
│         │  • test_results           │                │
│         │  • ai_metadata            │                │
│         └───────────────────────────┘                │
│                                                        │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│                    Web Interface Layer                 │
├────────────────────────────────────────────────────────┤
│                                                        │
│  ┌──────────────────────────────────────────┐         │
│  │         Express REST API                 │         │
│  │       routes/mcpRoutes.js                │         │
│  │  • /api/register                         │         │
│  │  • /api/test/:id                         │         │
│  │  • /api/ai-query                         │         │
│  └──────────────────────────────────────────┘         │
│                                                        │
│  ┌──────────────────────────────────────────┐         │
│  │       Browser UI (client/ui/)            │         │
│  │  • API Registration Form                 │         │
│  │  • Test Scenarios Manager                │         │
│  │  • Results Dashboard                     │         │
│  └──────────────────────────────────────────┘         │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Data Flow: Claude Desktop → API Test

1. **User command in Claude:**
   ```
   Test the GitHub API
   ```

2. **Claude Desktop → mcpServer.js** (stdio)
   ```json
   {
     "jsonrpc": "2.0",
     "method": "tools/call",
     "params": {
       "name": "test-api",
       "arguments": {
         "api_id": 1,
         "scenarios": [...]
       }
     }
   }
   ```

3. **mcpServer.js → apiTester.testAPIWithScenarios()**
   - Loads API from database
   - Executes HTTP requests
   - Analyzes responses with AI
   - Stores results

4. **Response → Claude Desktop**
   ```json
   {
     "success": true,
     "total_scenarios": 3,
     "successful_tests": 3,
     "ai_analysis": "..."
   }
   ```

5. **Claude presents to user:**
   ```
   I've tested the GitHub API with 3 scenarios. All tests passed!

   Key findings:
   - Response time: 245ms average
   - All endpoints returning valid JSON
   - No authentication errors

   Would you like to see detailed results?
   ```

---

## Advanced Configuration

### Multiple Environments

Configure different environments:

```json
{
  "mcpServers": {
    "api-testing-dev": {
      "command": "node",
      "args": ["./mcpServer.js"],
      "env": {
        "NODE_ENV": "development",
        "DB_NAME": "api_testing_dev"
      }
    },
    "api-testing-prod": {
      "url": "https://api.example.com/mcp/sse",
      "transport": "sse"
    }
  }
}
```

### Custom Authentication

Add authentication to HTTP endpoint:

```javascript
// In app.js, before mounting /mcp
app.use('/mcp', (req, res, next) => {
  const token = req.headers.authorization;
  if (token !== `Bearer ${process.env.MCP_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

Then configure client:

```json
{
  "mcpServers": {
    "api-testing": {
      "url": "https://api.example.com/mcp/sse",
      "transport": "sse",
      "headers": {
        "Authorization": "Bearer YOUR_SECRET"
      }
    }
  }
}
```

### Rate Limiting

Already configured! See `routes/mcpRoutes.js:9`:

```javascript
router.use(rateLimit(100, 60000)); // 100 requests per minute
```

Adjust as needed:

```javascript
router.use(rateLimit(1000, 60000)); // 1000 requests per minute
```

---

## Troubleshooting

### Issue: "MCP server not appearing in Claude Desktop"

**Checklist:**
- [ ] JSON syntax is valid (use `cat config.json | jq` to verify)
- [ ] Absolute path to `mcpServer.js` is correct
- [ ] Environment variables are set (especially DB credentials)
- [ ] MySQL server is running
- [ ] Database `api_testing` exists
- [ ] Restarted Claude Desktop after config changes

**Debug:**
1. Check Claude logs:
   - macOS: `~/Library/Logs/Claude/`
   - Windows: `%APPDATA%\Claude\logs\`

2. Test server manually:
   ```bash
   node mcpServer.js
   ```

### Issue: "Database connection failed"

**Solution:**
```bash
# 1. Check MySQL is running
mysql -u root -p

# 2. Create database if missing
mysql -u root -p -e "CREATE DATABASE api_testing;"

# 3. Import schema
mysql -u root -p api_testing < database/schema.sql

# 4. Test connection
npm test
```

### Issue: "HTTP endpoint not accessible"

**Solution:**
```bash
# 1. Check server is running
curl http://localhost:3000/api/health

# 2. Check port is correct
cat .env | grep PORT

# 3. Check firewall
# macOS:
sudo pfctl -d  # Disable temporarily

# Linux:
sudo ufw status
```

### Issue: "AI features not working"

**Solution:**
```bash
# 1. Check API keys
cat .env | grep API_KEY

# 2. Verify keys are valid
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# 3. Check usage limits on provider dashboard
```

---

## Security Best Practices

### For Production Deployment

1. **Use HTTPS**
   ```bash
   # With nginx reverse proxy
   server {
     listen 443 ssl;
     server_name api.example.com;

     location /mcp {
       proxy_pass http://localhost:3000/mcp;
     }
   }
   ```

2. **Implement Authentication**
   - API keys for HTTP endpoint
   - Firewall rules for stdio server
   - Database user with minimal privileges

3. **Environment Variables**
   ```bash
   # Never commit .env file
   echo ".env" >> .gitignore

   # Use secrets management
   export DB_PASSWORD=$(vault read secret/db/password)
   ```

4. **Rate Limiting**
   - Already implemented (100 req/min)
   - Adjust based on your needs
   - Consider IP-based limits

5. **Input Validation**
   - Already implemented via middleware
   - Domain validation active
   - SQL injection protection via parameterized queries

---

## Performance Optimization

### Database Indexing

Already optimized! See schema:
```sql
CREATE INDEX idx_api_endpoint ON api_registry(endpoint);
CREATE INDEX idx_test_api_id ON test_results(api_id);
CREATE INDEX idx_metadata_api ON ai_metadata(api_id);
```

### Caching

Add Redis caching:
```javascript
import redis from 'redis';
const cache = redis.createClient();

// Cache API list
async function getAllAPIs(options) {
  const cacheKey = `apis:${JSON.stringify(options)}`;
  const cached = await cache.get(cacheKey);

  if (cached) return JSON.parse(cached);

  const apis = await db.query(...);
  await cache.setex(cacheKey, 300, JSON.stringify(apis));

  return apis;
}
```

### Connection Pooling

Already configured in `database/connection.js`:
```javascript
const pool = mysql.createPool({
  connectionLimit: 10,
  ...
});
```

---

## Next Steps

1. **Start with Claude Desktop integration** (easiest)
   - Copy `claude_desktop_config.example.json`
   - Update paths and credentials
   - Restart Claude Desktop

2. **Test your setup**
   ```bash
   npm test
   ```

3. **Register your first API**
   - Use web UI at `http://localhost:3000`
   - Or via Claude: `"Register API at https://..."`

4. **Explore AI features**
   - Auto-generated test scenarios
   - AI-powered response analysis
   - Context-aware queries

5. **Deploy to production**
   - Set up HTTPS
   - Configure authentication
   - Enable monitoring

---

## Resources

- **MCP Protocol Documentation:** https://modelcontextprotocol.io/
- **Claude Desktop:** https://claude.ai/download
- **Full Setup Guide:** `CLAUDE_DESKTOP_SETUP.md`
- **API Documentation:** `routes/mcpRoutes.js` (inline comments)

---

## Support

If you encounter issues:

1. **Run diagnostics:** `npm test`
2. **Check logs:** `~/Library/Logs/Claude/` (Claude Desktop)
3. **Review setup guide:** `CLAUDE_DESKTOP_SETUP.md`
4. **Check server logs:** Look for error messages in terminal

---

**Last Updated:** 2025-11-27
**MCP Version:** 1.21.1
**Server Version:** 1.0.0
