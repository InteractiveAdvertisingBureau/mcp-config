/**
 * A2A SDK-based Router
 * Standards-compliant A2A v0.3.0 implementation
 * Uses types from @a2a-js/sdk
 */

import express from 'express';
import { AGENT_CARD_PATH } from '@a2a-js/sdk';
import { randomUUID } from 'crypto';
import { OpenDirectAgentExecutor } from './agentExecutor.js';

// In-memory task storage
const tasks = new Map();

/**
 * Create A2A SDK-based router for an agent
 * @param {string} role - 'buyer' or 'seller'
 * @param {Map} mcpToolHandlers - MCP tool handlers
 * @param {Array} mcpTools - MCP tool definitions
 * @param {OpenAI} openaiClient - OpenAI client instance
 */
export function createA2ASDKRouter(role, mcpToolHandlers, mcpTools, openaiClient) {
  const router = express.Router();

  // Create agent executor with our custom logic
  const agentExecutor = new OpenDirectAgentExecutor(
    role,
    mcpToolHandlers,
    mcpTools,
    openaiClient
  );

  // Agent card at /.well-known/agent-card.json (A2A standard)
  // Dynamically generate based on request URL
  router.get(`/${AGENT_CARD_PATH}`, (req, res) => {
    const agentCard = createAgentCard(role, mcpTools, req);
    res.json(agentCard);
  });

  // Legacy /card endpoint for backwards compatibility
  router.get('/card', (req, res) => {
    const agentCard = createAgentCard(role, mcpTools, req);
    res.json(agentCard);
  });

  // Default endpoint at root - forward to JSON-RPC (A2A v0.3.0 expects POST to url)
  router.post('/', express.json(), async (req, res) => {
    await handleJSONRPC(req, res, agentExecutor, role);
  });

  // JSON-RPC 2.0 transport (A2A standard)
  router.post('/jsonrpc', express.json(), async (req, res) => {
    await handleJSONRPC(req, res, agentExecutor, role);
  });

  // REST/HTTP+JSON transport (A2A standard)
  router.post('/rest/sendMessage', express.json(), async (req, res) => {
    await handleRESTSendMessage(req, res, agentExecutor, role);
  });

  router.get('/rest/getTask/:taskId', async (req, res) => {
    await handleRESTGetTask(req, res);
  });

  router.post('/rest/cancelTask/:taskId', async (req, res) => {
    await handleRESTCancelTask(req, res, agentExecutor);
  });

  return router;
}

/**
 * Handle JSON-RPC 2.0 requests
 */
async function handleJSONRPC(req, res, agentExecutor, role) {
  const { jsonrpc, method, params, id } = req.body;

  console.log(`📥 JSON-RPC request: method="${method}", id=${id}`);

  if (jsonrpc !== '2.0') {
    return res.json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Invalid Request' },
      id: id || null
    });
  }

  try {
    let result;

    switch (method) {
      case 'sendMessage':
      case 'message/send':  // Official A2A client uses this format
        result = await handleSendMessage(params, agentExecutor, role);
        break;
      case 'getTask':
      case 'task/get':
      case 'tasks/get':  // Official A2A client uses this format (plural)
        result = await handleGetTask(params);
        break;
      case 'cancelTask':
      case 'task/cancel':
      case 'tasks/cancel':  // Official A2A client uses this format (plural)
        result = await handleCancelTask(params, agentExecutor);
        break;
      default:
        console.log(`❌ Unknown method: ${method}`);
        return res.json({
          jsonrpc: '2.0',
          error: { code: -32601, message: 'Method not found' },
          id
        });
    }

    res.json({ jsonrpc: '2.0', result, id });
  } catch (error) {
    res.json({
      jsonrpc: '2.0',
      error: { code: -32603, message: error.message },
      id
    });
  }
}

/**
 * Handle REST sendMessage
 */
