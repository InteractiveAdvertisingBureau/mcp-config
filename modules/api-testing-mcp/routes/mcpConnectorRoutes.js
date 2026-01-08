import { Router } from 'express';
import axios from 'axios';

const router = Router();

/**
 * POST /api/mcp/validate
 * Validate MCP server connection and get tools
 */
router.post('/mcp/validate', async (req, res) => {
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

/**
 * POST /api/mcp/get-tools
 * Get tools from MCP server
 */
router.post('/mcp/get-tools', async (req, res) => {
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

/**
 * POST /api/mcp/call-tool
 * Call a tool on MCP server
 */
router.post('/mcp/call-tool', async (req, res) => {
  try {
    const { serverUrl, toolName, parameters } = req.body;

    if (!serverUrl || !toolName) {
      return res.status(400).json({
        success: false,
        error: 'Server URL and tool name are required'
      });
    }

    const response = await axios.post(serverUrl, {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: parameters || {}
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      timeout: 30000
    });

    let result = response.data;
    if (typeof result === 'string' && result.includes('event: message')) {
      const lines = result.split('\n');
      const dataLine = lines.find(l => l.startsWith('data: '));
      if (dataLine) {
        result = JSON.parse(dataLine.replace('data: ', ''));
      }
    }

    if (result.error) {
      return res.status(400).json({
        success: false,
        error: result.error.message || 'Tool execution failed',
        errorCode: result.error.code
      });
    }

    res.json({
      success: true,
      result: result.result
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
