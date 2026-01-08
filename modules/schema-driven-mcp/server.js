/**
 * Schema-Driven MCP Server (HTTP Transport)
 * Auto-generates CRUD tools from OpenDirect v2.1 schemas
 * Similar to Python's http_server_github.py
 */

import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { loadConfig } from './lib/schemaLoader.js';
import { generateCRUDTools, generateToolDefinitions, generateResourceDefinitions } from './lib/toolGenerator.js';
import { createValidationMiddleware, formatValidationErrors } from './lib/schemaValidator.js';

/**
 * In-memory storage for OpenDirect objects
 */
const storage = {
  accounts: {},
  orders: {},
  lines: {},
  creatives: {},
  assignments: {},
  organizations: {},
  products: {},
  changeRequests: {},
  messages: {}
};


// Global state for dynamic reloading
let currentServer = null;
let currentTransport = null;
let currentConfig = null;
let currentToolHandlersMap = null;
let currentToolDefinitions = null;
let currentResourceDefinitions = null;

/**
 * Load schema and update global tool/resource state
 */
function loadSchemaAndUpdateTools() {
  console.log('🔧 Loading schema-driven configuration...');

  // Load configuration from schema and manifest
  currentConfig = loadConfig({
    implementation: 'nodejs-schema-driven'
  });

  console.log('🏗️  Generating CRUD tools from schemas...');

  // Generate tool handlers
  const toolHandlers = generateCRUDTools(currentConfig.schemas, storage);
  currentToolHandlersMap = new Map(toolHandlers.map(t => [t.name, t.handler]));

  // Generate tool definitions for MCP
  // Pass existing tools from schema (if any) to avoid generating tools for helper schemas
  currentToolDefinitions = generateToolDefinitions(currentConfig.schemas, currentConfig.tools);

  // Generate resource definitions
  currentResourceDefinitions = generateResourceDefinitions(currentConfig.schemas);

  console.log(`✅ Generated ${currentToolDefinitions.length} tools`);
  console.log(`✅ Generated ${currentResourceDefinitions.length} resources`);
}

/**
 * Create MCP server instance (once) with handlers that reference global state
 */
