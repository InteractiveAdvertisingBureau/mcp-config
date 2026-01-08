# AI Chat Module

## Overview

The **AI Chat Module** provides a multi-provider AI chat interface with integrated MCP tool support. Chat with Claude, GPT, or Gemini while accessing MCP tools for enhanced capabilities.

## Features

- 💬 **Multi-Provider** - Support for Anthropic Claude, OpenAI GPT, Google Gemini
- 🔧 **MCP Integration** - Access to all MCP server tools
- 🎯 **Auto-Provider Selection** - Uses first available API key
- 🛡️ **Tool Filtering** - Admin tools hidden from chat users
- 📝 **Context Management** - Intelligent pruning to prevent token overflow
- 🌐 **Web Interface** - Ready-to-use chat UI
- ⚡ **Streaming Support** - Real-time response streaming

## Directory Structure

```
modules/ai-chat/
├── index.js                # Module entry point
├── server.js               # AI chat server setup
└── README.md               # This file
```

## Endpoints

### Chat Interface

```bash
GET /chat
```
Web-based chat interface

### Chat API

```bash
POST /api/ai-chat
{
  "message": "Your message here",
  "conversationHistory": []
}
```

### Health Check

```bash
GET /api/ai-health
```

Returns AI provider status and MCP connection info.

## Supported AI Providers

### 1. Anthropic Claude

**Models:**
- `claude-sonnet-4-5` (default)
- `claude-opus-4`
- `claude-haiku-4`

**Environment:**
```bash
ANTHROPIC_API_KEY=sk-ant-...
```

### 2. OpenAI GPT

**Models:**
- `gpt-4o-mini` (default)
- `gpt-4o`
- `gpt-4-turbo`
- `gpt-4`

**Environment:**
```bash
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini
```

### 3. Google Gemini

**Models:**
- `gemini-2.0-flash-exp` (default)
- `gemini-2.0-flash-lite`
- `gemini-1.5-pro`

**Environment:**
```bash
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.0-flash-exp
```

## MCP Integration

The AI Chat module connects to the MCP server to access tools:

```
┌─────────────┐
│  User       │
└──────┬──────┘
       │
       │ Chat message
       ▼
┌──────────────────────┐
│  AI Chat Module      │
│  • Parse message     │
│  • Select AI provider│
│  • Connect to MCP    │
└──────┬───────────────┘
       │
       │ If tool needed
       ▼
┌──────────────────────┐
│  MCP Server          │
│  /mcp/sse            │
│  • Execute tool      │
│  • Return result     │
└──────┬───────────────┘
       │
       │ Tool result
       ▼
┌──────────────────────┐
│  AI processes result │
│  Formats response    │
└──────┬───────────────┘
       │
       │ Final response
       ▼
┌─────────────┐
│  User       │
└─────────────┘
```

## Configuration

Module configuration in `shared/config/index.js`:

```javascript
aiChat: {
  enabled: true,
  basePath: '/chat',
  aiProvider: process.env.AI_PROVIDER || 'auto',
  mcpServerUrl: process.env.MCP_SERVER_URL || 'http://localhost:3000/mcp/sse'
}
```

Environment variables:

```bash
# AI Provider Selection (auto, openai, anthropic, gemini)
AI_PROVIDER=auto

# Provider API Keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...
GEMINI_API_KEY=...

# Model Selection
OPENAI_MODEL=gpt-4o-mini
GEMINI_MODEL=gemini-2.0-flash-exp

# MCP Server
MCP_SERVER_URL=http://localhost:3000/mcp/sse

# Tool Access Control
MCP_ENABLE_ADMIN_TOOLS=false
```

## Usage Examples

### Example 1: Simple Chat

```bash
curl -X POST http://localhost:3000/api/ai-chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello! What can you help me with?"
  }'
```

**Response:**
```json
{
  "success": true,
  "response": "Hello! I can help you with various tasks including API testing, OpenDirect advertising operations, and more. I have access to several tools through the MCP server. What would you like to do?",
  "provider": "openai",
  "model": "gpt-4o-mini"
}
```

### Example 2: Chat with Tool Use

```bash
curl -X POST http://localhost:3000/api/ai-chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Can you list all registered APIs?",
    "conversationHistory": []
  }'
```

The AI will:
1. Understand the request
2. Call the `list-apis` MCP tool
3. Format and return the results

