// AI Chat Module - Can be imported into any Express app
// Provides AI chat functionality with MCP integration

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MCP Client (official SDK)
let mcpClient = null;
let mcpTransport = null;

// Global variables for MCP tools (fetched from MCP server)
let MCP_TOOLS = [];
let mcpServerConnected = false;

// These will be set when setupAIChat is called
let AI_PROVIDER = 'none';
let aiClient = null;
let MCP_SERVER_URL = 'http://localhost:3000/mcp';

// ============================================================
// MCP SDK CLIENT - OFFICIAL IMPLEMENTATION
// ============================================================

/**
 * Initialize MCP client and connect to server
 */
async function initializeMCPClient() {
    try {
        console.log(`🔗 Connecting to MCP Server: ${MCP_SERVER_URL}`);

        // Create MCP client
        mcpClient = new Client({
            name: 'ai-chat-mcp-client',
            version: '1.0.0'
        }, {
            capabilities: {}
        });

        // Create transport (Streamable HTTP)
        mcpTransport = new StreamableHTTPClientTransport(
            `${MCP_SERVER_URL}/sse`  // Correct MCP endpoint
        );

        // Connect client to server via transport
        await mcpClient.connect(mcpTransport);

        console.log('✅ MCP client connected successfully');
        return true;
    } catch (error) {
        console.error('❌ MCP client connection failed:', error.message);
        mcpServerConnected = false;
        mcpClient = null;
        mcpTransport = null;
        return false;
    }
}

/**
 * Fetch available tools from MCP server using SDK
 */
async function fetchMCPTools() {
    try {
        if (!mcpClient) {
            throw new Error('MCP client not initialized');
        }

        console.log('🔄 Fetching tools from MCP server...');

        // Use official SDK method
        const response = await mcpClient.listTools();

        if (response && response.tools) {
            // Filter out admin-only tools that shouldn't be exposed to chat users
            const ADMIN_TOOLS = ['register-api', 'update-api', 'delete-api'];
            MCP_TOOLS = response.tools.filter(tool => !ADMIN_TOOLS.includes(tool.name));

            mcpServerConnected = true;
            console.log(`✅ Loaded ${MCP_TOOLS.length} tools from MCP server (${response.tools.length - MCP_TOOLS.length} admin tools filtered)`);
            MCP_TOOLS.forEach(tool => {
                console.log(`   - ${tool.name}: ${tool.description}`);
            });
            return true;
        } else {
            throw new Error('No tools returned from MCP server');
        }
    } catch (error) {
        console.error('❌ Failed to fetch MCP tools:', error.message);
        mcpServerConnected = false;
        return false;
    }
}

/**
 * Execute MCP tool using official SDK
 */
async function executeMCPTool(toolName, toolInput) {
    try {
        if (!mcpClient) {
            throw new Error('MCP client not initialized');
        }

        console.log(`🔧 Forwarding tool call to MCP server: ${toolName}`, toolInput);

        const result = await mcpClient.callTool({
            name: toolName,
            arguments: toolInput
        });

        console.log(`✅ Tool execution successful: ${toolName}`);

        // Extract text content from MCP response
        if (result && result.content && result.content.length > 0) {
            const textContent = result.content.find(item => item.type === 'text');
            if (textContent) {
                try {
                    return JSON.parse(textContent.text);
                } catch {
                    return textContent.text;
                }
            }
        }

        return result;
    } catch (error) {
        console.error(`❌ Tool execution failed: ${toolName}`, error.message);
        return { error: error.message };
    }
}

// ============================================================
// AI SYSTEM PROMPT
// ============================================================

// System prompt for all providers
const SYSTEM_PROMPT = `AI assistant for Ads.txt & Compliance APIs.

To find available APIs, call the list-apis tool first. Filter the list to find the relevant API ID for the user's query.

CRITICAL: When calling query-api-with-summary tool, use EXACT format:
{
  "api_id": 24,
  "params": {
    "query": {"domain": "example.com"}
  }
}
NOT: {"query": {"api_id": 24}} - api_id must be TOP-LEVEL!

IMPORTANT: APIs return full datasets. YOU must filter/search the data for the requested entity (domain, company name, etc.).

Format responses clearly and explain data.`;

