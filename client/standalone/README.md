# Ads.txt & Compliance Query Client

A standalone HTML/JavaScript client for querying ads.txt and compliance APIs through the MCP server.

## Features

✅ **Simple Interface** - Chat-like interface for natural language queries
✅ **Direct MCP Communication** - Connects directly to MCP HTTP/SSE server
✅ **Real-time Status** - Shows connection status to MCP server
✅ **Example Queries** - Quick-fill common questions
✅ **Result History** - Keeps track of all queries and responses
✅ **Configurable** - Change MCP endpoint without editing code

## Quick Start

### 1. Ensure MCP Server is Running

Make sure your MCP HTTP server is running:

```bash
# Start the MCP server (from project root)
node server.js
```

The MCP server should be accessible at: `http://localhost:3001/sse`

### 2. Open the Client

Simply open the HTML file in your browser:

```bash
# Option 1: Open directly
open client/standalone/adstxt-compliance-client.html

# Option 2: Use a local server (recommended)
cd client/standalone
python3 -m http.server 8080
# Then visit: http://localhost:8080/adstxt-compliance-client.html
```

### 3. Configure (if needed)

If your MCP server is on a different host/port:
1. Click on the yellow configuration box
2. Update the MCP Server Endpoint
3. Check the connection status indicator

## Usage Examples

### List All APIs
```
List all registered APIs
```

### Query Specific API
```
Query API 16 with summary
```

### Get API Details
```
Get API 3
```

### Validate and Execute
```
Validate and execute API 5
```

### Check Statistics
```
Show statistics for API 2
```

## How It Works

### Query Parsing

The client intelligently parses your natural language query and converts it to MCP tool calls:

| Your Query | MCP Tool Called | Arguments |
|------------|----------------|-----------|
| "List all APIs" | `list-apis` | `{}` |
| "Query API 16" | `query-api-with-summary` | `{api_id: 16}` |
| "Get API 3" | `get-api` | `{api_id: 3}` |
| "Validate API 5" | `validate-and-execute-api` | `{api_id: 5}` |
| "Statistics for API 2" | `get-api-statistics` | `{api_id: 2}` |

### MCP Communication

The client uses the MCP JSON-RPC 2.0 protocol over HTTP:

```javascript
// Request format
{
  "jsonrpc": "2.0",
  "id": 1234567890,
  "method": "tools/call",
  "params": {
    "name": "list-apis",
    "arguments": {}
  }
}

// Response format
{
  "jsonrpc": "2.0",
  "id": 1234567890,
  "result": {
    "content": [{
      "type": "text",
      "text": "JSON response here"
    }]
  }
}
```

## Customization

### Adding Custom Queries

To add more example queries, edit the HTML file:

```html
<div class="example-chips">
    <span class="example-chip" onclick="fillQuery(this.textContent)">
        Your custom query here
    </span>
</div>
```

### Extending Query Parser

To handle new query patterns, modify the `parseQueryToToolCall` function:

```javascript
function parseQueryToToolCall(query) {
    const lowerQuery = query.toLowerCase();

    // Add your custom pattern
    if (lowerQuery.includes('your pattern')) {
        return {
            tool: 'your-tool-name',
            arguments: { /* your args */ }
        };
    }

    // ... existing patterns
}
```

## MCP Tools Available

The client can call any MCP tool from your server:

1. **register-api** - Register a new API
2. **test-api** - Test API with scenarios
3. **get-api** - Get API details
4. **list-apis** - List all registered APIs
5. **get-test-results** - Get test results
6. **get-api-statistics** - Get API statistics
7. **update-api** - Update API details
8. **delete-api** - Delete an API
9. **generate-test-scenarios** - Auto-generate test scenarios
10. **query-api-with-summary** - Query API with AI summary
11. **validate-and-execute-api** - Validate and execute API

## Troubleshooting

### Connection Failed

**Symptoms:** Red status indicator, "Disconnected" message

**Solutions:**
1. Check if MCP server is running: `curl http://localhost:3001/health`
2. Verify the endpoint URL in the configuration box
3. Check for CORS issues (server must allow browser requests)
4. Check browser console for errors (F12)

### CORS Error

**Symptoms:** Browser console shows: `Access to fetch blocked by CORS policy`

**Solution:** Update your MCP server's CORS settings in `app.js`:

```javascript
app.use(cors({
  origin: '*',  // Allow all origins (or specify your domain)
  credentials: true
}));
```

### Query Not Understood

**Symptoms:** Wrong tool is called or default `list-apis` is used

**Solution:** Be more specific in your query. Include:
- Action word: "query", "get", "list", "validate"
- Entity: "API"
- ID number if applicable: "API 16"

**Good:** "Query API 16 with summary"
**Bad:** "Show me something about API"

## Advanced Usage

### Calling with Custom Parameters

While the client focuses on simple queries, you can extend it to pass custom parameters:

```javascript
// In parseQueryToToolCall function
if (lowerQuery.includes('query with params')) {
    return {
        tool: 'query-api-with-summary',
        arguments: {
            api_id: 16,
            params: {
                path: { username: 'torvalds' }
            }
        }
    };
}
```

### Integration with Other Tools

The client is standalone but can be integrated:

1. **Embed in iframe**: `<iframe src="adstxt-compliance-client.html"></iframe>`
2. **PostMessage API**: Communicate with parent window
3. **URL Parameters**: Pass initial query via URL hash

### Styling

The client uses inline CSS for portability. To customize:

1. Edit the `<style>` section in the HTML
2. Or extract to external CSS file
3. Use CSS variables for quick theme changes

## Production Deployment

### 1. Update Endpoint

Change the default MCP endpoint to your production URL:

```javascript
let mcpEndpoint = 'https://your-production-url.run.app/mcp/sse';
```

### 2. Host the File

Options:
- Static hosting: Netlify, Vercel, GitHub Pages
- Cloud storage: S3, Cloud Storage
- CDN: Cloudflare, CloudFront
- Or include in your existing web app

### 3. Security Considerations

- MCP server must have proper CORS headers
- Consider adding authentication if needed
- Use HTTPS for production
- Implement rate limiting on MCP server

## Support

For issues or questions:
1. Check the browser console (F12)
2. Verify MCP server logs
3. Test MCP endpoint with curl:
   ```bash
   curl -X POST http://localhost:3001/sse \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
   ```

## License

Same as the main project.
