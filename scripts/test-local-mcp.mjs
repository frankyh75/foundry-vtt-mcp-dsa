#!/usr/bin/env node

/**
 * Simple MCP Client Test
 * Tests the local MCP server via stdio transport
 */

import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const mcpServer = new Client({
  name: 'test-client',
  version: '1.0.0'
}, {
  capabilities: {}
});

const transport = new StdioClientTransport({
  command: 'node',
  args: ['packages/mcp-server/dist/index.js'],
  stderr: 'inherit'
});

async function testMCP() {
  console.log('🚀 Starting local MCP server test...\n');

  try {
    // Connect to server (initialize happens automatically)
    await mcpServer.connect(transport);
    console.log('✅ Connected to MCP server\n');

    // Server info is available after connection
    console.log('📋 Server Information:');
    console.log(`   Client: ${mcpServer.name} v${mcpServer.version}`);
    console.log(`   Server is ready!\n`);

    // Test tools/list
    console.log('🔧 Testing tools/list...');
    const toolsResult = await mcpServer.listTools();
    console.log(`✅ Found ${toolsResult.tools.length} tools:\n`);

    // Group tools by category
    const categories = {};
    for (const tool of toolsResult.tools) {
      const category = tool.name.split('/')[0] || 'other';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(tool);
    }

    // Print tools by category
    for (const [category, tools] of Object.entries(categories)) {
      console.log(`   ${category}:`);
      for (const tool of tools) {
        console.log(`      - ${tool.name}: ${tool.description?.substring(0, 80)}${tool.description?.length > 80 ? '...' : ''}`);
      }
    }

    console.log(`\n✅ All tests passed!`);

    // Cleanup
    await mcpServer.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    await mcpServer.close();
    process.exit(1);
  }
}

testMCP();
