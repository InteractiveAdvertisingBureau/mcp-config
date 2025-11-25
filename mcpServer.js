// MCP Server Implementation for API Testing System
// Based on screenshot_2 architecture
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { initializeDatabase } from './database/connection.js';
import * as apiService from './database/apiService.js';
import * as apiTester from './services/apiTester.js';

// Initialize database
initializeDatabase();

/**
 * Initialize MCP Server for API Testing
 */
const server = new Server(
  {
    name: 'api-testing-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// ============================================
// TOOL DEFINITIONS
// ============================================

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'register-api',
      description: 'Register a new API endpoint for testing. Stores API details in database.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Friendly name for the API'
          },
          endpoint: {
            type: 'string',
            description: 'Full URL of the API endpoint'
          },
          method: {
            type: 'string',
            description: 'HTTP method (GET, POST, PUT, DELETE, PATCH)',
            enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
            default: 'GET'
          },
          request_type: {
            type: 'string',
            description: 'Content-Type for requests',
            default: 'application/json'
          },
          request_params: {
            type: 'object',
            description: 'Default request parameters or body'
          },
          description: {
            type: 'string',
            description: 'Optional description of what the API does'
          }
        },
        required: ['endpoint']
      }
    },
    {
      name: 'test-api',
      description: 'Test a registered API with multiple scenarios. Collects results and generates AI analysis.',
      inputSchema: {
        type: 'object',
        properties: {
          api_id: {
            type: 'integer',
            description: 'ID of the registered API to test'
          },
          scenarios: {
            type: 'array',
            description: 'Array of test scenarios. Each scenario can have different params/headers.',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Scenario name' },
                params: { type: 'object', description: 'Request parameters for this scenario' },
                headers: { type: 'object', description: 'Additional headers for this scenario' }
              }
            }
          }
        },
        required: ['api_id']
      }
    },
    {
      name: 'get-api',
      description: 'Retrieve details of a registered API by ID',
      inputSchema: {
        type: 'object',
        properties: {
          api_id: {
            type: 'integer',
            description: 'ID of the API to retrieve'
          }
        },
        required: ['api_id']
      }
    },
    {
      name: 'list-apis',
      description: 'List all registered APIs with optional filtering',
      inputSchema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            description: 'Filter by status (active, inactive, testing)',
            enum: ['active', 'inactive', 'testing']
          },
          method: {
            type: 'string',
            description: 'Filter by HTTP method',
            enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
          },
          limit: {
            type: 'integer',
            description: 'Maximum number of results to return',
            default: 50
          }
        }
      }
    },
    {
      name: 'get-test-results',
      description: 'Get test results for a specific API',
      inputSchema: {
        type: 'object',
        properties: {
          api_id: {
            type: 'integer',
            description: 'ID of the API'
          },
          limit: {
            type: 'integer',
            description: 'Number of recent results to retrieve',
            default: 10
          }
        },
        required: ['api_id']
      }
    },
    {
      name: 'get-api-statistics',
      description: 'Get statistics and performance metrics for an API',
      inputSchema: {
        type: 'object',
        properties: {
          api_id: {
            type: 'integer',
            description: 'ID of the API'
          }
        },
        required: ['api_id']
      }
    },
    {
      name: 'update-api',
      description: 'Update a registered API',
      inputSchema: {
        type: 'object',
        properties: {
          api_id: {
            type: 'integer',
            description: 'ID of the API to update'
          },
          updates: {
            type: 'object',
            description: 'Fields to update',
            properties: {
              name: { type: 'string' },
              endpoint: { type: 'string' },
              method: { type: 'string' },
              request_type: { type: 'string' },
              request_params: { type: 'object' },
              description: { type: 'string' },
              status: { type: 'string', enum: ['active', 'inactive', 'testing'] }
            }
          }
        },
        required: ['api_id', 'updates']
      }
    },
    {
      name: 'delete-api',
      description: 'Delete a registered API and all its test results',
      inputSchema: {
        type: 'object',
        properties: {
          api_id: {
            type: 'integer',
            description: 'ID of the API to delete'
          }
        },
        required: ['api_id']
      }
    },
    {
      name: 'generate-test-scenarios',
      description: 'Auto-generate test scenarios for an API based on its definition',
      inputSchema: {
        type: 'object',
        properties: {
          api_id: {
            type: 'integer',
            description: 'ID of the API'
          }
        },
        required: ['api_id']
      }
    }
  ]
}));

