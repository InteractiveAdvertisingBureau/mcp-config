/**
 * OpenDirect MCP Module
 * Provides MCP server for OpenDirect v2.1 advertising operations
 */

import { createAgenticMCPHttpApp } from './server.js';
import { createLogger } from '../../shared/utils/logger.js';

const log = createLogger('OpenDirect-MCP');

/**
 * Initialize OpenDirect MCP module
 */
export function init(app, basePath = '/agenticdirect/mcp') {
  log.info('Initializing OpenDirect MCP module...');

  // Create MCP server app
  const mcpApp = createAgenticMCPHttpApp();

  // Mount on Express app
  app.use(basePath, mcpApp);

  log.success(`OpenDirect MCP mounted at ${basePath}`);

  return {
    name: 'OpenDirect MCP',
    version: '2.1.0',
    basePath,
    endpoints: {
      sse: `${basePath}/sse`,
      health: `${basePath}/health`,
      info: `${basePath}/info`
    }
  };
}

export default { init };
