/**
 * A2A Protocol Endpoints
 * Implements Agent2Agent protocol for buyer and seller agents
 * Uses OpenAI LLM for intelligent tool selection
 */

import express from 'express';
import { randomUUID } from 'crypto';
import OpenAI from 'openai';
import axios from 'axios';
import { loadPrompt } from './promptLoader.js';

// Simple in-memory task storage
const tasks = new Map();

// Export tasks map for progress tracking
export function getTask(taskId) {
  return tasks.get(taskId);
}

export function getAllTasks() {
  return Array.from(tasks.values());
}

// OpenAI client for AI-powered agents
let openaiClient = null;
let useAI = false;

/**
 * Initialize OpenAI for AI-powered agents
 */
export function initializeAIAgents(openaiApiKey) {
  if (openaiApiKey) {
    openaiClient = new OpenAI({ apiKey: openaiApiKey });
    useAI = true;
    console.log('✅ AI-powered agents initialized with OpenAI');
  } else {
    useAI = false;
    console.log('⚠️  Agents running in pattern-matching mode (no AI)');
  }
}

/**
 * Create A2A router for an agent (buyer or seller)
 */
export function createA2ARouter(role, mcpToolHandlers, mcpTools) {
  const router = express.Router();

  /**
   * Agent Card endpoint - A2A Protocol v0.3.0 compliant
   */
  router.get('/card', (req, res) => {
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;
    const agentUrl = `${baseUrl}/a2a/${role}`;

    // Define skills based on role (A2A v0.3.0 format)
    const buyerSkills = [
      {
        name: 'campaign-planning',
        description: 'Plan and design advertising campaigns',
        inputModes: ['text/plain', 'application/json'],
        outputModes: ['text/plain', 'application/json']
      },
      {
        name: 'order-creation',
        description: 'Create and manage advertising orders',
        inputModes: ['application/json'],
        outputModes: ['application/json']
      },
      {
        name: 'creative-submission',
        description: 'Submit and manage creative assets',
        inputModes: ['application/json'],
        outputModes: ['application/json']
      },
      {
        name: 'product-discovery',
        description: 'Search and discover advertising products',
        inputModes: ['text/plain'],
        outputModes: ['application/json']
      }
    ];

    const sellerSkills = [
      {
        name: 'product-search',
        description: 'Search available advertising inventory',
        inputModes: ['text/plain', 'application/json'],
        outputModes: ['application/json']
      },
      {
        name: 'inventory-management',
        description: 'Manage publisher inventory and products',
        inputModes: ['application/json'],
        outputModes: ['application/json']
      },
      {
        name: 'order-processing',
        description: 'Process and fulfill advertising orders',
        inputModes: ['application/json'],
        outputModes: ['application/json']
      },
      {
        name: 'creative-approval',
        description: 'Review and approve creative submissions',
        inputModes: ['application/json'],
        outputModes: ['application/json']
      }
    ];

    // A2A v0.3.0 compliant agent card
    const card = {
      name: `opendirect-${role}-agent`,
      description: role === 'buyer'
        ? 'Manages advertiser campaigns, orders, and creative submissions using OpenDirect v2.1'
        : 'Manages publisher inventory, products, and order fulfillment using OpenDirect v2.1',
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
      additionalInterfaces: [
        {
          protocol: 'http+json',
          version: '1.0',
          endpoints: {
            sendMessage: `${agentUrl}/message`,
            getTask: `${agentUrl}/task/{taskId}`,
            cancelTask: `${agentUrl}/task/{taskId}/cancel`
          }
        },
        {
          protocol: 'mcp',
          version: '2024-11-05',
          endpoint: role === 'buyer'
            ? `${baseUrl}/schema/mcp/sse`
            : `${baseUrl}/agenticdirect/mcp/sse`,
          tools: mcpTools.map(t => t.name)
        }
      ]
    };

    res.json(card);
  });

  /**
   * Send Message - A2A Protocol
   */
  router.post('/message', async (req, res) => {
    try {
      const { contextId, taskId, message, autonomous, sessionId } = req.body.params || req.body;

      console.log(`\n📨 A2A ${role} received message:`, message.parts[0].text);
      console.log(`   Mode: ${autonomous ? '🤖 Autonomous' : '🔧 Orchestrated'}`);

      // Create new task
      const task = {
        id: taskId || randomUUID(),
        contextId: contextId || randomUUID(),
        status: {
          state: 'submitted',
          timestamp: new Date().toISOString()
        },
        history: [{
          role: message.role,
          parts: message.parts,
          timestamp: new Date().toISOString()
        }],
        artifacts: [],
        steps: [] // For autonomous mode progress tracking
      };

      tasks.set(task.id, task);

      // Process message asynchronously
      processMessageAsync(task.id, message, role, mcpToolHandlers, mcpTools, autonomous, sessionId)
        .catch(error => {
          console.error(`❌ Task processing failed:`, error);
          const failedTask = tasks.get(task.id);
          if (failedTask) {
            failedTask.status = {
              state: 'failed',
              message: error.message,
              timestamp: new Date().toISOString()
            };
          }
        });

      // Return task immediately (async pattern)
      res.json({
        jsonrpc: '2.0',
        id: req.body.id || Date.now(),
        result: { task }
      });

    } catch (error) {
      res.json({
        jsonrpc: '2.0',
        id: req.body.id || Date.now(),
        error: {
          code: -32603,
          message: error.message
        }
      });
    }
  });

  /**
   * Get Task - A2A Protocol
   */
  router.post('/task/:taskId', (req, res) => {
    const { taskId } = req.params;
    const task = tasks.get(taskId);

    if (!task) {
      return res.json({
        jsonrpc: '2.0',
        id: req.body.id || Date.now(),
        error: {
          code: -32602,
          message: `Task not found: ${taskId}`
        }
      });
    }

    res.json({
      jsonrpc: '2.0',
      id: req.body.id || Date.now(),
      result: { task }
    });
  });

  /**
   * Cancel Task - A2A Protocol
   */
  router.post('/task/:taskId/cancel', (req, res) => {
    const { taskId } = req.params;
    const task = tasks.get(taskId);

    if (!task) {
      return res.json({
        jsonrpc: '2.0',
        id: req.body.id || Date.now(),
        error: {
          code: -32602,
          message: `Task not found: ${taskId}`
        }
      });
    }

    task.status = {
      state: 'cancelled',
      timestamp: new Date().toISOString()
    };

    res.json({
      jsonrpc: '2.0',
      id: req.body.id || Date.now(),
      result: { task }
    });
  });

  return router;
}

