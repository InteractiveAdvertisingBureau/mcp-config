import { Router } from 'express';
import axios from 'axios';
import {
  getCustomSchema,
  setCustomSchema,
  clearCustomSchema,
  addToHistory,
  getHistory,
  isUsingCustomSchema
} from '../lib/schemaStorage.js';
import { reloadSchemaDrivenServer, testToolInSandbox } from '../server.js';

const router = Router();

/**
 * POST /api/schema/register
 * Register a new custom schema
 */
router.post('/schema/register', async (req, res) => {
  try {
    const { schema, source, sourceType } = req.body;

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

    setCustomSchema({
      ...schema,
      source: source || 'Custom Upload',
      sourceType: sourceType || 'file',
      registeredAt
    });

    addToHistory({
      name: schema.name,
      version: schema.version,
      source: source || 'Custom Upload',
      registeredAt,
      toolsCount: schema.tools?.length || 0
    });

    const reloadResult = reloadSchemaDrivenServer();
    const actualTools = reloadResult.toolDefinitions || [];

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
      tools: actualTools,
      mcpServerUrl: mcpServerUrl
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/schema/fetch-url
 * Fetch schema from a URL
 */
router.post('/schema/fetch-url', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    let fetchUrl = url;
    if (url.includes('github.com') && url.includes('/blob/')) {
      fetchUrl = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
    }

    const response = await axios.get(fetchUrl, {
      headers: { 'Accept': 'application/json' },
      timeout: 10000
    });

    const schema = response.data;

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

/**
 * POST /api/schema/reset
 * Reset schema to default
 */
router.post('/schema/reset', (req, res) => {
  clearCustomSchema();
  reloadSchemaDrivenServer();
  res.json({
    success: true,
    message: 'Schema reset to default and MCP server reloaded'
  });
});

/**
 * POST /api/schema/test-tool
 * Test a tool in sandbox mode
 */
router.post('/schema/test-tool', async (req, res) => {
  try {
    const { toolName, payload } = req.body;

    if (!toolName) {
      return res.status(400).json({
        success: false,
        error: 'Tool name is required'
      });
    }

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

export default router;
