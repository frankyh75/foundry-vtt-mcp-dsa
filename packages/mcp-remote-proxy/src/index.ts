import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';

const HOST = process.env.HOST ?? '127.0.0.1';
const PROXY_PORT = Number(process.env.PROXY_PORT ?? '8787');
const MCP_CHILD_ENTRY = process.env.MCP_CHILD_ENTRY;
const MCP_CHILD_CWD = process.env.MCP_CHILD_CWD;
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS ?? '30000');
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

if (!MCP_CHILD_ENTRY) {
  console.error('MCP_CHILD_ENTRY is required to start the MCP child process.');
  process.exit(1);
}

const sseClients = new Set<ServerResponse>();
const pendingRequests = new Map<string, {
  resolve: (message: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}>();

let childProcess: ChildProcessWithoutNullStreams | null = null;
let childExited = false;
let stdoutBuffer = '';

function isOriginAllowed(origin: string | undefined): string | null {
  if (!origin) {
    return null;
  }
  if (ALLOWED_ORIGINS.length === 0) {
    return null;
  }
  if (ALLOWED_ORIGINS.includes('*')) {
    return '*';
  }
  if (ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }
  return null;
}

function applyCors(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin;
  const allowedOrigin = isOriginAllowed(origin);
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
}

function sendSseEvent(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    client.write(payload);
  }
}

function failPendingRequests(error: Error) {
  for (const [id, pending] of pendingRequests.entries()) {
    clearTimeout(pending.timeout);
    pending.reject(error);
    pendingRequests.delete(id);
  }
}

function handleChildExit(message: string) {
  childExited = true;
  sendSseEvent('error', { message });
  for (const client of sseClients) {
    client.end();
  }
  sseClients.clear();
  failPendingRequests(new Error(message));
}

function parseMessageId(message: unknown): string | null {
  if (!message || typeof message !== 'object') {
    return null;
  }
  const id = (message as { id?: unknown }).id;
  if (id === undefined || id === null) {
    return null;
  }
  return String(id);
}

function handleChildMessage(message: unknown) {
  sendSseEvent('message', message);
  const id = parseMessageId(message);
  if (!id) {
    return;
  }
  const pending = pendingRequests.get(id);
  if (!pending) {
    return;
  }
  clearTimeout(pending.timeout);
  pending.resolve(message);
  pendingRequests.delete(id);
}

function parseStdoutChunk(chunk: Buffer) {
  stdoutBuffer += chunk.toString('utf8');
  while (true) {
    const newlineIndex = stdoutBuffer.indexOf('\n');
    if (newlineIndex === -1) {
      break;
    }
    const line = stdoutBuffer.slice(0, newlineIndex).replace(/\r$/, '');
    stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
    if (!line.trim()) {
      continue;
    }
    try {
      const message = JSON.parse(line);
      handleChildMessage(message);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown parse error';
      console.error(`Failed to parse MCP message: ${errorMessage}`);
    }
  }
}

function startChildProcess() {
  childProcess = spawn('node', [MCP_CHILD_ENTRY], {
    cwd: MCP_CHILD_CWD,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  childProcess.stdout.on('data', parseStdoutChunk);
  childProcess.stderr.on('data', chunk => {
    process.stderr.write(`[mcp-child] ${chunk.toString('utf8')}`);
  });

  childProcess.on('error', error => {
    handleChildExit(`MCP child process error: ${error.message}`);
  });

  childProcess.on('exit', (code, signal) => {
    handleChildExit(`MCP child process exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})`);
  });
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) {
    return null;
  }
  return JSON.parse(raw);
}

async function handleMessageRequest(req: IncomingMessage, res: ServerResponse) {
  if (childExited || !childProcess?.stdin.writable) {
    res.statusCode = 500;
    res.end('MCP child process is not running.');
    return;
  }

  let message: unknown;
  try {
    message = await readJsonBody(req);
  } catch (error) {
    res.statusCode = 400;
    res.end('Invalid JSON payload.');
    return;
  }

  if (!message || typeof message !== 'object') {
    res.statusCode = 400;
    res.end('Payload must be a JSON-RPC object.');
    return;
  }

  const serialized = `${JSON.stringify(message)}\n`;
  childProcess.stdin.write(serialized);

  const id = parseMessageId(message);
  if (!id) {
    res.statusCode = 202;
    res.end('Accepted');
    return;
  }

  const responsePromise = new Promise<unknown>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error('Request timed out.'));
    }, REQUEST_TIMEOUT_MS);
    pendingRequests.set(id, { resolve, reject, timeout });
  });

  try {
    const responseMessage = await responsePromise;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(responseMessage));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.statusCode = errorMessage === 'Request timed out.' ? 504 : 500;
    res.end(errorMessage);
  }
}

const server = createServer(async (req, res) => {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (!req.url) {
    res.statusCode = 404;
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${HOST}:${PROXY_PORT}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    res.statusCode = 200;
    res.end('ok');
    return;
  }

  if (req.method === 'GET' && url.pathname === '/mcp/sse') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });
    res.write(': connected\n\n');
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/mcp/message') {
    await handleMessageRequest(req, res);
    return;
  }

  res.statusCode = 404;
  res.end('Not found.');
});

startChildProcess();

server.listen(PROXY_PORT, HOST, () => {
  console.log(`MCP remote proxy listening on http://${HOST}:${PROXY_PORT}`);
});

process.on('SIGINT', async () => {
  console.log('Shutting down MCP remote proxy...');
  for (const client of sseClients) {
    client.end();
  }
  sseClients.clear();
  if (childProcess) {
    childProcess.kill();
    await delay(100);
  }
  server.close();
  process.exit(0);
});