/**
 * Process A2A message asynchronously
 */
async function processMessageAsync(taskId, message, role, mcpToolHandlers, mcpTools, autonomous = false, sessionId = null) {
  const task = tasks.get(taskId);
  if (!task) return;

  // Update status to working
  task.status = {
    state: 'working',
    timestamp: new Date().toISOString()
  };

  try {
    const messageText = message.parts[0].text;

    if (autonomous && useAI && openaiClient) {
      console.log(`🤖 Autonomous mode requested for ${role} agent`);
      try {
        // Autonomous mode: create and execute plan
        await processAutonomousMode(taskId, messageText, role, mcpToolHandlers, mcpTools, sessionId);
      } catch (autonomousError) {
        console.error(`❌ Autonomous mode failed for ${role}, falling back to orchestrated:`, autonomousError.message);
        // Fallback to orchestrated mode
        await processOrchestratedMode(taskId, messageText, role, mcpToolHandlers, mcpTools);
      }
    } else {
      // Orchestrated mode: simple tool selection
      await processOrchestratedMode(taskId, messageText, role, mcpToolHandlers, mcpTools);
    }

  } catch (error) {
    console.error(`❌ ${role} agent processing failed:`, error);

    const task = tasks.get(taskId);
    if (task) {
      task.status = {
        state: 'failed',
        message: error.message,
        timestamp: new Date().toISOString()
      };

      task.artifacts.push({
        type: 'text',
        text: `Error: ${error.message}`
      });
    }
  }
}

/**
 * Process in orchestrated mode (simple tool selection)
 */
async function processOrchestratedMode(taskId, messageText, role, mcpToolHandlers, mcpTools) {
  const task = tasks.get(taskId);
  if (!task) return;

  // Parse message to determine which MCP tool to call
  const toolCall = await parseMessageToToolCall(messageText, mcpTools, role);

  console.log(`🔧 ${role} agent calling tool: ${toolCall.toolName}`);

  // Get MCP tool handler
  const handler = mcpToolHandlers.get(toolCall.toolName);
  if (!handler) {
    throw new Error(`Tool not found: ${toolCall.toolName}`);
  }

  // Execute MCP tool
  const result = await handler(toolCall.parameters);

  console.log(`✅ ${role} agent tool executed successfully`);

  // Add result as artifact
  task.artifacts.push({
    type: 'data',
    mimeType: 'application/json',
    data: result.data || result
  });

  // Add response message to history
  task.history.push({
    role: 'agent',
    parts: [{
      type: 'text',
      text: `Completed ${toolCall.toolName}: ${JSON.stringify(result, null, 2)}`
    }],
    timestamp: new Date().toISOString()
  });

  // Mark as completed
  task.status = {
    state: 'completed',
    timestamp: new Date().toISOString()
  };
}

