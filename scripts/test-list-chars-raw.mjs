#!/usr/bin/env node

/**
 * Test list-characters and show raw response
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

async function test() {
  try {
    await mcpServer.connect(transport);
    console.log('✅ Connected\n');

    const result = await mcpServer.callTool({
      name: 'list-characters',
      arguments: {}
    });

    console.log('📦 Raw Response:');
    console.log('='.repeat(60));
    console.log('Type:', result.content[0].type);
    console.log('Text length:', result.content[0].text.length);
    console.log('First 500 chars:');
    console.log(result.content[0].text.substring(0, 500));
    console.log('\nLast 500 chars:');
    console.log(result.content[0].text.substring(result.content[0].text.length - 500));

    await mcpServer.close();
  } catch (error) {
    console.error('Error:', error.message);
    await mcpServer.close();
  }
}

test();
