#!/usr/bin/env node

import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  isJSONRPCErrorResponse,
  isJSONRPCRequest,
  isJSONRPCResultResponse,
  type JSONRPCMessage
} from '@modelcontextprotocol/sdk/types.js';

type RequestMeta = {
  startTime: number;
  method: string;
  toolName?: string;
  remoteIp?: string;
};

const authToken = process.env.MCP_AUTH_TOKEN;
if (!authToken) {
  console.error('MCP_AUTH_TOKEN is required for the HTTP bridge.');
  process.exit(1);
}

const httpHost = process.env.MCP_HTTP_HOST || '0.0.0.0';
const httpPort = Number.parseInt(process.env.MCP_LISTEN_PORT || '3333', 10);

const serverCommand = process.env.MCP_SERVER_COMMAND || 'node';
const serverArgsRaw = process.env.MCP_SERVER_ARGS?.trim();
const defaultServerPath = fileURLToPath(new URL('./index.js', import.meta.url));
const serverArgs = serverArgsRaw ? serverArgsRaw.split(' ').filter(Boolean) : [defaultServerPath];

const serverEnv = { ...process.env };
delete serverEnv.MCP_AUTH_TOKEN;
delete serverEnv.MCP_HTTP_HOST;
delete serverEnv.MCP_HTTP_PORT;
delete serverEnv.MCP_SERVER_COMMAND;
delete serverEnv.MCP_SERVER_ARGS;

type RequestHeaders = Record<string, string | string[] | undefined> | undefined;

const requestMeta = new Map<string, RequestMeta>();

const logInfo = (message: string, meta?: Record<string, unknown>) => {
  if (meta) {
    console.log(`${message} ${JSON.stringify(meta)}`);
    return;
  }
  console.log(message);
};

const logError = (message: string, meta?: Record<string, unknown>) => {
  if (meta) {
    console.error(`${message} ${JSON.stringify(meta)}`);
    return;
  }
  console.error(message);
};

const getHeaderValue = (headers: RequestHeaders, name: string): string | undefined => {
  if (!headers) return undefined;
  const direct = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(direct)) return direct[0];
  if (direct) return direct;
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  if (!entry) return undefined;
  const value = entry[1];
  return Array.isArray(value) ? value[0] : value;
};

const getRemoteIp = (headers: RequestHeaders): string | undefined => {
  const forwarded = getHeaderValue(headers, 'x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim();
  return (
    getHeaderValue(headers, 'cf-connecting-ip') ||
    getHeaderValue(headers, 'x-real-ip')
  );
};

const isAuthorized = (req: http.IncomingMessage): boolean => {
  const header = req.headers.authorization;
  if (!header) return false;
  const [scheme, token] = header.split(' ');
  if (!scheme || !token) return false;
  return scheme.toLowerCase() === 'bearer' && token === authToken;
};

const stdioTransport = new StdioClientTransport({
  command: serverCommand,
  args: serverArgs,
  env: serverEnv,
  stderr: 'inherit'
});

const httpTransport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
  enableJsonResponse: true
});

httpTransport.onmessage = async (message: JSONRPCMessage, extra) => {
  if (isJSONRPCRequest(message) && message.id !== undefined) {
    const requestId = String(message.id);
    const toolName = message.method === 'tools/call' ? (message.params as any)?.name : undefined;
    requestMeta.set(requestId, {
      startTime: Date.now(),
      method: message.method,
      toolName,
      remoteIp: getRemoteIp(extra?.requestInfo?.headers as RequestHeaders)
    });
  }

  try {
    await stdioTransport.send(message);
  } catch (error) {
    logError('mcp.http_to_stdio_failed', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

stdioTransport.onmessage = async (message: JSONRPCMessage) => {
  const requestId =
    isJSONRPCResultResponse(message) || isJSONRPCErrorResponse(message)
      ? String(message.id)
      : undefined;

  try {
    await httpTransport.send(message);
  } catch (error) {
    logError('mcp.stdio_to_http_failed', {
      error: error instanceof Error ? error.message : String(error)
    });
  }

  if (requestId) {
    const meta = requestMeta.get(requestId);
    if (meta) {
      const durationMs = Date.now() - meta.startTime;
      const errorReason = isJSONRPCErrorResponse(message)
        ? message.error?.message
        : undefined;
      logInfo('mcp.request.completed', {
        requestId,
        remoteIp: meta.remoteIp,
        method: meta.method,
        toolName: meta.toolName,
        durationMs,
        error: errorReason ?? null
      });
      requestMeta.delete(requestId);
    }
  }
};

stdioTransport.onerror = (error) => {
  logError('mcp.stdio.error', { error: error.message });
};

httpTransport.onerror = (error) => {
  logError('mcp.http.error', { error: error.message });
};

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.statusCode = 400;
    res.end('Bad Request');
    return;
  }

  if (req.url.startsWith('/health')) {
    if (!isAuthorized(req)) {
      const remoteIp = getRemoteIp(req.headers as RequestHeaders);
      logInfo('mcp.auth.denied', { remoteIp, path: req.url });
      res.statusCode = 401;
      res.setHeader('WWW-Authenticate', 'Bearer');
      res.end('Unauthorized');
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (!req.url.startsWith('/mcp')) {
    res.statusCode = 404;
    res.end('Not Found');
    return;
  }

  if (!isAuthorized(req)) {
    const remoteIp = getRemoteIp(req.headers as RequestHeaders);
    logInfo('mcp.auth.denied', { remoteIp, path: req.url });
    res.statusCode = 401;
    res.setHeader('WWW-Authenticate', 'Bearer');
    res.end('Unauthorized');
    return;
  }

  try {
    await httpTransport.handleRequest(req, res);
  } catch (error) {
    logError('mcp.http.request_failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
});

const shutdown = async () => {
  logInfo('mcp.http_bridge.shutdown');
  try {
    await httpTransport.close();
  } catch (error) {
    logError('mcp.http_bridge.http_close_failed', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
  try {
    await stdioTransport.close();
  } catch (error) {
    logError('mcp.http_bridge.stdio_close_failed', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
  server.close(() => process.exit(0));
};

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

const start = async () => {
  await stdioTransport.start();
  await httpTransport.start();

  server.listen(httpPort, httpHost, () => {
    logInfo('mcp.http_bridge.listening', {
      host: httpHost,
      port: httpPort,
      serverCommand,
      serverArgs
    });
  });
};

start().catch((error) => {
  logError('mcp.http_bridge.start_failed', {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
});
