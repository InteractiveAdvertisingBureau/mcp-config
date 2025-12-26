# MCP Config - Multi-Feature AI Platform

An advanced AI-powered platform with MCP (Model Context Protocol) integration, OpenDirect v2.1 support, multi-provider AI chat, and comprehensive API testing capabilities.

## 🎯 Overview

This project provides:
- **OpenDirect MCP Servers** - Both manual and schema-driven MCP implementations
- **Multi-Provider AI Chat** - Integrated chat with Claude, OpenAI, and Gemini
- **MCP Client Integration** - Connect to any MCP server with AI-powered chat
- **API Testing System** - Register, test, and analyze APIs
- **AI Features** - Auto-fill, pattern detection, and intelligent analysis

---

## 🚀 Quick Start

### Prerequisites
```bash
# Node.js 18+ required
node --version

# Install dependencies
npm install
```

### Environment Setup
Create `.env` file in root:
```env
# Database
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=mcp_api_testing

# AI Providers (at least one required)
ANTHROPIC_API_KEY=your_anthropic_key_here
OPENAI_API_KEY=your_openai_key_here
GOOGLE_API_KEY=your_google_key_here
```

### Start the Main Server
```bash
npm start
# Server runs on http://localhost:3000
```

---

## 📦 Available Modules & Endpoints

### 1. **Main Web Application**
**Start:** `npm start` (port 3000)

**Endpoints:**
- `/` - Home page
- `/register` - API registration interface
- `/chat` - Multi-provider AI chat interface
- `/mcp-client` - MCP client chat interface
- `/api/*` - API testing endpoints

**Features:**
- API registration and testing
- Multi-scenario testing
- Performance analytics
- AI-powered analysis

---

### 2. **OpenDirect MCP Servers**

#### **A. Manual MCP Server (10 Tools)**
**Start:** `npm run mcp:agentic`

**Type:** stdio transport (for Claude Desktop)

**Tools:** 10 manually crafted OpenDirect v2.1 tools
- `create_organization`
- `create_account`
- `create_order`
- `create_line`
- `create_creative`
- `create_assignment`
- `search_products`
- `create_change_request`
- `send_message`
- `update_booking_status`

**Documentation:** [docs/AGENTICDIRECT_MCP.md](./docs/AGENTICDIRECT_MCP.md)

**Claude Desktop Config:**
```json
{
  "mcpServers": {
    "agenticdirect": {
      "command": "node",
      "args": ["/absolute/path/to/mcpServerAgentic.js"]
    }
  }
}
```

---

#### **B. Schema-Driven MCP Server (33 Tools)**
**Start HTTP:** `npm run mcp:schema` (port 3000)
**Start stdio:** `npm run mcp:schema-stdio`

**Type:** HTTP or stdio transport

**Tools:** 33 auto-generated CRUD tools with validation
- Account: create, get, list, update
- Order: create, get, list, update
- Line: create, get, list, update
- Creative: create, get, list, update
- Assignment: create, get, list, delete
- Organization: create, get, list, update
- Product: get, list, search
- ChangeRequest: create, get, list
- Message: create, get, list

**Features:**
- ✅ Auto-generated from OpenDirect v2.1 schemas
- ✅ Runtime validation against spec
- ✅ Single source of truth (schema files)

**Documentation:** [docs/SCHEMA_DRIVEN_GUIDE.md](./docs/SCHEMA_DRIVEN_GUIDE.md)

**Endpoints (when running `npm start`):**
- SSE: `http://localhost:3000/schema/mcp/sse`
- Health: `http://localhost:3000/schema/mcp/health`
- Info: `http://localhost:3000/schema/mcp/info`
- **REST API (Python client compatible):**
  - `GET /schema/mcp/tools` - List all tools
  - `POST /schema/mcp/tools/:tool_name` - Execute a tool
  - `GET /schema/mcp/resources` - List all resources
  - `GET /schema/mcp/resources/:resource_type` - Get resource data

**REST API Examples:**
```bash
# List all tools
curl http://localhost:3000/schema/mcp/tools

# Create an organization
curl -X POST http://localhost:3000/schema/mcp/tools/create_organization \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Advertiser Inc", "contacts": [{"email": "test@example.com", "name": "John Doe"}]}'

# Get all organizations
curl http://localhost:3000/schema/mcp/resources/organizations
```

**Claude Desktop Config (stdio):**
```json
{
  "mcpServers": {
    "opendirect-schema": {
      "command": "node",
      "args": ["/absolute/path/to/mcpServerSchemaDrivenStdio.js"]
    }
  }
}
```

---

### 3. **Multi-Provider AI Chat**

**Access:** `http://localhost:3000/chat`

