/**
 * Modular MCP Server - Refactored Architecture
 * Clean module-based organization with proper initialization
 */

import express from 'express';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

// Shared imports
import config from './shared/config/index.js';
import { createLogger } from './shared/utils/logger.js';
import corsMiddleware from './shared/middleware/cors.js';
import { errorHandler, notFoundHandler } from './shared/middleware/error-handler.js';
import { initializeDatabase } from './shared/database/connection.js';
import { getCustomSchema, getHistory, isUsingCustomSchema } from './modules/schema-driven-mcp/lib/schemaStorage.js';
import fs from 'fs';

// Module imports
import * as apiTestingMCP from './modules/api-testing-mcp/index.js';
import * as opendirectMCP from './modules/opendirect-mcp/index.js';
import * as schemaDrivenMCP from './modules/schema-driven-mcp/index.js';
import * as a2aProtocol from './modules/a2a-protocol/index.js';
import * as aiChat from './modules/ai-chat/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const log = createLogger('Server');

// ============================================
// EXPRESS APP SETUP
// ============================================

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10); // Different port for parallel testing

// Trust proxy for Cloud Run / load balancers
app.set('trust proxy', true);

// Middleware
app.use(morgan('dev'));
app.use(corsMiddleware);
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

// ============================================
// DATABASE INITIALIZATION
// ============================================

try {
  initializeDatabase();
  log.success('Database initialized');
} catch (error) {
  log.warn('Database initialization failed - API Testing features may not work');
}

// ============================================
// MODULE INITIALIZATION (BEFORE STATIC FILES!)
// ============================================

const modules = [];

log.info('Initializing modules...\n');

// 1. API Testing MCP
try {
  const module = apiTestingMCP.init(app, config.modules.apiTestingMCP);
  modules.push(module);
} catch (error) {
  log.error(`Failed to initialize API Testing MCP: ${error.message}`);
}

// 2. OpenDirect MCP (Manual)
try {
  const module = opendirectMCP.init(app, config.modules.opendirectMCP);
  modules.push(module);
} catch (error) {
  log.error(`Failed to initialize OpenDirect MCP: ${error.message}`);
}

// 3. Schema-Driven MCP
try {
  const module = schemaDrivenMCP.init(app, config.modules.schemaDrivenMCP);
  modules.push(module);
} catch (error) {
  log.error(`Failed to initialize Schema-Driven MCP: ${error.message}`);
}

// 4. A2A Protocol
// Note: A2A requires schema-driven state, so we need to get it dynamically
try {
  // Get the schema-driven state by importing the module's exported state
  const { initializeOrReloadServer } = await import('./modules/schema-driven-mcp/server.js');
  const schemaDrivenState = initializeOrReloadServer();

  const a2aConfig = {
    ...config.modules.a2aProtocol,
    basePath: config.modules.a2aProtocol,
    openaiApiKey: config.ai.openai.apiKey,
    enabled: true
  };

  const module = a2aProtocol.init(app, a2aConfig, schemaDrivenState);
  modules.push(module);
} catch (error) {
  log.error(`Failed to initialize A2A Protocol: ${error.message}`);
}

// 5. AI Chat
try {
  const aiChatConfig = {
    aiProvider: config.ai.anthropic.apiKey ? 'anthropic' :
                config.ai.openai.apiKey ? 'openai' :
                config.ai.gemini.apiKey ? 'gemini' : 'none',
    mcpServerUrl: `http://localhost:${PORT}${config.modules.apiTestingMCP}`,
    basePath: config.modules.aiChat
  };

  const module = aiChat.init(app, aiChatConfig);
  modules.push(module);
} catch (error) {
  log.error(`Failed to initialize AI Chat: ${error.message}`);
}

log.info('');

// ============================================
// REST API ROUTES (BEFORE STATIC FILES!)
// ============================================

try {
  const { default: mcpRoutes } = await import('./modules/api-testing-mcp/routes/mcpRoutes.js');
  app.use('/api', mcpRoutes);
  log.success('REST API routes mounted at /api');
} catch (error) {
  log.error(`Failed to mount REST API routes: ${error.message}`);
}

// ============================================
// SCHEMA ENDPOINTS
// ============================================

