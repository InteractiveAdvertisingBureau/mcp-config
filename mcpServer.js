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
import { multiModelService } from './services/multiModelService.js';

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
    },
    {
      name: 'query-api-with-summary',
      description: 'Execute an API call and return response with AI-generated summary and analysis. First call get-api to see required parameters, then call this with appropriate params structure: {path: {...}, query: {...}, body: {...}}',
      inputSchema: {
        type: 'object',
        properties: {
          api_id: {
            type: 'integer',
            description: 'ID of the registered API to query'
          },
          params: {
            type: 'object',
            description: 'Request parameters structured as: {path: {key: value}, query: {key: value}, body: {key: value}}. Path params replace {placeholders} in URL',
            properties: {
              path: {
                type: 'object',
                description: 'Path parameters to replace {placeholders} in the endpoint URL'
              },
              query: {
                type: 'object',
                description: 'Query string parameters (appended as ?key=value)'
              },
              body: {
                type: 'object',
                description: 'Request body for POST/PUT/PATCH requests'
              }
            }
          },
          headers: {
            type: 'object',
            description: 'Custom headers for the API call'
          }
        },
        required: ['api_id']
      }
    },
    {
      name: 'validate-and-execute-api',
      description: 'Validate request parameters, HTTP method, and execute API call with full validation',
      inputSchema: {
        type: 'object',
        properties: {
          api_id: {
            type: 'integer',
            description: 'ID of the registered API'
          },
          params: {
            type: 'object',
            description: 'Parameters to validate and use in request'
          },
          method: {
            type: 'string',
            description: 'HTTP method to validate (GET, POST, PUT, DELETE, PATCH)',
            enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
          },
          headers: {
            type: 'object',
            description: 'Headers to validate and include'
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
        console.error(`📝 [MCP] Registering API: ${args.name || args.endpoint}`);

        // Register the API
        const api = await apiService.registerAPI(args);
        console.error(`✅ [MCP] API registered with ID: ${api.id}`);

        // Auto-generate and run test scenarios (async)
        const scenarios = apiTester.generateTestScenarios(api);
        console.error(`🔧 [MCP] Auto-generated ${scenarios.length} test scenarios`);

        // Run tests in background
        setImmediate(async () => {
          try {
            console.error(`🧪 [MCP] Starting automatic test for API ${api.id}...`);
            await apiTester.testAPIWithScenarios(api.id, scenarios);
            console.error(`✅ [MCP] Automatic test completed for API ${api.id}`);
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

        // Add parameter guidance for Claude Desktop
        if (api) {
          const parameterGuide = {
            endpoint: api.endpoint,
            method: api.method,
            parameters: api.request_params || {},
            example_usage: `To call this API, use query-api-with-summary with:\n` +
              `{\n  "api_id": ${api.id},\n  "params": ${JSON.stringify(api.request_params || {}, null, 2)}\n}`
          };
          api.parameter_guide = parameterGuide;
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

      case 'query-api-with-summary': {
        console.error(`🔍 [MCP] Querying API ${args.api_id} with summary`);
        // Fetch API with auth token for internal execution
        const api = await apiService.getAPIById(args.api_id, true);
        if (!api) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ error: 'API not found' }, null, 2)
            }],
            isError: true
          };
        }

        // Execute API call (auth token will be auto-injected by apiTester)
        const testResult = await apiTester.executeAPICall(api, {
          params: args.params || api.request_params || {},
          headers: args.headers || {}
        });

        // If API call itself failed, return error immediately
        if (testResult.error) {
          console.error(`❌ API call failed: ${testResult.error}`);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                api_id: args.api_id,
                api_name: api.name,
                endpoint: api.endpoint,
                method: api.method,
                error: testResult.error,
                response_time: testResult.response_time
              }, null, 2)
            }],
            isError: true
          };
        }

        // Generate AI summary with fallback
        let aiSummary = 'AI summary not available';
        let modelUsed = 'none';

        try {
          const summaryPrompt = `Analyze this API response and provide a concise summary:

API: ${api.name} (${api.method} ${api.endpoint})
Status: ${testResult.status}
Response Time: ${testResult.response_time}ms

Response Data:
${JSON.stringify(testResult.body, null, 2)}

Provide:
1. Brief summary of what the API returned
2. Key data points
3. Any notable patterns or insights
4. Potential issues or recommendations`;

          const aiResponse = await multiModelService.generateCompletion('default', summaryPrompt, {
            temperature: 0.3,
            maxTokens: 500
          });

          aiSummary = aiResponse.content || aiResponse;
          modelUsed = aiResponse.provider || 'default';
          console.error(`✅ AI summary generated using ${modelUsed}`);
        } catch (aiError) {
          console.error(`⚠️  AI summary generation failed: ${aiError.message}`);
          aiSummary = `AI summary generation failed: ${aiError.message}. API response returned successfully.`;
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              api_id: args.api_id,
              api_name: api.name,
              endpoint: api.endpoint,
              method: api.method,
              response: {
                status: testResult.status,
                response_time: testResult.response_time,
                body: testResult.body
              },
              ai_summary: aiSummary,
              model_used: modelUsed
            }, null, 2)
          }]
        };
      }

      case 'validate-and-execute-api': {
        console.error(`✅ [MCP] Validating and executing API ${args.api_id}`);
        // Fetch API with auth token for internal execution
        const api = await apiService.getAPIById(args.api_id, true);
        if (!api) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ error: 'API not found' }, null, 2)
            }],
            isError: true
          };
        }

        // Validate HTTP method
        const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
        const requestMethod = args.method || api.method;
        if (!validMethods.includes(requestMethod)) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'Invalid HTTP method',
                provided: requestMethod,
                allowed: validMethods
              }, null, 2)
            }],
            isError: true
          };
        }

        // Validate method matches registered API
        if (args.method && args.method !== api.method) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'Method mismatch',
                registered: api.method,
                provided: args.method,
                message: 'Provided method does not match registered API method'
              }, null, 2)
            }],
            isError: true
          };
        }

        // Fetch latest metadata for validation
        const metadata = await apiService.getAIMetadata(args.api_id, 1);
        let validationWarnings = [];

        if (metadata && metadata.length > 0) {
          const latestMetadata = metadata[0];
          const recommendations = latestMetadata.ai_recommendations || {};

          // Check auth requirements
          if (recommendations.authorization_required &&
              (!args.headers || !args.headers.Authorization)) {
            validationWarnings.push({
              type: 'auth_missing',
              message: 'This API requires authorization but no Authorization header provided',
              auth_type: recommendations.auth_type || 'Unknown'
            });
          }

          // Check required headers
          if (recommendations.required_headers && recommendations.required_headers.length > 0) {
            const missingHeaders = recommendations.required_headers.filter(
              h => !args.headers || !args.headers[h]
            );
            if (missingHeaders.length > 0) {
              validationWarnings.push({
                type: 'missing_headers',
                message: 'Missing recommended headers',
                missing: missingHeaders
              });
            }
          }

          // Check required params
          if (recommendations.required_params && recommendations.required_params.length > 0) {
            const missingParams = recommendations.required_params.filter(
              p => !args.params || !args.params[p]
            );
            if (missingParams.length > 0) {
              validationWarnings.push({
                type: 'missing_params',
                message: 'Missing recommended parameters',
                missing: missingParams
              });
            }
          }
        }

        // Execute API call
        const testResult = await apiTester.executeAPICall(api, {
          params: args.params || api.request_params || {},
          headers: args.headers || {}
        });

        // Store test result
        await apiService.storeTestResult({
          api_id: args.api_id,
          scenario_name: 'validated_execution',
          response_status: testResult.status,
          response_time: testResult.response_time,
          response_body: testResult.body,
          request_params: args.params || api.request_params || {},
          request_headers: args.headers || {},
          success: testResult.success,
          error_message: testResult.error || null
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              validation: {
                method: 'valid',
                warnings: validationWarnings
              },
              execution: {
                status: testResult.status,
                response_time: testResult.response_time,
                success: testResult.success,
                body: testResult.body
              },
              metadata_used: metadata && metadata.length > 0
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
    },
    {
      uri: 'api://metadata/{id}',
      name: 'API Metadata',
      description: 'Access AI-generated metadata and analysis for an API',
      mimeType: 'application/json'
    },
    {
      uri: 'api://all-metadata',
      name: 'All API Metadata',
      description: 'Browse all API metadata stored in database',
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

    if (uri.startsWith('api://metadata/')) {
      const id = parseInt(uri.replace('api://metadata/', ''));
      const metadata = await apiService.getAIMetadata(id, 10);
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(metadata || [], null, 2)
        }]
      };
    }

    if (uri === 'api://all-metadata') {
      const allApis = await apiService.getAllAPIs({});
      const allMetadata = await Promise.all(
        allApis.map(async (api) => {
          const metadata = await apiService.getAIMetadata(api.id, 1);
          return {
            api_id: api.id,
            api_name: api.name,
            endpoint: api.endpoint,
            metadata: metadata[0] || null
          };
        })
      );
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(allMetadata, null, 2)
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