**Features:**
- Switch between Claude (Anthropic), GPT-4 (OpenAI), and Gemini (Google)
- Context-aware conversations
- Message history
- Real-time streaming responses
- Provider status indicators

**API Endpoints:**
- `POST /ai/chat` - Send chat message
- `GET /ai/providers` - List available providers
- `POST /ai/switch-provider` - Switch AI provider

**Documentation:**
- [docs/AI-CHAT-QUICKSTART.md](./docs/AI-CHAT-QUICKSTART.md)
- [docs/AI-CHAT-MULTI-PROVIDER.md](./docs/AI-CHAT-MULTI-PROVIDER.md)

---

### 4. **MCP Client Integration**

**Access:** `http://localhost:3000/mcp-client`

**Features:**
- Connect to any MCP server
- Chat with AI using MCP tools
- View available tools and resources
- Test MCP tool execution
- Connection management

**API Endpoints:**
- `POST /mcp/connect` - Connect to MCP server
- `POST /mcp/disconnect` - Disconnect from server
- `GET /mcp/tools` - List available tools
- `POST /mcp/call-tool` - Execute MCP tool
- `POST /mcp/chat` - AI chat with MCP context

**Documentation:** [docs/MCP_INTEGRATION_GUIDE.md](./docs/MCP_INTEGRATION_GUIDE.md)

---

## 🛠️ NPM Scripts

### **Main Server**
```bash
npm start              # Start main web application (port 3000)
npm run dev            # Start with auto-reload
```

### **MCP Servers**
```bash
npm run mcp:agentic         # Manual MCP server (stdio)
npm run mcp:schema          # Schema-driven MCP (HTTP)
npm run mcp:schema-stdio    # Schema-driven MCP (stdio)
```

### **Testing**
```bash
npm test               # Run MCP connection tests
npm run test:mcp       # Test MCP functionality
```

### **Utilities**
```bash
npm run setup-auth     # Interactive API key setup
```

---

## 📊 Database Setup

### Create Database
```bash
mysql -u root -p
CREATE DATABASE mcp_api_testing;
exit;
```

### Run Schema
```bash
mysql -u root -p mcp_api_testing < database/schema.sql
```

### Tables
- `apis` - Registered APIs
- `test_results` - Test execution results
- `api_stats` - Performance statistics
- `ai_metadata` - AI analysis metadata

---

## 🔗 Key Endpoints Reference

### **Web Interface**
| Path | Description |
|------|-------------|
| `http://localhost:3000/` | Home page |
| `http://localhost:3000/register` | API registration |
| `http://localhost:3000/chat` | Multi-provider AI chat |
| `http://localhost:3000/mcp-client` | MCP client interface |

### **API Testing**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/register` | POST | Register new API |
| `/api/apis` | GET | List all APIs |
| `/api/test/:id` | POST | Test API with scenarios |
| `/api/test/:id/results` | GET | Get test results |
| `/api/stats/:id` | GET | Get API statistics |

### **AI Chat**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/ai/chat` | POST | Send chat message |
| `/ai/providers` | GET | List available providers |
| `/ai/switch-provider` | POST | Switch AI provider |

### **MCP Client**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp/connect` | POST | Connect to MCP server |
| `/mcp/disconnect` | POST | Disconnect from server |
| `/mcp/tools` | GET | List available tools |
| `/mcp/call-tool` | POST | Execute MCP tool |
| `/mcp/chat` | POST | AI chat with MCP |

### **Schema-Driven MCP (when running HTTP mode)**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/agenticdirect/mcp/sse` | GET | SSE endpoint for MCP |
| `/agenticdirect/mcp/message` | POST | Message endpoint |
| `/agenticdirect/health` | GET | Health check |

---

## 📚 Documentation

All documentation is located in the `docs/` directory:

### **Getting Started**
- [docs/INDEX.md](./docs/INDEX.md) - Documentation index and navigation

### **MCP Servers**
- [docs/AGENTICDIRECT_MCP.md](./docs/AGENTICDIRECT_MCP.md) - Manual MCP server (10 tools)
- [docs/SCHEMA_DRIVEN_GUIDE.md](./docs/SCHEMA_DRIVEN_GUIDE.md) - Schema-driven MCP (33 tools)
- [docs/CLAUDE_DESKTOP_SETUP.md](./docs/CLAUDE_DESKTOP_SETUP.md) - Claude Desktop integration

### **AI Chat**
- [docs/AI-CHAT-QUICKSTART.md](./docs/AI-CHAT-QUICKSTART.md) - Quick start guide
- [docs/AI-CHAT-MULTI-PROVIDER.md](./docs/AI-CHAT-MULTI-PROVIDER.md) - Multi-provider setup
- [docs/CHAT_IMPLEMENTATION.md](./docs/CHAT_IMPLEMENTATION.md) - Implementation details

