# OpenDirect MCP Module

## Overview

The **OpenDirect MCP Module** provides a manual implementation of OpenDirect v2.1 advertising operations. It offers 10 carefully crafted tools for managing accounts, orders, lines, creatives, and products according to the OpenDirect specification.

## Features

- 📋 **10 Core Tools** - Essential OpenDirect operations
- 🎯 **Manual Implementation** - Hand-crafted for optimal control
- ✅ **OpenDirect v2.1 Compliant** - Follows IAB specification
- 🔄 **SSE Transport** - Streaming support via Server-Sent Events
- 📊 **9 Resources** - Complete resource catalog
- 🚀 **AgenticDirect** - AI-powered advertising automation

## Directory Structure

```
modules/opendirect-mcp/
├── index.js                # Module entry point
├── server.js               # MCP server setup (AgenticDirect)
└── README.md               # This file
```

## Endpoints

### MCP Protocol (SSE)

```bash
POST /agenticdirect/mcp/sse
Content-Type: application/json
```

### Health & Info

```bash
GET /agenticdirect/mcp/health
GET /agenticdirect/mcp/info
```

## Available Tools

### 1. create_organization
Create a new advertiser, agency, or publisher organization.

**Parameters:**
```json
{
  "name": "string",
  "url": "string",
  "type": "advertiser|agency|publisher"
}
```

### 2. create_account
Create a buyer-advertiser account.

**Parameters:**
```json
{
  "name": "string",
  "buyerId": "string",
  "advertiserId": "string"
}
```

### 3. create_order
Create an advertising order/campaign.

**Parameters:**
```json
{
  "accountId": "string",
  "name": "string",
  "startDate": "date-time",
  "endDate": "date-time",
  "budget": "number"
}
```

### 4. create_line
Create a line item within an order.

**Parameters:**
```json
{
  "orderId": "string",
  "productId": "string",
  "name": "string",
  "startDate": "date-time",
  "endDate": "date-time",
  "quantity": "number",
  "cost": "number"
}
```

### 5. create_creative
Upload or create an ad creative.

**Parameters:**
```json
{
  "accountId": "string",
  "name": "string",
  "creativeType": "image|video|html",
  "adFormat": "string",
  "clickUrl": "string",
  "language": "string"
}
```

### 6. create_assignment
Assign a creative to a placement.

**Parameters:**
```json
{
  "lineId": "string",
  "creativeId": "string",
  "weight": "number"
}
```

### 7. search_products
Search available advertising inventory.

**Parameters:**
```json
{
  "filter": "string",
  "productType": "display|video|native|audio",
  "minQuantity": "number"
}
```

### 8. create_change_request
Request changes to an existing order.

**Parameters:**
```json
{
  "orderId": "string",
  "comments": "string",
  "requestedBy": "buyer|seller"
}
```

### 9. send_message
Send a message related to an order.

**Parameters:**
```json
{
  "orderId": "string",
  "subject": "string",
  "message": "string"
}
```

### 10. update_line_booking_status
Update the booking status of a line item.

**Parameters:**
```json
{
  "lineId": "string",
  "bookingStatus": "draft|pending|approved|rejected|reserved|booked|in_flight|finished|stopped|cancelled"
}
```

## Available Resources

```
opendirect://organizations
opendirect://accounts
opendirect://orders
opendirect://lines
opendirect://products
opendirect://creatives
opendirect://assignments
opendirect://change_requests
opendirect://messages
```

## Usage Examples

### Example 1: Create Organization

```bash
curl -X POST http://localhost:3000/agenticdirect/mcp/sse \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "create_organization",
      "arguments": {
        "name": "Nike",
        "url": "https://nike.com",
        "type": "advertiser"
      }
    }
  }'
```

### Example 2: Create Account

```bash
curl -X POST http://localhost:3000/agenticdirect/mcp/sse \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "create_account",
      "arguments": {
        "name": "Nike Campaign Account",
        "buyerId": "buyer_123",
        "advertiserId": "org_nike_456"
      }
    }
  }'
```

### Example 3: Create Order with Budget

```bash
curl -X POST http://localhost:3000/agenticdirect/mcp/sse \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "create_order",
      "arguments": {
        "accountId": "acc_789",
        "name": "Summer Sale Campaign",
        "startDate": "2026-06-01T00:00:00Z",
        "endDate": "2026-08-31T23:59:59Z",
        "budget": 100000
      }
    }
  }'
```

### Example 4: Search Video Products

```bash
curl -X POST http://localhost:3000/agenticdirect/mcp/sse \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "search_products",
      "arguments": {
        "productType": "video",
        "minQuantity": 1000
      }
    }
  }'
```

## Configuration

Module configuration in `shared/config/index.js`:

```javascript
opendirectMCP: {
  enabled: true,
  basePath: '/agenticdirect/mcp'
}
```

## OpenDirect Workflow

### Complete Campaign Setup

```
1. create_organization → Create advertiser
   └─> org_id: "org_123"

2. create_account → Link buyer to advertiser
   └─> account_id: "acc_456"

3. create_order → Create campaign
   └─> order_id: "ord_789"

4. search_products → Find inventory
   └─> product_id: "prod_101"

5. create_line → Add line item to order
   └─> line_id: "line_112"

6. create_creative → Upload ad creative
   └─> creative_id: "cre_131"

7. create_assignment → Assign creative to line
   └─> assignment_id: "asg_141"

8. update_line_booking_status → Approve line
   └─> status: "approved"
```

## Testing

### Test Health

```bash
curl http://localhost:3000/agenticdirect/mcp/health
```

**Expected:**
```json
{
  "status": "healthy",
  "server": "agenticdirect-mcp",
  "tools": 10,
  "timestamp": "2026-01-07T..."
}
```

### Test Tool Listing

```bash
curl -X POST http://localhost:3000/agenticdirect/mcp/sse \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }' | jq '.result.tools[] | .name'
```

### Test Resource Listing

```bash
curl -X POST http://localhost:3000/agenticdirect/mcp/sse \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "resources/list"
  }' | jq
```

## Integration with A2A Agents

The OpenDirect MCP module integrates seamlessly with A2A agents:

```
User → A2A Buyer Agent → OpenDirect MCP Tools
```

Example:
```
User: "create order for Nike with $50k budget"
  └─> Buyer Agent analyzes request
      └─> Calls create_order tool
          └─> OpenDirect MCP executes
              └─> Returns order details
```

## Claude Desktop Integration

```json
{
  "mcpServers": {
    "opendirect-mcp": {
      "url": "http://localhost:3000/agenticdirect/mcp/sse",
      "transport": "http"
    }
  }
}
```

## OpenDirect v2.1 Compliance

This module implements the following OpenDirect v2.1 specifications:

- ✅ Organization management
- ✅ Account management
- ✅ Order/Campaign management
- ✅ Line item management
- ✅ Creative management
- ✅ Assignment management
- ✅ Product catalog and search
- ✅ Change request workflow
- ✅ Messaging system
- ✅ Booking status lifecycle

## Troubleshooting

### Tools Not Available

```bash
# Check server is running
curl http://localhost:3000/agenticdirect/mcp/health

# List available tools
curl -X POST http://localhost:3000/agenticdirect/mcp/sse \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### Invalid Parameters

```bash
# Tool calls validate against OpenDirect spec
# Check parameter names and types match the specification
```

## Development

### Adding New Tools

1. Edit `server.js` to add new tool definition
2. Implement tool handler
3. Update tool list
4. Test with MCP client

### Customizing Tool Behavior

Edit `server.js` to modify tool implementations and add custom logic.

## License

Part of the OpenDirect A2A Agent System - MIT License