/**
 * Process in autonomous mode (plan creation and execution)
 */
async function processAutonomousMode(taskId, messageText, role, mcpToolHandlers, mcpTools, sessionId) {
  const task = tasks.get(taskId);
  if (!task) return;

  console.log(`🤖 ${role} agent entering autonomous mode`);
  console.log(`   Message: ${messageText.substring(0, 100)}...`);

  try {
    // Step 1: Create plan or response using AI
    const plan = await createAutonomousPlan(messageText, role, mcpTools);

    console.log(`📋 ${role} agent created plan with ${plan.actions?.length || plan.steps?.length || 0} steps`);
    console.log(`   Plan:`, JSON.stringify(plan, null, 2).substring(0, 500));

  // Add plan to task
  task.artifacts.push({
    type: 'plan',
    mimeType: 'application/json',
    data: plan
  });

  // Step 2: Execute plan steps
  const actions = plan.actions || plan.steps || [];

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const stepNum = action.actionNumber || action.stepNumber || (i + 1);

    console.log(`   Step ${stepNum}/${actions.length}: ${action.description}`);

    // Update task with current step
    task.steps.push({
      stepNumber: stepNum,
      description: action.description,
      type: action.type,
      status: 'in_progress',
      timestamp: new Date().toISOString()
    });

    try {
      if (action.type === 'tool' && action.details?.tool) {
        // Execute MCP tool
        const toolResult = await executeToolAction(action, mcpToolHandlers);

        // Store result
        task.steps[task.steps.length - 1].result = toolResult;
        task.steps[task.steps.length - 1].status = 'completed';

        console.log(`   ✅ Step ${stepNum} completed`);

      } else if (action.type === 'negotiate' && action.details?.message) {
        // Send A2A message to other agent
        const negotiationResult = await executeNegotiationAction(action, sessionId);

        // Store result
        task.steps[task.steps.length - 1].result = negotiationResult;
        task.steps[task.steps.length - 1].status = 'completed';

        console.log(`   ✅ Step ${stepNum} completed (negotiation)`);

      } else if (action.type === 'decision') {
        // Decision/evaluation step
        task.steps[task.steps.length - 1].result = {
          evaluated: true,
          criteria: action.details?.params?.criteria
        };
        task.steps[task.steps.length - 1].status = 'completed';

        console.log(`   ✅ Step ${stepNum} completed (decision)`);
      }

    } catch (stepError) {
      console.error(`   ❌ Step ${stepNum} failed:`, stepError.message);

      task.steps[task.steps.length - 1].status = 'failed';
      task.steps[task.steps.length - 1].error = stepError.message;

      // Continue with next step (error recovery)
    }
  }

  // Step 3: Generate final response
  const finalResponse = plan.response || generateFinalResponse(plan, task.steps, role);

  // Add final response to history
  task.history.push({
    role: 'agent',
    parts: [{
      type: 'text',
      text: finalResponse
    }],
    timestamp: new Date().toISOString()
  });

  // Add execution summary as artifact
  task.artifacts.push({
    type: 'execution_summary',
    mimeType: 'application/json',
    data: {
      plan: plan,
      executedSteps: task.steps,
      finalResponse: finalResponse
    }
  });

  // Mark as completed
  task.status = {
    state: 'completed',
    timestamp: new Date().toISOString()
  };

  console.log(`✅ ${role} agent autonomous execution completed`);

  } catch (error) {
    console.error(`❌ ${role} agent autonomous mode failed:`, error);

    task.status = {
      state: 'failed',
      message: `Autonomous mode error: ${error.message}`,
      timestamp: new Date().toISOString()
    };

    task.artifacts.push({
      type: 'error',
      text: `Autonomous mode failed: ${error.message}\nStack: ${error.stack}`
    });

    // Re-throw to trigger fallback
    throw error;
  }
}

/**
 * Create autonomous plan using AI prompts
 */
