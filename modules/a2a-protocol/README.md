# A2A Protocol Module

## Overview

The **A2A (Agent-to-Agent) Protocol Module** implements the A2A Protocol v0.3.0 specification, providing autonomous AI-powered agents for OpenDirect advertising operations. This module features dual agents (Buyer and Seller) with natural language understanding, multi-transport support, and MCP tool integration.

## Features

- 🤖 **Dual AI Agents** - Autonomous Buyer and Seller agents
- 📋 **A2A Protocol v0.3.0** - Full spec compliance with agent cards
- 🔄 **Multiple Transports** - JSON-RPC 2.0, HTTP+JSON, MCP tools
- 🧠 **AI-Powered** - Natural language → tool mapping with OpenAI GPT
- ⚡ **Multi-Step Workflows** - Intelligent chaining with `__PREVIOUS_RESULT_ID__`
- 🎯 **Two Modes** - Autonomous (auto-routing) and Orchestrated (manual)
- 💬 **Session Management** - Conversation history and context tracking
- 📊 **Progress Tracking** - Real-time status updates and events

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Client (Web UI / API)                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ POST /api/a2a/chat
                     │
┌────────────────────▼────────────────────────────────────┐
│         Client Agent (Orchestrator)                      │
│  • Analyze message with AI                               │
│  • Select appropriate agent (Buyer/Seller)               │
│  • Route to target agent                                 │
│  • Manage conversation context                           │
└────────────┬───────────────────────┬────────────────────┘
             │                       │
    ┌────────▼─────────┐    ┌───────▼────────┐
    │  Buyer Agent     │    │ Seller Agent    │
    │  /a2a/buyer      │    │ /a2a/seller     │
    │                  │    │                 │
    │  Skills:         │    │  Skills:        │
    │  • create_account│    │  • list_products│
    │  • create_order  │    │  • process_order│
    │  • search_inv    │    │  • search_inv   │
    └────────┬─────────┘    └───────┬─────────┘
             │                      │
             │  MCP Tool Calls      │
             └──────────┬───────────┘
                        │
           ┌────────────▼──────────────┐
           │   MCP Tool Execution       │
           │   (Schema-Driven MCP)      │
           └────────────────────────────┘
```

## Directory Structure

```
modules/a2a-protocol/
├── index.js                 # Module entry point
├── server.js                # A2A server setup
├── routes/
│   └── a2aRoutes.js        # Agent endpoints
├── lib/
│   ├── a2aEndpoints.js     # Agent card generation
│   ├── agentExecutor.js    # Tool execution logic
│   ├── clientAgent.js      # Orchestrator agent
│   ├── promptLoader.js     # Load agent prompts
│   └── sdkRouter.js        # A2A SDK integration
└── README.md               # This file
```

## Endpoints

### Agent Discovery

```bash
GET /a2a/agents
```
Lists all available agents.

**Response:**
```json
{
  "agents": [
    {
      "name": "buyer",
      "endpoint": "/a2a/buyer",
      "agentCard": "/a2a/buyer/.well-known/agent-card.json"
    },
    {
      "name": "seller",
      "endpoint": "/a2a/seller",
      "agentCard": "/a2a/seller/.well-known/agent-card.json"
    }
  ]
}
```

### Agent Cards

```bash
GET /a2a/buyer/.well-known/agent-card.json
GET /a2a/seller/.well-known/agent-card.json
```

Returns agent capability description including:
- Skills and operations
- Transport protocols
- Authentication requirements
- Example requests

### JSON-RPC 2.0 Transport

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

### HTTP+JSON Transport

```bash
POST /a2a/{agent}/rest
Content-Type: application/json

{
  "message": "search for video ad products",
  "sessionId": "optional-session-id"
}
```

### Client Agent API

```bash
# Send message to orchestrator
POST /api/a2a/chat
{
  "message": "create account for Adidas and order with budget $500",
  "mode": "autonomous"
}

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

## Agent Skills

### Buyer Agent

**Account Management:**
- `create_account` - Create advertiser/agency account
- `get_account` - Retrieve account details
- `update_account` - Update account information

**Order Management:**
- `create_order` - Create advertising order/campaign
- `get_order` - Retrieve order details
- `list_orders` - List all orders

