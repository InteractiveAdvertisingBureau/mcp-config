// AI Chat Server - MCP-Aware AI Proxy
// Connects AI providers with MCP server (no tool duplication)
// Run on port 4000: node aiChatServer.js

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load AI Chat specific environment variables
config({ path: '.env.ai-chat' });

const app = express();
const PORT = process.env.AI_CHAT_PORT || 4000;
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3000/mcp';

// MCP Client (official SDK)
let mcpClient = null;
let mcpTransport = null;

// Global variables for MCP tools (fetched from MCP server)
let MCP_TOOLS = [];
let mcpServerConnected = false;

// Middleware
app.use(cors({
    origin: '*',
    credentials: true
}));
app.use(express.json());

// Serve static files from standalone directory
app.use('/static', express.static(path.join(__dirname, 'client/standalone')));

// Determine which AI provider to use
let AI_PROVIDER = 'none';
let aiClient = null;

if (process.env.ANTHROPIC_API_KEY) {
    AI_PROVIDER = 'anthropic';
    aiClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
} else if (process.env.OPENAI_API_KEY) {
    AI_PROVIDER = 'openai';
    aiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} else if (process.env.GEMINI_API_KEY) {
    AI_PROVIDER = 'gemini';
    aiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

// Serve AI chat client at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/standalone', 'adstxt-ai-chat.html'));
});

// Serve pattern matching client at /query
app.get('/query', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/standalone', 'adstxt-compliance-client.html'));
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'AI Chat Server (MCP Proxy)',
        port: PORT,
        aiProvider: AI_PROVIDER,
        aiConfigured: AI_PROVIDER !== 'none',
        mcpServerConnected: mcpServerConnected,
        mcpToolsCount: MCP_TOOLS.length
    });
});

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
        // First parameter is the URL string directly
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
            throw new Error('Invalid response format from MCP server');
        }
    } catch (error) {
        console.error('❌ Failed to fetch MCP tools:', error.message);
        mcpServerConnected = false;
        return false;
    }
}

/**
 * Execute a tool by calling MCP server using SDK
 */
async function executeMCPTool(toolName, toolInput) {
    console.log(`🔧 Forwarding tool call to MCP server: ${toolName}`, toolInput);

    try {
        if (!mcpClient) {
            throw new Error('MCP client not initialized');
        }

        // Use official SDK method
        const mcpResult = await mcpClient.callTool({
            name: toolName,
            arguments: toolInput
        });

        console.log(`✅ Tool execution successful: ${toolName}`);

        // MCP SDK returns result in format: { content: [{type: 'text', text: '...'}], isError: false }
        // We need to extract and parse the actual JSON from the text content
        if (mcpResult && mcpResult.content && mcpResult.content.length > 0) {
            const textContent = mcpResult.content[0].text;

            try {
                // Try to parse as JSON
                const parsedResult = JSON.parse(textContent);
                return parsedResult;
            } catch (e) {
                // If not JSON, return as-is
                return { success: true, result: textContent };
            }
        }

        // Fallback: return the raw result
        return mcpResult;
    } catch (error) {
        console.error(`❌ Tool execution failed: ${toolName}`, error.message);
        return {
            success: false,
            error: error.message,
            tool: toolName
        };
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

// Main AI chat endpoint
app.post('/api/ai-chat', async (req, res) => {
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

        // Build conversation history (limit to save tokens)
        const messages = [
            ...conversation.slice(-4), // Keep last 4 messages for context (2 exchanges)
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
            toolCalls: toolCalls.length > 0 ? toolCalls : null,
            provider: AI_PROVIDER,
            usage
        });

    } catch (error) {
        console.error('❌ Error in AI chat:', error);
        res.status(500).json({
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Call Anthropic API (Claude)
async function callAnthropicAPI(messages) {
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
        max_tokens: 2048, // Reduced from 4096 to save output tokens
        system: SYSTEM_PROMPT,
        messages,
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
            max_tokens: 2048, // Reduced from 4096 to save output tokens
            system: SYSTEM_PROMPT,
            messages: [
                ...messages,
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

// Call OpenAI API (GPT)
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

// Call Gemini API with Function Calling
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

        // Execute the tool via MCP
        const toolResult = await executeMCPTool(toolName, toolArgs);
        console.log(`✅ Tool result:`, JSON.stringify(toolResult).substring(0, 200) + '...');

        // Send function response back to Gemini
        result = await chat.sendMessage([{
            functionResponse: {
                name: toolName,
                response: toolResult
            }
        }]);

        response = result.response;
    }

    // Extract final text response
    let responseText = '';
    if (response.candidates && response.candidates[0].content.parts) {
        const textParts = response.candidates[0].content.parts.filter(part => part.text);
        responseText = textParts.map(part => part.text).join('');
    }

    if (!responseText) {
        responseText = 'I apologize, but I could not generate a response.';
    }

    return {
        responseText,
        toolCalls,
        usage: {
            promptTokens: response.usageMetadata?.promptTokenCount || 0,
            completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
            totalTokens: response.usageMetadata?.totalTokenCount || 0
        }
    };
}

// Start server
app.listen(PORT, async () => {
    console.log(`\n🚀 AI Chat Server (MCP Proxy) running on http://localhost:${PORT}`);
    console.log(`\n📱 Client Access:`);
    console.log(`   AI Chat (Conversational):  http://localhost:${PORT}/`);
    console.log(`   Pattern Matching (Simple): http://localhost:${PORT}/query`);
    console.log(`\n📡 API Endpoints:`);
    console.log(`   AI Chat API:    http://localhost:${PORT}/api/ai-chat`);
    console.log(`   Health Check:   http://localhost:${PORT}/api/health`);

    if (AI_PROVIDER === 'none') {
        console.warn(`\n⚠️  WARNING: No AI provider configured!`);
        console.warn(`   Add one of these to .env.ai-chat:`);
        console.warn(`   - ANTHROPIC_API_KEY=sk-ant-xxx  (Claude 3.5)`);
        console.warn(`   - OPENAI_API_KEY=sk-xxx         (GPT-4)`);
        console.warn(`   - GEMINI_API_KEY=xxx            (Gemini)`);
    } else {
        console.log(`\n✅ AI Provider: ${AI_PROVIDER.toUpperCase()}`);
    }

    // Initialize MCP client and fetch tools
    console.log(`\n🔗 MCP Server Configuration:`);
    console.log(`   URL: ${MCP_SERVER_URL}/sse`);

    // Step 1: Initialize MCP client
    const clientInitialized = await initializeMCPClient();

    if (clientInitialized) {
        // Step 2: Fetch tools
        const toolsFetched = await fetchMCPTools();

        if (toolsFetched) {
            console.log(`✅ MCP integration complete - ${MCP_TOOLS.length} tools available`);
        } else {
            console.warn(`⚠️  WARNING: Could not fetch tools from MCP server`);
        }
    } else {
        console.warn(`⚠️  WARNING: Could not connect to MCP server`);
        console.warn(`   Make sure MCP server is running on ${MCP_SERVER_URL}`);
        console.warn(`   Start it with: node mcpServerHttp.js`);
    }

    console.log(`\n💡 Quick Start:`);
    console.log(`   1. Open: http://localhost:${PORT}/`);
    console.log(`   2. Start chatting with AI!\n`);
});

export default app;
