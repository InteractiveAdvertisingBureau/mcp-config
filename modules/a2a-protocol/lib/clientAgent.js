/**
 * Client Agent - Orchestrates A2A communication between Buyer and Seller agents
 * Uses OpenAI LLM for intelligent intent analysis and workflow orchestration
 */

import axios from 'axios';
import { randomUUID } from 'crypto';
import OpenAI from 'openai';
import { loadPrompt } from './promptLoader.js';
import { EventEmitter } from 'events';

export class ClientAgent extends EventEmitter {
  constructor(baseUrl = 'http://localhost:3000', openaiApiKey = null, mode = 'autonomous') {
    super();
    this.baseUrl = baseUrl;
    this.conversationHistory = new Map(); // Store conversation history per session
    this.agentRegistry = new Map(); // Cache agent cards
    this.mode = mode; // 'autonomous' or 'orchestrated'

    // Initialize OpenAI client for intelligent orchestration
    if (openaiApiKey) {
      this.openai = new OpenAI({ apiKey: openaiApiKey });
      this.useAI = true;
      console.log(`✅ Client Agent initialized with OpenAI LLM (${mode} mode)`);
    } else {
      this.useAI = false;
      console.log(`⚠️  Client Agent initialized without AI (pattern matching mode)`);
    }
  }

  /**
   * Initialize - Discover available agents
   */
  async initialize() {
    try {
      console.log('🤖 Client Agent: Discovering available agents...');

      const response = await axios.get(`${this.baseUrl}/a2a/agents`);
      const agents = response.data.agents;

      // Fetch and cache agent cards
      for (const agent of agents) {
        const cardResponse = await axios.get(agent.cardUrl);
        this.agentRegistry.set(agent.id, {
          ...agent,
          card: cardResponse.data
        });
        console.log(`✅ Registered agent: ${agent.id} (${agent.role})`);
      }

      console.log(`✅ Client Agent initialized with ${this.agentRegistry.size} agents`);
      return true;
    } catch (error) {
      console.error('❌ Client Agent initialization failed:', error.message);
      return false;
    }
  }