**Inventory Search:**
- `search_products` - Search available ad inventory
- `get_product` - Get product details

**Creative Management:**
- `create_creative` - Upload ad creative
- `assign_creative` - Assign creative to placement

### Seller Agent

**Product Management:**
- `list_products` - List available ad products
- `search_products` - Search inventory
- `get_product` - Get product details

**Order Processing:**
- `process_order` - Process buyer order
- `update_line_status` - Update line item status

**Change Management:**
- `create_change_request` - Handle order changes
- `approve_change_request` - Approve changes

## Usage Examples

### Example 1: Create Account

```bash
curl -X POST http://localhost:3000/api/a2a/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "create an account for Nike"
  }'
```

**Response:**
```json
{
  "success": true,
  "response": "✅ Created account for Nike (ID: acc_123)",
  "data": {
    "accountId": "acc_123",
    "name": "Nike",
    "type": "advertiser"
  },
  "sessionId": "session_abc"
}
```

### Example 2: Multi-Step Workflow (Advanced)

The AgentExecutor now supports **intelligent multi-step workflows** where results from previous steps are automatically chained to subsequent steps using the `__PREVIOUS_RESULT_ID__` placeholder.

```bash
# Request to create account AND order in one message
curl -X POST http://localhost:3000/a2a/buyer/jsonrpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "sendMessage",
    "params": {
      "message": {
        "messageId": "msg-001",
        "role": "user",
        "parts": [{
          "kind": "text",
          "text": "Create an account for Nike and then create an order for Nike with budget 50000"
        }],
        "kind": "message"
      }
    },
    "id": 1
  }'
```

**What happens internally:**

1. **AI Planning** - OpenAI analyzes the message and creates a 2-step execution plan:
```json
{
  "steps": [
    {
      "toolName": "create_account",
      "toolParams": { "name": "Nike", "type": "advertiser" }
    },
    {
      "toolName": "create_order",
      "toolParams": {
        "accountId": "__PREVIOUS_RESULT_ID__",
        "name": "Nike",
        "budget": 50000
      }
    }
  ]
}
```

2. **Step 1 Execution** - Creates account, returns `e6625eeb-23a7-46f3-89b5-d63fb5d75b3e`
3. **Result Chaining** - Replaces `__PREVIOUS_RESULT_ID__` with actual account ID
4. **Step 2 Execution** - Creates order with linked account ID
5. **Progress Updates** - Publishes intermediate results after each step

**Response (via getTask):**
```json
{
  "task": {
    "id": "task-123",
    "status": { "state": "completed" },
    "history": [
      {
        "role": "user",
        "parts": [{"kind": "text", "text": "Create an account for Nike..."}]
      },
      {
        "role": "agent",
        "parts": [
          {"kind": "text", "text": "Step 1/2: Successfully executed create_account"},
          {"kind": "data", "data": {
            "success": true,
            "data": {"Id": "e6625eeb-23a7-46f3-89b5-d63fb5d75b3e", "name": "Nike"}
          }}
        ]
      },
      {
        "role": "agent",
        "parts": [
          {"kind": "text", "text": "Step 2/2: Successfully executed create_order"},
          {"kind": "data", "data": {
            "success": true,
            "data": {"Id": "0a906307-ab25-430b-b669-56d196ed1ba9", "accountid": "e6625eeb-23a7-46f3-89b5-d63fb5d75b3e"}
          }}
        ]
      },
      {
        "role": "agent",
        "parts": [
          {"kind": "text", "text": "Successfully completed 2 steps:\n1. create_account\n2. create_order"},
          {"kind": "data", "data": [/* both results */]}
        ]
      }
    ]
  }
}
```

### Example 3: Direct Agent Communication

```bash
# Buyer agent via JSON-RPC
curl -X POST http://localhost:3000/a2a/buyer/jsonrpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "sendMessage",
    "params": {
      "message": "search for premium video inventory"
    },
    "id": 1
  }'
```

## Agent Modes

### Autonomous Mode (Default)

Agent automatically selects the appropriate sub-agent based on message intent.

```bash
POST /api/a2a/mode
{
  "mode": "autonomous"
}
```

