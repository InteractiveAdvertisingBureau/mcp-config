import express from 'express';
import cors from 'cors';
import bodyParser from "body-parser";
import path from "path"
import { fileURLToPath } from 'url';
import morgan from 'morgan';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = express();

// Trust proxy headers for proper protocol detection behind load balancers/proxies
app.set('trust proxy', true);

// Configure CORS with environment-based whitelist
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman, MCP clients)
    if (!origin) return callback(null, true);

    // In production, allow same origin (Cloud Run URL calling itself)
    if (process.env.NODE_ENV === 'production') {
      return callback(null, true);
    }

    // In development, check against whitelist
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400 // 24 hours
};

app.use(morgan('dev'));

app.use(cors(corsOptions));

// Body parser with increased limit for file validation
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.use(express.static(path.join(__dirname, 'client/ui')))
app.use(express.static(path.join(__dirname, 'storage')));

import mcpRoutes from './routes/mcpRoutes.js';
import { createMCPHttpApp } from './mcpServerHttp.js';
import { createAgenticMCPHttpApp } from './mcpServerHttpAgentic.js';
import { createSchemaDrivenMCPApp, reloadSchemaDrivenServer } from './mcpServerSchemaDriven.js';
import { setupAIChat } from './aiChatModule.js';

// MCP server for API testing tools
const mcpApp = createMCPHttpApp();
app.use('/mcp', mcpApp);

// AgenticDirect MCP server for OpenDirect v2.1 tools (10 manual tools)
const agenticMcpApp = createAgenticMCPHttpApp();
app.use('/agenticdirect/mcp', agenticMcpApp);

// Schema-Driven MCP server for OpenDirect v2.1 (33 auto-generated tools)
// Note: Schema changes require server restart to take effect
const schemaMcpApp = createSchemaDrivenMCPApp();
app.use('/schema/mcp', schemaMcpApp);

// Mount REST API BEFORE catch-all route
app.use('/api', mcpRoutes);

// Setup AI Chat functionality (adds /chat and /api/ai-chat endpoints)
// Pass environment variables from .env (used by Cloud Run)
// MCP server URL: In Cloud Run, use localhost on same port. Locally, use configured port.
const mcpPort = process.env.PORT || '3000';
const mcpServerUrl = process.env.MCP_SERVER_URL || `http://localhost:${mcpPort}/mcp`;

setupAIChat(app, {
  staticPath: path.join(__dirname, 'client/standalone'),
  mcpServerUrl: mcpServerUrl,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,
  geminiApiKey: process.env.GEMINI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite'
}).catch(err => {
  console.error('⚠️  AI Chat setup failed:', err.message);
});

// ============================================
// SCHEMA REGISTRATION ENDPOINTS
// ============================================
import fs from 'fs';
import axios from 'axios';
import {
  getCustomSchema,
  setCustomSchema,
  clearCustomSchema,
  addToHistory,
  getHistory,
  isUsingCustomSchema
} from './lib/schemaStorage.js';

// Get current schema info
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

