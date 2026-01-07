# OpenDirect A2A Agent System

## Overview

A comprehensive Node.js implementation of an **Agent-to-Agent (A2A) system** compliant with the A2A Protocol v0.3.0. The system features dual AI-powered agents (Buyer and Seller) for OpenDirect advertising operations, with integrated Model Context Protocol (MCP) support for tool execution.

Built on a **clean modular architecture** with 5 independent modules that work together seamlessly.

## 🎯 Key Features

- **🤖 Dual AI Agents** - Autonomous Buyer and Seller agents with natural language understanding
- **📋 A2A Protocol v0.3.0** - Full compliance with agent card discovery, JSON-RPC 2.0, and HTTP+JSON transports
- **🔧 MCP Integration** - 33+ auto-generated tools from OpenDirect schemas
- **🎨 Schema-Driven** - Single source of truth from OpenAPI 3.0 schemas
- **💬 Multi-Provider AI** - Support for OpenAI, Anthropic Claude, and Google Gemini
- **🌐 Web Interface** - Ready-to-use test client for agent interactions

---

## 🚀 Quick Start (5 Minutes)

### Prerequisites

```bash
node >= 18.0.0
npm >= 9.0.0
```

### Installation

```bash
# Clone repository
git clone https://github.com/InteractiveAdvertisingBureau/mcp-config.git
cd mcp-config

# Install dependencies
npm install

# Install test client
cd client-test && npm install && cd ..
```

### Environment Setup

Create `.env` file:

```bash
NODE_ENV=development
PORT=3000

# AI Provider (choose one)
OPENAI_API_KEY=sk-proj-your-key
OPENAI_MODEL=gpt-4o-mini

# Optional: Other providers
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...

# MCP Configuration
DEFAULT_ANALYSIS_MODEL=openai
DEFAULT_CHAT_MODEL=openai
MCP_ENABLE_ADMIN_TOOLS=false
```

**Or use the quick-start script:**
```bash
./quick-start.sh
```

### Start Server

```bash
npm start
# Expected: Server on port 3000, MCP integration with 33 tools
```

### Start Test Client (new terminal)

```bash
cd client-test && npm start
# Expected: Server on http://localhost:8080
```

### Verify

✅ **Agent Card Discovery:**
```bash
curl http://localhost:3000/a2a/buyer/.well-known/agent-card.json | jq
```

✅ **Web Client:**
```
http://localhost:8080
```

✅ **Send test message:**
```
"create an account for Nike"
```

---

## 🏗️ Architecture Layers

### Layer Overview

The system is organized into four distinct layers:

1. **Client Layer** - Web UI (`client-test/`) and A2A-compliant clients communicate via the A2A Protocol v0.3.0 over HTTPS.

2. **A2A Agent Layer** - Express.js server (port 3000) hosting Buyer and Seller agents with multiple transport protocols (JSON-RPC 2.0, HTTP+JSON), dynamic agent card generation, and AI-powered execution.

3. **MCP Layer** - Schema-driven tool generator using OpenAPI 3.0 specs to dynamically create 33+ tools from the OpenDirect schema, with validation and API handlers via Server-Sent Events (SSE) transport.

4. **Schema Layer** - OpenAPI 3.0 specification defining 13 resource types (Account, Order, Line, Product, Creative, etc.), 40+ object definitions, and standardized endpoints with parameters and validations.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  Web Client  │  │Claude Desktop│  │  Test Client │              │
│  │(client-test) │  │  (MCP HTTP)  │  │    (SDK)     │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
└─────────┼──────────────────┼──────────────────┼───────────────────┘
          │                  │                  │
          │ HTTP/JSON        │ SSE              │ HTTP
          │ A2A Protocol     │ MCP Protocol     │ A2A Protocol
          │                  │                  │
