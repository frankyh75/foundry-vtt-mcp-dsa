#!/usr/bin/env node
/**
 * Gate: every query the MCP server sends must have a registered handler in the
 * Foundry module.
 *
 * Why this exists: a merge once dropped two handler registrations from
 * `packages/foundry-module/src/queries.ts` while keeping the tools and their
 * `DataAccess` methods. The tool list stayed complete (53 tools discovered),
 * the tests stayed green (they mock the transport), and only a live GM call
 * revealed `No handler found for query: foundry-mcp-bridge.<name>`.
 *
 * Tool count != loaded code, and a tool name != the query name it sends.
 * This gate compares the two sets structurally so that class of loss fails CI.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SERVER_TOOLS = join(ROOT, 'packages/mcp-server/src/tools');
const MODULE_QUERIES = join(ROOT, 'packages/foundry-module/src/queries.ts');

/** Queries the MCP server actually sends: `foundry-mcp-bridge.<name>`. */
function collectSentQueries(dir) {
  const found = new Map();
  const walk = (d) => {
    for (const entry of readdirSync(d)) {
      const p = join(d, entry);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!entry.endsWith('.ts') || entry.includes('.test.')) continue;
      const src = readFileSync(p, 'utf8');
      // Direct string literals (`query('foundry-mcp-bridge.foo')`) and
      // template/computed forms are both covered by scanning the module id.
      for (const m of src.matchAll(/foundry-mcp-bridge\.([a-zA-Z0-9_-]+)/g)) {
        if (!found.has(m[1])) found.set(m[1], p.replace(ROOT + '/', ''));
      }
    }
  };
  walk(dir);
  return found;
}

/** Queries the module registers: `CONFIG.queries[`${modulePrefix}.<name>`]`. */
function collectRegisteredHandlers(file) {
  const src = readFileSync(file, 'utf8');
  const registered = new Set();
  for (const m of src.matchAll(/modulePrefix\}\.([a-zA-Z0-9_-]+)`\]/g)) {
    registered.add(m[1]);
  }
  // Detect a registration whose `.bind(this)` target has no method body.
  const bound = new Set();
  for (const m of src.matchAll(/this\.(handle[A-Za-z0-9]+)\s*\.bind\(this\)/g)) bound.add(m[1]);
  // Definition only: the name must be followed by `(` and must not be a call site.
  const defined = new Set();
  for (const m of src.matchAll(/^\s*(?:(?:private|protected|public|async|static)\s+)*handle([A-Za-z0-9]+)\s*\(/gm)) {
    defined.add('handle' + m[1]);
  }
  return { registered, missingBody: [...bound].filter((h) => !defined.has(h)) };
}

if (!existsSync(SERVER_TOOLS) || !existsSync(MODULE_QUERIES)) {
  console.error('[query-handler-coverage] expected paths not found; run from the repo root.');
  process.exit(2);
}

const sent = collectSentQueries(SERVER_TOOLS);
const { registered, missingBody } = collectRegisteredHandlers(MODULE_QUERIES);

const missing = [...sent.entries()]
  .filter(([q]) => !registered.has(q))
  .sort((a, b) => a[0].localeCompare(b[0]));

console.log(`[query-handler-coverage] sent=${sent.size} registered=${registered.size}`);

if (missingBody.length) {
  console.error(`\n[query-handler-coverage] FAIL: registration without a method body:`);
  for (const h of missingBody) console.error(`  - this.${h}.bind(this) has no handle${h}() definition`);
}

if (missing.length) {
  console.error(`\n[query-handler-coverage] FAIL: ${missing.length} query/queries sent by the server have no module handler.`);
  console.error('These tools are listed and dispatchable but will fail at runtime with');
  console.error('"No handler found for query: foundry-mcp-bridge.<name>":\n');
  for (const [q, file] of missing) console.error(`  - foundry-mcp-bridge.${q}  (sent from ${file})`);
  console.error('\nRegister each in packages/foundry-module/src/queries.ts and add the handler body.');
}

if (missing.length || missingBody.length) process.exit(1);
console.log('[query-handler-coverage] OK: every sent query has a registered handler.');
