#!/usr/bin/env node

/**
 * Test script to verify MCP server advertises DSA5 tools correctly
 *
 * This simulates what Cline does:
 * 1. Spawns the MCP server via stdio
 * 2. Sends initialize request
 * 3. Sends tools/list request
 * 4. Checks if DSA5 tools are present
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const backendPath = join(__dirname, '../packages/mcp-server/dist/index.js');

let backend;

try {
  console.log('Starting MCP server...');
  backend = spawn(process.execPath, [backendPath], {
    stdio: ['pipe', 'pipe', 'inherit'],
    env: {
      ...process.env,
      FOUNDRY_HOST: 'localhost',
      FOUNDRY_PORT: '31415',
      FOUNDRY_NAMESPACE: '/foundry-mcp',
      LOG_LEVEL: 'error', // Reduce noise
    },
  });

  let requestId = 0;
  const pending = new Map();

  backend.stdout.on('data', (data) => {
    const responses = data.toString().split('\n').filter(Boolean);
    for (const response of responses) {
      try {
        const msg = JSON.parse(response);
        console.log('\n← Received:', JSON.stringify(msg, null, 2));

        if (msg.id !== undefined && pending.has(msg.id)) {
          const { resolve } = pending.get(msg.id);
          pending.delete(msg.id);
          resolve(msg);
        }
      } catch (e) {
        console.error('Failed to parse response:', e.message);
      }
    }
  });

  const sendRequest = (method, params = {}) => {
    return new Promise((resolve, reject) => {
      const id = ++requestId;
      const request = { jsonrpc: '2.0', id, method, params };

      console.log(`\n→ Sending ${method}:`);
      console.log(JSON.stringify(request, null, 2));

      pending.set(id, { resolve, reject });

      backend.stdin.write(JSON.stringify(request) + '\n');
    });
  };

  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Initialize
  console.log('\n=== Step 1: Initialize ===');
  await sendRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test-client', version: '1.0.0' },
  });

  // List tools
  console.log('\n=== Step 2: List Tools ===');
  const toolsResponse = await sendRequest('tools/list');

  // Check for DSA5 tools
  console.log('\n=== Step 3: Check for DSA5 Tools ===');
  const tools = toolsResponse.result?.tools || [];
  const dsa5Tools = tools.filter(t => t.name.includes('dsa5'));

  console.log(`\nTotal tools: ${tools.length}`);
  console.log(`DSA5 tools found: ${dsa5Tools.length}`);

  if (dsa5Tools.length > 0) {
    console.log('\n✅ DSA5 Tools:');
    dsa5Tools.forEach(tool => {
      console.log(`  - ${tool.name}`);
      console.log(`    Description: ${tool.description?.substring(0, 80)}...`);
    });
  } else {
    console.log('\n❌ No DSA5 tools found!');
    console.log('\nAll tool names:');
    tools.forEach(t => console.log(`  - ${t.name}`));
  }

  // Shutdown
  await sendRequest('shutdown');

} catch (error) {
  console.error('Error:', error);
} finally {
  if (backend) {
    console.log('\nStopping MCP server...');
    backend.kill();
  }
  process.exit(0);
}
