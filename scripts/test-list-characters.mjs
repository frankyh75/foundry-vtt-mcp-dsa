#!/usr/bin/env node

/**
 * Simple test for list-characters tool
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

async function testListCharacters() {
  console.log('🚀 Testing list-characters...\n');

  let startTime;
  try {
    console.log('⏳ Connecting to MCP server...');
    await mcpServer.connect(transport);
    console.log('✅ Connected\n');

    console.log('⏳ Calling list-characters...');
    startTime = Date.now();

    const result = await mcpServer.callTool({
      name: 'list-characters',
      arguments: {}
    });

    const duration = Date.now() - startTime;

    console.log(`✅ SUCCESS (${duration}ms)\n`);

    // Parse and display result
    const text = result.content[0].text;
    const characters = JSON.parse(text);

    console.log('📋 Characters found:');
    console.log('='.repeat(60));
    characters.forEach((char, index) => {
      console.log(`${index + 1}. ${char.name} (${char.type})`);
      console.log(`   ID: ${char.id}`);
      if (char.prototype) {
        console.log(`   Prototype: ${char.prototype}`);
      }
      console.log('');
    });

    console.log(`Total: ${characters.length} characters`);

    await mcpServer.close();
    process.exit(0);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`\n❌ ERROR after ${duration}ms:`);
    console.error(error.message);

    if (error.message.includes('timeout')) {
      console.error('\n⚠️  This appears to be a timeout issue!');
      console.error('   Check if Foundry VTT is running on port 31415');
    }

    await mcpServer.close();
    process.exit(1);
  }
}

testListCharacters();
