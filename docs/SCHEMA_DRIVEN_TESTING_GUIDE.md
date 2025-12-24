# Schema-Driven MCP Server - Testing Guide

Complete workflow for testing the schema-driven OpenDirect MCP server with 33 auto-generated CRUD tools.

---

## 🚀 Quick Start

### **1. Start the Schema-Driven Server**

```bash
# HTTP mode (standalone on port 3000)
npm run mcp:schema

# OR stdio mode (for Claude Desktop)
npm run mcp:schema-stdio
```

**Expected Output:**
```
✅ Schema loaded: opendirect-mcp-server v2.1.0
✅ Generated 33 CRUD tools
✅ Generated 9 resources
🚀 Schema-Driven OpenDirect MCP Server (HTTP)
   🌐 Server URL: http://localhost:3000
```

---

## 📋 Testing Workflow

### **Method 1: Using MCP Client (Web Interface)**

The schema-driven server integrates with the main web application that has an MCP client.

#### **Step 1: Start Main Server**
```bash
# Kill schema-driven standalone server first
pkill -f "mcpServerSchemaDriven"

# Start main server (includes MCP client)
npm start
```

#### **Step 2: Access MCP Client Interface**
Open browser: `http://localhost:3000/mcp-client`

#### **Step 3: Connect to Schema-Driven Server**
- **Server URL:** `http://localhost:3000/agenticdirect/mcp/sse`
- Click "Connect"
- You should see 33 tools loaded

#### **Step 4: Test CRUD Operations**

**Example: Create an Organization**
```json
{
  "tool": "create_organization",
  "arguments": {
    "Name": "Acme Corporation",
    "Address": {
      "city": "New York",
      "country": "USA"
    },
    "Contacts": [{
      "Email": "contact@acme.com",
      "Type": "Billing"
    }]
  }
}
```

**Example: Create an Account**
```json
{
  "tool": "create_account",
  "arguments": {
    "Name": "Acme Advertising Account",
    "AdvertiserId": "<org-id-from-previous-step>",
    "BuyerId": "<buyer-org-id>"
  }
}
```

**Example: Get Account**
```json
{
  "tool": "get_account",
  "arguments": {
    "id": "<account-id>"
  }
}
```

**Example: List All Accounts**
```json
{
  "tool": "list_account",
  "arguments": {}
}
```

---

### **Method 2: Using Claude Desktop (stdio)**

#### **Step 1: Configure Claude Desktop**

Edit `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "opendirect-schema": {
      "command": "node",
      "args": [
        "/absolute/path/to/mcpServerSchemaDrivenStdio.js"
      ]
    }
  }
}
```

#### **Step 2: Restart Claude Desktop**

#### **Step 3: Test with Natural Language**

In Claude Desktop, try:
- "Create a new organization called Tech Innovations Inc"
- "List all organizations"
- "Create an account for organization <id>"
- "Show me all orders"

Claude will automatically use the 33 available tools!

---

### **Method 3: Direct HTTP Testing (Advanced)**

#### **Test 1: Check Available Tools (via MCP Protocol)**

```bash
# Start schema-driven server
npm run mcp:schema

# In another terminal, test MCP endpoint
curl -X POST http://localhost:3000/agenticdirect/mcp/sse \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'
```

**Expected Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "create_account",
        "description": "Create a new Account",
        "inputSchema": {...}
      },
      {
        "name": "get_account",
        "description": "Get a Account by ID",
        "inputSchema": {...}
      },
      ... (31 more tools)
    ]
  }
}
```

#### **Test 2: Execute a Tool (via MCP Protocol)**

```bash
curl -X POST http://localhost:3000/agenticdirect/mcp/sse \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "create_organization",
      "arguments": {
        "Name": "Test Corp",
        "Address": {
          "city": "San Francisco",
          "country": "USA"
        }
      }
    }
  }'
```

**Expected Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"success\":true,\"message\":\"Organization created successfully\",\"data\":{\"Id\":\"<uuid>\",\"Name\":\"Test Corp\",...}}"
      }
    ]
  }
}
```

---

## 🔧 Available Tools (33 Total)

### **Account (4 tools)**
- `create_account` - Create new account
- `get_account` - Get account by ID
- `list_account` - List all accounts
- `update_account` - Update existing account

### **Order (4 tools)**
- `create_order` - Create new order
- `get_order` - Get order by ID
- `list_order` - List all orders
- `update_order` - Update existing order

### **Line (4 tools)**
- `create_line` - Create new line item
- `get_line` - Get line by ID
- `list_line` - List all lines
- `update_line` - Update existing line

### **Creative (4 tools)**
- `create_creative` - Create new creative
- `get_creative` - Get creative by ID
- `list_creative` - List all creatives
- `update_creative` - Update existing creative

### **Assignment (4 tools)**
- `create_assignment` - Create new assignment
- `get_assignment` - Get assignment by ID
- `list_assignment` - List all assignments
- `delete_assignment` - Delete assignment