**Example:**
- Message: "create order for Nike"
- Agent: Automatically routes to Buyer agent

### Orchestrated Mode

User manually selects target agent.

```bash
POST /api/a2a/mode
{
  "mode": "orchestrated"
}
```

**Example:**
- User selects: Buyer agent
- Message: "create order for Nike"
- Agent: Uses selected Buyer agent directly

## Configuration

Module configuration in `shared/config/index.js`:

```javascript
a2aProtocol: {
  enabled: true,
  basePath: '/a2a',
  aiProvider: 'openai',
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  defaultMode: 'autonomous'
}
```

Environment variables:

```bash
# AI Provider for A2A orchestration
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini

# Agent mode
A2A_DEFAULT_MODE=autonomous
```

## Testing

### Test Agent Card Discovery

```bash
curl http://localhost:3000/a2a/buyer/.well-known/agent-card.json | jq
```

### Test Message Sending

```bash
curl -X POST http://localhost:3000/api/a2a/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "create account for Test Company"
  }' | jq
```

### Test Multiple Agents

```bash
# List all agents
curl http://localhost:3000/a2a/agents | jq

# Test buyer agent
curl -X POST http://localhost:3000/a2a/buyer/rest \
  -H "Content-Type: application/json" \
  -d '{"message": "create account for Nike"}'

# Test seller agent
curl -X POST http://localhost:3000/a2a/seller/rest \
  -H "Content-Type: application/json" \
  -d '{"message": "list available products"}'
```

## AI Prompts

Agent prompts are located in `/prompts/`:

```
prompts/
├── buyer/
│   └── autonomous-planner.prompt
└── seller/
    └── autonomous-responder.prompt
```

Prompts define:
- Agent behavior and personality
- Task understanding
- Tool selection logic
- Response formatting

## Integration with MCP

The A2A module integrates with the MCP layer for tool execution:

1. **Client sends message** → A2A orchestrator
2. **Orchestrator analyzes** → Selects buyer/seller agent
3. **Agent executes** → Calls MCP tools
4. **MCP returns result** → Agent formats response
5. **Response sent back** → Client receives data

## Common Use Cases

### Use Case 1: Account Creation Workflow
```
User: "create advertiser account for Nike"
  └─> Buyer Agent → create_account tool
      └─> MCP: POST /schema/mcp/sse (create_account)
          └─> Result: { accountId: "acc_123" }
```

### Use Case 2: Order Creation with Budget
```
User: "create order for Nike with $100k budget"
  └─> Buyer Agent → create_order tool
      └─> MCP: POST /schema/mcp/sse (create_order)
          └─> Result: { orderId: "ord_456", budget: 100000 }
```

### Use Case 3: Product Search
```
User: "show me video ad inventory"
  └─> Seller Agent → search_products tool
      └─> MCP: POST /schema/mcp/sse (search_products)
          └─> Result: [ { productId: "prod_789", ... } ]
```

## Troubleshooting

### Agent Not Responding

```bash
# Check agent health
curl http://localhost:3000/a2a/agents

# Verify AI provider is configured
echo $OPENAI_API_KEY

# Check logs
tail -f /tmp/server-test.log | grep A2A
```

### Agent Card Not Found

```bash
# Verify agent card endpoint
curl http://localhost:3000/a2a/buyer/.well-known/agent-card.json

# Check if A2A module is enabled
curl http://localhost:3000/a2a/agents
```

### MCP Tools Not Available

```bash
# Check MCP server is running
curl http://localhost:3000/schema/mcp/health

# List available tools
curl http://localhost:3000/schema/mcp/tools
```

## Development

### Adding New Agent Skills

1. Define skill in agent card (`lib/a2aEndpoints.js`)
2. Implement tool in MCP layer
3. Update agent executor logic (`lib/agentExecutor.js`)
4. Test with client

### Customizing Agent Behavior

Edit prompts in `/prompts/buyer/` or `/prompts/seller/`:

```bash
# Edit buyer agent prompt
nano prompts/buyer/autonomous-planner.prompt

# Restart server to reload
npm start
```

## License

Part of the OpenDirect A2A Agent System - MIT License