async function createAutonomousPlan(messageText, role, mcpTools) {
  const promptName = role === 'buyer' ? 'autonomous-planner' : 'autonomous-responder';
  const systemPrompt = loadPrompt(role, promptName);

  if (!systemPrompt) {
    throw new Error(`Prompt not found: ${role}/${promptName}`);
  }

  // Add available tools context
  const toolsContext = `\n\nAvailable MCP Tools:\n${mcpTools.map(t =>
    `- ${t.name}: ${t.description || 'No description'}`
  ).join('\n')}`;

  const response = await openaiClient.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt + toolsContext },
      { role: 'user', content: messageText }
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' }
  });

  const plan = JSON.parse(response.choices[0].message.content);
  return plan;
}

/**
 * Execute a tool action from the plan
 */
async function executeToolAction(action, mcpToolHandlers) {
  const toolName = action.details.tool;
  const params = action.details.params || {};

  const handler = mcpToolHandlers.get(toolName);
  if (!handler) {
    throw new Error(`Tool not found: ${toolName}`);
  }

  const result = await handler(params);
  return result.data || result;
}

/**
 * Execute a negotiation action (send A2A message to another agent)
 */
async function executeNegotiationAction(action, sessionId) {
  const targetAgent = action.agent; // 'buyer' or 'seller'

  if (!targetAgent || targetAgent === 'self') {
    // No actual negotiation needed
    return {
      negotiated: false,
      message: action.details.message,
      response: 'Self-action, no negotiation needed'
    };
  }

  try {
    // Determine target endpoint
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const targetEndpoint = `${baseUrl}/a2a/${targetAgent}/message`;

    // Create A2A message
    const message = {
      role: 'user',
      parts: [{
        type: 'text',
        text: action.details.message
      }]
    };

    // Send A2A message
    const response = await axios.post(targetEndpoint, {
      jsonrpc: '2.0',
      method: 'agent.sendMessage',
      params: {
        contextId: sessionId || randomUUID(),
        message: message,
        autonomous: true,
        sessionId: sessionId
      },
      id: Date.now()
    });

    const task = response.data.result?.task;

    // Wait for task completion (poll for result)
    if (task) {
      const completedTask = await waitForTaskCompletion(task.id, targetAgent, baseUrl);

      return {
        negotiated: true,
        message: action.details.message,
        response: completedTask.history[completedTask.history.length - 1]?.parts[0]?.text || 'No response',
        taskId: task.id,
        artifacts: completedTask.artifacts
      };
    }

    return {
      negotiated: true,
      message: action.details.message,
      response: 'Message sent, no task returned'
    };

  } catch (error) {
    console.error('Negotiation failed:', error.message);
    return {
      negotiated: false,
      message: action.details.message,
      response: `Error: ${error.message}`
    };
  }
}

/**
 * Wait for task completion by polling
 */
async function waitForTaskCompletion(taskId, agentRole, baseUrl, maxWaitTime = 30000) {
  const startTime = Date.now();
  const pollInterval = 500; // Poll every 500ms

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const response = await axios.post(`${baseUrl}/a2a/${agentRole}/task/${taskId}`, {
        jsonrpc: '2.0',
        method: 'agent.getTask',
        params: { taskId },
        id: Date.now()
      });

      const task = response.data.result?.task;

      if (task && (task.status.state === 'completed' || task.status.state === 'failed')) {
        return task;
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));

    } catch (error) {
      console.error('Error polling task:', error.message);
      break;
    }
  }

  throw new Error('Task completion timeout');
}

/**
 * Generate final response from plan and execution results
 */
function generateFinalResponse(plan, steps, role) {
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const failedSteps = steps.filter(s => s.status === 'failed').length;

  let response = `${role.charAt(0).toUpperCase() + role.slice(1)} Agent Execution Summary:\n\n`;
  response += `Strategy: ${plan.strategy || plan.understanding}\n`;
  response += `Steps Completed: ${completedSteps}/${steps.length}\n`;

  if (failedSteps > 0) {
    response += `Steps Failed: ${failedSteps}\n`;
  }

  response += `\nExecution Details:\n`;
  steps.forEach(step => {
    const status = step.status === 'completed' ? '✅' :
                   step.status === 'failed' ? '❌' : '⏳';
    response += `${status} Step ${step.stepNumber}: ${step.description}\n`;
  });

  return response;
}

