/**
 * API Testing MCP Module
 * Provides MCP server for API testing and validation
 */

import { createMCPHttpApp } from './server.js';
import { createLogger } from '../../shared/utils/logger.js';

const log = createLogger('API-Testing-MCP');

/**
 * Initialize API Testing MCP module
 */
export function init(app, basePath = '/mcp') {
  log.info('Initializing API Testing MCP module...');

  // Create MCP server app
  const mcpApp = createMCPHttpApp();

  // Mount on Express app
  app.use(basePath, mcpApp);

  log.success(`API Testing MCP mounted at ${basePath}`);

  return {
    name: 'API Testing MCP',
    version: '1.0.0',
    basePath,
    endpoints: {
      sse: `${basePath}/sse`,
      health: `${basePath}/health`,
      info: `${basePath}/info`
    }
  };
}

export default { init };