// ============================================================
// ANTHROPIC CLAUDE API
// ============================================================

async function callAnthropicAPI(messages) {
    const anthropicMessages = messages.map(m => ({
        role: m.role,
        content: m.content
    }));

    // Convert MCP tools to Anthropic format
    const anthropicTools = MCP_TOOLS.map(tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema || tool.input_schema || {
            type: 'object',
            properties: {},
            required: []
        }
    }));

    let response = await aiClient.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: anthropicMessages,
        tools: anthropicTools
    });

    const toolCalls = [];
    let toolIterations = 0;
    const MAX_TOOL_ITERATIONS = 3; // Prevent infinite loops

    while (response.stop_reason === 'tool_use' && toolIterations < MAX_TOOL_ITERATIONS) {
        toolIterations++;

        // Get ALL tool use blocks (not just the first one)
        const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');
        if (toolUseBlocks.length === 0) break;

        console.log(`🔧 Anthropic wants to use ${toolUseBlocks.length} tool(s) (iteration ${toolIterations}/${MAX_TOOL_ITERATIONS})`);

        // Execute all tools and collect results
        const toolResults = [];
        for (const toolUseBlock of toolUseBlocks) {
            console.log(`🔧 Executing tool: ${toolUseBlock.name}`);
            toolCalls.push({ name: toolUseBlock.name, input: toolUseBlock.input });

            const toolResult = await executeMCPTool(toolUseBlock.name, toolUseBlock.input);
            const resultContent = JSON.stringify(toolResult);
            console.log(`✅ Tool result for ${toolUseBlock.name}: ${resultContent.length} chars`);

            toolResults.push({
                type: 'tool_result',
                tool_use_id: toolUseBlock.id,
                content: resultContent
            });
        }

        // Send all tool results back in one message
        response = await aiClient.messages.create({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 2048,
            system: SYSTEM_PROMPT,
            messages: [
                ...anthropicMessages,
                { role: 'assistant', content: response.content },
                {
                    role: 'user',
                    content: toolResults
                }
            ],
            tools: anthropicTools
        });
    }

    const textBlock = response.content.find(block => block.type === 'text');
    const responseText = textBlock ? textBlock.text : 'I apologize, but I could not generate a response.';

    return { responseText, toolCalls, usage: response.usage };
}

// ============================================================
// OPENAI API
// ============================================================

async function callOpenAIAPI(messages) {
    const openaiMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.map(m => ({ role: m.role, content: m.content }))
    ];

    const tools = MCP_TOOLS.map(tool => ({
        type: 'function',
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.input_schema
        }
    }));

    let response = await aiClient.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: openaiMessages,
        tools,
        max_tokens: 4096
    });

    const toolCalls = [];
    let responseMessage = response.choices[0].message;

    // Handle tool calls
    while (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        console.log(`🔧 OpenAI wants to use ${responseMessage.tool_calls.length} tool(s)`);

        // Add assistant message with tool_calls ONCE (not per tool)
        openaiMessages.push(responseMessage);

        // Execute all tools and collect results
        for (const toolCall of responseMessage.tool_calls) {
            console.log(`🔧 Executing tool: ${toolCall.function.name}`);
            const args = JSON.parse(toolCall.function.arguments);
            toolCalls.push({ name: toolCall.function.name, input: args });

            const toolResult = await executeMCPTool(toolCall.function.name, args);
            console.log(`✅ Tool result:`, JSON.stringify(toolResult).substring(0, 200) + '...');

            // Add tool response for this specific tool_call_id
            openaiMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(toolResult)
            });
        }

        // Get next response after ALL tools have been executed
        response = await aiClient.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages: openaiMessages,
            tools,
            max_tokens: 4096
        });

        responseMessage = response.choices[0].message;
    }

    const responseText = responseMessage.content || 'I apologize, but I could not generate a response.';
    return { responseText, toolCalls, usage: response.usage };
}

// ============================================================
// GEMINI API
// ============================================================