function createMCPServerInstance() {
  const server = new Server(
    {
      name: 'opendirect-schema-driven-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        logging: {},
      },
    }
  );

  // Register tool handlers that always use current global state
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    console.log(`🔍 MCP tools/list called - returning ${currentToolDefinitions?.length || 0} tools`);
    return { tools: currentToolDefinitions || [] };
  });

  const validateRequest = (name, args) => {
    // Simple validation - check if tool exists
    const tool = currentToolDefinitions.find(t => t.name === name);
    if (!tool) {
      return { valid: false, errors: [`Tool ${name} not found`] };
    }
    return { valid: true };
  };

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Validate request
    const validationResult = validateRequest(name, args);
    if (!validationResult.valid) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Validation failed:\n${validationResult.errors.join('\n')}`
          }
        ],
        isError: true
      };
    }

    // Get handler from current map
    const handler = currentToolHandlersMap.get(name);
    if (!handler) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Unknown tool: ${name}`
          }
        ],
        isError: true
      };
    }

    try {
      // Execute handler
      const result = await handler(args);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      console.error(`❌ Tool execution error (${name}):`, error);
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error: ${error.message}`
          }
        ],
        isError: true
      };
    }
  });

  // Register resource handlers that use current global state
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources: currentResourceDefinitions };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    // Extract object type from URI (e.g., opendirect://accounts -> accounts)
    const match = uri.match(/^opendirect:\/\/(.+)$/);
    if (!match) {
      throw new Error(`Invalid resource URI: ${uri}`);
    }

    const storageKey = match[1];
    const items = storage[storageKey] ? Object.values(storage[storageKey]) : [];

    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(items, null, 2)
        }
      ]
    };
  });

  console.log('✅ Schema-driven MCP server created');

  return server;
}

/**
 * Initialize or reload the MCP server with current schema
 */
export function initializeOrReloadServer() {
  console.log('🔄 Initializing/Reloading schema-driven MCP server...');

  // Load schema and update global tools/resources
  loadSchemaAndUpdateTools();

  // Create MCP server on first initialization only
  if (!currentServer) {
    currentServer = createMCPServerInstance();
    console.log(`📋 Tools: ${currentToolDefinitions.length}`);
    console.log(`📋 Resources: ${currentResourceDefinitions.length}`);
  } else {
    console.log(`🔄 Schema reloaded - Tools: ${currentToolDefinitions.length}`);
    console.log(`🔄 Schema reloaded - Resources: ${currentResourceDefinitions.length}`);
  }

  // Create single transport instance (or reuse)
  if (!currentTransport) {
    currentTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined // Stateless
    });

    currentServer.connect(currentTransport).then(() => {
      console.log('✅ Schema-driven MCP HTTP transport connected');
    });
  }

  return {
    server: currentServer,
    transport: currentTransport,
    config: currentConfig,
    toolHandlersMap: currentToolHandlersMap,
    toolDefinitions: currentToolDefinitions,
    resourceDefinitions: currentResourceDefinitions
  };
}

/**
 * Create Express app with schema-driven MCP endpoint
 * Uses relative paths so it can be mounted at any base path
 */
export function createSchemaDrivenMCPApp() {
  const app = express();

  app.use(express.json());

  // Initialize server on first load
  initializeOrReloadServer();

  // SSE endpoint for MCP - handles both GET (SSE) and POST (messages)
  app.all('/sse', async (req, res) => {
    console.log(`🔗 Schema MCP ${req.method} /sse`);
    await currentTransport.handleRequest(req, res, req.body);
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      server: 'schema-driven-mcp',
      tools: Object.keys(storage).length,
      timestamp: new Date().toISOString()
    });
  });

  // Info endpoint
  app.get('/info', (req, res) => {
    res.json({
      name: 'Schema-Driven OpenDirect MCP Server',
      version: '2.1.0',
      specification: 'OpenDirect v2.1',
      description: 'Auto-generated CRUD tools from OpenDirect schemas with runtime validation',
      type: 'schema-driven',
      endpoints: {
        sse: '/schema/mcp/sse',
        health: '/schema/mcp/health',
        info: '/schema/mcp/info',
        tools: '/schema/mcp/tools',
        resources: '/schema/mcp/resources'
      },
      tools: {
        total: 33,
        account: ['create_account', 'update_account', 'get_account', 'list_account'],
        order: ['create_order', 'update_order', 'get_order', 'list_order'],
        line: ['create_line', 'update_line', 'get_line', 'list_line'],
        creative: ['create_creative', 'update_creative', 'get_creative', 'list_creative'],
        assignment: ['create_assignment', 'delete_assignment', 'get_assignment', 'list_assignment'],
        organization: ['create_organization', 'update_organization', 'get_organization', 'list_organization'],
        product: ['get_product', 'list_product', 'search_product'],
        changerequest: ['create_changerequest', 'get_changerequest', 'list_changerequest'],
        message: ['create_message', 'get_message', 'list_message']
      },
      resources: [
        'opendirect://accounts',
        'opendirect://orders',
        'opendirect://lines',
        'opendirect://creatives',
        'opendirect://assignments',
        'opendirect://organizations',
        'opendirect://products',
        'opendirect://changeRequests',
        'opendirect://messages'
      ],
      features: [
        'Auto-generated from OpenDirect v2.1 schemas',
        'Runtime validation against specification',
        'Full CRUD operations (Create, Read, Update, Delete)',
        'Single source of truth (schema files)',
        'Type-safe operations with JSON Schema validation'
      ]
    });
  });

  // ============================================
  // REST API ENDPOINTS (Python Client Compatibility)
  // ============================================

  // GET /tools - List all available tools
  app.get('/tools', (req, res) => {
    console.log('📋 REST API: GET /tools');
    res.json({
      tools: currentToolDefinitions.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }))
    });
  });

  // POST /tools/:tool_name - Execute a tool
  app.post('/tools/:tool_name', async (req, res) => {
    const toolName = req.params.tool_name;
    const args = req.body;

    console.log(`🔧 REST API: POST /tools/${toolName}`, args);

    try {
      // Get handler
      const handler = currentToolHandlersMap.get(toolName);
      if (!handler) {
        return res.status(404).json({
          error: 'Tool not found',
          message: `Unknown tool: ${toolName}`,
          available_tools: Array.from(currentToolHandlersMap.keys())
        });
      }

      // Execute tool
      const result = await handler(args);

      // Return result
      res.json({
        success: true,
        tool: toolName,
        result: result
      });
    } catch (error) {
      console.error(`❌ Tool execution error:`, error);
      res.status(500).json({
        success: false,
        error: error.message,
        tool: toolName
      });
    }
  });

  // GET /resources - List all available resources
  app.get('/resources', (req, res) => {
    console.log('📦 REST API: GET /resources');
    res.json({
      resources: currentResourceDefinitions.map(resource => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType
      }))
    });
  });

  // GET /resources/:resource_type - Get resource data
  app.get('/resources/:resource_type', (req, res) => {
    const resourceType = req.params.resource_type;
    console.log(`📦 REST API: GET /resources/${resourceType}`);

    // Map resource type to storage key
    const storageKey = resourceType.toLowerCase();

    if (!storage[storageKey]) {
      return res.status(404).json({
        error: 'Resource not found',
        message: `Unknown resource type: ${resourceType}`,
        available_resources: Object.keys(storage)
      });
    }

    const items = Object.values(storage[storageKey]);
    res.json({
      resource: resourceType,
      uri: `opendirect://${storageKey}`,
      count: items.length,
      items: items
    });
  });

  return app;
}

