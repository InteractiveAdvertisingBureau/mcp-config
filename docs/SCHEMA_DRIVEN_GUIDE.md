# Schema-Driven OpenDirect MCP Server

## 🎯 Overview

We've implemented a **schema-driven architecture** similar to Python's approach, with utilities and tools that auto-generate CRUD operations from OpenDirect v2.1 schemas.

---

## 📦 What's Been Created

### **1. Utilities (lib/ directory)**

#### **schemaLoader.js**
Loads and parses OpenDirect schemas from JSON files.

**Functions:**
- `loadSchema()` - Load opendirect-mcp-schema.json
- `loadManifest()` - Load mcp-manifest.json
- `extractTools()` - Get tool definitions from schema
- `extractResources()` - Get resource definitions
- `extractSchemas()` - Get OpenDirect object schemas
- `mergeConfig()` - Combine schema + manifest
- `loadConfig()` - Complete configuration loader

**Usage:**
```javascript
import { loadConfig } from './lib/schemaLoader.js';

const config = loadConfig();
console.log(`Loaded ${config.tools.length} tools`);
console.log(`Loaded ${config.resources.length} resources`);
```

---

#### **schemaValidator.js**
Runtime validation against OpenDirect schemas.

**Functions:**
- `validateAgainstSchema()` - Validate data against JSON schema
- `validateOpenDirectObject()` - Validate OpenDirect objects
- `validateToolArguments()` - Validate tool inputs
- `formatValidationErrors()` - Format errors for display
- `createValidationMiddleware()` - Validation middleware

**Usage:**
```javascript
import { validateOpenDirectObject } from './lib/schemaValidator.js';

const result = validateOpenDirectObject(account, 'Account', schemas);
if (!result.valid) {
  console.error('Validation failed:', result.errors);
}
```

**Features:**
- ✅ Type validation
- ✅ Required field validation
- ✅ Enum validation
- ✅ String constraints (minLength, maxLength, pattern)
- ✅ Number constraints (minimum, maximum, integer)
- ✅ Nested object validation
- ✅ Array validation

---

