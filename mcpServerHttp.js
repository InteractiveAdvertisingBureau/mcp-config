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
      },
      {
        name: 'query-api-with-summary',
        description: 'Execute an API call and return response with AI-generated summary and analysis',
        inputSchema: {
          type: 'object',
          properties: {
            api_id: {
              type: 'integer',
              description: 'ID of the registered API to query'
            },
            params: {
              type: 'object',
              description: 'Request parameters for the API call'
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

        case 'query-api-with-summary': {
          console.log(`🔍 [MCP] Querying API ${args.api_id} with summary`);
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

          // Generate AI summary
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
                ai_summary: aiResponse.content || aiResponse,
                model_used: aiResponse.provider || 'default'
              }, null, 2)
            }]
          };
        }

        case 'validate-and-execute-api': {
          console.log(`✅ [MCP] Validating and executing API ${args.api_id}`);
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