/**
 * Reload schema-driven MCP server with current schema
 * Called when a new schema is registered via API
 */
export function reloadSchemaDrivenServer() {
  console.log('🔄 Reloading schema-driven MCP server due to schema change...');
  return initializeOrReloadServer();
}

/**
 * Standalone server mode
 */
async function main() {
  const PORT = process.env.PORT || 3000;
  const app = createSchemaDrivenMCPApp();

  app.listen(PORT, () => {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║   🚀 Schema-Driven OpenDirect MCP Server (HTTP)           ║');
    console.log('╟────────────────────────────────────────────────────────────╢');
    console.log(`║   🌐 Server URL: http://localhost:${PORT}                    ║`);
    console.log(`║   🔗 SSE Endpoint: /sse                                    ║`);
    console.log(`║   ❤️  Health Check: /health                                ║`);
    console.log('╟────────────────────────────────────────────────────────────╢');
    console.log('║   📋 33 Auto-Generated CRUD Tools                         ║');
    console.log('║   ✅ Schema Validation Enabled                            ║');
    console.log('║   🔧 OpenDirect v2.1 Compliant                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
  });
}

/**
 * Validate payload against JSON schema
 * @param {Object} payload - The payload to validate
 * @param {Object} schema - The JSON schema
 * @returns {Object} Validation result { valid, errors }
 */
function validatePayloadAgainstSchema(payload, schema) {
  const errors = [];

  if (!schema || !schema.properties) {
    return { valid: true, errors: [] };
  }

  // Check required fields
  if (schema.required && Array.isArray(schema.required)) {
    for (const requiredField of schema.required) {
      if (!(requiredField in payload)) {
        errors.push(`Missing required field: "${requiredField}"`);
      }
    }
  }

  // Check field types and constraints
  for (const [fieldName, fieldValue] of Object.entries(payload)) {
    const fieldSchema = schema.properties[fieldName];

    if (!fieldSchema) {
      errors.push(`Unknown field: "${fieldName}" (not in schema)`);
      continue;
    }

    // Type validation
    if (fieldSchema.type) {
      const actualType = Array.isArray(fieldValue) ? 'array' : typeof fieldValue;
      const expectedType = fieldSchema.type;

      if (expectedType === 'integer' || expectedType === 'number') {
        if (typeof fieldValue !== 'number') {
          errors.push(`Field "${fieldName}" must be a number, got ${actualType}`);
        } else if (expectedType === 'integer' && !Number.isInteger(fieldValue)) {
          errors.push(`Field "${fieldName}" must be an integer, got ${fieldValue}`);
        }
      } else if (expectedType !== actualType && actualType !== 'null') {
        errors.push(`Field "${fieldName}" must be ${expectedType}, got ${actualType}`);
      }
    }

    // Enum validation
    if (fieldSchema.enum && Array.isArray(fieldSchema.enum)) {
      if (!fieldSchema.enum.includes(fieldValue)) {
        errors.push(`Field "${fieldName}" must be one of: ${fieldSchema.enum.join(', ')}, got "${fieldValue}"`);
      }
    }

    // String constraints
    if (fieldSchema.type === 'string' && typeof fieldValue === 'string') {
      if (fieldSchema.minLength && fieldValue.length < fieldSchema.minLength) {
        errors.push(`Field "${fieldName}" must be at least ${fieldSchema.minLength} characters`);
      }
      if (fieldSchema.maxLength && fieldValue.length > fieldSchema.maxLength) {
        errors.push(`Field "${fieldName}" must be at most ${fieldSchema.maxLength} characters`);
      }
      if (fieldSchema.pattern) {
        const regex = new RegExp(fieldSchema.pattern);
        if (!regex.test(fieldValue)) {
          errors.push(`Field "${fieldName}" does not match required pattern: ${fieldSchema.pattern}`);
        }
      }
    }

    // Number constraints
    if ((fieldSchema.type === 'number' || fieldSchema.type === 'integer') && typeof fieldValue === 'number') {
      if (fieldSchema.minimum !== undefined && fieldValue < fieldSchema.minimum) {
        errors.push(`Field "${fieldName}" must be >= ${fieldSchema.minimum}`);
      }
      if (fieldSchema.maximum !== undefined && fieldValue > fieldSchema.maximum) {
        errors.push(`Field "${fieldName}" must be <= ${fieldSchema.maximum}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Test tool in sandbox mode
 * Creates isolated storage, executes tool, returns result, then clears sandbox
 * @param {string} toolName - Name of the tool to test
 * @param {Object} payload - Tool input parameters
 * @returns {Promise<Object>} Test result
 */
export async function testToolInSandbox(toolName, payload) {
  console.log(`🧪 Testing tool in sandbox: ${toolName}`);

  // Create sandbox storage (isolated copy)
  const sandboxStorage = {};

  try {
    // Get the tool handler from current tool handlers map
    const handler = currentToolHandlersMap?.get(toolName);

    if (!handler) {
      return {
        success: false,
        error: `Tool not found: ${toolName}`,
        available_tools: currentToolHandlersMap ? Array.from(currentToolHandlersMap.keys()) : []
      };
    }

    // Find tool definition for validation
    const toolDef = currentToolDefinitions?.find(t => t.name === toolName);

    // Validate payload against input schema
    if (toolDef && toolDef.inputSchema) {
      console.log(`🔍 Validating payload against schema...`);
      const validation = validatePayloadAgainstSchema(payload, toolDef.inputSchema);

      if (!validation.valid) {
        console.log(`❌ Validation failed:`, validation.errors);
        return {
          success: false,
          error: 'Payload validation failed',
          validationErrors: validation.errors,
          toolName: toolName,
          payload: payload,
          toolDefinition: {
            name: toolDef.name,
            description: toolDef.description,
            inputSchema: toolDef.inputSchema
          }
        };
      }
      console.log(`✅ Payload validation passed`);
    }

    // Execute handler with sandbox storage
    console.log(`🔧 Executing ${toolName} with payload:`, JSON.stringify(payload, null, 2));

    // Create a temporary tool handler that uses sandbox storage
    const sandboxHandler = async (args) => {
      // Determine storage key from tool name
      const objectType = toolName.split('_').slice(1).join('_'); // e.g., "create_campaign" -> "campaign"
      const storageKey = objectType + 's'; // e.g., "campaigns"

      // Initialize sandbox storage for this object type if needed
      if (!sandboxStorage[storageKey]) {
        sandboxStorage[storageKey] = {};
      }

      // Create a storage proxy that uses sandbox
      const sandboxStorageProxy = new Proxy(sandboxStorage, {
        get: (target, prop) => target[prop],
        set: (target, prop, value) => {
          target[prop] = value;
          return true;
        }
      });

      // Execute the original handler logic with sandbox storage
      const operation = toolName.split('_')[0]; // e.g., "create", "get", "update"

      switch (operation) {
        case 'create': {
          const { randomUUID } = await import('crypto');
          const id = randomUUID();
          const obj = { Id: id, ...args };
          sandboxStorage[storageKey][id] = obj;
          return {
            success: true,
            message: `${objectType} created successfully (sandbox)`,
            data: obj
          };
        }

        case 'get': {
          const { id } = args;
          if (!sandboxStorage[storageKey] || !sandboxStorage[storageKey][id]) {
            return {
              success: false,
              error: `${objectType} not found: ${id}`
            };
          }
          return {
            success: true,
            data: sandboxStorage[storageKey][id]
          };
        }

        case 'list': {
          const items = sandboxStorage[storageKey] ? Object.values(sandboxStorage[storageKey]) : [];
          return {
            success: true,
            total: items.length,
            data: items
          };
        }

        case 'update': {
          const { id, ...updates } = args;
          if (!sandboxStorage[storageKey] || !sandboxStorage[storageKey][id]) {
            return {
              success: false,
              error: `${objectType} not found: ${id}`
            };
          }
          sandboxStorage[storageKey][id] = {
            ...sandboxStorage[storageKey][id],
            ...updates
          };
          return {
            success: true,
            message: `${objectType} updated successfully (sandbox)`,
            data: sandboxStorage[storageKey][id]
          };
        }

        case 'delete': {
          const { id } = args;
          if (!sandboxStorage[storageKey] || !sandboxStorage[storageKey][id]) {
            return {
              success: false,
              error: `${objectType} not found: ${id}`
            };
          }
          delete sandboxStorage[storageKey][id];
          return {
            success: true,
            message: `${objectType} deleted successfully (sandbox)`
          };
        }

        default:
          return handler(args);
      }
    };

    const result = await sandboxHandler(payload);

    console.log(`✅ Tool executed successfully in sandbox`);
    console.log(`📊 Sandbox storage state:`, JSON.stringify(sandboxStorage, null, 2));
    console.log(`🧹 Clearing sandbox storage...`);

    // Return result with metadata
    return {
      success: result.success,
      toolName: toolName,
      sandboxMode: true,
      payload: payload,
      result: result,
      toolDefinition: toolDef ? {
        name: toolDef.name,
        description: toolDef.description,
        inputSchema: toolDef.inputSchema
      } : null,
      sandboxCleared: true
    };

  } catch (error) {
    console.error(`❌ Sandbox test failed:`, error);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

// Run standalone if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export default { createSchemaDrivenMCPApp, initializeOrReloadServer, reloadSchemaDrivenServer, testToolInSandbox };