┌─────────▼──────────────────▼──────────────────▼───────────────────┐
│                    A2A AGENT LAYER (Port 3000)                      │
│  ┌───────────────────────────────────────────────────────────┐     │
│  │         Client Agent (Orchestrator)                       │     │
│  │  • Autonomous Mode: Auto-selects buyer/seller            │     │
│  │  • Orchestrated Mode: User-directed routing              │     │
│  │  • Session management & conversation history             │     │
│  └─────────────┬────────────────────────┬────────────────────┘     │
│                │                        │                           │
│   ┌────────────▼──────────┐  ┌─────────▼──────────┐               │
│   │   Buyer Agent         │  │   Seller Agent      │               │
│   │  /a2a/buyer           │  │  /a2a/seller        │               │
│   │  ┌─────────────────┐  │  │  ┌─────────────────┐│               │
│   │  │ Agent Card      │  │  │  │ Agent Card      ││               │
│   │  │ - Skills        │  │  │  │ - Skills        ││               │
│   │  │ - Transports    │  │  │  │ - Transports    ││               │
│   │  │ - Examples      │  │  │  │ - Examples      ││               │
│   │  └─────────────────┘  │  │  └─────────────────┘│               │
│   │  Skills:              │  │  Skills:             │               │
│   │  • create_account     │  │  • list_products     │               │
│   │  • create_order       │  │  • search_inventory  │               │
│   │  • search_inventory   │  │  • process_orders    │               │
│   └────────────┬──────────┘  └─────────┬───────────┘               │
└────────────────┼─────────────────────────┼─────────────────────────┘
                 │                         │
                 │ MCP Tool Calls          │ MCP Tool Calls
                 │                         │
┌────────────────▼─────────────────────────▼─────────────────────────┐
│                         MCP LAYER                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ API Testing  │  │  OpenDirect  │  │Schema-Driven │             │
│  │     MCP      │  │     MCP      │  │     MCP      │             │
│  │  /mcp/sse    │  │/agenticdirect│  │ /schema/mcp  │             │
│  │   (8 tools)  │  │  /mcp/sse    │  │   /sse       │             │
│  │              │  │  (10 tools)  │  │  (33 tools)  │             │
│  │  Transport:  │  │  Transport:  │  │  Transport:  │             │
│  │  SSE         │  │  SSE         │  │  SSE         │             │
│  └──────────────┘  └──────────────┘  └──────┬───────┘             │
└─────────────────────────────────────────────┼───────────────────────┘
                                              │
                                              │ Schema Loading
                                              │ & Validation
                                              │
┌─────────────────────────────────────────────▼───────────────────────┐
│                       SCHEMA LAYER                                   │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │          OpenDirect OpenAPI 3.0 Schema                        │  │
│  │          (opendirect-mcp-schema.json)                         │  │
│  │                                                               │  │
│  │  📋 13 Resource Types:                                        │  │
│  │     Account, Order, Line, Product, Creative,                 │  │
│  │     Assignment, Organization, ChangeRequest, Message         │  │
│  │                                                               │  │
│  │  🏗️  40+ Object Definitions:                                  │  │
│  │     - Request/Response schemas                               │  │
│  │     - Validation rules (Zod)                                 │  │
│  │     - Parameter specifications                               │  │
│  │                                                               │  │
│  │  ✅ CRUD Operations: create, get, list, update, delete       │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### System Components

#### Client Layer
- **Web UI** (`client-test/`): Pure HTML/CSS/JavaScript interface
- **A2A Protocol v0.3.0**: Standard agent communication
- **Features**:
  - Agent selection (Buyer/Seller)
  - Connection management
  - Real-time response display
  - Message history and session tracking

#### A2A Agent Layer
- **Dual Agents**: Buyer (`/a2a/buyer`) and Seller (`/a2a/seller`)
- **Agent Card Discovery**: `/.well-known/agent-card.json`
- **Transports**:
  - JSON-RPC 2.0 (`/jsonrpc`)
  - HTTP+JSON (`/rest`)
  - MCP tools integration
- **AI-Powered Execution**: OpenAI GPT for natural language understanding
- **Modes**:
  - Autonomous: Agent auto-selects sub-agents
  - Orchestrated: User-directed routing

