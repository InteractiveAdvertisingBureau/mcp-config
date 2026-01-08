/**
 * AI Chat Module
 * Provides AI chat functionality with MCP integration
 * Supports Anthropic Claude, OpenAI GPT, and Google Gemini
 */

import { setupAIChat } from './server.js';
import { createLogger } from '../../shared/utils/logger.js';

const log = createLogger('AI-Chat');

/**
 * Initialize AI Chat module
 */
export function init(app, config) {
  log.info('Initializing AI Chat module...');

  const { aiProvider, mcpServerUrl, basePath = '/chat' } = config;

  // Setup AI chat with configuration
  setupAIChat(app, {
    aiProvider,
    mcpServerUrl,
    basePath
  });

  log.success(`AI Chat mounted at ${basePath}`);

  return {
    name: 'AI Chat',
    version: '1.0.0',
    basePath,
    endpoints: {
      chat: `${basePath}/api/chat`,
      providers: `${basePath}/api/providers`,
      tools: `${basePath}/api/tools`
    }
  };
}

export default { init };