// ============================================
// TOOL HANDLERS
// ============================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'register-api': {
        console.log(`📝 [MCP] Registering API: ${args.name || args.endpoint}`);

        // Register the API
        const api = await apiService.registerAPI(args);
        console.log(`✅ [MCP] API registered with ID: ${api.id}`);

        // Auto-generate and run test scenarios (async)
        const scenarios = apiTester.generateTestScenarios(api);
        console.log(`🔧 [MCP] Auto-generated ${scenarios.length} test scenarios`);

        // Run tests in background
        setImmediate(async () => {
          try {
            console.log(`🧪 [MCP] Starting automatic test for API ${api.id}...`);
            await apiTester.testAPIWithScenarios(api.id, scenarios);
            console.log(`✅ [MCP] Automatic test completed for API ${api.id}`);
          } catch (testError) {
            console.error(`❌ [MCP] Automatic test failed:`, testError.message);
          }
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'API registered successfully. Automatic testing initiated.',
              api,
              auto_testing: {
                enabled: true,
                scenarios_count: scenarios.length,
                status: 'initiated'
              }
            }, null, 2)
          }]
        };
      }

      case 'test-api': {
        const results = await apiTester.testAPIWithScenarios(
          args.api_id,
          args.scenarios || []
        );
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'API testing completed',
              ...results
            }, null, 2)
          }]
        };
      }

      case 'get-api': {
        const api = await apiService.getAPIById(args.api_id);
        if (!api) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'API not found',
                api_id: args.api_id
              }, null, 2)
            }],
            isError: true
          };
        }
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true, api }, null, 2)
          }]
        };
      }

      case 'list-apis': {
        const apis = await apiService.getAllAPIs({
          status: args.status,
          method: args.method,
          limit: args.limit || 50
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              total: apis.length,
              apis
            }, null, 2)
          }]
        };
      }

      case 'get-test-results': {
        const results = await apiService.getTestResults(
          args.api_id,
          args.limit || 10
        );
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              api_id: args.api_id,
              total: results.length,
              results
            }, null, 2)
          }]
        };
      }

      case 'get-api-statistics': {
        const stats = await apiService.getAPIStatistics(args.api_id);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              api_id: args.api_id,
              statistics: stats
            }, null, 2)
          }]
        };
      }

      case 'update-api': {
        const updatedAPI = await apiService.updateAPI(
          args.api_id,
          args.updates
        );
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'API updated successfully',
              api: updatedAPI
            }, null, 2)
          }]
        };
      }

      case 'delete-api': {
        const deleted = await apiService.deleteAPI(args.api_id);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: deleted,
              message: deleted ? 'API deleted successfully' : 'API not found',
              api_id: args.api_id
            }, null, 2)
          }]
        };
      }

      case 'generate-test-scenarios': {
        const api = await apiService.getAPIById(args.api_id);
        if (!api) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ error: 'API not found' }, null, 2)
            }],
            isError: true
          };
        }
        const scenarios = apiTester.generateTestScenarios(api);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              api_id: args.api_id,
              scenarios
            }, null, 2)
          }]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    console.error(`❌ Error in tool ${name}:`, error);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, null, 2)
      }],
      isError: true
    };
  }
});

// ============================================
// RESOURCE DEFINITIONS
// ============================================

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'api://registered/{id}',
      name: 'Registered API',
      description: 'Access details of a registered API',
      mimeType: 'application/json'
    },
    {
      uri: 'api://statistics/{id}',
      name: 'API Statistics',
      description: 'Access performance statistics for an API',
      mimeType: 'application/json'
    },
    {
      uri: 'api://all-statistics',
      name: 'All API Statistics',
      description: 'View statistics for all registered APIs',
      mimeType: 'application/json'
    }
  ]
}));

// ============================================
// RESOURCE HANDLERS
// ============================================

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

    if (uri === 'api://all-statistics') {
      const stats = await apiService.getAllAPIStatistics();
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(stats, null, 2)
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

// ============================================
// SERVER STARTUP
// ============================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('API Testing MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