async function callGeminiAPI(messages) {
    // Convert MCP tools to Gemini function declarations
    const tools = MCP_TOOLS.map(tool => ({
        functionDeclarations: [{
            name: tool.name,
            description: tool.description,
            parameters: tool.input_schema
        }]
    }));

    const model = aiClient.getGenerativeModel({
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',
        systemInstruction: SYSTEM_PROMPT
    });

    // Build conversation history for Gemini
    const history = messages.slice(0, -1).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
    }));

    const chat = model.startChat({
        history,
        tools
    });

    const toolCalls = [];
    let currentMessage = messages[messages.length - 1].content;
    let result = await chat.sendMessage(currentMessage);
    let response = result.response;

    // Handle function calls
    while (response.candidates && response.candidates[0].content.parts) {
        const parts = response.candidates[0].content.parts;
        const functionCall = parts.find(part => part.functionCall);

        if (!functionCall) break;

        console.log(`🔧 Gemini wants to use tool: ${functionCall.functionCall.name}`);
        const toolName = functionCall.functionCall.name;
        const toolArgs = functionCall.functionCall.args || {};

        toolCalls.push({ name: toolName, input: toolArgs });

        const toolResult = await executeMCPTool(toolName, toolArgs);

        result = await chat.sendMessage([{
            functionResponse: {
                name: toolName,
                response: toolResult
            }
        }]);

        response = result.response;
    }

    const responseText = response.text() || 'I apologize, but I could not generate a response.';
    return { responseText, toolCalls, usage: null };
}

// ============================================================
// EXPORT MODULE FUNCTIONS
// ============================================================

/**
 * Setup AI Chat routes on an Express app
 * @param {Express.Application} app - Express app instance
 * @param {Object} options - Configuration options
 * @param {String} options.basePath - Base path for routes (default: '')
 * @param {String} options.staticPath - Path to static files
 * @param {String} options.mcpServerUrl - MCP server URL (default: http://localhost:3000/mcp)
 * @param {String} options.anthropicApiKey - Anthropic API key (from env)
 * @param {String} options.openaiApiKey - OpenAI API key (from env)
 * @param {String} options.geminiApiKey - Gemini API key (from env)
 * @param {String} options.openaiModel - OpenAI model name
 * @param {String} options.geminiModel - Gemini model name
 */
