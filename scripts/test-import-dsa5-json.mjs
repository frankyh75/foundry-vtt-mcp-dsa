#!/usr/bin/env node

import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const DEFAULT_FILE_PATH =
  'C:/Users/Frank/iCloudDrive/Documents/DSA_/Charactere/aktuell/loreley/Loreley.json';

const filePath = process.env.DSA5_IMPORT_FILE || DEFAULT_FILE_PATH;
const strategy = process.env.DSA5_IMPORT_STRATEGY || 'auto';
const resolveItems = process.env.DSA5_IMPORT_RESOLVE_ITEMS !== 'false';
const strict = process.env.DSA5_IMPORT_STRICT === 'true';
const addToScene = process.env.DSA5_IMPORT_ADD_TO_SCENE === 'true';

const mcpServer = new Client(
  { name: 'dsa5-json-import-test', version: '1.0.0' },
  { capabilities: {} }
);

const transport = new StdioClientTransport({
  command: 'node',
  args: ['packages/mcp-server/dist/index.js'],
  stderr: 'inherit',
});

async function main() {
  console.log('[START] DSA5 JSON import smoke test');
  console.log(`[CONFIG] filePath=${filePath}`);
  console.log(`[CONFIG] strategy=${strategy}, resolveItems=${resolveItems}, strict=${strict}, addToScene=${addToScene}`);

  await mcpServer.connect(transport);

  const result = await mcpServer.callTool({
    name: 'import-dsa5-actor-from-json',
    arguments: {
      filePath,
      strategy,
      resolveItems,
      strict,
      addToScene,
    },
  });

  console.log('[RESULT]');
  console.log(JSON.stringify(result, null, 2));

  await mcpServer.close();
}

main().catch(async (error) => {
  console.error('[ERROR]', error instanceof Error ? error.message : String(error));
  try {
    await mcpServer.close();
  } catch {
    // ignore close errors
  }
  process.exit(1);
});