#### MCP Layer
- **Schema-Driven Tool Generator**: Processes OpenAPI 3.0 specs
- **Validation**: Zod schemas for runtime parameter checking
- **Tool Registry**:
  - API Testing MCP: 8 tools (register, test, analyze APIs)
  - OpenDirect MCP: 10 tools (manual implementations)
  - Schema-Driven MCP: 33 tools (auto-generated CRUD)
- **Transport**: Server-Sent Events (SSE) for streaming

#### Schema Layer
- **OpenDirect Specification**: OpenAPI 3.0 format
- **13 Resource Types**: Account, Order, Line, Product, Creative, etc.
- **40+ Object Definitions**: Complete request/response schemas
- **Validation Rules**: JSON Schema with Zod transformation

### A2A Protocol Flow

```
┌─────────────┐
│   Client    │  1. User sends message: "create account for Nike"
│  (Web UI)   │
└──────┬──────┘
       │
       │ POST /api/a2a/chat
       │ { message: "create account for Nike" }
       │
       ▼
┌─────────────────────────────────────────────────────┐
│           Client Agent (Orchestrator)                │
│                                                      │
│  2. Analyze message with AI (OpenAI GPT)           │
│     → Determine: Account creation needed            │
│     → Select: Buyer Agent                           │
│     → Extract params: { name: "Nike" }             │
└──────┬──────────────────────────────────────────────┘
       │
       │ 3. Route to Buyer Agent
       │
       ▼
┌─────────────────────────────────────────────────────┐
│              Buyer Agent                             │
│             /a2a/buyer                               │
│                                                      │
│  4. Receive message via JSON-RPC 2.0:               │
│     POST /a2a/buyer/jsonrpc                         │
│     {                                                │
│       "method": "sendMessage",                      │
│       "params": {                                    │
│         "message": "create account for Nike"       │
│       }                                              │
│     }                                                │
└──────┬──────────────────────────────────────────────┘
       │
       │ 5. Execute skill: create_account
       │
       ▼
┌─────────────────────────────────────────────────────┐
│               MCP Layer                              │
│        (Schema-Driven MCP Server)                    │
│                                                      │
│  6. Call MCP tool: create_account                   │
│     POST /schema/mcp/sse                            │
│     {                                                │
│       "method": "tools/call",                       │
│       "params": {                                    │
│         "name": "create_account",                   │
│         "arguments": {                              │
│           "name": "Nike",                           │
│           "type": "advertiser"                      │
│         }                                            │
│       }                                              │
│     }                                                │
│                                                      │
│  7. Validate with Zod schema                        │
│  8. Execute account creation logic                  │
└──────┬──────────────────────────────────────────────┘
       │
       │ 9. Return result
       │ { accountId: "acc_123", name: "Nike", ... }
       │
       ▼
┌─────────────────────────────────────────────────────┐
│              Buyer Agent                             │
│                                                      │
│  10. Format response                                 │
│      "✅ Created account for Nike (ID: acc_123)"   │
└──────┬──────────────────────────────────────────────┘
       │
       │ 11. Return to orchestrator
       │
       ▼
┌─────────────────────────────────────────────────────┐
│         Client Agent (Orchestrator)                  │
│                                                      │
│  12. Add to conversation history                     │
│  13. Publish progress events                         │
└──────┬──────────────────────────────────────────────┘
       │
       │ 14. Return to client
       │ {
       │   response: "✅ Created account...",
       │   data: { accountId: "acc_123", ... }
       │ }
       │
       ▼
┌─────────────┐
│   Client    │  15. Display response to user
│  (Web UI)   │
└─────────────┘
```

**Multi-Step Workflow Example:**

Message: "Create account for Adidas and create order for Adidas with budget $300"

```
Step 1: create_account
  └─> Response: { accountId: "acc_456" }
       │
       ▼
Step 2: create_order
  └─> Input: { accountId: "acc_456", budget: 300 }
  └─> Response: { orderId: "ord_789", accountId: "acc_456" }
```