### **Organization (4 tools)**
- `create_organization` - Create new organization
- `get_organization` - Get organization by ID
- `list_organization` - List all organizations
- `update_organization` - Update existing organization

### **Product (3 tools)**
- `get_product` - Get product by ID
- `list_product` - List all products
- `search_product` - Search products

### **ChangeRequest (3 tools)**
- `create_changerequest` - Create new change request
- `get_changerequest` - Get change request by ID
- `list_changerequest` - List all change requests

### **Message (3 tools)**
- `create_message` - Create new message
- `get_message` - Get message by ID
- `list_message` - List all messages

---

## ✅ Validation Testing

The schema-driven server validates all requests against OpenDirect v2.1 spec.

### **Test Invalid Data**

```bash
curl -X POST http://localhost:3000/agenticdirect/mcp/sse \
  -H "Content-Type": application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "create_account",
      "arguments": {
        "Name": "A"
      }
    }
  }'
```

**Expected:** Validation error (missing required fields)

---

## 🧪 Complete End-to-End Workflow

### **Scenario: Create a Complete Ad Campaign**

#### **1. Create Organizations**
```javascript
// Create Advertiser
create_organization({
  Name: "Nike",
  Address: { city: "Portland", country: "USA" }
})

// Create Publisher
create_organization({
  Name: "ESPN",
  Address: { city: "Bristol", country: "USA" }
})
```

#### **2. Create Account**
```javascript
create_account({
  Name: "Nike Advertising Account",
  AdvertiserId: "<nike-org-id>",
  BuyerId: "<agency-org-id>"
})
```

#### **3. Create Order**
```javascript
create_order({
  Name: "Nike Summer Campaign",
  AccountId: "<account-id>",
  PublisherId: "<espn-org-id>",
  Currency: "USD",
  Budget: 100000
})
```

#### **4. Create Line Item**
```javascript
create_line({
  Name: "Nike Banner Ads",
  OrderId: "<order-id>",
  ProductId: "<product-id>",
  Quantity: 1000000,
  Cost: 50000
})
```

#### **5. Create Creative**
```javascript
create_creative({
  Name: "Nike Air Max Ad",
  AccountId: "<account-id>",
  AdFormat: "Banner"
})
```

#### **6. Assign Creative to Line**
```javascript
create_assignment({
  LineId: "<line-id>",
  CreativeId: "<creative-id>",
  Weight: 100
})
```

#### **7. List Everything**
```javascript
list_organization({})
list_account({})
list_order({})
list_line({})
list_creative({})
list_assignment({})
```

---

## 📊 Testing Checklist

### **Basic CRUD Testing**
- [ ] Create organization
- [ ] Get organization by ID
- [ ] List all organizations
- [ ] Update organization
- [ ] Create account
- [ ] List accounts
- [ ] Create order
- [ ] Update order

### **Validation Testing**
- [ ] Missing required fields (should fail)
- [ ] Invalid field types (should fail)
- [ ] Valid data (should succeed)

### **Relationship Testing**
- [ ] Create account with invalid advertiser ID (should fail)
- [ ] Create order with valid account ID (should succeed)
- [ ] Create assignment linking creative and line

### **Resource Testing**
- [ ] List resources
- [ ] Read resource content (e.g., `opendirect://organizations`)

---

## 🔍 Debugging

### **Check Server Logs**
```bash
# Server shows detailed logs
npm run mcp:schema

# Look for:
# ✅ Tool execution successful
# ❌ Validation failed
```

### **Enable Verbose Logging**
Edit `mcpServerSchemaDriven.js`:
```javascript
console.log('🔧 Tool called:', toolName, args);
console.log('📊 Validation result:', validationResult);
```

---

## 📈 Performance Testing

### **Load Testing**
```bash
# Create 100 organizations
for i in {1..100}; do
  curl -X POST http://localhost:3000/agenticdirect/mcp/sse \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":$i,\"method\":\"tools/call\",\"params\":{\"name\":\"create_organization\",\"arguments\":{\"Name\":\"Org $i\"}}}"
done

# List all (should return 100)
# Use list_organization tool
```

---

## 🎯 Next Steps

### **Extend the Schema**
1. Edit `opendirect-mcp-schema.json`
2. Add new object types or fields
3. Restart server - tools auto-regenerate!

### **Add Custom Validation**
1. Edit `lib/schemaValidator.js`
2. Add business logic validation
3. Tools automatically use new validation

### **Connect to Database**
1. Replace in-memory `storage` with database calls
2. Update `lib/toolGenerator.js` handlers
3. All 33 tools automatically use database

---

## 🆘 Troubleshooting

### **"Cannot connect to MCP server"**
- Ensure server is running: `npm run mcp:schema`
- Check port 3000 is free: `lsof -i :3000`
- Try: `pkill node` then restart

### **"Tool not found"**
- Check tool name (case-sensitive): `create_account` not `createAccount`
- List available tools via MCP client

### **"Validation failed"**
- Check required fields in schema
- Review `opendirect-mcp-schema.json` for object definition
- Use MCP client to see full error details

---

**Last Updated:** December 23, 2025
