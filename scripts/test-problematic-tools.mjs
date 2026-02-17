#!/usr/bin/env node

/**
 * Test the tools that Codex says are hanging
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

async function testTool(toolName, args) {
  const startTime = Date.now();

  try {
    console.log(`\n🧪 Testing: ${toolName}`);
    console.log(`   Args:`, JSON.stringify(args));

    const result = await Promise.race([
      mcpServer.callTool({
        name: toolName,
        arguments: args
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT after 15s')), 15000)
      )
    ]);

    const duration = Date.now() - startTime;
    console.log(`✅ SUCCESS (${duration}ms)`);
    console.log(`   Response length: ${result.content[0].text.length} chars`);

    // Try to parse as JSON
    try {
      const data = JSON.parse(result.content[0].text);
      console.log(`   Valid JSON: ✅`);
      if (data.id) console.log(`   Character: ${data.name || data.id}`);
      if (data.matches) console.log(`   Matches: ${data.matches.length}`);
    } catch {
      console.log(`   Valid JSON: ❌ (starts with: "${result.content[0].text.substring(0, 50)}...")`);
    }

    return { success: true, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ ERROR (${duration}ms): ${error.message}`);
    return { success: false, duration, error: error.message };
  }
}

async function main() {
  console.log('🚀 Testing tools that Codex says are hanging...\n');

  try {
    await mcpServer.connect(transport);
    console.log('✅ Connected to MCP server\n');

    // Test 1: get-character with Arbosch (player character)
    await testTool('get-character', {
      identifier: 'Arbosch Sohn des Angrax'
    });

    // Test 2: get-character with ID
    await testTool('get-character', {
      identifier: 'OKr7XGGxd3JGBgOy'
    });

    // Test 3: search-character-items
    await testTool('search-character-items', {
      characterIdentifier: 'Arbosch Sohn des Angrax',
      query: 'schwert'
    });

    // Test 4: search-character-items with no query (all items)
    await testTool('search-character-items', {
      characterIdentifier: 'Arbosch Sohn des Angrax',
      limit: 10
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests completed!');
    console.log('='.repeat(60));

    await mcpServer.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    await mcpServer.close();
    process.exit(1);
  }
}

main();
