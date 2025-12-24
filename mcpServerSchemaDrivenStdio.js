/**
 * Schema-Driven MCP Server (stdio Transport)
 * Auto-generates CRUD tools from OpenDirect v2.1 schemas
 * For Claude Desktop, Cline, Continue, and other stdio-based MCP clients
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
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
  console.error('🔧 Loading schema-driven configuration...');

  // Load configuration from schema and manifest
  const config = loadConfig({
    implementation: 'nodejs-schema-driven'
  });

  console.error('🏗️  Generating CRUD tools from schemas...');

  // Generate tool handlers
  const toolHandlers = generateCRUDTools(config.schemas, storage);
  const toolHandlersMap = new Map(toolHandlers.map(t => [t.name, t.handler]));

  // Generate tool definitions for MCP
  const toolDefinitions = generateToolDefinitions(config.schemas);

  // Generate resource definitions
  const resourceDefinitions = generateResourceDefinitions(config.schemas);

  // Create validation middleware
  const validateRequest = createValidationMiddleware(config.schemas, toolDefinitions);

  console.error(`✅ Generated ${toolDefinitions.length} tools`);
  console.error(`✅ Generated ${resourceDefinitions.length} resources`);

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

  console.error('✅ Schema-driven MCP server created');
  console.error(`📋 Tools: ${toolDefinitions.length}`);
  console.error(`📋 Resources: ${resourceDefinitions.length}`);

  return server;
}

/**
 * Main function - Start stdio server
 */
async function main() {
  console.error('');
  console.error('╔════════════════════════════════════════════════════════════╗');
  console.error('║   🚀 Schema-Driven OpenDirect MCP Server (stdio)          ║');
  console.error('╟────────────────────────────────────────────────────────────╢');
  console.error('║   🔌 Transport: stdio (stdin/stdout)                      ║');
  console.error('║   📋 37+ Auto-Generated CRUD Tools                        ║');
  console.error('║   ✅ Schema Validation Enabled                            ║');
  console.error('║   🔧 OpenDirect v2.1 Compliant                            ║');
  console.error('╚════════════════════════════════════════════════════════════╝');
  console.error('');

  const server = createSchemaDrivenMCPServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  console.error('✅ Schema-driven MCP stdio server running');
  console.error('🔗 Ready to accept MCP requests via stdio');
}

// Run server
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

export default { createSchemaDrivenMCPServer };