The orchestrator automatically:
- ✅ Chains multiple operations
- ✅ Passes data between steps (account ID)
- ✅ Maintains conversation context
- ✅ Handles errors gracefully

### Key Components

| Component | File/Module | Purpose |
|-----------|-------------|---------|
| Main Server | `server.js` | Express setup, module orchestration, routing |
| Agent Card | `modules/a2a-protocol/lib/a2aEndpoints.js` | Agent discovery with skills, capabilities, security |
| Agent Executor | `modules/a2a-protocol/lib/agentExecutor.js` | AI-powered tool selection and task management |
| Client Agent | `modules/a2a-protocol/lib/clientAgent.js` | Agent orchestrator (autonomous/orchestrated modes) |
| MCP Server | `modules/schema-driven-mcp/server.js` | Schema-driven tool registry with SSE transport |
| Tool Generator | `modules/schema-driven-mcp/lib/toolGenerator.js` | Auto-generate CRUD tools from schemas |
| Schema Loader | `modules/schema-driven-mcp/lib/schemaLoader.js` | Load and validate OpenAPI schemas |
| Web Client | `client-test/` | HTML/CSS/JS A2A test interface |
| OpenDirect Schema | `opendirect-mcp-schema.json` | OpenAPI 3.0 resource definitions and validations |

---

## 📋 Detailed Layer Descriptions

### 1. Client Layer
- **Web UI** (`client-test/`): Pure HTML/CSS/JS interface
- Direct A2A protocol calls
- Agent selection (Buyer/Seller)
- Real-time monitoring and status updates
- Message streaming support

### 2. A2A Agent Layer
- **Express.js server** (Port 3000)
- **Dual agents**:
  - Buyer: `/a2a/buyer`
  - Seller: `/a2a/seller`
- **Agent card discovery**: `/.well-known/agent-card.json`
- **Skills**: Order creation, campaigns, creative management, product search
- **Multiple transports**: JSON-RPC 2.0, HTTP+JSON, MCP tools
- **AI-powered orchestration**: Natural language → tool mapping

### 3. MCP Layer
- **Schema-driven tool generator** from OpenAPI schemas
- **Input**: OpenDirect OpenAPI 3.0 specification
- **Output**: 33+ executable MCP tools with validation
- **Transport**: Server-Sent Events (SSE) for streaming
- **Tool categories**: CRUD operations, search, validation

### 4. Schema Layer
- **OpenDirect JSON specification** (OpenAPI 3.0)
- **13 resource types**: Account, Order, Line, Product, Creative, etc.
- **40+ object definitions** with full validation schemas
- **Parameter validation** and response schemas

---

## 📂 Project Structure

```
mcp-config/
├── server.js                       # Main entry point (modular architecture)
├── package.json                    # Dependencies
│
├── modules/                        # 5 Independent modules
│   ├── a2a-protocol/              # ⭐ Agent-to-Agent communication
│   │   ├── server.js              # A2A agent orchestrator
│   │   ├── routes/                # Agent endpoints
│   │   └── lib/                   # Agent cards, executors, SDK integration
│   ├── opendirect-mcp/            # OpenDirect MCP implementation
│   ├── schema-driven-mcp/         # Schema-to-tools generator
│   ├── api-testing-mcp/           # API testing & validation
│   └── ai-chat/                   # Multi-provider AI chat
│
├── shared/                         # Shared utilities
│   ├── config/                    # Centralized configuration
│   ├── database/                  # Database connection
│   ├── utils/                     # Logger, UUID, date utilities
│   └── middleware/                # CORS, error handlers
│
├── client/                         # Frontend clients
│   └── standalone/                # AI chat UI
├── client-test/                    # ⭐ A2A test client
│   ├── index.html                 # Web interface
│   ├── app.js                     # Client logic
│   └── style.css                  # Styling
├── client-test-sdk/                # SDK-based test client
│
├── prompts/                        # AI agent prompts
│   ├── buyer/                     # Buyer agent prompts
│   └── seller/                    # Seller agent prompts
│
├── tests/                          # Test resources
│   ├── schemas/                   # Test schemas
│   └── test.sh                    # Module testing script
│
├── opendirect-mcp-schema.json     # OpenDirect schema
├── claude-desktop-config.json     # MCP client configuration
├── quick-start.sh                 # Quick setup script
├── deploy.sh                      # Cloud deployment script
├── Dockerfile                     # Docker configuration
│
└── a2a-agenticdirect-standalone/  # Standalone A2A module
```

