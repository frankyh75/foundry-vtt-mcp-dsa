#!/usr/bin/env node

/**
 * Tests character tools with realistic preconditions:
 * - MCP stdio server must be reachable
 * - Foundry module bridge must be connected
 * - At least one character should exist for positive-path tests
 */

import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const mcpServer = new Client(
  {
    name: 'test-client',
    version: '1.0.0'
  },
  {
    capabilities: {}
  }
);

const transport = new StdioClientTransport({
  command: 'node',
  args: ['packages/mcp-server/dist/index.js'],
  stderr: 'inherit'
});

async function testTool(toolName, args) {
  const startTime = Date.now();

  try {
    console.log(`\n[TEST] ${toolName}`);
    console.log(`       args=${JSON.stringify(args)}`);

    const result = await Promise.race([
      mcpServer.callTool({
        name: toolName,
        arguments: args
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT after 15s')), 15000))
    ]);

    const duration = Date.now() - startTime;
    const text = result?.content?.[0]?.text ?? '';

    console.log(`[OK]   completed in ${duration}ms`);
    console.log(`       payloadLength=${text.length}`);

    if (text.startsWith('Error:')) {
      console.log(`       toolError=${text}`);
      return { success: false, softFailure: true, duration, error: text };
    }

    try {
      const data = JSON.parse(text);
      console.log('       json=valid');
      if (data?.id || data?.name) {
        console.log(`       entity=${data.name ?? data.id}`);
      }
      if (Array.isArray(data?.matches)) {
        console.log(`       matches=${data.matches.length}`);
      }
    } catch {
      console.log(`       json=invalid preview="${text.substring(0, 80)}..."`);
    }

    return { success: true, duration, text };
  } catch (error) {
    const duration = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);
    console.log(`[ERR]  failed in ${duration}ms: ${message}`);
    return { success: false, duration, error: message };
  }
}

async function assertBridgeConnected() {
  const result = await mcpServer.callTool({
    name: 'list-characters',
    arguments: {}
  });
  const text = result?.content?.[0]?.text ?? '';

  if (text.includes('Foundry VTT module not connected')) {
    throw new Error('Bridge not connected: Foundry world/module is not connected to MCP server.');
  }

  if (text.startsWith('Error:')) {
    throw new Error(`list-characters failed during preflight: ${text}`);
  }

  return text;
}

async function pickCharacterIdentifier() {
  const result = await mcpServer.callTool({
    name: 'list-characters',
    arguments: {}
  });
  const text = result?.content?.[0]?.text ?? '';

  if (text.startsWith('Error:')) {
    throw new Error(`list-characters failed: ${text}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`list-characters returned non-JSON payload: ${text.substring(0, 120)}`);
  }

  const candidates = Array.isArray(parsed) ? parsed : Array.isArray(parsed.characters) ? parsed.characters : [];

  if (candidates.length === 0) {
    throw new Error('No characters found in current world; cannot run character tool tests.');
  }

  const first = candidates[0];
  const identifier = first?.name || first?.id;

  if (!identifier) {
    throw new Error('Could not derive character identifier from list-characters response.');
  }

  return String(identifier);
}

async function main() {
  console.log('[START] Character tool diagnostics (bridge-aware)\n');

  try {
    await mcpServer.connect(transport);
    console.log('[OK] Connected to MCP server\n');

    await assertBridgeConnected();
    console.log('[OK] Foundry bridge connected\n');

    const characterIdentifier = await pickCharacterIdentifier();
    console.log(`[OK] Selected character identifier: ${characterIdentifier}\n`);

    await testTool('get-character', { identifier: characterIdentifier });
    await testTool('get-character', { identifier: 'NON_EXISTENT_CHARACTER_ID' });
    await testTool('search-character-items', { characterIdentifier, query: 'schwert' });
    await testTool('search-character-items', { characterIdentifier, limit: 10 });

    console.log('\n[DONE] All diagnostics completed.');

    await mcpServer.close();
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n[FATAL] ${message}`);

    if (message.includes('Bridge not connected')) {
      console.error('[ACTION] Open Foundry world and enable Foundry MCP Bridge module.');
    }

    await mcpServer.close();
    process.exit(1);
  }
}

main();
