#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = spawnSync('npm', ['run', 'build:server'], {
  cwd: rootDir,
  stdio: 'inherit',
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const cliPath = resolve(rootDir, 'packages/mcp-server/dist/adventure-import/pdf/cli.js');
const run = spawnSync(process.execPath, [cliPath, ...process.argv.slice(2)], {
  cwd: rootDir,
  stdio: 'inherit',
});

process.exit(run.status ?? 1);