---

## 🤖 A2A Agent System

### Agent Card Discovery

Each agent exposes a standard agent card at `/.well-known/agent-card.json`:

```bash
# Buyer Agent Card
curl http://localhost:3000/a2a/buyer/.well-known/agent-card.json

# Seller Agent Card
curl http://localhost:3000/a2a/seller/.well-known/agent-card.json
```

**Agent Card Structure:**
- **Identity**: Name, description, version
- **Skills**: Available operations (create_order, search_products, etc.)
- **Transports**: JSON-RPC 2.0, HTTP+JSON, MCP tools
- **Security**: Authentication requirements
- **Examples**: Sample requests and responses

### Agent Modes

**1. Autonomous Mode** (Default)
- Agent automatically selects appropriate sub-agents
- Natural language understanding
- Multi-step workflow orchestration
- Example: "Create order for Nike" → Agent calls buyer agent with correct tools

**2. Orchestrated Mode**
- User manually selects target agent
- Direct agent communication
- More control over agent selection

### Agent Communication Endpoints

#### JSON-RPC 2.0 Transport
```bash
POST /a2a/{agent}/jsonrpc
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "sendMessage",
  "params": {
    "message": "create an account for Nike",
    "context": {}
  },
  "id": 1
}
```

#### HTTP+JSON Transport
```bash
POST /a2a/{agent}/rest
Content-Type: application/json

{
  "message": "search for video ad products",
  "sessionId": "optional-session-id"
}
```

#### Client Agent API
```bash
# Send message to orchestrator
POST /api/a2a/chat

# Get conversation history
GET /api/a2a/chat/:sessionId/history

# Clear conversation
DELETE /api/a2a/chat/:sessionId

# Get progress events
GET /api/a2a/chat/:sessionId/progress

# Set/get agent mode
POST /api/a2a/mode
GET /api/a2a/mode
```

---

## 🔧 Available Modules

### ⭐ 1. A2A Protocol (Primary Feature)

**Purpose**: Agent-to-agent communication using official `@a2a-js/sdk` with AI orchestration.

**Endpoints**:
- `/a2a/agents` - Agent discovery
- `/a2a/buyer/.well-known/agent-card.json` - Buyer agent card
- `/a2a/seller/.well-known/agent-card.json` - Seller agent card
- `/api/a2a/chat` - Client agent chat
- `/api/a2a/mode` - Set orchestration mode

**Agent Skills**:

**Buyer Agent:**
- Create and manage accounts
- Create advertising orders
- Manage campaigns and budgets
- Search for ad inventory
- Assign creatives to placements

**Seller Agent:**
- List available products
- Process orders
- Manage inventory
- Handle change requests

**Key Features**:
- ✅ Agent card auto-generation with skills, examples, security
- ✅ Multiple transports: JSON-RPC 2.0, HTTP+JSON, MCP tools
- ✅ AI-powered natural language understanding (OpenAI GPT)
- ✅ Autonomous and orchestrated modes
- ✅ Session management and conversation history
- ✅ Progress tracking and streaming responses

---

### 2. OpenDirect MCP

**Purpose**: Advertising operations following OpenDirect v2.1 specification.

**Endpoints**: `/agenticdirect/mcp/sse`

**Tools** (10 core operations):
- Organization, Account, Order, Line, Creative management
- Product search and inventory queries
- Change requests and messaging

---

### 3. Schema-Driven MCP

**Purpose**: Auto-generate MCP tools from OpenAPI schemas with runtime validation.

**Endpoints**: `/schema/mcp/sse`