async function handleRESTSendMessage(req, res, agentExecutor, role) {
  try {
    const result = await handleSendMessage(req.body, agentExecutor, role);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Handle REST getTask
 */
async function handleRESTGetTask(req, res) {
  try {
    const result = await handleGetTask({ taskId: req.params.taskId });
    res.json(result);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
}

/**
 * Handle REST cancelTask
 */
async function handleRESTCancelTask(req, res, agentExecutor) {
  try {
    const result = await handleCancelTask({ taskId: req.params.taskId }, agentExecutor);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Send message and create task
 */
async function handleSendMessage(params, agentExecutor, role) {
  const { message, contextId, taskId } = params;

  const newTaskId = taskId || randomUUID();
  const newContextId = contextId || randomUUID();

  // Create task
  const task = {
    kind: 'task',
    id: newTaskId,
    contextId: newContextId,
    status: {
      state: 'submitted',
      timestamp: new Date().toISOString()
    },
    history: [message]
  };

  tasks.set(newTaskId, task);

  // Process asynchronously with executor
  processTask(newTaskId, message, agentExecutor, params.metadata)
    .catch(error => {
      const failedTask = tasks.get(newTaskId);
      if (failedTask) {
        failedTask.status = {
          state: 'failed',
          message: error.message,
          timestamp: new Date().toISOString()
        };
      }
    });

  return { task };
}

/**
 * Get task by ID
 */
async function handleGetTask(params) {
  const task = tasks.get(params.taskId);
  if (!task) {
    throw new Error(`Task not found: ${params.taskId}`);
  }
  return { task };
}

/**
 * Cancel task
 */
async function handleCancelTask(params, agentExecutor) {
  const task = tasks.get(params.taskId);
  if (!task) {
    throw new Error(`Task not found: ${params.taskId}`);
  }

  await agentExecutor.cancelTask(params.taskId);

  task.status = {
    state: 'canceled',
    timestamp: new Date().toISOString()
  };

  return { task };
}

/**
 * Process task using executor
 */
async function processTask(taskId, message, agentExecutor, metadata) {
  const task = tasks.get(taskId);
  if (!task) return;

  // Update status to working
  task.status = {
    state: 'working',
    timestamp: new Date().toISOString()
  };

  // Create simple event bus
  const eventBus = {
    publish: (event) => {
      if (event.kind === 'message') {
        task.history.push(event);
      }
    },
    finished: () => {
      task.status = {
        state: 'completed',
        timestamp: new Date().toISOString()
      };
    }
  };

  // Execute with our custom executor
  const requestContext = {
    message,
    contextId: task.contextId,
    taskId: task.id,
    metadata: metadata || {}
  };

  await agentExecutor.execute(requestContext, eventBus);
}

/**
 * Create A2A v0.3.0 compliant agent card
 * Automatically detects the base URL from the incoming request
 */
function createAgentCard(role, mcpTools, req) {
  // Automatically detect protocol and host from request
  let protocol = 'http';
  let host = 'localhost:3000';

  if (req) {
    // Get protocol from request (handles proxies with X-Forwarded-Proto)
    protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
    // Get host from request (handles proxies with X-Forwarded-Host)
    host = req.get('x-forwarded-host') || req.get('host') || 'localhost:3000';
  }

  // Allow environment variables to override if needed
  protocol = process.env.PROTOCOL || protocol;
  host = process.env.HOST || host;

  const baseUrl = `${protocol}://${host}`;
  const agentUrl = `${baseUrl}/a2a/${role}`;

  // Define skills based on role
  const buyerSkills = [
    {
      id: 'campaign-planning',
      name: 'Campaign Planning',
      description: 'Plan and design advertising campaigns',
      tags: ['advertising', 'campaign', 'planning'],
      examples: [
        'Create a campaign for Nike summer collection',
        'Plan an advertising campaign targeting millennials'
      ],
      inputModes: ['text/plain', 'application/json'],
      outputModes: ['text/plain', 'application/json']
    },
    {
      id: 'order-creation',
      name: 'Order Creation',
      description: 'Create and manage advertising orders',
      tags: ['advertising', 'order', 'creation'],
      examples: [
        'Create an account for Nike',
        'Create an order for Adidas campaign',
        'Set up a new advertiser account'
      ],
      inputModes: ['application/json'],
      outputModes: ['application/json']
    },
    {
      id: 'creative-submission',
      name: 'Creative Submission',
      description: 'Submit and manage creative assets',
      tags: ['advertising', 'creative', 'assets'],
      examples: [
        'Submit creative for Nike banner ad',
        'Upload video creative for campaign'
      ],
      inputModes: ['application/json'],
      outputModes: ['application/json']
    },
    {
      id: 'product-discovery',
      name: 'Product Discovery',
      description: 'Search and discover advertising products',
      tags: ['advertising', 'product', 'search'],
      examples: [
        'Find premium advertising products',
        'Search for video ad inventory'
      ],
      inputModes: ['text/plain'],
      outputModes: ['application/json']
    }
  ];

  const sellerSkills = [
    {
      id: 'product-search',
      name: 'Product Search',
      description: 'Search available advertising inventory',
      tags: ['advertising', 'inventory', 'search'],
      inputModes: ['text/plain', 'application/json'],
      outputModes: ['application/json']
    },
    {
      id: 'inventory-management',
      name: 'Inventory Management',
      description: 'Manage publisher inventory and products',
      tags: ['advertising', 'inventory', 'management'],
      inputModes: ['application/json'],
      outputModes: ['application/json']
    },
    {
      id: 'order-processing',
      name: 'Order Processing',
      description: 'Process and fulfill advertising orders',
      tags: ['advertising', 'order', 'fulfillment'],
      inputModes: ['application/json'],
      outputModes: ['application/json']
    },
    {
      id: 'creative-approval',
      name: 'Creative Approval',
      description: 'Review and approve creative submissions',
      tags: ['advertising', 'creative', 'approval'],
      inputModes: ['application/json'],
      outputModes: ['application/json']
    }
  ];

  return {
    name: `opendirect-${role}-agent`,
    description: role === 'buyer'
      ? 'Use this agent for ALL advertising-related requests including: creating accounts, managing campaigns, creating orders, submitting creatives, and searching for advertising products. Handles advertiser (buyer) operations using OpenDirect v2.1 standard.'
      : 'Use this agent for ALL publisher-related requests including: searching inventory, managing products, processing orders, and approving creatives. Handles publisher (seller) operations using OpenDirect v2.1 standard.',
    protocolVersion: '0.3.0',
    version: '1.0.0',
    url: agentUrl,
    skills: role === 'buyer' ? buyerSkills : sellerSkills,
    capabilities: {
      pushNotifications: false,
      streaming: true,
      mcpIntegration: true
    },
    defaultInputModes: ['text/plain', 'application/json'],
    defaultOutputModes: ['text/plain', 'application/json'],
    securitySchemes: {
      oauth2: {
        type: 'oauth2',
        description: 'OAuth 2.0 authentication for OpenDirect API access',
        flows: {
          clientCredentials: {
            tokenUrl: `${baseUrl}/oauth/token`,
            scopes: {
              'opendirect:read': 'Read access to OpenDirect resources',
              'opendirect:write': 'Write access to OpenDirect resources',
              'opendirect:admin': 'Administrative access to OpenDirect resources'
            }
          },
          authorizationCode: {
            authorizationUrl: `${baseUrl}/oauth/authorize`,
            tokenUrl: `${baseUrl}/oauth/token`,
            scopes: {
              'opendirect:read': 'Read access to OpenDirect resources',
              'opendirect:write': 'Write access to OpenDirect resources',
              'opendirect:admin': 'Administrative access to OpenDirect resources'
            }
          }
        }
      }
    },
    security: [
      {
        oauth2: ['opendirect:read', 'opendirect:write']
      }
    ],
    additionalInterfaces: [
      {
        protocol: 'jsonrpc',
        version: '2.0',
        transport: 'http',
        url: `${agentUrl}/jsonrpc`
      },
      {
        protocol: 'http+json',
        version: '1.0',
        transport: 'http',
        url: `${agentUrl}/rest`
      },
      {
        protocol: 'mcp',
        version: '2024-11-05',
        transport: 'sse',
        tools: mcpTools.map(t => t.name)
      }
    ]
  };
}
