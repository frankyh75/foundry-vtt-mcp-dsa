#!/usr/bin/env node

/**
 * Show full error messages
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
      name: 'get-character',
      arguments: { identifier: 'Arbosch Sohn des Angrax' }
    });

    console.log('📦 Full Response:');
    console.log('='.repeat(60));
    console.log(result.content[0].text);
    console.log('='.repeat(60));

    await mcpServer.close();
  } catch (error) {
    console.error('Error:', error.message);
    await mcpServer.close();
  }
}

test();