**Tools** (33+ auto-generated):
- CRUD operations for all OpenDirect resources
- Runtime JSON Schema validation
- Hot-reload capability without server restart
- Sandbox testing environment

**Schema Management API**:
```bash
POST /api/schema/register      # Register custom schema
POST /api/schema/fetch-url     # Fetch schema from URL
POST /api/schema/reset         # Reset to default
POST /api/schema/test-tool     # Test tool in sandbox
GET  /api/schema/current       # Get current schema
GET  /api/schema/history       # Get registration history
```

---

### 4. API Testing MCP

**Purpose**: Test and validate REST APIs with AI analysis.

**Endpoints**: `/mcp/sse`

**Tools**: Register APIs, test endpoints, generate AI-powered analysis and test scenarios.

---

### 5. AI Chat

**Purpose**: Multi-provider AI chat with MCP integration.

**Endpoints**: `/chat`

**Providers**: Anthropic Claude, OpenAI GPT, Google Gemini

---

## 🧪 Testing

### Test Agent Card Discovery

```bash
curl http://localhost:3000/a2a/buyer/.well-known/agent-card.json | jq
```

**Expected Response:**
```json
{
  "name": "OpenDirect Buyer Agent",
  "version": "1.0.0",
  "skills": [
    {
      "name": "create_account",
      "description": "Create a new buyer account",
      "parameters": { ... }
    }
  ],
  "transports": [
    {
      "type": "jsonrpc",
      "version": "2.0",
      "endpoint": "/a2a/buyer/jsonrpc"
    }
  ]
}
```

### Test JSON-RPC Message

```bash
curl -X POST http://localhost:3000/a2a/buyer/jsonrpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "sendMessage",
    "params": {
      "message": "create an account for Nike"
    },
    "id": 1
  }' | jq
```

### Test MCP Tools

```bash
# List available MCP tools
curl http://localhost:3000/schema/mcp/tools | jq '.tools[].name'

# Test MCP health
curl http://localhost:3000/schema/mcp/health
curl http://localhost:3000/agenticdirect/mcp/health
curl http://localhost:3000/mcp/health
```

### Run All Module Tests

```bash
./tests/test.sh
```

---

## 💬 Common Test Scenarios

### Buyer Agent Examples

```bash
# Account creation
"create an account for Nike"

# Order creation
"create an order for Adidas with budget $50000"

# Inventory search
"search for video ad inventory"

# Campaign setup
"create a campaign for summer sale targeting 25-34 age group"
```

### Seller Agent Examples

```bash
# Product listing
"list available products"

# Inventory search
"search for premium ad space"

# Order processing
"process order for account ABC"

# Change requests
"handle change request for order 12345"
```

---

## 🔌 Claude Desktop Integration

### HTTP Transport (Recommended)

Create `claude-desktop-config.json`:

```json
{
  "mcpServers": {
    "api-testing-mcp": {
      "url": "http://localhost:3000/mcp/sse",
      "transport": "http"
    },
    "opendirect-mcp": {
      "url": "http://localhost:3000/agenticdirect/mcp/sse",
      "transport": "http"
    },
    "schema-driven-mcp": {
      "url": "http://localhost:3000/schema/mcp/sse",
      "transport": "http"
    }
  }
}
```

---

## 🐳 Docker Deployment

```bash
# Build image
docker build -t mcp-config .

# Run container
docker run -p 3000:3000 \
  -e PORT=3000 \
  -e OPENAI_API_KEY=sk-proj-... \
  -e OPENAI_MODEL=gpt-4o-mini \
  mcp-config
```

---

## ☁️ Cloud Run Deployment

```bash
# Deploy to Google Cloud Run
./deploy.sh

# Or manually
gcloud run deploy mcp-config \
  --source . \
  --platform managed \
  --region us-east4 \
  --allow-unauthenticated
```

---

## 🛠️ Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 3000 in use | `lsof -i :3000` then `kill -9 <PID>` |
| Missing API key | Verify `.env` contains `OPENAI_API_KEY` |
| Server not responding | `curl http://localhost:3000/mcp/health` |
| Client connection fails | Confirm server running, check CORS |
| Agent card 404 | Check `/a2a/buyer/.well-known/agent-card.json` |
| MCP tools not loading | Verify schema loaded: `GET /api/schema/current` |

