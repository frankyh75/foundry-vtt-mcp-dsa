#!/usr/bin/env node

import localtunnel from 'localtunnel';

const port = Number(process.env.MCP_HTTP_PORT ?? process.env.PORT ?? '3333');
const host = process.env.LOCALTUNNEL_HOST ?? 'https://localtunnel.me';
const subdomain = process.env.LOCALTUNNEL_SUBDOMAIN;

const waitIndefinitely = () => new Promise(() => {});

const cleanup = (tunnel) => async () => {
  await tunnel.close();
  process.exit(0);
};

try {
  const tunnel = await localtunnel({ port, subdomain, host });
  console.log('LocalTunnel is listening at', tunnel.url);
  console.log('Press Ctrl+C to stop the tunnel.');
  process.on('SIGINT', cleanup(tunnel));
  process.on('SIGTERM', cleanup(tunnel));
  await waitIndefinitely();
} catch (error) {
  console.error('Failed to start LocalTunnel:', error instanceof Error ? error.message : error);
  process.exit(1);
}