### Example 3: Check AI Health

```bash
curl http://localhost:3000/api/ai-health
```

**Response:**
```json
{
  "status": "ok",
  "service": "AI Chat (MCP Integrated)",
  "aiProvider": "openai",
  "aiConfigured": true,
  "mcpServerConnected": true,
  "mcpToolsCount": 8
}
```

## Web Interface

Access the chat UI at:
```
http://localhost:3000/chat
```

**Features:**
- Message input with Enter key support
- Conversation history display
- Real-time response streaming
- Tool call visibility
- Provider and model display

## Available MCP Tools

When chatting, the AI has access to these tools (admin tools filtered out):

### API Testing Tools
- `test-api` - Test API endpoints
- `get-api` - Get API details
- `list-apis` - List all APIs
- `get-test-results` - Get test history
- `generate-test-scenarios` - Generate test cases
- `query-api-with-summary` - Query API with AI summary
- `validate-and-execute-api` - Validate and execute API
- `get-api-statistics` - Get API statistics

### Admin Tools (Filtered)
- `register-api` (hidden)
- `update-api` (hidden)
- `delete-api` (hidden)

## Context Management

The module automatically manages conversation context:

- **Context Window**: Maintains recent conversation history
- **Intelligent Pruning**: Removes old messages when approaching token limits
- **Tool Context**: Preserves tool call history for continuity

## Error Handling

### Conversational Errors

Errors are presented in a user-friendly format:

```
❌ I encountered an issue: The API request failed due to network timeout.

Would you like me to try again or help with something else?
```

### Provider Fallback

If the primary provider fails, the module can be configured to fall back to alternative providers.

## Testing

### Test Web Interface

```bash
# Open in browser
open http://localhost:3000/chat
```

### Test Chat API

```bash
curl -X POST http://localhost:3000/api/ai-chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, can you help me test an API?"
  }' | jq
```

### Test MCP Connection

```bash
curl http://localhost:3000/api/ai-health | jq
```

### Test with Different Providers

```bash
# Use OpenAI
AI_PROVIDER=openai node server.js

# Use Anthropic
AI_PROVIDER=anthropic node server.js

# Use Gemini
AI_PROVIDER=gemini node server.js
```

## Provider Selection Logic

```javascript
// Auto-selection priority:
1. Check ANTHROPIC_API_KEY → Use Claude
2. Check OPENAI_API_KEY → Use GPT
3. Check GEMINI_API_KEY → Use Gemini
4. None available → Return error
```

## Common Chat Scenarios

### Scenario 1: API Testing

```
User: "Can you test the API with ID 5?"
AI: *Calls test-api tool*
AI: "I've tested API #5. The test completed successfully with a 200 status code and response time of 245ms."
```

### Scenario 2: Information Retrieval

```
User: "What APIs do we have registered?"
AI: *Calls list-apis tool*
AI: "You have 15 APIs registered. Here are the top 5: ..."
```

### Scenario 3: Multi-Step Task

```
User: "Register and test the JSONPlaceholder users endpoint"
AI: "I'd be happy to help! However, I don't have access to the register-api tool for security reasons. But I can help you test it once it's registered. Would you like me to show you how to register it manually?"
```

## Troubleshooting

### No AI Provider Configured

```bash
# Error: "No AI provider configured"

# Solution: Set at least one API key
export OPENAI_API_KEY=sk-proj-...
# or
export ANTHROPIC_API_KEY=sk-ant-...
```

### MCP Server Not Connected

```bash
# Check MCP server is running
curl http://localhost:3000/mcp/health

# Update MCP_SERVER_URL if needed
MCP_SERVER_URL=http://localhost:3000/mcp/sse
```

### Tools Not Available

```bash
# Check AI health endpoint
curl http://localhost:3000/api/ai-health

# Verify MCP connection
curl http://localhost:3000/mcp/sse \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Development

### Adding Custom Tool Filters

Edit `server.js` to customize which tools are available to chat users:

```javascript
const ADMIN_TOOLS = ['register-api', 'update-api', 'delete-api', 'your-tool'];
```

### Customizing Chat Interface

Edit `client/standalone/adstxt-ai-chat.html` to customize the web UI.

### Adding New AI Provider

1. Install provider SDK
2. Add provider logic to `server.js`
3. Update configuration
4. Test with new provider

## License

Part of the OpenDirect A2A Agent System - MIT License