### Debug Mode

```bash
# Enable debug logging
NODE_ENV=development node server.js

# Check server logs
tail -f /tmp/server-test.log

# Test each module independently
curl http://localhost:3000/mcp/health
curl http://localhost:3000/agenticdirect/mcp/health
curl http://localhost:3000/schema/mcp/health
curl http://localhost:3000/a2a/agents
```

---

## 📚 API Reference

### Health Endpoints

```bash
GET /mcp/health                     # API Testing MCP
GET /agenticdirect/mcp/health       # OpenDirect MCP
GET /schema/mcp/health              # Schema-Driven MCP
GET /a2a/agents                     # A2A Protocol
GET /api/ai-health                  # AI Chat
```

### Agent Endpoints

```bash
GET  /a2a/agents                                         # List agents
GET  /a2a/{agent}/.well-known/agent-card.json           # Agent card
POST /a2a/{agent}/jsonrpc                               # JSON-RPC 2.0
POST /a2a/{agent}/rest                                  # HTTP+JSON
POST /api/a2a/chat                                      # Client chat
GET  /api/a2a/chat/:sessionId/history                   # History
POST /api/a2a/mode                                      # Set mode
```

### MCP Endpoints

```bash
POST /mcp/sse                       # API Testing MCP (SSE)
POST /agenticdirect/mcp/sse         # OpenDirect MCP (SSE)
POST /schema/mcp/sse                # Schema-Driven MCP (SSE)

GET  /schema/mcp/tools              # List generated tools
GET  /schema/mcp/resources          # List resources
```

---

## ✅ Verification Checklist

After setup, verify:

- ✅ Server running on `http://localhost:3000`
- ✅ Test client running on `http://localhost:8080`
- ✅ Agent cards accessible:
  - `http://localhost:3000/a2a/buyer/.well-known/agent-card.json`
  - `http://localhost:3000/a2a/seller/.well-known/agent-card.json`
- ✅ MCP endpoints healthy:
  - `http://localhost:3000/mcp/health`
  - `http://localhost:3000/schema/mcp/health`
- ✅ Messages sent/received successfully via web client
- ✅ Response data displayed as JSON
- ✅ Multi-step workflows execute sequentially

---

## 🎨 Architecture Benefits

1. **Protocol Compliance** - Full A2A v0.3.0 support with agent cards
2. **Scalability** - Modular design allows independent scaling
3. **Extensibility** - Schema-driven tool generation from OpenAPI
4. **Maintainability** - Clear separation of concerns across modules
5. **AI-Powered** - Natural language understanding with multiple AI providers
6. **Interoperability** - Standard MCP protocol for tool execution

---

## 🚀 Next Steps

1. **Explore Agent Cards** - Review buyer and seller capabilities
2. **Test with Web Client** - Use `http://localhost:8080` for interactive testing
3. **Review MCP Tools** - Check `/schema/mcp/tools` for available operations
4. **Integrate with Claude** - Use HTTP transport configuration
5. **Deploy to Production** - Use `deploy.sh` for Cloud Run deployment
6. **Customize Agents** - Modify prompts in `prompts/buyer/` and `prompts/seller/`

---

## 📚 Resources

- **A2A Protocol**: [https://a2a-protocol.org/v0.3.0/specification/](https://a2a-protocol.org/v0.3.0/specification/)
- **OpenDirect Spec**: [https://www.iab.com/guidelines/opendirect/](https://www.iab.com/guidelines/opendirect/)
- **MCP Protocol**: [https://modelcontextprotocol.io/](https://modelcontextprotocol.io/)
- **JSON-RPC 2.0**: [https://www.jsonrpc.org/specification](https://www.jsonrpc.org/specification)
- **IABTechLab MCP Server**: [https://mcpclient.iabtechlab.com](https://mcpclient.iabtechlab.com)
