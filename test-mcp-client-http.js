import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

async function testMCPConnection() {
  console.log('🔌 Connecting to MCP server via Streamable HTTP...');

  const transport = new StreamableHTTPClientTransport(
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
    console.log(`Found ${tools.tools.length} tools:`);
    tools.tools.forEach((tool, index) => {
      console.log(`  ${index + 1}. ${tool.name} - ${tool.description}`);
    });

    // List available resources
    console.log('\n📦 Listing available resources...');
    const resources = await client.listResources();
    console.log(`Found ${resources.resources.length} resources`);

    // Call a tool: list APIs
    console.log('\n🔧 Calling tool: list-apis...');
    const result = await client.callTool({
      name: 'list-apis',
      arguments: {}
    });
    console.log('Result:', JSON.stringify(result, null, 2));

    // Try another tool: get API by ID
    console.log('\n🔧 Calling tool: get-api (ID: 9)...');
    const apiResult = await client.callTool({
      name: 'get-api',
      arguments: { api_id: 9 }
    });
    console.log('API Details:', JSON.stringify(apiResult, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    try {
      await client.close();
      console.log('\n🔌 Disconnected from MCP server');
    } catch (e) {
      // Ignore close errors
    }
    process.exit(0);
  }
}

testMCPConnection();
