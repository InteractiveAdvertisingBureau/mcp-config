# Schema-Driven MCP Module

## Overview

The **Schema-Driven MCP Module** automatically generates MCP (Model Context Protocol) tools from OpenAPI 3.0 schemas. It provides runtime validation, hot-reload capabilities, and a REST API for schema management.

## Features

- 🔧 **Auto-Generate Tools** - Create CRUD operations from OpenAPI schemas
- ✅ **Runtime Validation** - Zod schemas for parameter checking
- 🔄 **Hot-Reload** - Update schemas without server restart
- 📋 **33+ Tools** - Complete OpenDirect v2.1 operations
- 🧪 **Sandbox Testing** - Test tools before deployment
- 🌐 **REST API** - Manage schemas via HTTP endpoints
- 📊 **Schema History** - Track schema registrations

## Architecture

```
┌──────────────────────────────────────────────────────┐
│          OpenAPI 3.0 Schema                           │
│       (opendirect-mcp-schema.json)                    │
└────────────────┬─────────────────────────────────────┘
                 │
                 │ Load & Parse
                 ▼
┌──────────────────────────────────────────────────────┐
│          Schema Loader                                │
│  • Parse OpenAPI spec                                 │
│  • Extract resources & schemas                        │
│  • Generate validation rules                          │
└────────────────┬─────────────────────────────────────┘
                 │
                 │ Generate Tools
                 ▼
┌──────────────────────────────────────────────────────┐
│          Tool Generator                               │
│  • Create CRUD operations                             │
│  • Build Zod validators                               │
│  • Generate MCP tool definitions                      │
└────────────────┬─────────────────────────────────────┘
                 │
                 │ Register Tools
                 ▼
┌──────────────────────────────────────────────────────┐
│          MCP Server (SSE Transport)                   │
│  Endpoint: /schema/mcp/sse                            │
│  • tools/list                                         │
│  • tools/call                                         │
│  • resources/list                                     │
└──────────────────────────────────────────────────────┘
```

## Directory Structure

```
modules/schema-driven-mcp/
├── index.js                # Module entry point
├── server.js               # MCP server setup
├── routes/
│   └── schemaRoutes.js    # Schema management API
├── lib/
│   ├── schemaLoader.js    # Load and parse schemas
│   ├── schemaStorage.js   # Store active schema
│   ├── schemaValidator.js # Validate requests
│   └── toolGenerator.js   # Generate CRUD tools
└── README.md              # This file
```

## Endpoints

### MCP Protocol (SSE)

```bash
POST /schema/mcp/sse
Content-Type: application/json

# List tools
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}

# Call tool
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "create_account",
    "arguments": {
      "name": "Nike",
      "type": "advertiser"
    }
  }
}
```

### Health & Info

```bash
GET /schema/mcp/health
GET /schema/mcp/info
GET /schema/mcp/tools
GET /schema/mcp/resources
```

### Schema Management API

```bash
# Get current schema
GET /api/schema/current

# Register custom schema
POST /api/schema/register
{
  "schema": { ... },
  "source": "Custom Schema",
  "sourceType": "file"
}

# Fetch schema from URL
POST /api/schema/fetch-url
{
  "url": "https://raw.githubusercontent.com/.../schema.json"
}

# Reset to default schema
POST /api/schema/reset

# Test tool in sandbox
POST /api/schema/test-tool
{
  "toolName": "create_account",
  "payload": {
    "name": "Test Company",
    "type": "advertiser"
  }
}

# Get registration history
GET /api/schema/history
```

## Generated Tools

### Account Operations (5 tools)
- `create_account` - Create new account
- `get_account` - Retrieve account by ID
- `list_accounts` - List all accounts
- `update_account` - Update account
- `delete_account` - Delete account

### Order Operations (5 tools)
- `create_order` - Create advertising order
- `get_order` - Retrieve order by ID
- `list_orders` - List all orders
- `update_order` - Update order
- `delete_order` - Delete order

### Line Operations (5 tools)
- `create_line` - Create line item
- `get_line` - Retrieve line by ID
- `list_lines` - List all lines
- `update_line` - Update line
- `delete_line` - Delete line

### Creative Operations (5 tools)
- `create_creative` - Upload creative
- `get_creative` - Retrieve creative by ID
- `list_creatives` - List all creatives
- `update_creative` - Update creative
- `delete_creative` - Delete creative

### Product Operations (3 tools)
- `get_product` - Retrieve product by ID
- `list_products` - List all products
- `search_products` - Search inventory

