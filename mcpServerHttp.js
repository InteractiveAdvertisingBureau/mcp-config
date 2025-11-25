// MCP HTTP Server Implementation for API Testing System
// Based on screenshot_2 architecture - Streamable HTTP transport
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import { initializeDatabase } from './database/connection.js';
import * as apiService from './database/apiService.js';
import * as apiTester from './services/apiTester.js';

/**
 * Create and configure MCP server
 */
function createMCPServer() {
  const server = new Server(
    {
      name: 'api-testing-mcp-http',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // Register all tools (same as stdio version)
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'register-api',
        description: 'Register a new API endpoint for testing',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'API name' },
            endpoint: { type: 'string', description: 'Full URL' },
            method: {
              type: 'string',
              enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
              default: 'GET'
            },
            request_type: { type: 'string', default: 'application/json' },
            request_params: { type: 'object' },
            description: { type: 'string' }
          },
          required: ['endpoint']
        }
      },
      {
        name: 'test-api',
        description: 'Test API with multiple scenarios and generate AI analysis',
        inputSchema: {
          type: 'object',
          properties: {
            api_id: { type: 'integer' },
            scenarios: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  params: { type: 'object' },
                  headers: { type: 'object' }
                }
              }
            }
          },
          required: ['api_id']
        }
      },
      {
        name: 'get-api',
        description: 'Get API by ID',
        inputSchema: {
          type: 'object',
          properties: { api_id: { type: 'integer' } },
          required: ['api_id']
        }
      },
      {
        name: 'list-apis',
        description: 'List all registered APIs',
        inputSchema: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['active', 'inactive', 'testing'] },
            method: { type: 'string' },
            limit: { type: 'integer', default: 50 }
          }
        }
      },
      {
        name: 'get-test-results',
        description: 'Get test results for an API',
        inputSchema: {
          type: 'object',
          properties: {
            api_id: { type: 'integer' },
            limit: { type: 'integer', default: 10 }
          },
          required: ['api_id']
        }
      },
      {
        name: 'get-api-statistics',
        description: 'Get API statistics',
        inputSchema: {
          type: 'object',
          properties: { api_id: { type: 'integer' } },
          required: ['api_id']
        }
      },
      {
        name: 'update-api',
        description: 'Update a registered API',
        inputSchema: {
          type: 'object',
          properties: {
            api_id: { type: 'integer' },
            updates: { type: 'object' }
          },
          required: ['api_id', 'updates']
        }
      },
      {
        name: 'delete-api',
        description: 'Delete an API',
        inputSchema: {
          type: 'object',
          properties: { api_id: { type: 'integer' } },
          required: ['api_id']
        }
      },
      {
        name: 'generate-test-scenarios',
        description: 'Auto-generate test scenarios',
        inputSchema: {
          type: 'object',
          properties: { api_id: { type: 'integer' } },
          required: ['api_id']
        }
      }
    ]
  }));

  // Tool handlers
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'register-api':
          const api = await apiService.registerAPI(args);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ success: true, message: 'API registered', api }, null, 2)
            }]
          };

        case 'test-api':
          const results = await apiTester.testAPIWithScenarios(args.api_id, args.scenarios || []);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ success: true, ...results }, null, 2)
            }]
          };

        case 'get-api':
          const apiData = await apiService.getAPIById(args.api_id);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ success: !!apiData, api: apiData }, null, 2)
            }]
          };

        case 'list-apis':
          const apis = await apiService.getAllAPIs({
            status: args.status,
            method: args.method,
            limit: args.limit || 50
          });
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ success: true, total: apis.length, apis }, null, 2)
            }]
          };

        case 'get-test-results':
          const testResults = await apiService.getTestResults(args.api_id, args.limit || 10);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ success: true, results: testResults }, null, 2)
            }]
          };

        case 'get-api-statistics':
          const stats = await apiService.getAPIStatistics(args.api_id);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ success: true, statistics: stats }, null, 2)
            }]
          };

        case 'update-api':
          const updated = await apiService.updateAPI(args.api_id, args.updates);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ success: true, api: updated }, null, 2)
            }]
          };

        case 'delete-api':
          const deleted = await apiService.deleteAPI(args.api_id);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ success: deleted }, null, 2)
            }]
          };

        case 'generate-test-scenarios':
          const apiForScenarios = await apiService.getAPIById(args.api_id);
          if (!apiForScenarios) throw new Error('API not found');
          const scenarios = apiTester.generateTestScenarios(apiForScenarios);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ success: true, scenarios }, null, 2)
            }]
          };

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: error.message }, null, 2)
        }],
        isError: true
      };
    }
  });

  // Resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: 'api://registered/{id}',
        name: 'Registered API',
        description: 'API details',
        mimeType: 'application/json'
      },
      {
        uri: 'api://statistics/{id}',
        name: 'API Statistics',
        description: 'Performance metrics',
        mimeType: 'application/json'
      }
    ]
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;

    try {
      if (uri.startsWith('api://registered/')) {
        const id = parseInt(uri.replace('api://registered/', ''));
        const api = await apiService.getAPIById(id);
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(api || { error: 'Not found' }, null, 2)
          }]
        };
      }

      if (uri.startsWith('api://statistics/')) {
        const id = parseInt(uri.replace('api://statistics/', ''));
        const stats = await apiService.getAPIStatistics(id);
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(stats || { error: 'Not found' }, null, 2)
          }]
        };
      }

      throw new Error(`Unknown resource: ${uri}`);
    } catch (error) {
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({ error: error.message }, null, 2)
        }]
      };
    }
  });

  return server;
}

/**
 * Create Express app with MCP HTTP endpoint
 */
export function createMCPHttpApp() {
  const app = express();
  app.use(express.json());

  // Initialize database
  initializeDatabase();

  const server = createMCPServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined // Stateless
  });

  server.connect(transport).then(() => {
    console.log('✅ MCP HTTP server connected');
  }).catch((error) => {
    console.error('❌ MCP server connection failed:', error);
  });

  // MCP endpoint
  app.all('/sse', async (req, res) => {
    await transport.handleRequest(req, res, req.body);
  });

  return app;
}

// Standalone mode
if (import.meta.url === `file://${process.argv[1]}`) {
  const app = createMCPHttpApp();
  const PORT = process.env.MCP_PORT || 3001;

  app.listen(PORT, () => {
    console.log(`🚀 MCP HTTP Server running on http://localhost:${PORT}/mcp/sse`);
  });
}
