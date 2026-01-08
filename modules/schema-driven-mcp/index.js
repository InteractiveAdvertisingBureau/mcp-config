/**
 * Schema-Driven MCP Module
 * Auto-generates CRUD tools from OpenDirect v2.1 schemas
 */

import { createSchemaDrivenMCPApp } from './server.js';
import { createLogger } from '../../shared/utils/logger.js';

const log = createLogger('Schema-Driven-MCP');

/**
 * Initialize Schema-Driven MCP module
 */
export function init(app, basePath = '/schema/mcp') {
  log.info('Initializing Schema-Driven MCP module...');

  // Create MCP server app
  const mcpApp = createSchemaDrivenMCPApp();

  // Mount on Express app
  app.use(basePath, mcpApp);

  log.success(`Schema-Driven MCP mounted at ${basePath}`);

  return {
    name: 'Schema-Driven MCP',
    version: '2.1.0',
    basePath,
    endpoints: {
      sse: `${basePath}/sse`,
      health: `${basePath}/health`,
      info: `${basePath}/info`,
      tools: `${basePath}/tools`,
      resources: `${basePath}/resources`
    }
  };
}

export default { init };
