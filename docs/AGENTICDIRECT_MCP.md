# AgenticDirect MCP Server - OpenDirect v2.1

Two transport options for maximum flexibility:

## 🚀 Quick Start

### Option 1: HTTP Transport (Web/API)
```bash
npm start
```
Access at: `http://localhost:3000/agenticdirect/mcp/sse`

### Option 2: stdio Transport (Claude Desktop)
```bash
node mcpServerAgentic.js
```
Use with Claude Desktop, Cline, Continue, etc.

---

## 📦 Available Tools (10)

1. **create_organization** - Create advertiser, agency, or publisher
2. **create_account** - Create buyer-advertiser account
3. **create_order** - Create advertising order/campaign
4. **create_line** - Create line item within order
5. **create_creative** - Upload/create ad creative
6. **create_assignment** - Assign creative to placement
7. **search_products** - Search advertising inventory
8. **create_change_request** - Request order changes
9. **send_message** - Send order-related message
10. **update_line_booking_status** - Update line status

---

## 🔌 Transport Options

### HTTP Transport (mcpServerHttpAgentic.js)

**Use When:**
- ✅ Building web applications
- ✅ Testing with curl/Postman
- ✅ Remote/network access needed
- ✅ Integrating with /chat interface

**How to Use:**

1. **Start the server:**
   ```bash
   npm start
   ```

2. **Access endpoint:**
   ```
   POST http://localhost:3000/agenticdirect/mcp/sse
   ```

3. **Test with curl:**
   ```bash
   # Health check
   curl http://localhost:3000/agenticdirect/mcp/health

   # Get server info
   curl http://localhost:3000/agenticdirect/mcp/info
   ```

**Integrated in app.js:**
```javascript
import { createAgenticMCPHttpApp } from './mcpServerHttpAgentic.js';

const agenticMcpApp = createAgenticMCPHttpApp();
app.use('/agenticdirect/mcp', agenticMcpApp);
```

---

### stdio Transport (mcpServerAgentic.js)

**Use When:**
- ✅ Integrating with Claude Desktop
- ✅ Using Cline VSCode extension
- ✅ Using Continue VSCode extension
- ✅ Need process-based MCP client

**How to Use:**

1. **For Claude Desktop:**

   Edit your Claude Desktop config:
   ```json
   {
     "mcpServers": {
       "agenticdirect": {
         "command": "node",
         "args": [
           "/Users/sirajworkspace/Desktop/iabtechlab/crawlers/mcp-config/mcpServerAgentic.js"
         ]
       }
     }
   }
   ```

   **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
   **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

2. **Restart Claude Desktop**

3. **Verify in Claude:**
   Type: "What OpenDirect tools do you have?"

   Claude should see all 10 tools!

---

## 📊 Comparison

| Feature | HTTP (mcpServerHttpAgentic.js) | stdio (mcpServerAgentic.js) |
|---------|-------------------------------|---------------------------|
| **Transport** | HTTP/SSE | stdin/stdout |
| **Protocol** | MCP JSON-RPC | MCP JSON-RPC |
| **Claude Desktop** | ❌ No | ✅ Yes |
| **Web Apps** | ✅ Yes | ❌ No |
| **Network Access** | ✅ Yes | ❌ No |
| **Testing** | Easy (curl) | Complex |
| **Started by** | npm start | node mcpServerAgentic.js |

---

## 🧪 Testing

### Test HTTP Transport
```bash
# Start server
npm start

# Test health
curl http://localhost:3000/agenticdirect/mcp/health

# Get info
curl http://localhost:3000/agenticdirect/mcp/info
```

### Test stdio Transport
```bash
# Run directly (will wait for stdin)
node mcpServerAgentic.js

# Or configure in Claude Desktop and use through UI
```

---

## 🛠️ Example Usage

### Create Organization (HTTP)
```bash
curl -X POST http://localhost:3000/agenticdirect/mcp/sse \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "create_organization",
      "arguments": {
        "name": "Acme Advertising",
        "org_type": "Advertiser"
      }
    },
    "id": 1
  }'
```

### Create Organization (Claude Desktop with stdio)
Just ask in Claude:
```
Create a new advertiser organization called "Acme Advertising"
```

Claude will use the `create_organization` tool automatically!

---

## 📋 Resources (9)

Both transports provide access to:

1. `opendirect://organizations` - All organizations
2. `opendirect://accounts` - All accounts
3. `opendirect://orders` - All orders
4. `opendirect://lines` - All line items
5. `opendirect://products` - Available products
6. `opendirect://creatives` - All creatives
7. `opendirect://assignments` - Creative assignments
8. `opendirect://change_requests` - Change requests
9. `opendirect://messages` - Messages

---

## 🎯 Which One Should I Use?

**Use HTTP Transport if:**
- Building a web application
- Need network/remote access
- Testing with curl/Postman
- Integrating with existing /chat interface

**Use stdio Transport if:**
- Using Claude Desktop
- Using Cline/Continue in VSCode
- Need local process-based integration
- Want official MCP client support

**Use Both if:**
- You want maximum flexibility! 🚀

---

## 🔄 Architecture

```
┌─────────────────────────────────────────────────────┐
│         AgenticDirect MCP Server (Shared Logic)     │
│  - 10 OpenDirect v2.1 Tools                         │
│  - 9 Resources                                       │
│  - In-memory Storage                                 │
└────────────┬───────────────────────┬─────────────────┘
             │                       │
    ┌────────▼────────┐     ┌───────▼────────┐
    │  HTTP Transport │     │ stdio Transport │
    │  (Port 3000)    │     │  (stdin/stdout) │
    └────────┬────────┘     └───────┬─────────┘
             │                      │
    ┌────────▼────────┐     ┌──────▼──────────┐
    │   Web Apps      │     │ Claude Desktop  │
    │   curl/Postman  │     │ Cline/Continue  │
    │   REST Clients  │     │ MCP Clients     │
    └─────────────────┘     └─────────────────┘
```

---

## ✅ Status

- ✅ Full OpenDirect v2.1 compliance
- ✅ All 10 tools implemented
- ✅ All 9 resources available
- ✅ HTTP transport working
- ✅ stdio transport working
- ✅ Tested and production-ready

**Ready to use with both transports!** 🎉