// Register new schema from file upload or URL
app.post('/api/schema/register', async (req, res) => {
  try {
    const { schema, source, sourceType } = req.body;

    // Validate schema structure
    if (!schema || typeof schema !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid schema format'
      });
    }

    if (!schema.name || !schema.version) {
      return res.status(400).json({
        success: false,
        error: 'Schema must have name and version fields'
      });
    }

    const registeredAt = new Date().toISOString();

    // Store custom schema
    setCustomSchema({
      ...schema,
      source: source || 'Custom Upload',
      sourceType: sourceType || 'file',
      registeredAt
    });

    // Add to history
    addToHistory({
      name: schema.name,
      version: schema.version,
      source: source || 'Custom Upload',
      registeredAt,
      toolsCount: schema.tools?.length || 0
    });

    // Reload schema-driven MCP server with new schema
    console.log('🔄 Triggering schema-driven MCP server reload...');
    const reloadResult = reloadSchemaDrivenServer();
    console.log('✅ Schema-driven MCP server reloaded with new schema');

    // Get the actual tools from the reloaded server
    const actualTools = reloadResult.toolDefinitions || [];

    // Build dynamic MCP server URL based on request
    // Check X-Forwarded-Proto header for proper protocol detection behind proxies
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('host');
    const mcpServerUrl = `${protocol}://${host}/schema/mcp/sse`;

    res.json({
      success: true,
      message: 'Schema registered and loaded successfully',
      reloaded: true,
      schema: {
        name: schema.name,
        version: schema.version,
        toolsCount: actualTools.length,
        resourcesCount: schema.resources?.length || 0
      },
      tools: actualTools,  // Return actual generated tools
      mcpServerUrl: mcpServerUrl  // Dynamic URL based on current host
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Fetch schema from URL (handles both direct and GitHub URLs)
app.post('/api/schema/fetch-url', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    // Convert GitHub blob URL to raw URL
    let fetchUrl = url;
    if (url.includes('github.com') && url.includes('/blob/')) {
      fetchUrl = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
    }

    // Fetch the schema
    const response = await axios.get(fetchUrl, {
      headers: {
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    const schema = response.data;

    // Validate schema
    if (!schema || typeof schema !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid JSON schema format'
      });
    }

    res.json({
      success: true,
      schema: schema,
      source: url
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: `Failed to fetch schema: ${error.message}`
    });
  }
});

// Reset to default schema
app.post('/api/schema/reset', (req, res) => {
  clearCustomSchema();

  // Reload schema-driven MCP server with default schema
  console.log('🔄 Reloading schema-driven MCP server to default...');
  reloadSchemaDrivenServer();
  console.log('✅ Schema-driven MCP server reset to default');

  res.json({
    success: true,
    message: 'Schema reset to default and MCP server reloaded'
  });
});

// Test individual tool with sandbox storage
app.post('/api/schema/test-tool', async (req, res) => {
  try {
    const { toolName, payload } = req.body;

    if (!toolName) {
      return res.status(400).json({
        success: false,
        error: 'Tool name is required'
      });
    }

    // Import the sandbox test function from mcpServerSchemaDriven
    const { testToolInSandbox } = await import('./mcpServerSchemaDriven.js');

    // Execute tool in sandbox mode
    const result = await testToolInSandbox(toolName, payload || {});

    res.json({
      success: result.success,
      toolName: toolName,
      executed: true,
      sandboxMode: true,
      result: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: `Tool execution failed: ${error.message}`
    });
  }
});

// Get schema registration history
app.get('/api/schema/history', (req, res) => {
  res.json({
    success: true,
    history: getHistory()
  });
});

// ============================================
// MCP CONNECTOR ENDPOINTS
// ============================================

// Validate and connect to MCP server
app.post('/api/mcp/validate', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'MCP server URL is required'
      });
    }

    // Try to fetch tools list via POST (JSON-RPC)
    const response = await axios.post(url, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      timeout: 5000
    });

    // Parse SSE response if needed
    let result = response.data;
    if (typeof result === 'string' && result.includes('event: message')) {
      // Parse SSE format
      const lines = result.split('\n');
      const dataLine = lines.find(l => l.startsWith('data: '));
      if (dataLine) {
        result = JSON.parse(dataLine.replace('data: ', ''));
      }
    }

    const tools = result.result?.tools || [];

    res.json({
      success: true,
      connected: true,
      url: url,
      toolsCount: tools.length,
      tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description || 'No description',
        inputSchema: tool.inputSchema
      }))
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      connected: false,
      error: `Failed to connect to MCP server: ${error.message}`
    });
  }
});

// Get tools from MCP server (same as validate but separate endpoint for clarity)
app.post('/api/mcp/get-tools', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'MCP server URL is required'
      });
    }

    const response = await axios.post(url, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      timeout: 5000
    });

    // Parse response
    let result = response.data;
    if (typeof result === 'string' && result.includes('event: message')) {
      const lines = result.split('\n');
      const dataLine = lines.find(l => l.startsWith('data: '));
      if (dataLine) {
        result = JSON.parse(dataLine.replace('data: ', ''));
      }
    }

    const tools = result.result?.tools || [];

    res.json({
      success: true,
      tools: tools
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Catch-all route for SPA (must be AFTER API/MCP routes)
app.get(/^\/(?!api|mcp|chat).*/, function (req, res) {
  res.sendFile(path.join(__dirname, 'client/ui', 'index.html'));
})




export default app;