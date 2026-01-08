/**
 * A2A Protocol Module
 * Agent-to-Agent communication using @a2a-js/sdk
 */

import { createA2ASDKRouter } from './lib/sdkRouter.js';
import { ClientAgent } from './lib/clientAgent.js';
import OpenAI from 'openai';
import { createLogger } from '../../shared/utils/logger.js';

const log = createLogger('A2A-Protocol');

// Store progress events for each session
const progressStore = new Map();

export function init(app, config, schemaDrivenState) {
  log.info('Initializing A2A Protocol module...');

  // Initialize OpenAI client for AI-powered agents
  const openaiClient = config.openaiApiKey
    ? new OpenAI({ apiKey: config.openaiApiKey })
    : null;

  if (openaiClient) {
    log.success('AI-powered agents initialized with OpenAI');
  } else {
    log.warn('Agents running without AI (no OPENAI_API_KEY)');
  }

  // Get MCP tools from schema-driven server
  const mcpTools = schemaDrivenState?.toolDefinitions || [];
  const mcpHandlers = schemaDrivenState?.toolHandlersMap || new Map();

  // Create A2A SDK-based endpoints for Buyer and Seller agents
  const buyerA2ARouter = createA2ASDKRouter('buyer', mcpHandlers, mcpTools, openaiClient);
  const sellerA2ARouter = createA2ASDKRouter('seller', mcpHandlers, mcpTools, openaiClient);

  app.use(`${config.basePath}/buyer`, buyerA2ARouter);
  app.use(`${config.basePath}/seller`, sellerA2ARouter);

  // Agent discovery endpoint
  app.get(`${config.basePath}/agents`, (req, res) => {
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;

    res.json({
      agents: [
        {
          id: 'buyer-agent-opendirect',
          role: 'buyer',
          name: 'Buyer Agent',
          cardUrl: `${baseUrl}${config.basePath}/buyer/.well-known/agent-card.json`
        },
        {
          id: 'seller-agent-opendirect',
          role: 'seller',
          name: 'Seller Agent',
          cardUrl: `${baseUrl}${config.basePath}/seller/.well-known/agent-card.json`
        }
      ]
    });
  });

  // Initialize Client Agent
  const clientAgent = new ClientAgent('http://localhost:3000', config.openaiApiKey, 'autonomous');

  // Listen for progress events
  clientAgent.on('progress', (progressData) => {
    const { sessionId, ...progress } = progressData;
    if (!progressStore.has(sessionId)) {
      progressStore.set(sessionId, []);
    }
    progressStore.get(sessionId).push({
      ...progress,
      timestamp: new Date().toISOString()
    });
  });

  // Client Agent API endpoints
  setupClientAgentAPI(app, config.basePath, clientAgent, progressStore);

  log.success(`A2A Protocol mounted at ${config.basePath}`);

  return {
    name: 'A2A Protocol',
    version: '1.0.0',
    enabled: config.enabled,
    endpoints: {
      agents: `${config.basePath}/agents`,
      buyer: `${config.basePath}/buyer`,
      seller: `${config.basePath}/seller`,
      chat: `${config.basePath}/api/chat`
    }
  };
}

function setupClientAgentAPI(app, basePath, clientAgent, progressStore) {
  // Client Agent Chat endpoint
  app.post(`/api${basePath}/chat`, async (req, res) => {
    try {
      const { sessionId, message, mode } = req.body;

      if (!message) {
        return res.status(400).json({
          success: false,
          error: 'Message is required'
        });
      }

      if (mode && (mode === 'autonomous' || mode === 'orchestrated')) {
        clientAgent.mode = mode;
      }

      const actualSessionId = sessionId || 'default';
      progressStore.delete(actualSessionId);

      if (!clientAgent.agentRegistry.size) {
        const protocol = req.get('x-forwarded-proto') || req.protocol;
        const host = req.get('host');
        clientAgent.baseUrl = `${protocol}://${host}`;
        await clientAgent.initialize();
      }

      const result = await clientAgent.processMessage(actualSessionId, message);
      const progress = progressStore.get(actualSessionId) || [];

      res.json({
        success: result.success,
        message: result.summary,
        details: result.details,
        mode: clientAgent.mode,
        progress: progress
      });
    } catch (error) {
      log.error('A2A Chat error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get conversation history
  app.get(`/api${basePath}/chat/:sessionId/history`, (req, res) => {
    const { sessionId } = req.params;
    const history = clientAgent.getConversationHistory(sessionId);
    res.json({
      success: true,
      history: history || { messages: [] }
    });
  });

  // Clear conversation
  app.delete(`/api${basePath}/chat/:sessionId`, (req, res) => {
    const { sessionId } = req.params;
    clientAgent.clearConversation(sessionId);
    progressStore.delete(sessionId);
    res.json({
      success: true,
      message: 'Conversation cleared'
    });
  });

  // Get progress
  app.get(`/api${basePath}/chat/:sessionId/progress`, (req, res) => {
    const { sessionId } = req.params;
    const progress = progressStore.get(sessionId) || [];
    res.json({
      success: true,
      sessionId,
      progress,
      count: progress.length
    });
  });

  // Set mode
  app.post(`/api${basePath}/mode`, (req, res) => {
    const { mode } = req.body;
    if (!mode || (mode !== 'autonomous' && mode !== 'orchestrated')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid mode. Must be "autonomous" or "orchestrated"'
      });
    }
    clientAgent.mode = mode;
    res.json({
      success: true,
      mode: clientAgent.mode
    });
  });

  // Get mode
  app.get(`/api${basePath}/mode`, (req, res) => {
    res.json({
      success: true,
      mode: clientAgent.mode,
      useAI: clientAgent.useAI
    });
  });
}

export default { init };