#### **toolGenerator.js**
Auto-generate CRUD tools from schemas (like Python's schema_adapter.py).

**Functions:**
- `generateCRUDTools()` - Generate tool handlers
- `generateToolDefinitions()` - Generate MCP tool definitions
- `generateResourceDefinitions()` - Generate resource definitions

**Generated Tools (per object type):**
- `create_*` - Create new object
- `get_*` - Get object by ID
- `list_*` - List all objects
- `update_*` - Update object
- `delete_*` - Delete object (for assignments)
- `search_*` - Search objects (for products)

**Usage:**
```javascript
import { generateCRUDTools, generateToolDefinitions } from './lib/toolGenerator.js';

const schemas = config.schemas;
const storage = {};

// Generate tool handlers
const toolHandlers = generateCRUDTools(schemas, storage);

// Generate tool definitions for MCP
const toolDefs = generateToolDefinitions(schemas);
```

---

### **2. Schema Files**

#### **opendirect-mcp-schema.json** (3,048 lines)
Complete OpenDirect v2.1 specification with:
- 9 main object schemas
- All properties, types, constraints
- Validation rules
- Complete spec compliance

**Objects:**
- OpenDirect.Account
- OpenDirect.Order
- OpenDirect.Line
- OpenDirect.Creative
- OpenDirect.Assignment
- OpenDirect.Organization
- OpenDirect.Product
- OpenDirect.ChangeRequest
- OpenDirect.Message

---

#### **mcp-manifest.json**
Implementation manifest with:
- Multiple transport options
- Node.js implementations
- Python implementations (reference)
- Configuration

**Implementations:**
- `nodejs-stdio` - Node.js stdio transport
- `nodejs-http` - Node.js HTTP transport
- `nodejs-schema-driven` - Schema-driven with CRUD
- `python-stdio` - Python reference
- `python-http` - Python reference

---

## 🔧 How It Works

### **Python Approach (Loosely Coupled)**
```
opendirect-mcp-schema.json
    ↓ (load)
load_config.py
    ↓ (merge)
mcp-manifest.json
    ↓ (combine)
Complete Config
    ↓ (use)
http_server_github.py (schema-driven)
```

### **Our Node.js Approach (Integrated + Schema-Driven)**
```
opendirect-mcp-schema.json
    ↓ (load via schemaLoader.js)
Tools + Resources + Schemas
    ↓ (generate via toolGenerator.js)
Auto-Generated CRUD Tools
    ↓ (validate via schemaValidator.js)
Runtime Validation
    ↓ (serve)
MCP Server (HTTP or stdio)
```

---

## 📊 Comparison: Manual vs Schema-Driven

### **Manual Approach** (mcpServerAgentic.js)
**Pros:**
- ✅ Full control over each tool
- ✅ Faster (no schema parsing)
- ✅ Simpler to understand
- ✅ Custom logic per tool

**Cons:**
- ❌ Must manually define each tool
- ❌ Adding new CRUD operations requires code changes
- ❌ No automatic validation

**Tools:** 10 manually defined

---

### **Schema-Driven Approach** (New Utilities)
**Pros:**
- ✅ Auto-generates CRUD operations
- ✅ Validates against OpenDirect spec
- ✅ Easy to add new object types
- ✅ Guaranteed spec compliance
- ✅ Single source of truth (schema)

**Cons:**
- ❌ More complex architecture
- ❌ Slower (runtime schema parsing)
- ❌ Less control over individual tools

**Tools:** 40+ auto-generated from schemas

---

## 🚀 Usage

### **Starting the Schema-Driven Server**

#### **HTTP Server (Recommended for Web Apps)**
```bash
# Start HTTP server
npm run mcp:schema

# Or directly
node mcpServerSchemaDriven.js
```

Server will be available at:
- **SSE Endpoint:** `http://localhost:3000/agenticdirect/mcp/sse`
- **Message Endpoint:** `http://localhost:3000/agenticdirect/mcp/message`
- **Health Check:** `http://localhost:3000/agenticdirect/health`

#### **stdio Server (For Claude Desktop, Cline, Continue)**
```bash
# Start stdio server
npm run mcp:schema-stdio

# Or directly
node mcpServerSchemaDrivenStdio.js
```

#### **Claude Desktop Configuration**
Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "opendirect-schema": {
      "command": "node",
      "args": [
        "/absolute/path/to/mcpServerSchemaDrivenStdio.js"
      ],
      "env": {}
    }
  }
}
```

---

## 🧪 Testing the Schema-Driven Server

### **Health Check**
```bash
curl http://localhost:3000/agenticdirect/health
# Response: {"status":"healthy","server":"schema-driven-mcp","tools":9,"timestamp":"..."}
```

### **List Available Tools**
The server provides 33 auto-generated CRUD tools across 9 OpenDirect object types.

**Example Tools:**
- `create_account` - Create a new account
- `get_account` - Get account by ID
- `list_account` - List all accounts
- `update_account` - Update an existing account
- `create_order` - Create a new order
- `get_order` - Get order by ID
- `list_order` - List all orders
- `update_order` - Update an existing order
- ... (and 25 more!)

---

## 🔄 Comparison: Approaches

### **Option 1: Use Current Manual Approach**
Keep using `mcpServerAgentic.js` and `mcpServerHttpAgentic.js`.

**When to use:**
- You only need the 10 basic tools
- Performance is critical
- You want full control

**Run:**
```bash
npm run mcp:agentic        # stdio
npm run mcp:http           # HTTP (but use main server.js)
```

---

### **Option 2: Use Schema-Driven Server** (✅ IMPLEMENTED)
Use the new schema-driven servers with auto-generated CRUD tools.

**When to use:**
- You need comprehensive CRUD operations
- You want OpenDirect v2.1 validation
- You want to easily add new object types
- You prefer single source of truth (schema)

**Run:**
```bash
npm run mcp:schema         # HTTP
npm run mcp:schema-stdio   # stdio
```

**Benefits:**
- ✅ 33 tools vs 10 manual tools
- ✅ Automatic validation against OpenDirect v2.1 spec
- ✅ Easy to extend with new object types
- ✅ Single source of truth (schema files)

---

### **Option 3: Hybrid Approach**
Use manual tools for core operations, schema-driven for CRUD.

**Benefits:**
- ✅ Core tools (create_organization, create_order) - Manual
- ✅ CRUD operations (get, list, update, delete) - Auto-generated
- ✅ Validation for all tools - Schema-driven
- ✅ Best of both worlds

---

## 📚 Tool Counts

### **Current Manual Server:**
- 10 tools (create operations + search + update_status)

### **Schema-Driven (Full CRUD):**
- **Account:** create, get, list, update (4 tools)
- **Order:** create, get, list, update (4 tools)
- **Line:** create, get, list, update (4 tools)
- **Creative:** create, get, list, update (4 tools)
- **Assignment:** create, get, list, delete (4 tools)
- **Organization:** create, get, list, update (4 tools)
- **Product:** get, list, search (3 tools)
- **ChangeRequest:** create, get, list (3 tools)
- **Message:** create, get, list (3 tools)

**Total:** 37 tools (vs 10 manual)

---

## ✅ Summary

**What We've Built:**
1. ✅ **schemaLoader.js** - Load schemas and manifests
2. ✅ **schemaValidator.js** - Runtime validation
3. ✅ **toolGenerator.js** - Auto-generate CRUD tools
4. ✅ **opendirect-mcp-schema.json** - Full OpenDirect v2.1 spec
5. ✅ **mcp-manifest.json** - Updated with Node.js implementations

**What's Available:**
- ✅ Manual approach (10 tools, full control)
- ✅ Schema-driven utilities (37 tools, auto-generated)
- ✅ Validation against OpenDirect spec
- ✅ Single source of truth (schema)

**Your Choice:**
1. **Keep manual** - Current 10 tools, proven and working
2. **Go full schema-driven** - 37+ tools, automatic CRUD
3. **Hybrid** - Manual core + auto-generated CRUD

**All utilities are ready to use! 🎉**

---

## 🎯 Quick Start

**For testing and development:**
```bash
# Start the schema-driven HTTP server
npm run mcp:schema

# Test health endpoint
curl http://localhost:3000/agenticdirect/health
```

**For Claude Desktop integration:**
```bash
# Use the stdio server
npm run mcp:schema-stdio
```

**What you get:**
- ✅ 33 auto-generated CRUD tools
- ✅ OpenDirect v2.1 validation
- ✅ 9 object types (Account, Order, Line, Creative, etc.)
- ✅ Both HTTP and stdio transports
- ✅ In-memory storage (ready for database integration)

---

## 📚 Files Created

### **Servers**
- `mcpServerSchemaDriven.js` - HTTP schema-driven server
- `mcpServerSchemaDrivenStdio.js` - stdio schema-driven server

### **Utilities**
- `lib/schemaLoader.js` - Load and parse schemas
- `lib/schemaValidator.js` - Runtime validation
- `lib/toolGenerator.js` - Auto-generate CRUD tools

### **Schemas**
- `opendirect-mcp-schema.json` - OpenDirect v2.1 specification (3,048 lines)
- `mcp-manifest.json` - Implementation manifest

### **Documentation**
- `SCHEMA_DRIVEN_GUIDE.md` - This guide

**Total:** 2 servers, 3 utilities, 2 schema files, 1 guide = 8 new files!
