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

/**
 * Create Schema-Driven MCP Server
 */
function createSchemaDrivenMCPServer() {
  console.log('🔧 Loading schema-driven configuration...');

  // Load configuration from schema and manifest
  const config = loadConfig({
    implementation: 'nodejs-schema-driven'
  });

  console.log('🏗️  Generating CRUD tools from schemas...');

  // Generate tool handlers
  const toolHandlers = generateCRUDTools(config.schemas, storage);
  const toolHandlersMap = new Map(toolHandlers.map(t => [t.name, t.handler]));

  // Generate tool definitions for MCP
  const toolDefinitions = generateToolDefinitions(config.schemas);

  // Generate resource definitions
  const resourceDefinitions = generateResourceDefinitions(config.schemas);

  // Create validation middleware
  const validateRequest = createValidationMiddleware(config.schemas, toolDefinitions);

  console.log(`✅ Generated ${toolDefinitions.length} tools`);
  console.log(`✅ Generated ${resourceDefinitions.length} resources`);

  // Create MCP server
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

  // Register tool handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: toolDefinitions };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Validate request
    const validationResult = validateRequest(name, args);
    if (!validationResult.valid) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Validation failed:\n${formatValidationErrors(validationResult.errors)}`
          }
        ],
        isError: true
      };
    }

    // Get handler
    const handler = toolHandlersMap.get(name);
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

  // Register resource handlers
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources: resourceDefinitions };
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
  console.log(`📋 Tools: ${toolDefinitions.length}`);
  console.log(`📋 Resources: ${resourceDefinitions.length}`);

  return server;
}

/**
 * Create Express app with schema-driven MCP endpoint
 * Uses relative paths so it can be mounted at any base path
 */
export function createSchemaDrivenMCPApp() {
  const app = express();

  app.use(express.json());

  const server = createSchemaDrivenMCPServer();

  // Load config for REST API endpoints
  const config = loadConfig({
    implementation: 'nodejs-schema-driven'
  });

  // Generate tool handlers and definitions for REST endpoints
  const toolHandlers = generateCRUDTools(config.schemas, storage);
  const toolHandlersMap = new Map(toolHandlers.map(t => [t.name, t.handler]));
  const toolDefinitions = generateToolDefinitions(config.schemas);
  const resourceDefinitions = generateResourceDefinitions(config.schemas);

  // Create single transport instance
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined // Stateless
  });

  server.connect(transport).then(() => {
    console.log('✅ Schema-driven MCP HTTP transport connected');
  });

  // SSE endpoint for MCP - handles both GET (SSE) and POST (messages)
  app.all('/sse', async (req, res) => {
    console.log(`🔗 Schema MCP ${req.method} /sse`);
    await transport.handleRequest(req, res, req.body);
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
      tools: toolDefinitions.map(tool => ({
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
      const handler = toolHandlersMap.get(toolName);
      if (!handler) {
        return res.status(404).json({
          error: 'Tool not found',
          message: `Unknown tool: ${toolName}`,
          available_tools: Array.from(toolHandlersMap.keys())
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
      resources: resourceDefinitions.map(resource => ({
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

// Run standalone if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export default { createSchemaDrivenMCPApp, createSchemaDrivenMCPServer };
