#!/usr/bin/env node

/**
 * Test specific MCP tools for hanging issues
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

async function testToolTimeout(toolName, params = {}) {
  const timeout = 10000; // 10 second timeout
  const startTime = Date.now();

  console.log(`\n🧪 Testing: ${toolName}`);
  console.log(`   Params: ${JSON.stringify(params)}`);

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), timeout)
    );

    const resultPromise = mcpServer.callTool({
      name: toolName,
      arguments: params
    });

    const result = await Promise.race([resultPromise, timeoutPromise]);
    const duration = Date.now() - startTime;

    console.log(`✅ SUCCESS (${duration}ms)`);
    console.log(`   Response:`, result);

    return { success: true, duration, result };
  } catch (error) {
    const duration = Date.now() - startTime;

    if (error.message === 'TIMEOUT') {
      console.log(`❌ TIMEOUT after ${duration}ms`);
      return { success: false, duration, error: 'timeout' };
    } else {
      console.log(`❌ ERROR (${duration}ms):`, error.message);
      return { success: false, duration, error: error.message };
    }
  }
}

async function main() {
  console.log('🚀 Testing MCP tools for timeout issues...\n');
  console.log('⚠️  Note: These tests require Foundry VTT to be running');

  try {
    await mcpServer.connect(transport);
    console.log('✅ Connected to MCP server\n');

    const results = [];

    // Test 1: list-characters (to get a valid actor ID)
    console.log('📋 Step 1: List characters to get test data...');
    try {
      const listResult = await mcpServer.callTool({
        name: 'list-characters',
        arguments: {}
      });

      const characters = JSON.parse(listResult.content[0].text);
      console.log(`   Found ${characters.length} characters`);

      if (characters.length > 0) {
        const testActorId = characters[0].id;
        const testActorName = characters[0].name;

        console.log(`   Using test actor: ${testActorName} (${testActorId})\n`);

        // Test 2: get-character
        console.log('\n📋 Step 2: Test get-character');
        const getResult = await testToolTimeout('get-character', {
          actorId: testActorId
        });
        results.push({ tool: 'get-character', ...getResult });

        // Test 3: get-character-entity
        console.log('\n📋 Step 3: Test get-character-entity');
        const entityResult = await testToolTimeout('get-character-entity', {
          actorId: testActorId,
          entityType: 'items'
        });
        results.push({ tool: 'get-character-entity', ...entityResult });

        // Test 4: search-character-items
        console.log('\n📋 Step 4: Test search-character-items');
        const searchResult = await testToolTimeout('search-character-items', {
          actorId: testActorId,
          query: 'sword'
        });
        results.push({ tool: 'search-character-items', ...searchResult });

      } else {
        console.log('⚠️  No characters found, skipping detailed tests');
      }
    } catch (error) {
      console.log('❌ Failed to list characters:', error.message);
      console.log('   This is expected if Foundry VTT is not running\n');
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));

    for (const result of results) {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      const duration = result.duration + 'ms';
      const error = result.error || '';
      console.log(`${status} | ${result.tool.padEnd(30)} | ${duration.padEnd(8)} | ${error}`);
    }

    const hanging = results.filter(r => !r.success && r.error === 'timeout');
    if (hanging.length > 0) {
      console.log(`\n⚠️  WARNING: ${hanging.length} tool(s) are hanging!`);
      process.exit(1);
    } else {
      console.log('\n✅ All tools responded normally');
      process.exit(0);
    }

    await mcpServer.close();
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    await mcpServer.close();
    process.exit(1);
  }
}

main();