### **MCP Integration**
- [docs/MCP_INTEGRATION_GUIDE.md](./docs/MCP_INTEGRATION_GUIDE.md) - Complete integration guide
- [docs/MCP-PROXY-REFACTORING.md](./docs/MCP-PROXY-REFACTORING.md) - Proxy architecture

### **AI Features**
- [docs/AI_AUTO_FILL_FEATURE.md](./docs/AI_AUTO_FILL_FEATURE.md) - Auto-fill functionality
- [docs/INTELLIGENT_PATTERN_DETECTION.md](./docs/INTELLIGENT_PATTERN_DETECTION.md) - Pattern detection
- [docs/AI_ANALYSIS_GUIDE.md](./docs/AI_ANALYSIS_GUIDE.md) - AI analysis capabilities

### **Other**
- [docs/Architecture.md](./docs/Architecture.md) - System architecture
- [docs/UI_GUIDE.md](./docs/UI_GUIDE.md) - UI guide
- [docs/TEST_RESULTS.md](./docs/TEST_RESULTS.md) - Test results

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser Interface                        │
│  /register  |  /chat  |  /mcp-client  |  /                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────────┐
│                   Express Server (port 3000)                 │
│  ┌─────────────┬──────────────┬───────────────────────┐    │
│  │ API Testing │  AI Chat     │  MCP Client           │    │
│  │ Module      │  Multi-Prov  │  Integration          │    │
│  └─────────────┴──────────────┴───────────────────────┘    │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
┌───────▼──────┐ ┌────▼─────┐ ┌─────▼──────────┐
│   MySQL DB   │ │ AI APIs  │ │ MCP Servers    │
│              │ │ (Claude, │ │ (stdio/HTTP)   │
│ - APIs       │ │  OpenAI, │ │ - AgenticDirect│
│ - Results    │ │  Gemini) │ │ - Schema-Driven│
│ - Stats      │ │          │ │                │
└──────────────┘ └──────────┘ └────────────────┘
```

---

## 🔧 Configuration Files

### **Claude Desktop**
Location: `~/.config/claude/claude_desktop_config.json` (macOS/Linux)

Example configuration:
```json
{
  "mcpServers": {
    "agenticdirect": {
      "command": "node",
      "args": ["/path/to/mcpServerAgentic.js"]
    },
    "opendirect-schema": {
      "command": "node",
      "args": ["/path/to/mcpServerSchemaDrivenStdio.js"]
    }
  }
}
```

### **Environment Variables**
See `.env.example` for all available options.

---

## 🧪 Testing

### Test MCP Connection
```bash
npm test
# or
npm run test:mcp
```

### Manual Testing
```bash
# Start schema-driven server
npm run mcp:schema

# Test health endpoint
curl http://localhost:3000/agenticdirect/health

# Expected response:
# {"status":"healthy","server":"schema-driven-mcp","tools":9,"timestamp":"..."}
```

---

## 📈 Features by Module

### **API Testing**
- ✅ REST API registration
- ✅ Multi-scenario testing
- ✅ Performance metrics
- ✅ AI-powered analysis
- ✅ MySQL persistence

### **AI Chat**
- ✅ Multi-provider support (Claude, GPT-4, Gemini)
- ✅ Context-aware conversations
- ✅ Streaming responses
- ✅ Provider switching
- ✅ Message history

### **MCP Integration**
- ✅ Connect to any MCP server
- ✅ Tool discovery and execution
- ✅ Resource management
- ✅ AI-powered chat with tools
- ✅ stdio and HTTP transports

### **OpenDirect MCP**
- ✅ OpenDirect v2.1 compliant
- ✅ 10 manual tools or 33 auto-generated
- ✅ Schema validation
- ✅ In-memory storage (ready for DB)
- ✅ Both stdio and HTTP modes

---

## 🤝 Integration Examples

### Connect to Schema-Driven MCP from Client
```javascript
// In browser or Node.js
const response = await fetch('http://localhost:3000/mcp/connect', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'http://localhost:3000/agenticdirect/mcp/sse'
  })
});
```

### Chat with AI + MCP Tools
```javascript
const response = await fetch('http://localhost:3000/mcp/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Create a new organization called Acme Corp'
  })
});
```

---

## 🔐 Security Notes

- Store API keys in `.env` file (never commit to git)
- `.env` is in `.gitignore`
- Use environment-specific API keys
- Rotate keys regularly
- Keep dependencies updated

---

## 📝 License

MIT

## 👤 Author

**Siraj M** - IAB Tech Lab

---

## 🆘 Support

- **Documentation:** See `docs/` directory
- **Issues:** Create an issue on GitHub
- **Questions:** Check documentation index at `docs/INDEX.md`

---

**Last Updated:** December 23, 2025