### Additional Operations (10 tools)
- Organization CRUD (5 tools)
- Assignment CRUD (5 tools)

**Total: 33 tools**

## Usage Examples

### Example 1: List All Tools

```bash
curl -X POST http://localhost:3000/schema/mcp/sse \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }' | jq
```

### Example 2: Create Account

```bash
curl -X POST http://localhost:3000/schema/mcp/sse \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "create_account",
      "arguments": {
        "name": "Nike",
        "type": "advertiser",
        "buyerId": "buyer_123"
      }
    }
  }' | jq
```

### Example 3: Register Custom Schema

```bash
curl -X POST http://localhost:3000/api/schema/register \
  -H "Content-Type: application/json" \
  -d @custom-schema.json
```

### Example 4: Test Tool in Sandbox

```bash
curl -X POST http://localhost:3000/api/schema/test-tool \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "create_order",
    "payload": {
      "accountId": "acc_123",
      "name": "Summer Campaign",
      "budget": 50000
    }
  }' | jq
```

## Schema Format

Your custom schema must follow this structure:

```json
{
  "name": "my-custom-schema",
  "version": "1.0.0",
  "description": "Custom schema description",
  "schemas": {
    "MyResource": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "name": { "type": "string" },
        "created": { "type": "string", "format": "date-time" }
      },
      "required": ["name"]
    }
  },
  "tools": [
    {
      "name": "create_my_resource",
      "description": "Create a new resource",
      "inputSchema": {
        "type": "object",
        "properties": {
          "name": { "type": "string" }
        },
        "required": ["name"]
      }
    }
  ],
  "resources": [
    {
      "uri": "custom://my-resources",
      "name": "My Resources",
      "mimeType": "application/json"
    }
  ]
}
```

## Configuration

Module configuration in `shared/config/index.js`:

```javascript
schemaDrivenMCP: {
  enabled: true,
  basePath: '/schema/mcp',
  schemaPath: './opendirect-mcp-schema.json',
  implementation: 'nodejs-schema-driven'
}
```

## Hot-Reload Workflow

1. **Register new schema**
   ```bash
   POST /api/schema/register
   ```

2. **Server automatically reloads**
   - Parses new schema
   - Generates tools
   - Updates MCP server
   - No restart required!

3. **Verify new tools**
   ```bash
   GET /schema/mcp/tools
   ```

## Testing

### Test Health

```bash
curl http://localhost:3000/schema/mcp/health
```

**Expected:**
```json
{
  "status": "healthy",
  "server": "schema-driven-mcp",
  "tools": 33,
  "timestamp": "2026-01-07T..."
}
```

### Test Tool Listing

```bash
curl http://localhost:3000/schema/mcp/tools | jq '.tools[] | .name'
```

### Test Schema Registration

```bash
# Create test schema
cat > test-schema.json << 'EOF'
{
  "name": "test-schema",
  "version": "1.0.0",
  "tools": [],
  "schemas": {
    "TestObject": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "name": { "type": "string" }
      }
    }
  }
}
EOF

# Register it
curl -X POST http://localhost:3000/api/schema/register \
  -H "Content-Type: application/json" \
  -d @test-schema.json
```

## Claude Desktop Integration

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "schema-driven-mcp": {
      "url": "http://localhost:3000/schema/mcp/sse",
      "transport": "http"
    }
  }
}
```

## Troubleshooting

### Tools Not Loading

```bash
# Check current schema
curl http://localhost:3000/api/schema/current

# Check tool count
curl http://localhost:3000/schema/mcp/health | jq '.tools'

# Reset to default
curl -X POST http://localhost:3000/api/schema/reset
```

### Validation Errors

```bash
# Test tool with invalid data
curl -X POST http://localhost:3000/api/schema/test-tool \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "create_account",
    "payload": {}
  }'

# Response will show validation errors
```

### Schema Not Found

```bash
# Check if schema file exists
ls -lh opendirect-mcp-schema.json

# Check schema history
curl http://localhost:3000/api/schema/history
```

## Development

### Adding Custom Validation

Edit `lib/schemaValidator.js` to add custom validation logic.

### Customizing Tool Generation

Edit `lib/toolGenerator.js` to modify how CRUD tools are generated.

### Adding New Resource Types

1. Add to your schema's `schemas` object
2. Register the schema
3. Tools auto-generate!

## License

Part of the OpenDirect A2A Agent System - MIT License
