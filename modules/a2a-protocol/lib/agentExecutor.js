/**
 * Advanced AgentExecutor for OpenDirect agents
 * Migrated from a2a-agenticdirect-standalone with multi-step workflow support
 * Uses @a2a-js/sdk with OpenAI + MCP integration
 */

import OpenAI from 'openai';

/**
 * @typedef {Object} MCPTool
 * @property {string} name
 * @property {string} description
 * @property {Object} inputSchema
 * @property {string} inputSchema.type
 * @property {Object} inputSchema.properties
 * @property {string[]} [inputSchema.required]
 */

/**
 * @typedef {Object} ExecutionStep
 * @property {string} toolName
 * @property {Object} toolParams
 */

/**
 * @typedef {Object} ExecutionPlan
 * @property {string} [toolName] - Single tool execution
 * @property {Object} [toolParams] - Single tool parameters
 * @property {ExecutionStep[]} [steps] - Multi-step execution
 */

/**
 * @typedef {Object} RequestContext
 * @property {Object} message - A2A message
 * @property {string} contextId
 * @property {string} taskId
 * @property {Object} [metadata]
 */

/**
 * @typedef {Object} EventBus
 * @property {Function} publish - Publish message to event bus
 * @property {Function} finished - Mark task as finished
 */

/**
 * OpenDirect Agent Executor
 * Implements AgentExecutor interface from @a2a-js/sdk with multi-step workflow support
 */
export class OpenDirectAgentExecutor {
  /**
   * @param {'buyer' | 'seller'} role
   * @param {Map<string, Function>} mcpToolHandlers
   * @param {MCPTool[]} mcpTools
   * @param {OpenAI} openaiClient
   */
  constructor(role, mcpToolHandlers, mcpTools, openaiClient) {
    this.role = role;
    this.mcpToolHandlers = mcpToolHandlers;
    this.mcpTools = mcpTools;
    this.openaiClient = openaiClient;
    this.useAI = !!openaiClient;
  }

  /**
   * Execute agent task with multi-step workflow support
   * @param {RequestContext} requestContext - A2A request context with message and metadata
   * @param {EventBus} eventBus - Event bus for publishing responses
   */
  async execute(requestContext, eventBus) {
    const { message, contextId, taskId } = requestContext;
    const userMessage = this.extractTextFromMessage(message);

    console.log(`\n🤖 Agent Executor (${this.role}): Processing request`);
    console.log(`📝 User message: ${userMessage}`);

    try {
      if (!this.useAI) {
        // Fallback to simple pattern matching if no AI
        await this.processWithoutAI(userMessage, eventBus, contextId, taskId);
        eventBus.finished();
        return;
      }

      // Step 1: Select appropriate tools using AI
      const planResponse = await this.selectToolsWithAI(userMessage);

      // Check if multi-step or single-step
      const steps = planResponse.steps || [{
        toolName: planResponse.toolName,
        toolParams: planResponse.toolParams
      }];

      console.log(`📊 Execution plan: ${steps.length} step(s)`);

      const results = [];
      let previousResult = null;

      // Execute each step sequentially
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        console.log(`\n🔧 Step ${i + 1}/${steps.length}: ${step.toolName}`);

        // Replace placeholders with actual results from previous steps
        let params = { ...step.toolParams };
        if (previousResult && previousResult.id) {
          // Replace "__PREVIOUS_RESULT_ID__" placeholder with actual ID
          for (const key in params) {
            if (params[key] === '__PREVIOUS_RESULT_ID__') {
              params[key] = previousResult.id;
              console.log(`🔗 Linked ${key} to previous result ID: ${previousResult.id}`);
            }
          }
        }

        console.log(`📋 Parameters:`, JSON.stringify(params, null, 2));

        // Execute the tool
        const result = await this.executeTool(step.toolName, params);
        results.push({ tool: step.toolName, result });
        previousResult = result;

        console.log(`✅ Step ${i + 1} completed`);

        // Publish intermediate result for multi-step
        if (steps.length > 1) {
          const stepMessage = this.createAgentMessage(
            `Step ${i + 1}/${steps.length}: Successfully executed ${step.toolName}`,
            result,
            contextId,
            taskId
          );
          eventBus.publish(stepMessage);
        }
      }

      console.log(`\n✅ All ${steps.length} step(s) completed successfully`);

      // Step 3: Publish final summary
      const summary = steps.length > 1
        ? `Successfully completed ${steps.length} steps:\n${steps.map((s, i) => `${i + 1}. ${s.toolName}`).join('\n')}`
        : `Successfully executed ${steps[0].toolName}`;

      const finalMessage = this.createAgentMessage(
        summary,
        steps.length === 1 ? results[0].result : results,
        contextId,
        taskId
      );

      eventBus.publish(finalMessage);
      eventBus.finished();

    } catch (error) {
      console.error(`❌ Execution failed:`, error);

      // Publish error message
      const errorMessage = this.createAgentMessage(
        `Error: ${error.message}`,
        null,
        contextId,
        taskId
      );

      eventBus.publish(errorMessage);
      eventBus.finished();
    }
  }

  /**
   * Select tools using AI (supports multi-step workflows)
   * @param {string} userMessage
   * @returns {Promise<ExecutionPlan>}
   */
  async selectToolsWithAI(userMessage) {
    const toolsWithSchemas = this.mcpTools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.inputSchema.properties || {}
    }));

    const systemPrompt = `You are an AI assistant for the OpenDirect ${this.role} agent.
Your job is to analyze user requests and determine which tools to execute.

Available tools with their exact parameter names:
${toolsWithSchemas.map(t => `
- ${t.name}: ${t.description}
  Parameters: ${JSON.stringify(t.parameters, null, 2)}