  /**
   * Process user message and orchestrate agent interactions
   */
  async processMessage(sessionId, userMessage) {
    console.log(`\n🗣️  User Message (Session ${sessionId}): ${userMessage}`);

    // Initialize conversation history if needed
    if (!this.conversationHistory.has(sessionId)) {
      this.conversationHistory.set(sessionId, {
        contextId: randomUUID(),
        messages: [],
        tasks: [],
        steps: []
      });
    }

    const conversation = this.conversationHistory.get(sessionId);
    conversation.messages.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    });

    // Choose mode: autonomous or orchestrated
    let result;
    if (this.mode === 'autonomous') {
      result = await this.processAutonomous(sessionId, userMessage, conversation);
    } else {
      result = await this.processOrchestrated(sessionId, userMessage, conversation);
    }

    // Add result to conversation history
    conversation.messages.push({
      role: 'assistant',
      content: result.summary,
      details: result.details,
      timestamp: new Date().toISOString()
    });

    return result;
  }

  /**
   * Autonomous mode: Facilitate agent-to-agent negotiation
   */
  async processAutonomous(sessionId, userMessage, conversation) {
    try {
      // Convert user message to goal using prompt
      const goal = await this.convertToGoal(userMessage);
      console.log('🎯 Goal:', goal);

      this.emitProgress(sessionId, {
        step: 'goal_conversion',
        description: 'Understanding your request...',
        status: 'completed',
        data: goal
      });

      // Send goal to appropriate starting agent
      const startingAgent = goal.startingAgent || 'buyer';
      console.log(`📤 Sending goal to ${startingAgent} agent for autonomous execution`);

      this.emitProgress(sessionId, {
        step: 'agent_delegation',
        description: `Delegating to ${startingAgent} agent...`,
        status: 'in_progress',
        agent: startingAgent
      });

      // The agent will autonomously plan and execute
      const result = await this.delegateGoalToAgent(startingAgent, goal, conversation, sessionId);

      return result;

    } catch (error) {
      console.error('❌ Autonomous processing failed:', error);
      return {
        success: false,
        summary: `❌ Error: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  /**
   * Orchestrated mode: Client plans and coordinates (old behavior)
   */
  async processOrchestrated(sessionId, userMessage, conversation) {
    // Analyze intent and determine required agents
    const intent = await this.analyzeIntent(userMessage);
    console.log(`🎯 Intent: ${intent.type}, Agents needed: ${intent.agents.join(', ')}`);

    // Execute workflow based on intent
    const result = await this.executeWorkflow(intent, conversation);
    return result;
  }

  /**
   * Convert user message to structured goal using AI
   */
  async convertToGoal(userMessage) {
    if (!this.useAI) {
      // Fallback: simple goal structure
      return {
        goal: 'create_advertising_campaign',
        description: userMessage,
        startingAgent: 'buyer',
        constraints: {},
        userIntent: userMessage
      };
    }

    try {
      const systemPrompt = loadPrompt('client', 'goal-converter');

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      return JSON.parse(response.choices[0].message.content);

    } catch (error) {
      console.error('❌ Goal conversion failed:', error.message);
      throw error;
    }
  }

  /**
   * Delegate goal to agent for autonomous execution
   */
  async delegateGoalToAgent(agentRole, goal, conversation, sessionId) {
    const agent = Array.from(this.agentRegistry.values()).find(a => a.role === agentRole);
    if (!agent) {
      throw new Error(`Agent not found: ${agentRole}`);
    }

    // Send goal as A2A message (A2A v0.3.0 format)
    const message = {
      messageId: randomUUID(),
      role: 'user',
      parts: [{
        kind: 'text',
        text: `GOAL: ${goal.goal}\nDESCRIPTION: ${goal.description}\nCONSTRAINTS: ${JSON.stringify(goal.constraints)}\n\nPlease create and execute a plan to achieve this goal. Coordinate with other agents as needed.`
      }],
      kind: 'message'
    };

    // Use JSON-RPC 2.0 endpoint
    const jsonrpcUrl = `${this.baseUrl}/a2a/${agentRole}/jsonrpc`;
    const response = await axios.post(jsonrpcUrl, {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'sendMessage',
      params: {
        message,
        contextId: conversation.contextId,
        metadata: {
          sessionId, // Pass session ID for progress tracking
          autonomous: true // Flag for autonomous mode
        }
      }
    });

    if (response.data.error) {
      throw new Error(response.data.error.message);
    }

    const task = response.data.result.task;

    // Wait for completion with progress updates
    const completedTask = await this.waitForTaskCompletion(agentRole, task.id, sessionId);

    // Extract workflow steps from task history and task.steps (autonomous execution)
    const executionSteps = completedTask.steps || [];
    const historySteps = completedTask.history
      .filter(h => h.role === 'agent')
      .map((h, i) => ({
        step: i + 1,
        agent: agentRole,
        action: h.action || 'processing',
        status: 'completed',
        message: h.parts?.[0]?.text || '',
        timestamp: h.timestamp
      }));

    // Combine execution steps with history
    const allSteps = [...executionSteps.map(s => ({
      ...s,
      agent: agentRole
    })), ...historySteps];

    const result = this.extractDataFromTask(completedTask);

    // Extract agent conversation from task history
    const agentConversation = completedTask.history.map(h => ({
      role: h.role,
      agent: agentRole,
      message: h.parts?.[0]?.text || '',
      timestamp: h.timestamp
    }));

    return {
      success: true,
      summary: this.formatAutonomousResult(goal, result, allSteps, agentConversation),
      details: {
        workflow: 'autonomous_negotiation',
        goal,
        steps: allSteps,
        result,
        conversation: agentConversation,
        taskId: task.id
      }
    };
  }

  /**
   * Format autonomous workflow result for user
   */
  formatAutonomousResult(goal, result, steps, conversation = []) {
    let summary = `✅ ${goal.description} completed successfully!\n\n`;

    // Show agent conversation if available
    if (conversation && conversation.length > 0) {
      summary += `**🤝 Agent Conversation:**\n`;
      conversation.forEach((msg, i) => {
        const agentEmoji = msg.agent === 'buyer' ? '💼' : msg.agent === 'seller' ? '🏪' : '🤖';
        const roleLabel = msg.role === 'user' ? 'Request' : 'Response';
        if (msg.message && msg.message.length > 0) {
          const shortMsg = msg.message.length > 150 ? msg.message.substring(0, 150) + '...' : msg.message;
          summary += `${agentEmoji} ${msg.agent} ${roleLabel}: ${shortMsg}\n`;
        }
      });
      summary += `\n`;
    }

    // Show execution steps
    if (steps && steps.length > 0) {
      summary += `**📋 Execution Steps:**\n`;
      steps.forEach((step, i) => {
        const status = step.status === 'completed' ? '✅' : step.status === 'failed' ? '❌' : '⏳';
        const desc = step.description || step.action || 'Processing';
        summary += `${status} ${i + 1}. ${desc}\n`;
      });
      summary += `\n`;
    }

    // Show results
    if (result) {
      summary += `**📊 Results:**\n`;
      if (result.accountId) summary += `- Account: ${result.accountId}\n`;
      if (result.orderId) summary += `- Order: ${result.orderId}\n`;
      if (result.products) summary += `- Products: ${result.products.length} selected\n`;
      if (result.budget) summary += `- Budget: $${result.budget}\n`;
    }

    return summary;
  }

  /**
   * Emit progress events for real-time updates
   */
  emitProgress(sessionId, progress) {
    this.emit('progress', { sessionId, ...progress });

    // Also store in conversation history
    const conversation = this.conversationHistory.get(sessionId);
    if (conversation) {
      conversation.steps = conversation.steps || [];
      conversation.steps.push({
        ...progress,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Analyze user message to determine intent and required agents
   * Uses OpenAI LLM for intelligent analysis
   */
  async analyzeIntent(message) {
    // Use AI if available
    if (this.useAI) {
      return await this.analyzeIntentWithAI(message);
    }

    // Fallback to pattern matching
    return this.analyzeIntentWithPatterns(message);
  }

  /**
   * AI-powered intent analysis using OpenAI
   */
  async analyzeIntentWithAI(message) {
    try {
      // Get agent capabilities
      const buyerAgent = Array.from(this.agentRegistry.values()).find(a => a.role === 'buyer');
      const sellerAgent = Array.from(this.agentRegistry.values()).find(a => a.role === 'seller');

      // Safely get capabilities with fallback
      const buyerCapabilities = (buyerAgent?.card?.capabilities && Array.isArray(buyerAgent.card.capabilities))
        ? buyerAgent.card.capabilities.join(', ')
        : 'campaign-planning, order-creation, creative-submission';
      const buyerTools = (buyerAgent?.card?.mcpTools && Array.isArray(buyerAgent.card.mcpTools))
        ? buyerAgent.card.mcpTools.join(', ')
        : 'create_account, create_order, create_line, create_creative';

      const sellerCapabilities = (sellerAgent?.card?.capabilities && Array.isArray(sellerAgent.card.capabilities))
        ? sellerAgent.card.capabilities.join(', ')
        : 'product-search, inventory-management, order-processing';
      const sellerTools = (sellerAgent?.card?.mcpTools && Array.isArray(sellerAgent.card.mcpTools))
        ? sellerAgent.card.mcpTools.join(', ')
        : 'search_products, list_products, get_product';

      const systemPrompt = `You are an intelligent orchestrator for an OpenDirect advertising workflow system.
You coordinate between two agents:

**Buyer Agent** - Capabilities: ${buyerCapabilities}
Available tools: ${buyerTools}

**Seller Agent** - Capabilities: ${sellerCapabilities}
Available tools: ${sellerTools}

Analyze the user's request and determine:
1. What type of action they want (create_campaign, search_products, create_order, etc.)
2. Which agents are needed (buyer, seller, or both)
3. What workflow to execute (buyer_seller_collaboration, buyer_only, seller_only, or none)
4. Extract any entities mentioned (advertiser names, publisher names, budget, etc.)

Respond ONLY with a JSON object in this exact format:
{
  "type": "action_type",
  "agents": ["buyer", "seller"],
  "workflow": "workflow_name",
  "entities": {
    "advertiser": "Company Name",
    "publisher": "Publisher Name",
    "budget": 10000
  }
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.3, // Lower temperature for more consistent results
        response_format: { type: 'json_object' }
      });

      const intent = JSON.parse(response.choices[0].message.content);
      console.log('🤖 AI Intent Analysis:', intent);
      return intent;

    } catch (error) {
      console.error('❌ AI intent analysis failed, falling back to patterns:', error.message);
      return this.analyzeIntentWithPatterns(message);
    }
  }

  /**
   * Pattern-based intent analysis (fallback)
   */
  analyzeIntentWithPatterns(message) {
    const lowerMsg = message.toLowerCase();

    // Campaign creation workflow (needs both buyer and seller)
    if (lowerMsg.includes('create campaign') ||
        lowerMsg.includes('new campaign') ||
        lowerMsg.includes('setup campaign')) {
      return {
        type: 'create_campaign',
        agents: ['buyer', 'seller'],
        workflow: 'buyer_seller_collaboration',
        entities: this.extractEntities(message)
      };
    }

    // Product search (seller only)
    if (lowerMsg.includes('search product') ||
        lowerMsg.includes('find product') ||
        lowerMsg.includes('available inventory')) {
      return {
        type: 'search_products',
        agents: ['seller'],
        workflow: 'seller_only',
        entities: this.extractEntities(message)
      };
    }

    // Order management (could be buyer or seller)
    if (lowerMsg.includes('create order') ||
        lowerMsg.includes('new order')) {
      return {
        type: 'create_order',
        agents: ['buyer'],
        workflow: 'buyer_only',
        entities: this.extractEntities(message)
      };
    }

    // Check order status (seller)
    if (lowerMsg.includes('order status') ||
        lowerMsg.includes('check order')) {
      return {
        type: 'get_order',
        agents: ['seller'],
        workflow: 'seller_only',
        entities: this.extractEntities(message)
      };
    }

    // Default - informational
    return {
      type: 'informational',
      agents: [],
      workflow: 'none',
      entities: {}
    };
  }

  /**
   * Extract entities from user message (advertiser, publisher, etc.)
   */
  extractEntities(message) {
    const entities = {};

    // Extract advertiser names (common brands)
    const advertisers = ['nike', 'coca-cola', 'apple', 'samsung', 'toyota', 'microsoft'];
    for (const advertiser of advertisers) {
      if (message.toLowerCase().includes(advertiser)) {
        entities.advertiser = advertiser.charAt(0).toUpperCase() + advertiser.slice(1);
        break;
      }
    }

    // Extract publisher names
    const publishers = ['cnn', 'forbes', 'nytimes', 'espn', 'wsj', 'techcrunch'];
    for (const publisher of publishers) {
      if (message.toLowerCase().includes(publisher)) {
        entities.publisher = publisher.toUpperCase();
        break;
      }
    }

    // Extract budget
    const budgetMatch = message.match(/\$?([\d,]+)/);
    if (budgetMatch) {
      entities.budget = parseFloat(budgetMatch[1].replace(/,/g, ''));
    }

    return entities;
  }

  /**
   * Execute workflow based on intent
   */
  async executeWorkflow(intent, conversation) {
    switch (intent.workflow) {
      case 'buyer_seller_collaboration':
        return await this.executeBuyerSellerWorkflow(intent, conversation);

      case 'buyer_only':
        return await this.executeBuyerWorkflow(intent, conversation);

      case 'seller_only':
        return await this.executeSellerWorkflow(intent, conversation);

      default:
        return {
          success: true,
          summary: "I can help you with campaign creation, product searches, and order management. What would you like to do?",
          details: { intent }
        };
    }
  }

  /**
   * Execute buyer-seller collaboration workflow (e.g., campaign creation)
   */
  async executeBuyerSellerWorkflow(intent, conversation) {
    const steps = [];

    try {
      // Step 1: Search products with Seller Agent
      console.log('\n📋 Step 1: Searching products with Seller Agent...');
      const productSearchMessage = {
        messageId: randomUUID(),
        role: 'user',
        parts: [{
          kind: 'text',
          text: `Search available products for ${intent.entities.publisher || 'premium publishers'}`
        }],
        kind: 'message'
      };

      const sellerTask1 = await this.sendMessageToAgent('seller', {
        contextId: conversation.contextId,
        message: productSearchMessage
      });

      steps.push({
        step: 1,
        agent: 'seller',
        action: 'search_products',
        status: 'completed',
        taskId: sellerTask1.task.id
      });

      // Poll for completion
      const sessionId = conversation.contextId;
      const productResult = await this.waitForTaskCompletion('seller', sellerTask1.task.id, sessionId);
      const products = this.extractDataFromTask(productResult);

      console.log(`✅ Found ${products.length || 0} products`);

      // Step 2: Create account with Buyer Agent
      console.log('\n📋 Step 2: Creating account with Buyer Agent...');
      const accountMessage = {
        messageId: randomUUID(),
        role: 'user',
        parts: [{
          kind: 'text',
          text: `Create advertiser account for ${intent.entities.advertiser || 'New Advertiser'}`
        }],
        kind: 'message'
      };

      const buyerTask1 = await this.sendMessageToAgent('buyer', {
        contextId: conversation.contextId,
        message: accountMessage
      });

      steps.push({
        step: 2,
        agent: 'buyer',
        action: 'create_account',
        status: 'completed',
        taskId: buyerTask1.task.id
      });

      const accountResult = await this.waitForTaskCompletion('buyer', buyerTask1.task.id, sessionId);
      const account = this.extractDataFromTask(accountResult);

      console.log(`✅ Account created: ${account?.Id || 'unknown'}`);

      // Step 3: Create order with Buyer Agent (using product from seller)
      console.log('\n📋 Step 3: Creating order with Buyer Agent...');
      const selectedProduct = products?.[0];
      const orderMessage = {
        messageId: randomUUID(),
        role: 'user',
        parts: [{
          kind: 'text',
          text: `Create order for account ${account?.Id} using product ${selectedProduct?.Id || 'prod-001'}`
        }],
        kind: 'message'
      };

      const buyerTask2 = await this.sendMessageToAgent('buyer', {
        contextId: conversation.contextId,
        taskId: buyerTask1.task.id, // Continue same conversation
        message: orderMessage
      });

      steps.push({
        step: 3,
        agent: 'buyer',
        action: 'create_order',
        status: 'completed',
        taskId: buyerTask2.task.id
      });

      const orderResult = await this.waitForTaskCompletion('buyer', buyerTask2.task.id, sessionId);
      const order = this.extractDataFromTask(orderResult);

      console.log(`✅ Order created: ${order?.Id || 'unknown'}`);

      // Step 4: Notify Seller Agent of new order
      console.log('\n📋 Step 4: Notifying Seller Agent of new order...');
      const notifyMessage = {
        messageId: randomUUID(),
        role: 'user',
        parts: [{
          kind: 'text',
          text: `New order received: ${order?.Id}. Please process.`
        }],
        kind: 'message'
      };

      const sellerTask2 = await this.sendMessageToAgent('seller', {
        contextId: conversation.contextId,
        taskId: sellerTask1.task.id, // Continue seller conversation
        message: notifyMessage
      });

      steps.push({
        step: 4,
        agent: 'seller',
        action: 'process_order',
        status: 'completed',
        taskId: sellerTask2.task.id
      });

      console.log(`✅ Seller notified`);

      // Generate summary
      return {
        success: true,
        summary: `✅ Campaign created successfully!\n\n` +
                 `📊 Summary:\n` +
                 `- Account: ${account?.Name || 'N/A'} (${account?.Id || 'N/A'})\n` +
                 `- Products Found: ${products?.length || 0}\n` +
                 `- Order: ${order?.Id || 'N/A'}\n` +
                 `- Budget: $${order?.Budget || intent.entities.budget || 'N/A'}\n\n` +
                 `The seller has been notified and will process your order.`,
        details: {
          workflow: 'buyer_seller_collaboration',
          steps,
          results: {
            products,
            account,
            order
          }
        }
      };

    } catch (error) {
      console.error('❌ Workflow failed:', error.message);
      return {
        success: false,
        summary: `❌ Campaign creation failed: ${error.message}`,
        details: { error: error.message, steps }
      };
    }
  }

  /**
   * Execute buyer-only workflow
   */
  async executeBuyerWorkflow(intent, conversation) {
    try {
      const message = {
        messageId: randomUUID(),
        role: 'user',
        parts: [{
          kind: 'text',
          text: `Execute ${intent.type} for ${JSON.stringify(intent.entities)}`
        }],
        kind: 'message'
      };

      const task = await this.sendMessageToAgent('buyer', {
        contextId: conversation.contextId,
        message
      });

      const result = await this.waitForTaskCompletion('buyer', task.task.id, conversation.contextId);
      const data = this.extractDataFromTask(result);

      return {
        success: true,
        summary: `✅ ${intent.type} completed successfully`,
        details: { task: result, data }
      };

    } catch (error) {
      return {
        success: false,
        summary: `❌ ${intent.type} failed: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  /**
   * Execute seller-only workflow
   */
  async executeSellerWorkflow(intent, conversation) {
    try {
      const message = {
        messageId: randomUUID(),
        role: 'user',
        parts: [{
          kind: 'text',
          text: `Execute ${intent.type} for ${JSON.stringify(intent.entities)}`
        }],
        kind: 'message'
      };

      const task = await this.sendMessageToAgent('seller', {
        contextId: conversation.contextId,
        message
      });

      const result = await this.waitForTaskCompletion('seller', task.task.id, conversation.contextId);
      const data = this.extractDataFromTask(result);

      return {
        success: true,
        summary: `✅ ${intent.type} completed successfully\n\nResults: ${JSON.stringify(data, null, 2)}`,
        details: { task: result, data }
      };

    } catch (error) {
      return {
        success: false,
        summary: `❌ ${intent.type} failed: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  /**
   * Send A2A message to specific agent (JSON-RPC 2.0)
   */
  async sendMessageToAgent(agentRole, params) {
    const agent = Array.from(this.agentRegistry.values())
      .find(a => a.role === agentRole);

    if (!agent) {
      throw new Error(`Agent not found: ${agentRole}`);
    }

    // Use JSON-RPC 2.0 endpoint
    const jsonrpcUrl = `${this.baseUrl}/a2a/${agentRole}/jsonrpc`;

    console.log(`📤 Sending message to ${agentRole} agent at ${jsonrpcUrl}`);

    // Ensure message has correct A2A v0.3.0 format
    const message = params.message;
    if (!message.messageId) {
      message.messageId = randomUUID();
    }
    if (!message.kind) {
      message.kind = 'message';
    }
    // Fix parts format (kind instead of type)
    if (message.parts) {
      message.parts = message.parts.map(part => ({
        kind: part.kind || part.type || 'text',
        text: part.text
      }));
    }

    const response = await axios.post(jsonrpcUrl, {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'sendMessage',
      params: {
        message,
        contextId: params.contextId,
        taskId: params.taskId
      }
    });

    if (response.data.error) {
      throw new Error(response.data.error.message);
    }

    return response.data.result;
  }

  /**
   * Wait for task to complete (with polling)
   */
  async waitForTaskCompletion(agentRole, taskId, sessionId = null, maxAttempts = 60, interval = 1000) {
    const agent = Array.from(this.agentRegistry.values())
      .find(a => a.role === agentRole);

    if (!agent) {
      throw new Error(`Agent not found: ${agentRole}`);
    }

    // Use JSON-RPC 2.0 endpoint
    const jsonrpcUrl = `${this.baseUrl}/a2a/${agentRole}/jsonrpc`;

    for (let i = 0; i < maxAttempts; i++) {
      const response = await axios.post(jsonrpcUrl, {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'getTask',
        params: { taskId }
      });

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      const task = response.data.result.task;

      // Emit progress for steps if available
      if (sessionId && task.steps && task.steps.length > 0) {
        const latestStep = task.steps[task.steps.length - 1];
        this.emitProgress(sessionId, {
          step: 'agent_execution',
          description: `${agentRole}: ${latestStep.description}`,
          status: latestStep.status,
          data: {
            agent: agentRole,
            stepNumber: latestStep.stepNumber,
            totalSteps: task.steps.length
          }
        });
      }

      if (task.status.state === 'completed') {
        console.log(`✅ Task ${taskId} completed`);

        // Emit completion progress
        if (sessionId) {
          this.emitProgress(sessionId, {
            step: 'task_completed',
            description: `${agentRole} agent completed`,
            status: 'completed',
            data: { taskId, agent: agentRole }
          });
        }

        return task;
      }

      if (task.status.state === 'failed') {
        throw new Error(`Task failed: ${task.status.message}`);
      }

      if (task.status.state === 'cancelled') {
        throw new Error('Task was cancelled');
      }

      // Still working, wait and retry
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error(`Task ${taskId} timeout - max attempts reached`);
  }

  /**
   * Extract data from completed task artifacts
   */
  extractDataFromTask(task) {
    if (!task.artifacts || task.artifacts.length === 0) {
      return null;
    }

    const dataArtifact = task.artifacts.find(a => a.type === 'data');
    if (!dataArtifact) {
      return null;
    }

    return dataArtifact.data;
  }

  /**
   * Get conversation history for a session
   */
  getConversationHistory(sessionId) {
    return this.conversationHistory.get(sessionId);
  }

  /**
   * Clear conversation history for a session
   */
  clearConversation(sessionId) {
    this.conversationHistory.delete(sessionId);
  }
}
