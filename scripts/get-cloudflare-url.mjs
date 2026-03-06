#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const COMMAND = 'docker';
const ARGS = ['compose', 'logs', 'cloudflared', '--tail', '20'];

const run = async () => {
  try {
    const { stdout } = await execFileAsync(COMMAND, ARGS, { cwd: process.cwd() });
    const lines = stdout.split(/\r?\n/);
    const urlLine = [...lines].reverse().find((line) =>
      /https:\/\/[^\s|]+\.trycloudflare\.com/.test(line)
    );
    if (!urlLine) {
      console.log('No quick tunnel URL found in the last 20 log lines.');
      process.exit(1);
    }
    const urlMatch = urlLine.match(/https:\/\/[^\s|]+\.trycloudflare\.com/);
    if (!urlMatch) {
      console.log('Tunnel creation line detected but no URL could be extracted.');
      process.exit(1);
    }
    console.log(urlMatch[0]);
  } catch (error) {
    console.error('Failed to read cloudflared logs:', error.message ?? error);
    process.exit(1);
  }
};

run();