`).join('\n')}

IMPORTANT RULES:
1. Use the EXACT parameter names from the tool schemas above
2. Use entity names EXACTLY as provided by the user (do NOT add suffixes like "Account" or "Order")
3. For multi-step workflows that need results from previous steps, use the special placeholder: "__PREVIOUS_RESULT_ID__"
4. You must respond with a valid JSON object

Example for "create account for Nike and create order for Nike with budget 500":
{
  "steps": [
    {
      "toolName": "create_account",
      "toolParams": { "name": "Nike", "type": "advertiser" }
    },
    {
      "toolName": "create_order",
      "toolParams": { "accountId": "__PREVIOUS_RESULT_ID__", "name": "Nike", "budget": 500 }
    }
  ]
}

If the request requires only ONE tool, respond with this JSON format:
{
  "toolName": "the_tool_to_use",
  "toolParams": { "paramName": "value" }
}

Always return valid JSON.`;

    const response = await this.openaiClient.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    return JSON.parse(content);
  }

  /**
   * Execute a single MCP tool
   * @param {string} toolName
   * @param {Object} params
   * @returns {Promise<any>}
   */
  async executeTool(toolName, params) {
    const handler = this.mcpToolHandlers.get(toolName);
    if (!handler) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    return await handler(params);
  }

  /**
   * Process without AI (pattern matching fallback)
   */
  async processWithoutAI(userMessage, eventBus, contextId, taskId) {
    console.log(`🔧 Pattern matching mode (no AI available)`);

    const selectedTool = this.selectToolByPattern(userMessage);
    if (!selectedTool) {
      throw new Error('No suitable tool found for request');
    }

    const result = await this.executeTool(selectedTool.name, {});

    const message = this.createAgentMessage(
      `Executed ${selectedTool.name} (pattern matching)`,
      result,
      contextId,
      taskId
    );

    eventBus.publish(message);
  }

  /**
   * Select tool by pattern matching (fallback when no AI)
   */
  selectToolByPattern(messageText) {
    const text = messageText.toLowerCase();

    // Pattern matching based on keywords
    if (text.includes('create') && text.includes('order')) {
      return this.mcpTools.find(t => t.name === 'create_order');
    }
    if (text.includes('create') && text.includes('account')) {
      return this.mcpTools.find(t => t.name === 'create_account');
    }
    if (text.includes('search') || text.includes('find')) {
      return this.mcpTools.find(t => t.name === 'search_products');
    }
    if (text.includes('list')) {
      return this.mcpTools.find(t => t.name.startsWith('list_'));
    }

    // Default to first tool
    return this.mcpTools[0];
  }

  /**
   * Extract text from A2A message
   * @param {Object} message
   * @returns {string}
   */
  extractTextFromMessage(message) {
    const textParts = message.parts.filter(p => p.kind === 'text');
    return textParts.map(p => p.text).join(' ');
  }

  /**
   * Create agent message
   * @param {string} text
   * @param {any} data
   * @param {string} contextId
   * @param {string} taskId
   * @returns {Object}
   */
  createAgentMessage(text, data, contextId, taskId) {
    const parts = [{ kind: 'text', text }];

    if (data) {
      parts.push({ kind: 'data', data });
    }

    return {
      messageId: `msg-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      role: 'agent',
      parts,
      kind: 'message',
      contextId,
      taskId,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Cancel task (required by AgentExecutor interface)
   */
  async cancelTask(taskId) {
    console.log(`❌ Cancelling task: ${taskId}`);
    // Task cancellation logic if needed
  }
}