/**
 * Parse natural language message to MCP tool call
 * Uses OpenAI LLM for intelligent tool selection
 */
async function parseMessageToToolCall(messageText, mcpTools, role) {
  // Use AI if available
  if (useAI && openaiClient) {
    return await parseMessageWithAI(messageText, mcpTools, role);
  }

  // Fallback to pattern matching
  return parseMessageWithPatterns(messageText, mcpTools);
}

/**
 * AI-powered tool selection using OpenAI
 */
async function parseMessageWithAI(messageText, mcpTools, role) {
  try {
    // Convert MCP tools to OpenAI function format
    const functions = mcpTools.map(tool => ({
      name: tool.name,
      description: tool.description || `${tool.name} tool`,
      parameters: tool.inputSchema || {
        type: 'object',
        properties: {},
        required: []
      }
    }));

    const systemPrompt = `You are a ${role} agent in an OpenDirect advertising workflow system.

Your role:
${role === 'buyer' ?
  '- Manage advertiser accounts, orders, lines, and creatives\n- Create and manage campaign structures\n- Submit orders to publishers' :
  '- Manage publisher inventory and products\n- Search and list available ad products\n- Process incoming orders from buyers'
}

Available tools: ${mcpTools.map(t => t.name).join(', ')}

Analyze the user's request and select the most appropriate tool to use. Fill in parameters intelligently based on the message context.`;

    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: messageText }
      ],
      functions: functions,
      function_call: 'auto',
      temperature: 0.3
    });

    const message = response.choices[0].message;

    if (message.function_call) {
      const toolName = message.function_call.name;
      const parameters = JSON.parse(message.function_call.arguments);

      console.log(`🤖 AI selected tool: ${toolName}`, parameters);

      return {
        toolName,
        parameters
      };
    }

    // No function call, fallback to pattern matching
    console.log('⚠️  AI did not select a function, falling back to patterns');
    return parseMessageWithPatterns(messageText, mcpTools);

  } catch (error) {
    console.error('❌ AI tool selection failed, falling back to patterns:', error.message);
    return parseMessageWithPatterns(messageText, mcpTools);
  }
}

/**
 * Pattern-based tool selection (fallback)
 */
function parseMessageWithPatterns(messageText, mcpTools) {
  const lower = messageText.toLowerCase();

  // Search products
  if (lower.includes('search') && lower.includes('product')) {
    return {
      toolName: 'search_products',
      parameters: {
        publisher: extractEntity(messageText, ['cnn', 'forbes', 'nytimes', 'espn']) || 'CNN Digital'
      }
    };
  }

  // Create account
  if (lower.includes('create') && lower.includes('account')) {
    const advertiserName = extractEntity(messageText, ['nike', 'coca-cola', 'apple', 'samsung']) || 'New Advertiser';
    return {
      toolName: 'create_account',
      parameters: {
        Name: `${advertiserName} Account`,
        AdvertiserId: randomUUID(),
        BuyerId: randomUUID()
      }
    };
  }

  // Create order
  if (lower.includes('create') && lower.includes('order')) {
    const accountIdMatch = messageText.match(/account\s+([a-f0-9-]+)/i);
    const productIdMatch = messageText.match(/product\s+([a-f0-9-]+)/i);

    return {
      toolName: 'create_order',
      parameters: {
        AccountId: accountIdMatch?.[1] || randomUUID(),
        Name: 'Campaign Order',
        Budget: 10000,
        Currency: 'USD',
        StartDate: new Date().toISOString(),
        EndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    };
  }

  // List products
  if (lower.includes('list') && lower.includes('product')) {
    return {
      toolName: 'list_products',
      parameters: {}
    };
  }

  // Get order
  if (lower.includes('order') && (lower.includes('status') || lower.includes('check') || lower.includes('get'))) {
    const orderIdMatch = messageText.match(/order[:\s]+([a-f0-9-]+)/i);
    return {
      toolName: 'get_order',
      parameters: {
        id: orderIdMatch?.[1] || 'unknown'
      }
    };
  }

  // Default - list available tools
  return {
    toolName: mcpTools[0]?.name || 'unknown',
    parameters: {}
  };
}

/**
 * Extract entity from message
 */
function extractEntity(message, entities) {
  const lower = message.toLowerCase();
  for (const entity of entities) {
    if (lower.includes(entity.toLowerCase())) {
      return entity.charAt(0).toUpperCase() + entity.slice(1);
    }
  }
  return null;
}