// Read-only schema endpoints (current/history)
app.get('/api/schema/current', (req, res) => {
  try {
    const customSchema = getCustomSchema();
    const schemaData = customSchema || JSON.parse(
      fs.readFileSync(path.join(__dirname, 'opendirect-mcp-schema.json'), 'utf-8')
    );

    res.json({
      success: true,
      schema: {
        name: schemaData.name || 'Unknown',
        version: schemaData.version || 'Unknown',
        toolsCount: schemaData.tools?.length || 0,
        resourcesCount: schemaData.resources?.length || 0,
        source: customSchema ? customSchema.source : 'Local Default',
        isCustom: isUsingCustomSchema()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/schema/history', (req, res) => {
  res.json({
    success: true,
    history: getHistory()
  });
});

// Schema management routes (register, fetch, reset, test) from schema-driven module
try {
  const { default: schemaRoutes } = await import('./modules/schema-driven-mcp/routes/schemaRoutes.js');
  app.use('/api', schemaRoutes);
  log.success('Schema management routes mounted at /api/schema/*');
} catch (error) {
  log.error(`Failed to mount schema management routes: ${error.message}`);
}

// MCP connector routes (validate, get-tools, call-tool) from api-testing module
try {
  const { default: mcpConnectorRoutes } = await import('./modules/api-testing-mcp/routes/mcpConnectorRoutes.js');
  app.use('/api', mcpConnectorRoutes);
  log.success('MCP connector routes mounted at /api/mcp/*');
} catch (error) {
  log.error(`Failed to mount MCP connector routes: ${error.message}`);
}

// ============================================
// STATIC FILES (AFTER MODULES AND API ROUTES!)
// ============================================

app.use(express.static(path.join(__dirname, 'client/ui')));
app.use(express.static(path.join(__dirname, 'storage')));

// ============================================
// HEALTH & INFO ENDPOINTS
// ============================================

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'MCP Config - Modular Architecture (Refactored)',
    version: '2.0.0',
    port: PORT,
    env: config.env,
    modules: modules.map(m => ({
      name: m.name,
      version: m.version,
      basePath: m.basePath,
      endpoints: m.endpoints
    }))
  });
});

app.get('/', (req, res) => {
  res.json({
    name: 'MCP Config Server - Refactored',
    version: '2.0.0',
    port: PORT,
    modules: modules.map(m => ({
      name: m.name,
      endpoints: m.endpoints
    })),
    endpoints: {
      health: '/health',
      modules: modules.reduce((acc, m) => {
        acc[m.name] = m.endpoints;
        return acc;
      }, {})
    }
  });
});

// Catch-all route for SPA (must be AFTER API/MCP routes)
// This regex excludes: /api, /mcp, /chat, /a2a, /health, /agenticdirect, /schema
app.get(/^\/(?!api|mcp|chat|a2a|health|agenticdirect|schema).*/, function (req, res) {
  res.sendFile(path.join(__dirname, 'client/ui', 'index.html'));
});

// ============================================
// ERROR HANDLERS (MUST BE LAST!)
// ============================================

app.use(notFoundHandler);
app.use(errorHandler);

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║    🚀  MCP Config Server - Modular Architecture (NEW)       ║');
  console.log('╟──────────────────────────────────────────────────────────────╢');
  console.log(`║  Port:         ${PORT.toString().padEnd(46)} ║`);
  console.log(`║  Environment:  ${config.env.padEnd(46)} ║`);
  console.log(`║  Modules:      ${modules.length} active${' '.repeat(39)} ║`);
  console.log('╟──────────────────────────────────────────────────────────────╢');
  modules.forEach(m => {
    console.log(`║  ✓ ${m.name.padEnd(55)} ║`);
  });
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  log.success(`Refactored server running at http://localhost:${PORT}`);
  log.info(`Original server still available at http://localhost:3000`);
  log.info('');
  log.info('Module Endpoints:');
  modules.forEach(m => {
    log.info(`  ${m.name}:`);
    Object.entries(m.endpoints || {}).forEach(([key, value]) => {
      log.info(`    - ${key}: http://localhost:${PORT}${value}`);
    });
  });
  console.log('');
});

export default app;
