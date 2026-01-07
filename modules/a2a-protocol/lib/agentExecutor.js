/**
 * Custom AgentExecutor for OpenDirect agents
 * Uses @a2a-js/sdk with existing OpenAI + MCP integration
 */

import OpenAI from 'openai';
import { randomUUID } from 'crypto';
import { loadPrompt } from './promptLoader.js';

/**
 * OpenDirect Agent Executor
 * Implements AgentExecutor interface from @a2a-js/sdk
 */
export class OpenDirectAgentExecutor {
  constructor(role, mcpToolHandlers, mcpTools, openaiClient) {
    this.role = role;
    this.mcpToolHandlers = mcpToolHandlers;
    this.mcpTools = mcpTools;
    this.openaiClient = openaiClient;
    this.useAI = !!openaiClient;
  }

  /**
   * Execute agent task
   * @param {RequestContext} requestContext - A2A request context with message and metadata
   * @param {ExecutionEventBus} eventBus - Event bus for publishing responses
   */
  async execute(requestContext, eventBus) {
    const { message, contextId, taskId } = requestContext;

    console.log(`\n📨 A2A ${this.role} received message:`, message.parts[0]?.text);

    try {
      // Extract message text
      const messageText = message.parts[0]?.text || '';

      // Determine if autonomous mode is requested
      const autonomous = requestContext.metadata?.autonomous || false;
      console.log(`   Mode: ${autonomous ? '🤖 Autonomous' : '🔧 Orchestrated'}`);

      if (autonomous && this.useAI) {
        // Autonomous mode: AI-powered planning and execution
        await this.processAutonomousMode(messageText, eventBus);
      } else {
        // Orchestrated mode: Simple tool selection
        await this.processOrchestratedMode(messageText, eventBus);
      }

      // Mark as finished
      eventBus.finished();

    } catch (error) {
      console.error(`❌ ${this.role} agent execution failed:`, error);

      // Publish error message
      eventBus.publish({
        messageId: randomUUID(),
        role: 'agent',
        parts: [{
          kind: 'text',
          text: `Error: ${error.message}`
        }],
        kind: 'message'
      });

      eventBus.finished();
    }
  }

  /**
   * Process in orchestrated mode (simple tool selection)
   */
  async processOrchestratedMode(messageText, eventBus) {
    console.log(`🔧 Orchestrated mode: selecting best tool`);

    if (!this.useAI) {
      // Pattern matching fallback
      const selectedTool = this.selectToolByPattern(messageText);
      await this.executeTool(selectedTool, messageText, eventBus);
      return;
    }

    // Use OpenAI to select tool
    const toolDescriptions = this.mcpTools.map(t =>
      `${t.name}: ${t.description}`
    ).join('\n');

    const response = await this.openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a ${this.role} agent. Select the best tool for the request.\n\nAvailable tools:\n${toolDescriptions}\n\nRespond with only the tool name.`
        },
        {
          role: 'user',
          content: messageText
        }
      ],
      temperature: 0
    });

    const selectedToolName = response.choices[0].message.content.trim();
    const selectedTool = this.mcpTools.find(t => t.name === selectedToolName);

    if (selectedTool) {
      await this.executeTool(selectedTool, messageText, eventBus);
    } else {
      eventBus.publish({
        messageId: randomUUID(),
        role: 'agent',
        parts: [{
          kind: 'text',
          text: `Could not find appropriate tool for: "${messageText}"`
        }],
        kind: 'message'
      });
    }
  }

  /**
   * Process in autonomous mode (AI-powered planning)
   */
  async processAutonomousMode(messageText, eventBus) {
    console.log(`🤖 Autonomous mode: creating plan`);

    const prompt = await loadPrompt(this.role, 'autonomous-planner');
    const toolsContext = JSON.stringify(this.mcpTools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.inputSchema
    })), null, 2);

    // Generate plan
    const planResponse = await this.openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: prompt.replace('{{TOOLS}}', toolsContext)
        },
        {
          role: 'user',
          content: messageText
        }
      ],
      temperature: 0
    });

    const planText = planResponse.choices[0].message.content;

    // Publish plan
    eventBus.publish({
      messageId: randomUUID(),
      role: 'agent',
      parts: [{
        kind: 'text',
        text: `📋 Plan:\n${planText}`
      }],
      kind: 'message'
    });

    // Parse and execute plan steps
    const steps = this.parsePlanSteps(planText);

    for (const step of steps) {
      const tool = this.mcpTools.find(t => t.name === step.tool);
      if (tool) {
        await this.executeTool(tool, messageText, eventBus, step.params);
      }
    }
  }

  /**
   * Execute a single MCP tool
   */
  async executeTool(tool, messageText, eventBus, params = null) {
    console.log(`🔧 Executing tool: ${tool.name}`);

    const handler = this.mcpToolHandlers.get(tool.name);
    if (!handler) {
      console.error(`❌ Handler not found for tool: ${tool.name}`);
      throw new Error(`Handler not found for tool: ${tool.name}`);
    }

    try {
      // Generate parameters if not provided
      let toolParams = params;
      if (!toolParams && this.useAI) {
        console.log(`🤖 Generating parameters for ${tool.name}...`);
        toolParams = await this.generateToolParams(tool, messageText);
        console.log(`📝 Generated params:`, JSON.stringify(toolParams, null, 2));
      }

      // Execute tool
      console.log(`⚙️  Calling handler for ${tool.name}...`);
      const result = await handler(toolParams || {});
      console.log(`✅ Tool ${tool.name} executed successfully`);

      // Publish result
      eventBus.publish({
        messageId: randomUUID(),
        role: 'agent',
        parts: [{
          kind: 'text',
          text: `✅ ${tool.name} result:\n${JSON.stringify(result, null, 2)}`
        }],
        kind: 'message'
      });
    } catch (error) {
      console.error(`❌ Tool execution failed for ${tool.name}:`, error);
      throw error;
    }
  }

  /**
   * Generate tool parameters using AI
   */
  async generateToolParams(tool, messageText) {
    const response = await this.openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Extract parameters for the tool "${tool.name}".\nSchema: ${JSON.stringify(tool.inputSchema)}\nRespond with only valid JSON.`
        },
        {
          role: 'user',
          content: messageText
        }
      ],
      temperature: 0
    });

    try {
      return JSON.parse(response.choices[0].message.content);
    } catch {
      return {};
    }
  }

  /**
   * Select tool by pattern matching (fallback)
   */
  selectToolByPattern(messageText) {
    const text = messageText.toLowerCase();

    // Pattern matching based on keywords
    if (text.includes('create') && text.includes('order')) {
      return this.mcpTools.find(t => t.name === 'create_order');
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
   * Parse plan steps from AI response
   */
  parsePlanSteps(planText) {
    const steps = [];
    const lines = planText.split('\n');

    for (const line of lines) {
      const match = line.match(/(?:Step \d+:|-)?\s*Use `(\w+)`/i);
      if (match) {
        steps.push({
          tool: match[1],
          params: null
        });
      }
    }

    return steps;
  }

  /**
   * Cancel task (required by AgentExecutor interface)
   */
  async cancelTask(taskId) {
    console.log(`❌ Cancelling task: ${taskId}`);
    // Task cancellation logic if needed
  }
}