export async function setupAIChat(app, options = {}) {
    const basePath = options.basePath || '';
    const staticPath = options.staticPath || path.join(__dirname, 'client/standalone');

    // Set MCP server URL
    MCP_SERVER_URL = options.mcpServerUrl || process.env.MCP_SERVER_URL || 'http://localhost:3000/mcp';

    // Initialize AI provider based on provided API keys
    const anthropicKey = options.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
    const openaiKey = options.openaiApiKey || process.env.OPENAI_API_KEY;
    const geminiKey = options.geminiApiKey || process.env.GEMINI_API_KEY;

    if (anthropicKey) {
        AI_PROVIDER = 'anthropic';
        aiClient = new Anthropic({ apiKey: anthropicKey });
    } else if (openaiKey) {
        AI_PROVIDER = 'openai';
        aiClient = new OpenAI({ apiKey: openaiKey });
        // Store model name in global for later use
        if (!process.env.OPENAI_MODEL && options.openaiModel) {
            process.env.OPENAI_MODEL = options.openaiModel;
        }
    } else if (geminiKey) {
        AI_PROVIDER = 'gemini';
        aiClient = new GoogleGenerativeAI(geminiKey);
        // Store model name in global for later use
        if (!process.env.GEMINI_MODEL && options.geminiModel) {
            process.env.GEMINI_MODEL = options.geminiModel;
        }
    }

    // Serve static files (images, CSS, JS) from standalone directory
    app.use(`${basePath}/chat`, express.static(staticPath));

    // Serve AI chat UI
    app.get(`${basePath}/chat`, (req, res) => {
        res.sendFile(path.join(staticPath, 'adstxt-ai-chat.html'));
    });

    // Health check endpoint
    app.get(`${basePath}/api/ai-health`, (req, res) => {
        res.json({
            status: 'ok',
            service: 'AI Chat (MCP Integrated)',
            aiProvider: AI_PROVIDER,
            aiConfigured: AI_PROVIDER !== 'none',
            mcpServerConnected: mcpServerConnected,
            mcpToolsCount: MCP_TOOLS.length
        });
    });

    // Main AI chat endpoint
    app.post(`${basePath}/api/ai-chat`, async (req, res) => {
        try {
            const { message, conversation = [] } = req.body;

            if (!message) {
                return res.status(400).json({ error: 'Message is required' });
            }

            if (AI_PROVIDER === 'none') {
                return res.status(503).json({
                    error: 'No AI provider configured',
                    message: 'Please add ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY to .env.ai-chat'
                });
            }

            console.log(`\n💬 User message: ${message} (using ${AI_PROVIDER})`);

            // Build conversation history with intelligent token-aware pruning
            // Keep recent messages but strip large tool results from older messages
            let recentMessages = conversation.slice(-4); // Last 4 messages

            // Prune old tool results to prevent context overflow
            recentMessages = recentMessages.map((msg, index) => {
                // Keep the most recent message fully intact
                if (index === recentMessages.length - 1) {
                    return msg;
                }

                // For older messages with tool_calls, keep only a summary
                if (msg.role === 'assistant' && msg.tool_calls) {
                    return {
                        ...msg,
                        tool_calls: msg.tool_calls.map(tc => ({
                            ...tc,
                            // Truncate function arguments/results to prevent token overflow
                            function: {
                                ...tc.function,
                                arguments: '{}' // Remove large query params from history
                            }
                        }))
                    };
                }

                // For tool result messages, keep only the summary
                if (msg.role === 'tool') {
                    try {
                        const content = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
                        // If response has many records, just keep a summary
                        if (content.response && content.response.body && Array.isArray(content.response.body)) {
                            return {
                                ...msg,
                                content: JSON.stringify({
                                    ...content,
                                    response: {
                                        ...content.response,
                                        body: `[${content.response.body.length} records - pruned from history to save tokens]`
                                    }
                                })
                            };
                        }
                    } catch (e) {
                        // If parsing fails, keep message as-is
                    }
                }

                return msg;
            });

            const messages = [
                ...recentMessages,
                { role: 'user', content: message }
            ];

            let responseText, toolCalls, usage;

            // Route to appropriate AI provider
            if (AI_PROVIDER === 'anthropic') {
                ({ responseText, toolCalls, usage } = await callAnthropicAPI(messages));
            } else if (AI_PROVIDER === 'openai') {
                ({ responseText, toolCalls, usage } = await callOpenAIAPI(messages));
            } else if (AI_PROVIDER === 'gemini') {
                ({ responseText, toolCalls, usage } = await callGeminiAPI(messages));
            }

            console.log(`📤 Sending response to client (${responseText.length} chars)`);

            res.json({
                response: responseText,
                toolCalls: toolCalls,
                usage: usage
            });

        } catch (error) {
            console.error('❌ AI Chat Error:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error.message
            });
        }
    });

    // Initialize MCP client (with retry for Cloud Run)
    console.log('\n✅ AI Provider:', AI_PROVIDER);
    console.log(`🔗 MCP Server Configuration:\n   URL: ${MCP_SERVER_URL}/sse`);

    // Delay MCP connection to allow server to fully start (especially for Cloud Run)
    setTimeout(async () => {
        const connected = await initializeMCPClient();
        if (connected) {
            await fetchMCPTools();
            console.log('✅ MCP integration complete - ' + MCP_TOOLS.length + ' tools available\n');
        } else {
            console.log('⚠️  MCP integration failed - retrying in 3 seconds...\n');
            // Retry once after 3 seconds
            setTimeout(async () => {
                const retryConnected = await initializeMCPClient();
                if (retryConnected) {
                    await fetchMCPTools();
                    console.log('✅ MCP integration complete (retry) - ' + MCP_TOOLS.length + ' tools available\n');
                } else {
                    console.log('⚠️  MCP integration failed - AI chat will not have access to tools\n');
                }
            }, 3000);
        }
    }, 2000); // Wait 2 seconds for server to be ready
}

export default { setupAIChat };
