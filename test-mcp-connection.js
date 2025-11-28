#!/usr/bin/env node

/**
 * MCP Connection Test Script
 * Tests both stdio and HTTP MCP servers
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';
import axios from 'axios';

console.log('🧪 MCP Server Connection Test\n');
console.log('=' .repeat(50));

// Test 1: HTTP Server Test
async function testHTTPServer() {
  console.log('\n📡 Test 1: HTTP/SSE Endpoint');
  console.log('-'.repeat(50));

  try {
    const response = await axios.get('http://localhost:3000/api/health', {
      timeout: 5000
    });

    if (response.status === 200) {
      console.log('✅ HTTP Server is running');
      console.log(`   Status: ${response.data.status}`);
      console.log(`   Timestamp: ${response.data.timestamp}`);

      // Test MCP endpoint
      console.log('\n   Testing MCP endpoint...');
      try {
        // MCP SSE endpoint expects POST with proper MCP protocol
        const mcpResponse = await axios.post('http://localhost:3000/mcp/sse',
          {
            jsonrpc: '2.0',
            method: 'tools/list',
            id: 1
          },
          {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 5000
          }
        );
        console.log('✅ MCP HTTP endpoint is accessible');
        console.log(`   Endpoint: http://localhost:3000/mcp/sse`);
      } catch (mcpError) {
        if (mcpError.response) {
          console.log('⚠️  MCP endpoint responded but may need proper MCP client');
          console.log(`   Endpoint: http://localhost:3000/mcp/sse`);
        } else {
          console.log('❌ MCP endpoint not accessible');
          console.log(`   Error: ${mcpError.message}`);
        }
      }

      return true;
    }
  } catch (error) {
    console.log('❌ HTTP Server not running');
    console.log(`   Error: ${error.message}`);
    console.log('\n   💡 Start the server with: npm start');
    return false;
  }
}

// Test 2: Stdio Server Test
async function testStdioServer() {
  console.log('\n📡 Test 2: Stdio MCP Server (Claude Desktop)');
  console.log('-'.repeat(50));

  try {
    console.log('   Starting stdio MCP server...');

    const serverProcess = spawn('node', ['mcpServer.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    let timeout;
    const timeoutPromise = new Promise((_, reject) => {
      timeout = setTimeout(() => {
        serverProcess.kill();
        reject(new Error('Server startup timeout'));
      }, 5000);
    });

    const startupPromise = new Promise((resolve, reject) => {
      let stderrOutput = '';

      serverProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderrOutput += output;

        if (output.includes('API Testing MCP Server running')) {
          clearTimeout(timeout);
          serverProcess.kill();
          resolve(stderrOutput);
        }
      });

      serverProcess.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      serverProcess.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          clearTimeout(timeout);
          reject(new Error(`Server exited with code ${code}\n${stderrOutput}`));
        }
      });
    });

    try {
      const output = await Promise.race([startupPromise, timeoutPromise]);
      console.log('✅ Stdio MCP server starts successfully');
      console.log('   Ready for Claude Desktop integration');
      return true;
    } catch (error) {
      throw error;
    }

  } catch (error) {
    console.log('❌ Stdio MCP server failed to start');
    console.log(`   Error: ${error.message}`);

    if (error.message.includes('database') || error.message.includes('MySQL')) {
      console.log('\n   💡 Check your database configuration:');
      console.log('      - Ensure MySQL is running');
      console.log('      - Verify database credentials in .env');
      console.log('      - Check if api_testing database exists');
    }

    return false;
  }
}

// Test 3: Database Connection Test
async function testDatabaseConnection() {
  console.log('\n📡 Test 3: Database Connection');
  console.log('-'.repeat(50));

  try {
    const response = await axios.get('http://localhost:3000/api/apis', {
      timeout: 5000
    });

    if (response.status === 200) {
      console.log('✅ Database connection working');
      console.log(`   Total APIs registered: ${response.data.total || 0}`);
      return true;
    }
  } catch (error) {
    console.log('❌ Database connection failed');
    console.log(`   Error: ${error.message}`);
    console.log('\n   💡 Troubleshooting:');
    console.log('      1. Check if MySQL server is running');
    console.log('      2. Verify database credentials in .env file');
    console.log('      3. Ensure api_testing database exists');
    console.log('      4. Run: mysql -u root -p < database/schema.sql');
    return false;
  }
}

// Test 4: AI Integration Test
async function testAIIntegration() {
  console.log('\n📡 Test 4: AI Integration');
  console.log('-'.repeat(50));

  // Check environment variables
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasGemini = !!process.env.GEMINI_API_KEY;

  if (hasOpenAI) {
    console.log('✅ OpenAI API key configured');
  } else {
    console.log('⚠️  OpenAI API key not found');
  }

  if (hasGemini) {
    console.log('✅ Gemini API key configured');
  } else {
    console.log('⚠️  Gemini API key not found');
  }

  if (!hasOpenAI && !hasGemini) {
    console.log('\n   💡 Add AI API keys to .env file:');
    console.log('      OPENAI_API_KEY=sk-...');
    console.log('      GEMINI_API_KEY=AI...');
    return false;
  }

  return hasOpenAI || hasGemini;
}

// Test 5: Claude Desktop Config Check
async function testClaudeDesktopConfig() {
  console.log('\n📡 Test 5: Claude Desktop Configuration');
  console.log('-'.repeat(50));

  const { homedir } = await import('os');
  const { existsSync, readFileSync } = await import('fs');
  const { join } = await import('path');

  let configPath;

  if (process.platform === 'darwin') {
    configPath = join(homedir(), 'Library/Application Support/Claude/claude_desktop_config.json');
  } else if (process.platform === 'win32') {
    configPath = join(process.env.APPDATA || '', 'Claude/claude_desktop_config.json');
  } else {
    configPath = join(homedir(), '.config/Claude/claude_desktop_config.json');
  }

  console.log(`   Config location: ${configPath}`);

  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));

      if (config.mcpServers && Object.keys(config.mcpServers).length > 0) {
        console.log('✅ Claude Desktop config file exists');
        console.log(`   Configured servers: ${Object.keys(config.mcpServers).join(', ')}`);

        const apiTestingConfig = Object.entries(config.mcpServers).find(
          ([_, cfg]) => cfg.args && cfg.args[0].includes('mcpServer.js')
        );

        if (apiTestingConfig) {
          console.log('✅ API Testing MCP server is configured');
          return true;
        } else {
          console.log('⚠️  API Testing MCP server not found in config');
          console.log('\n   💡 Add configuration from claude_desktop_config.example.json');
          return false;
        }
      } else {
        console.log('⚠️  Config file exists but no MCP servers configured');
        return false;
      }
    } catch (error) {
      console.log('❌ Config file exists but has errors');
      console.log(`   Error: ${error.message}`);
      return false;
    }
  } else {
    console.log('⚠️  Claude Desktop config file not found');
    console.log('\n   💡 Steps to configure:');
    console.log('      1. Copy claude_desktop_config.example.json');
    console.log(`      2. Save to: ${configPath}`);
    console.log('      3. Update paths and credentials');
    console.log('      4. Restart Claude Desktop');
    return false;
  }
}

// Main test runner
async function runTests() {
  const results = {
    httpServer: false,
    stdioServer: false,
    database: false,
    aiIntegration: false,
    claudeConfig: false
  };

  results.httpServer = await testHTTPServer();
  results.stdioServer = await testStdioServer();

  if (results.httpServer) {
    results.database = await testDatabaseConnection();
  }

  results.aiIntegration = await testAIIntegration();
  results.claudeConfig = await testClaudeDesktopConfig();

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary');
  console.log('='.repeat(50));

  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;

  console.log(`\n   ${passed}/${total} tests passed\n`);

  console.log(`   ${results.httpServer ? '✅' : '❌'} HTTP Server`);
  console.log(`   ${results.stdioServer ? '✅' : '❌'} Stdio Server`);
  console.log(`   ${results.database ? '✅' : '❌'} Database Connection`);
  console.log(`   ${results.aiIntegration ? '✅' : '❌'} AI Integration`);
  console.log(`   ${results.claudeConfig ? '✅' : '❌'} Claude Desktop Config`);

  console.log('\n' + '='.repeat(50));

  if (passed === total) {
    console.log('🎉 All systems operational!');
    console.log('   Your MCP server is ready to use with Claude Desktop.\n');
  } else {
    console.log('⚠️  Some issues detected. Please review the errors above.\n');
  }

  process.exit(passed === total ? 0 : 1);
}

// Run tests
runTests().catch(error => {
  console.error('\n❌ Test suite failed:', error);
  process.exit(1);
});
