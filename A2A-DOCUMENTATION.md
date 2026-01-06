# OpenDirect A2A Agent System Documentation

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [System Components](#system-components)
3. [A2A Protocol Flow](#a2a-protocol-flow)
4. [Setup & Installation](#setup--installation)
5. [Running Locally](#running-locally)
6. [Testing the System](#testing-the-system)
7. [API Reference](#api-reference)
8. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────────┐           ┌──────────────────────┐                │
│  │  Web Client UI       │           │  Any A2A Client      │                │
│  │  (client-test)       │           │  (@a2a-js/sdk)       │                │
│  │                      │           │                      │                │
│  │  - HTML/CSS/JS       │           │  - JavaScript SDK    │                │
│  │  - Direct A2A Calls  │           │  - Protocol Compliant│                │
│  └──────────────────────┘           └──────────────────────┘                │
│           │                                   │                               │
│           │  HTTPS                            │  HTTPS                       │
│           │  A2A Protocol v0.3.0              │  A2A Protocol v0.3.0         │
│           └───────────────┬───────────────────┘                              │
│                           │                                                   │
└───────────────────────────┼───────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          A2A AGENT LAYER                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    A2A Agent Server (Express.js)                       │ │
│  │                    Port: 3000 (local)                                  │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │                                                                          │ │
│  │  ┌──────────────────┐                    ┌──────────────────┐          │ │
│  │  │  Buyer Agent     │                    │  Seller Agent    │          │ │
│  │  │  /a2a/buyer      │                    │  /a2a/seller     │          │ │
│  │  ├──────────────────┤                    ├──────────────────┤          │ │
│  │  │ Agent Card       │                    │ Agent Card       │          │ │
│  │  │ ├─ Discovery     │                    │ ├─ Discovery     │          │ │
│  │  │ ├─ Skills        │                    │ ├─ Skills        │          │ │
│  │  │ ├─ Examples      │                    │ ├─ Examples      │          │ │
│  │  │ └─ Security      │                    │ └─ Security      │          │ │
│  │  │                  │                    │                  │          │ │
│  │  │ Transports:      │                    │ Transports:      │          │ │
│  │  │ ├─ JSON-RPC 2.0  │                    │ ├─ JSON-RPC 2.0  │          │ │
│  │  │ ├─ HTTP+JSON     │                    │ ├─ HTTP+JSON     │          │ │
│  │  │ └─ MCP Tools     │                    │ └─ MCP Tools     │          │ │
│  │  │                  │                    │                  │          │ │
│  │  │ Skills:          │                    │ Skills:          │          │ │
│  │  │ • Campaign       │                    │ • Product Search │          │ │
│  │  │ • Orders         │                    │ • Inventory      │          │ │
│  │  │ • Creative       │                    │ • Order Process  │          │ │
│  │  │ • Discovery      │                    │ • Approval       │          │ │
│  │  └────────┬─────────┘                    └────────┬─────────┘          │ │
│  │           │                                       │                     │ │
│  │           └───────────────┬───────────────────────┘                     │ │
│  │                           │                                              │ │
│  │                           ▼                                              │ │
│  │              ┌─────────────────────────┐                                │ │
│  │              │  Agent Executor         │                                │ │
│  │              │  (OpenDirectExecutor)   │                                │ │
│  │              ├─────────────────────────┤                                │ │
│  │              │ • AI-Powered (OpenAI)   │                                │ │
│  │              │ • Tool Selection        │                                │ │
│  │              │ • Task Management       │                                │ │
│  │              │ • Event Publishing      │                                │ │
│  │              └───────────┬─────────────┘                                │ │
│  │                          │                                               │ │
│  └──────────────────────────┼───────────────────────────────────────────────┘ │
│                             │                                                 │
└─────────────────────────────┼─────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MCP LAYER                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │              MCP Server (Model Context Protocol)                       │ │
│  │              Transport: SSE (Server-Sent Events)                       │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │                                                                          │ │
│  │  ┌────────────────────────────────────────────────────────────────┐    │ │
│  │  │  Schema-Driven Tool Generator                                  │    │ │
│  │  │  (mcpServerSchemaDriven.js)                                    │    │ │
│  │  ├────────────────────────────────────────────────────────────────┤    │ │
│  │  │                                                                 │    │ │
│  │  │  Input: opendirect.json (OpenAPI 3.0)                          │    │ │
│  │  │         ↓                                                       │    │ │
│  │  │  Schema Parser → Extracts:                                     │    │ │
│  │  │    • Tools (33 OpenDirect operations)                          │    │ │
│  │  │    • Resources (13 resource types)                             │    │ │
│  │  │    • Schemas (40 object definitions)                           │    │ │
│  │  │         ↓                                                       │    │ │
│  │  │  Tool Generator → Creates:                                     │    │ │
│  │  │    • CRUD operations (200 tools)                               │    │ │
│  │  │    • Validation logic (Zod schemas)                            │    │ │
│  │  │    • API handlers                                              │    │ │
│  │  │                                                                 │    │ │
│  │  └────────────────────────────────────────────────────────────────┘    │ │
│  │                             │                                            │ │
│  │                             ▼                                            │ │
│  │  ┌────────────────────────────────────────────────────────────────┐    │ │
│  │  │  MCP Tools Registry                                            │    │ │
│  │  ├────────────────────────────────────────────────────────────────┤    │ │
│  │  │                                                                 │    │ │
│  │  │  Buyer Tools:              Seller Tools:                       │    │ │
│  │  │  • create_account          • search_products                   │    │ │
│  │  │  • create_order             • create_product                   │    │ │
│  │  │  • create_line              • update_product                   │    │ │
│  │  │  • create_creative          • process_order                    │    │ │
│  │  │  • search_products          • approve_creative                 │    │ │
│  │  │  • get_account              • get_product                      │    │ │
│  │  │  • update_account           • list_products                    │    │ │
│  │  │  • ... (33 total tools)     • ... (33 total tools)             │    │ │
│  │  │                                                                 │    │ │
│  │  └────────────────────────────────────────────────────────────────┘    │ │
│  │                                                                          │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘

                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SCHEMA LAYER                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌────────────────────┐                                                      │
│  │  OpenDirect Schema │                                                      │
│  │  (opendirect.json) │                                                      │
│  ├────────────────────┤                                                      │
│  │                    │                                                      │
│  │  OpenAPI 3.0 Spec  │                                                      │
│  │  ├─ API Endpoints  │                                                      │
│  │  ├─ Object Schemas │                                                      │
│  │  ├─ Parameters     │                                                      │
│  │  ├─ Responses      │                                                      │
│  │  └─ Validations    │                                                      │
│  │                    │                                                      │
│  │  Resources:        │                                                      │
│  │  • Account         │                                                      │
│  │  • Order           │                                                      │
│  │  • Line            │                                                      │
│  │  • Product         │                                                      │
│  │  • Creative        │                                                      │
│  │  • Organization    │                                                      │
│  │  • ... (13 types)  │                                                      │
│  │                    │                                                      │
│  └────────────────────┘                                                      │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## System Components

### 1. **Client Layer**

#### Web Client UI (`client-test/`)
- **Technology**: Pure HTML, CSS, JavaScript
- **Purpose**: Direct interface for testing A2A agents
- **Features**:
  - Agent selection (Buyer/Seller)
  - Connection management
  - Message sending via A2A protocol
  - Task monitoring
  - Real-time status updates
- **Protocol**: A2A v0.3.0 compliant
- **Deployment**: Static files served via http-server

### 2. **A2A Agent Layer**

#### A2A Agent Server (`server.js`, `app.js`)
- **Technology**: Node.js 20, Express.js
- **Port**: 3000 (local)
- **Protocol**: A2A v0.3.0
- **Components**:
  - Dual agent system (Buyer & Seller)
  - Multiple transport protocols
  - Dynamic agent card generation
  - AI-powered task execution

#### Agent Card Discovery (`lib/a2a/sdkRouter.js`)
**Standard Endpoint**: `/.well-known/agent-card.json`

The agent card is the A2A protocol's discovery mechanism. It describes:

```json
{
  "name": "opendirect-buyer-agent",
  "protocolVersion": "0.3.0",
  "url": "https://mcpclient.iabtechlab.com/a2a/buyer",
  "version": "1.0.0",

  "skills": [
    {
      "id": "order-creation",
      "name": "Order Creation",
      "description": "Create and manage advertising orders",
      "tags": ["advertising", "order", "creation"],
      "examples": [
        "Create an account for Nike",
        "Create an order for Adidas campaign",
        "Set up a new advertiser account"
      ],
      "inputModes": ["application/json"],
      "outputModes": ["application/json"]
    }
  ],

  "capabilities": {
    "pushNotifications": false,
    "streaming": true,
    "mcpIntegration": true
  },

  "securitySchemes": {
    "oauth2": {
      "type": "oauth2",
      "description": "OAuth 2.0 authentication",
      "flows": {
        "clientCredentials": {
          "tokenUrl": "https://mcpclient.iabtechlab.com/oauth/token",
          "scopes": {
            "opendirect:read": "Read access to OpenDirect resources",
            "opendirect:write": "Write access to OpenDirect resources"
          }
        }
      }
    }
  },

  "security": [
    {"oauth2": ["opendirect:read", "opendirect:write"]}
  ],

  "additionalInterfaces": [
    {
      "protocol": "jsonrpc",
      "version": "2.0",
      "transport": "http",
      "url": "https://mcpclient.iabtechlab.com/a2a/buyer/jsonrpc"
    },
    {
      "protocol": "http+json",
      "version": "1.0",
      "transport": "http",
      "url": "https://mcpclient.iabtechlab.com/a2a/buyer/rest"
    },
    {
      "protocol": "mcp",
      "version": "2024-11-05",
      "transport": "sse",
      "tools": ["create_account", "create_order", "..."]
    }
  ]
}
```

**Key Features:**
- **Auto-detection**: URLs automatically adapt to deployment environment
- **Examples**: Help AI understand when to delegate (critical for host agents)
- **Multi-protocol**: Supports JSON-RPC, HTTP+JSON, and MCP
- **Security**: OAuth2 configuration (ready for implementation)

#### Agent Executor (`lib/a2a/agentExecutor.js`)
- **AI Model**: OpenAI GPT-4o-mini
- **Responsibilities**:
  1. Parse natural language requests
  2. Select appropriate MCP tools
  3. Generate tool parameters
  4. Execute tools
  5. Manage task lifecycle
  6. Publish events

### 3. **MCP Layer**

#### Schema-Driven MCP Server (`mcpServerSchemaDriven.js`)

**Purpose**: Transform OpenDirect API specification into executable tools

**Process**:
```
1. Load opendirect.json (OpenAPI 3.0)
   ↓
2. Parse Schema
   • Extract paths (API endpoints)
   • Extract operations (GET, POST, PUT, DELETE)
   • Extract schemas (object definitions)
   • Extract parameters and responses
   ↓
3. Generate Tools
   For each operation:
   • Create tool definition
   • Generate Zod validation schema
   • Create execution handler
   • Register with MCP server
   ↓
4. Expose Tools
   • Via MCP protocol (SSE transport)
   • Available to Agent Executor
   • Callable from A2A agents
```

**Example Tool Generation**:
```javascript
// From opendirect.json:
{
  "paths": {
    "/accounts": {
      "post": {
        "operationId": "create_account",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/Account"
              }
            }
          }
        }
      }
    }
  }
}

// Generates MCP tool:
{
  name: "create_account",
  description: "Create a new account",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string" },
      type: { type: "string" },
      buyerId: { type: "string" }
    },
    required: ["name"]
  }
}
```

#### MCP Tool Registry
**Total Tools**: 33 OpenDirect operations

**Buyer Tools**:
- Account Management: `create_account`, `get_account`, `update_account`
- Order Management: `create_order`, `get_order`, `update_order`
- Line Management: `create_line`, `update_line`
- Creative Management: `create_creative`, `get_creative`
- Product Discovery: `search_products`, `get_product`

**Seller Tools**:
- Product Management: `create_product`, `update_product`, `list_products`
- Order Processing: `process_order`, `approve_order`
- Creative Approval: `approve_creative`, `reject_creative`
- Inventory Management: `search_inventory`, `update_availability`

### 4. **Schema Layer**

#### OpenDirect Schema (`opendirect.json`)
- **Format**: OpenAPI 3.0 Specification
- **Standard**: OpenDirect v2.1 (IAB Tech Lab)
- **Purpose**: Single source of truth for API structure

**Contains**:
- **Paths**: 33 API endpoints
- **Schemas**: 40 object definitions (Account, Order, Line, Product, etc.)
- **Operations**: CRUD operations for each resource
- **Validations**: Parameter types, required fields, constraints
- **Responses**: Expected response structures

---

## A2A Protocol Flow

### Complete Request Flow: "Create an account for Nike"

```
┌─────────────┐
│   CLIENT    │
└──────┬──────┘
       │
       │ 1. Send message via JSON-RPC 2.0
       │
       ▼
POST /a2a/buyer/jsonrpc
{
  "jsonrpc": "2.0",
  "method": "sendMessage",
  "params": {
    "message": {
      "messageId": "msg-123",
      "role": "user",
      "parts": [{"kind": "text", "text": "create an account for Nike"}],
      "kind": "message"
    }
  },
  "id": 1
}
       │
       ▼
┌──────────────────────┐
│   A2A AGENT SERVER   │
│   (sdkRouter.js)     │
└──────┬───────────────┘
       │
       │ 2. Route to Buyer Agent
       │    Create Task
       │
       ▼
┌──────────────────────┐
│   AGENT EXECUTOR     │
│ (agentExecutor.js)   │
└──────┬───────────────┘
       │
       │ 3. Parse natural language with OpenAI
       │    "create an account for Nike"
       │    → tool: create_account
       │    → params: {name: "Nike", type: "advertiser"}
       │
       ▼
┌──────────────────────┐
│   MCP TOOL HANDLER   │
│  (create_account)    │
└──────┬───────────────┘
       │
       │ 4. Validate parameters (Zod)
       │    Generate UUID
       │    Create account object
       │
       ▼
┌──────────────────────┐
│   RESPONSE           │
└──────┬───────────────┘
       │
       │ 5. Return to Agent Executor
       │    {id: "uuid", name: "Nike", ...}
       │
       ▼
┌──────────────────────┐
│   AGENT EXECUTOR     │
└──────┬───────────────┘
       │
       │ 6. Update Task
       │    - Status: completed
       │    - Add agent message
       │    - Add artifact (account data)
       │
       ▼
┌──────────────────────┐
│   A2A AGENT SERVER   │
└──────┬───────────────┘
       │
       │ 7. Return JSON-RPC response
       │
       ▼
{
  "jsonrpc": "2.0",
  "result": {
    "task": {
      "id": "task-abc",
      "status": {
        "state": "completed",
        "timestamp": "2026-01-01T12:00:00Z"
      },
      "history": [
        {
          "role": "user",
          "parts": [{"kind": "text", "text": "create an account for Nike"}]
        },
        {
          "role": "agent",
          "parts": [{"kind": "text", "text": "Account created successfully"}]
        }
      ],
      "artifacts": [
        {
          "parts": [
            {
              "kind": "data",
              "data": {
                "id": "f0737068-...",
                "name": "Nike",
                "type": "advertiser"
              }
            }
          ]
        }
      ]
    }
  },
  "id": 1
}
       │
       ▼
┌─────────────┐
│   CLIENT    │
│  (Displays) │
└─────────────┘
```

### Task Lifecycle States

```
pending → working → completed
              ↓
          canceled
              ↓
          failed
```

---

## Setup & Installation

### Prerequisites

```bash
# Required Software
- Node.js >= 20.x
- npm >= 10.x

# Optional for local testing
- curl (for API testing)
- jq (for JSON formatting)
```

### Installation Steps

**1. Clone Repository**
```bash
git clone <repository-url>
cd mcp-config
```

**2. Install Dependencies**
```bash
# Main server
npm install

# Client UI
cd client-test
npm install
cd ..
```

**3. Configure Environment**

Create `.env` file in root directory:

```bash
# Server Configuration
NODE_ENV=development
PORT=3000

# LLM API Configuration (Required for AI-powered execution)
OPENAI_API_KEY=sk-proj-your-api-key-here
OPENAI_MODEL=gpt-4o-mini

# Default Model Selection
DEFAULT_ANALYSIS_MODEL=openai
DEFAULT_CHAT_MODEL=openai

# MCP Security
MCP_ENABLE_ADMIN_TOOLS=false
```

**4. Verify OpenDirect Schema**

Ensure `opendirect.json` exists in root directory:
```bash
ls -la opendirect.json
```

---

## Running Locally

### Start Main Server

```bash
# Development mode with auto-reload
npm run dev

# OR production mode
npm start
```

**Expected Output:**
```
Server running in development mode on port 3000
http://127.0.0.1:3000
✅ MCP integration complete - 33 tools available
```

### Verify Server is Running

```bash
# Health check
curl http://localhost:3000/api/health

# Get buyer agent card
curl http://localhost:3000/a2a/buyer/.well-known/agent-card.json | jq

# Get seller agent card
curl http://localhost:3000/a2a/seller/.well-known/agent-card.json | jq

# List MCP tools
curl http://localhost:3000/schema/mcp/tools | jq '.tools[].name'
```

### Start Client UI

```bash
cd client-test

# Using npm (recommended)
npm start
# Opens on http://localhost:8080

# OR using Python
python3 -m http.server 8081
# Opens on http://localhost:8081
```

**Access Client:**
- Open browser: `http://localhost:8080` or `http://localhost:8081`
- Server URL should show: `http://localhost:3000` (for local testing)
- Select agent: Buyer or Seller
- Click: "Connect"

---

## Testing the System

### 1. Test Agent Card Discovery

**Buyer Agent:**
```bash
curl http://localhost:3000/a2a/buyer/.well-known/agent-card.json | jq
```

**Verify Response Contains:**
- `name`: "opendirect-buyer-agent"
- `protocolVersion`: "0.3.0"
- `skills`: Array with 4 skills (each with examples)
- `securitySchemes`: OAuth2 configuration
- `additionalInterfaces`: JSON-RPC, HTTP+JSON, MCP

**Seller Agent:**
```bash
curl http://localhost:3000/a2a/seller/.well-known/agent-card.json | jq
```

**Verify Response Contains:**
- `name`: "opendirect-seller-agent"
- `skills`: Product Search, Inventory, Order Processing, Creative Approval

### 2. Test via JSON-RPC 2.0

**Create Account (Buyer):**
```bash
curl -X POST http://localhost:3000/a2a/buyer/jsonrpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "sendMessage",
    "params": {
      "message": {
        "messageId": "test-1",
        "role": "user",
        "parts": [
          {
            "kind": "text",
            "text": "create an account for Nike"
          }
        ],
        "kind": "message"
      }
    },
    "id": 1
  }' | jq
```

**Expected Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "task": {
      "id": "task-xyz",
      "status": {
        "state": "completed"
      },
      "history": [
        {
          "role": "user",
          "parts": [{"kind": "text", "text": "create an account for Nike"}]
        },
        {
          "role": "agent",
          "parts": [{"kind": "text", "text": "Account created successfully"}]
        }
      ]
    }
  },
  "id": 1
}
```

**Get Task Status:**
```bash
# Extract taskId from previous response
TASK_ID="task-xyz"

curl -X POST http://localhost:3000/a2a/buyer/jsonrpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "getTask",
    "params": {
      "taskId": "'$TASK_ID'"
    },
    "id": 2
  }' | jq
```

### 3. Test via Web Client UI

**Open Client:**
```
http://localhost:8080
```

**Test Scenarios:**

**Buyer Agent Tests:**
1. **Create Account**
   - Input: "create an account for Nike"
   - Expected: Account created with UUID

2. **Create Order**
   - Input: "create an order for Adidas campaign with budget $50000"
   - Expected: Order created with details

3. **Search Products**
   - Input: "search for video ad inventory"
   - Expected: List of products

4. **Create Campaign**
   - Input: "create a campaign for Nike summer collection"
   - Expected: Campaign plan

**Seller Agent Tests:**
1. **List Products**
   - Input: "list available products"
   - Expected: Product inventory

2. **Search Inventory**
   - Input: "search for premium ad space"
   - Expected: Premium products

3. **Process Order**
   - Input: "process order for account ABC"
   - Expected: Order processing confirmation

**Monitor:**
- Task status updates (pending → working → completed)
- Agent responses in chat
- Active tasks panel
- Debug logs

### 4. Test Different Message Formats

**Text Message:**
```json
{
  "parts": [
    {"kind": "text", "text": "create an account for Nike"}
  ]
}
```

**Structured Data:**
```json
{
  "parts": [
    {
      "kind": "data",
      "data": {
        "action": "create_account",
        "name": "Nike",
        "type": "advertiser"
      }
    }
  ]
}
```

### 5. Test Error Handling

**Invalid Request:**
```bash
curl -X POST http://localhost:3000/a2a/buyer/jsonrpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "sendMessage",
    "params": {},
    "id": 1
  }' | jq
```

**Expected:** Error response with validation details

**Unknown Tool:**
```bash
curl -X POST http://localhost:3000/a2a/buyer/jsonrpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "sendMessage",
    "params": {
      "message": {
        "messageId": "test-error",
        "role": "user",
        "parts": [{"kind": "text", "text": "do something impossible"}],
        "kind": "message"
      }
    },
    "id": 1
  }' | jq
```

**Expected:** Agent attempts to handle or returns graceful error

---

## API Reference

### Agent Discovery

```
GET /.well-known/agent-card.json
GET /a2a/buyer/.well-known/agent-card.json
GET /a2a/seller/.well-known/agent-card.json
```

**Response:** Agent card (JSON) per A2A v0.3.0 specification

### JSON-RPC 2.0 Endpoints

**Base URL:** `/a2a/{role}/jsonrpc`

**Methods:**

**1. sendMessage**
```json
{
  "jsonrpc": "2.0",
  "method": "sendMessage",
  "params": {
    "message": {
      "messageId": "string",
      "role": "user",
      "parts": [
        {"kind": "text", "text": "string"}
      ],
      "kind": "message"
    }
  },
  "id": 1
}
```
**Returns:** `{result: {task: Task}}`

**2. getTask**
```json
{
  "jsonrpc": "2.0",
  "method": "getTask",
  "params": {
    "taskId": "string"
  },
  "id": 2
}
```
**Returns:** `{result: {task: Task}}`

**3. cancelTask**
```json
{
  "jsonrpc": "2.0",
  "method": "cancelTask",
  "params": {
    "taskId": "string"
  },
  "id": 3
}
```
**Returns:** `{result: {task: Task}}`

### HTTP+JSON Endpoints

**Base URL:** `/a2a/{role}/rest`

```
POST /sendMessage
POST /getTask
POST /cancelTask
```

### Task Object Structure

```typescript
{
  id: string;                    // Unique task ID
  contextId: string;             // Conversation context
  status: {
    state: "pending" | "working" | "completed" | "failed" | "canceled";
    timestamp: string;           // ISO 8601
    message?: string;            // Optional status message
  };
  history: Message[];            // Conversation history
  artifacts?: Artifact[];        // Results/outputs
}
```

### Message Object Structure

```typescript
{
  messageId: string;
  role: "user" | "agent";
  parts: Part[];
  kind: "message";
  timestamp?: string;
}

// Part can be:
{kind: "text", text: string}
{kind: "data", data: object}
{kind: "file", file: {uri: string, mimeType: string}}
```

---

## Troubleshooting

### Server Won't Start

**Issue:** Port already in use
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3001 npm start
```

**Issue:** Missing dependencies
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

**Issue:** Missing OpenAI API key
```bash
# Check .env file exists and has OPENAI_API_KEY
cat .env | grep OPENAI_API_KEY

# Add if missing
echo "OPENAI_API_KEY=sk-proj-your-key-here" >> .env
```

### Agent Card Issues

**Issue:** URLs show localhost in production

The agent card should auto-detect URLs from the request. Check headers:
```bash
curl -v http://localhost:3000/a2a/buyer/.well-known/agent-card.json
```

**Issue:** Missing examples in skills

Verify `lib/a2a/sdkRouter.js` has examples:
```bash
grep -A5 "examples:" lib/a2a/sdkRouter.js
```

### Task Execution Issues

**Issue:** Tasks stuck in "working" state

Check OpenAI API:
```bash
# Test API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

Check server logs:
```bash
# Should see tool execution logs
tail -f logs/server.log
```

**Issue:** Tools not found

Verify MCP tools loaded:
```bash
curl http://localhost:3000/schema/mcp/tools | jq '.tools | length'
# Should return 33
```

**Issue:** AI gives wrong tool

The agent executor uses OpenAI to select tools. Check:
- Tool descriptions in `opendirect.json`
- Agent executor prompts in `lib/a2a/agentExecutor.js`
- Skill examples in agent card

### Client UI Issues

**Issue:** Can't connect to agent

Verify server is running:
```bash
curl http://localhost:3000/api/health
```

Check CORS:
```bash
curl -I http://localhost:3000/a2a/buyer/.well-known/agent-card.json
# Should include: Access-Control-Allow-Origin: *
```

**Issue:** No response after sending message

Check browser console (F12):
- Network tab for failed requests
- Console tab for JavaScript errors

Check server logs for the request

### MCP Integration Issues

**Issue:** MCP tools not loading

Check `opendirect.json` exists:
```bash
ls -la opendirect.json
```

Check schema parsing:
```bash
# Should show 33 tools
curl http://localhost:3000/schema/mcp/tools | jq '.tools[].name'
```

**Issue:** Tool execution fails

Check tool handler exists:
```bash
# Search for tool in codebase
grep -r "create_account" lib/mcp/
```

---

## Architecture Benefits

### 1. **Protocol Compliance**
- **A2A v0.3.0**: Standard agent discovery and communication
- **JSON-RPC 2.0**: Industry-standard RPC protocol
- **OpenAPI 3.0**: Standard API specification
- **MCP**: Tool integration protocol

### 2. **Scalability**
- **Stateless Design**: Each request is independent
- **Multi-agent**: Easy to add new agents
- **Multi-protocol**: Supports multiple transport mechanisms
- **Schema-driven**: Tools auto-generated from spec

### 3. **Extensibility**
- **New Tools**: Just update `opendirect.json`
- **New Agents**: Copy buyer/seller pattern
- **New Protocols**: Add to `additionalInterfaces`
- **New Skills**: Add to agent card

### 4. **Maintainability**
- **Single Source of Truth**: `opendirect.json` drives everything
- **Type Safety**: Zod validation throughout
- **Separation of Concerns**: Clear layer boundaries
- **Auto-detection**: URLs adapt to environment

---

## Next Steps

### Enhancements

1. **Implement OAuth2 Authentication**
   - Add token endpoints (`/oauth/token`, `/oauth/authorize`)
   - Implement JWT validation
   - Secure sensitive operations

2. **Add Persistent Storage**
   - Store tasks, messages, artifacts
   - Enable conversation history
   - Support resumable tasks

3. **Add Monitoring**
   - Request/response logging
   - Performance metrics
   - Error tracking

4. **Add Testing**
   - Unit tests for tools
   - Integration tests for agents
   - E2E tests with clients

5. **Documentation**
   - API reference (Swagger/OpenAPI)
   - Tool documentation
   - Client SDK examples

### Production Readiness

- [ ] Implement authentication
- [ ] Add rate limiting
- [ ] Set up monitoring/alerting
- [ ] Configure auto-scaling
- [ ] Enable HTTPS
- [ ] Add request validation
- [ ] Implement caching
- [ ] Add error recovery
- [ ] Create deployment pipeline
- [ ] Write comprehensive tests

---

## Resources

- **A2A Protocol**: https://a2a-protocol.org/v0.3.0/specification/
- **OpenDirect Spec**: https://www.iab.com/guidelines/opendirect/
- **MCP Protocol**: https://modelcontextprotocol.io/
- **JSON-RPC 2.0**: https://www.jsonrpc.org/specification

---

**Version:** 1.0.0
**Last Updated:** 2026-01-01
**Maintainer:** IAB Tech Lab
