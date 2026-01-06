import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

async function testMCPConnection() {
  console.log('🔌 Connecting to MCP server via HTTP/SSE...');
  
  const transport = new SSEClientTransport(
    new URL('http://localhost:3000/mcp/sse')
  );

  const client = new Client(
    {
      name: 'test-mcp-client',
      version: '1.0.0',
    },
    {
      capabilities: {},
    }
  );

  try {
    await client.connect(transport);
    console.log('✅ Connected to MCP server!');

    // List available tools
    console.log('\n📋 Listing available tools...');
    const tools = await client.listTools();
    console.log('Available tools:', JSON.stringify(tools, null, 2));

    // List available resources
    console.log('\n📦 Listing available resources...');
    const resources = await client.listResources();
    console.log('Available resources:', JSON.stringify(resources, null, 2));

    // Call a tool (example: register API)
    console.log('\n🔧 Testing tool: list_apis...');
    const result = await client.callTool({
      name: 'list_apis',
      arguments: {}
    });
    console.log('Result:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MCP server');
  }
}

testMCPConnection();
