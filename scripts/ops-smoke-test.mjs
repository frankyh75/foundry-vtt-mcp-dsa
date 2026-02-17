#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const {
  MCP_PUBLIC_URL,
  MCP_AUTH_TOKEN,
  MCP_PATH = '/mcp',
  HEALTH_PATH = '/health',
  MCP_PUBLIC_IP
} = process.env;

const MCP_OAUTH_METADATA_PATH = process.env.MCP_OAUTH_METADATA_PATH ?? '/.well-known/oauth-authorization-server';
const MCP_OAUTH_TOKEN_PATH = process.env.MCP_OAUTH_TOKEN_PATH ?? '/oauth/token';
const MCP_OAUTH_CLIENT_ID = process.env.MCP_OAUTH_CLIENT_ID ?? 'mcp-client';
const MCP_OAUTH_CLIENT_SECRET = process.env.MCP_OAUTH_CLIENT_SECRET ?? MCP_AUTH_TOKEN;

if (!MCP_PUBLIC_URL) {
  console.error('MCP_PUBLIC_URL is required');
  process.exit(1);
}

if (!MCP_AUTH_TOKEN) {
  console.error('MCP_AUTH_TOKEN is required');
  process.exit(1);
}

const normalizePath = (path) => (path.startsWith('/') ? path : `/${path}`);
const publicUrl = new URL(MCP_PUBLIC_URL);

const buildUrl = (path) => {
  const target = new URL(normalizePath(path), publicUrl);
  return target.toString();
};

const healthUrl = buildUrl(HEALTH_PATH);
const mcpUrl = buildUrl(MCP_PATH);

const CURL_CMD = process.platform === 'win32' ? 'C:\\Windows\\System32\\curl.exe' : 'curl';

const getErrorMessage = (error) => {
  if (error instanceof Error) return error.message;
  return String(error);
};

const runCurlRequest = async (url, options = {}, label) => {
  const urlObj = new URL(url);
  const args = ['-sS', '--show-error', '-D', '-', '-w', 'HTTPSTATUS:%{http_code}', '-L', url];
  if (options.method) {
    args.push('-X', options.method);
  }
  if (options.headers) {
    for (const [name, value] of Object.entries(options.headers)) {
      args.push('-H', `${name}: ${value}`);
    }
  }
  if (options.body) {
    args.push('-d', options.body);
  }
  if (MCP_PUBLIC_IP && urlObj.protocol === 'https:') {
    args.push('--resolve', `${urlObj.hostname}:443:${MCP_PUBLIC_IP}`);
  }
  try {
    const { stdout } = await execFileAsync(CURL_CMD, args);
    const statusIndex = stdout.lastIndexOf('HTTPSTATUS:');
    const status = Number(stdout.slice(statusIndex + 11).trim());
    const headerBody = stdout.slice(0, statusIndex);
    let splitIdx = headerBody.lastIndexOf('\r\n\r\n');
    let separatorLength = 4;
    if (splitIdx === -1) {
      splitIdx = headerBody.lastIndexOf('\n\n');
      separatorLength = 2;
    }
    const headerText = splitIdx !== -1 ? headerBody.slice(0, splitIdx) : headerBody;
    const body = splitIdx !== -1 ? headerBody.slice(splitIdx + separatorLength) : '';
    const headerLines = headerText.split(/\r\n|\n/).filter((line) => line.length > 0);
    const headerMap = new Map();
    for (const line of headerLines) {
      if (line.startsWith('HTTP')) continue;
      const [name, value] = line.split(/:(.+)/, 2);
      if (!name || !value) continue;
      headerMap.set(name.toLowerCase(), value.trim());
    }
    return {
      ok: status >= 200 && status < 400,
      status,
      headers: {
        get: (name) => headerMap.get(name.toLowerCase())
      },
      text: async () => body,
      json: async () => JSON.parse(body || '{}')
    };
  } catch (error) {
    outputFail(`${label} failed: ${getErrorMessage(error)}`);
    process.exit(1);
  }
};

const fetchWithLabel = async (url, options, label) => {
  try {
    return await fetch(url, options);
  } catch (error) {
    outputFail(`${label} failed: ${getErrorMessage(error)}`);
    process.exit(1);
  }
};

const performRequest = async (url, options, label) => {
  if (MCP_PUBLIC_IP) {
    return runCurlRequest(url, options, label);
  }
  return fetchWithLabel(url, options, label);
};

const outputOk = (message) => console.log(`[OK] ${message}`);
const outputWarn = (message) => console.warn(`[WARN] ${message}`);
const outputFail = (message) => console.error(`[FAIL] ${message}`);

const run = async () => {
  console.log('==== MCP Ops Smoke Test ====');
  await checkDockerCompose();
  await checkHealth();
  await verifyOAuthSetup();
  await runMcpInitAndList();
  console.log('==== MCP Ops Smoke Test complete ✅ ====');
};

const checkDockerCompose = async () => {
  try {
    const { stdout } = await execFileAsync('docker', [
      'compose',
      'ps',
      '--format',
      '{{.Name}}|{{.State}}'
    ], { cwd: process.cwd() });
    const entries = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, state] = line.split('|', 2);
        return { name, state };
      });

    if (entries.length === 0) {
      outputWarn('Docker Compose services not running (no containers listed).');
      return;
    }
    const up = entries.filter((entry) => {
      const state = (entry.state || '').toLowerCase();
      return state.includes('up') || state.includes('running');
    });
    if (up.length === 0) {
      outputFail('Docker Compose services are present but none are Up.');
      process.exit(1);
    }
    outputOk(`Docker Compose services are up (${up.length} containers).`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      outputWarn('Docker CLI not found; skipping Docker Compose check.');
      return;
    }
    outputWarn(`Unable to verify Docker Compose services: ${error.message}`);
  }
};

const checkHealth = async () => {
  console.log(`Checking health endpoint (unauthenticated -> expect 401): ${healthUrl}`);
  const unauth = await performRequest(healthUrl, undefined, 'Unauthenticated health check');
  if (unauth.status === 401) {
    outputOk('Health endpoint rejects anonymous requests (expected).');
  } else {
    outputFail(
      `Health endpoint should require auth but returned ${unauth.status}.`
    );
    process.exit(1);
  }

  const authRes = await performRequest(
    healthUrl,
    {
      headers: {
        Authorization: `Bearer ${MCP_AUTH_TOKEN}`
      }
    },
    'Authenticated health check'
  );

  if (authRes.status !== 200) {
    outputFail(
      `Authenticated health check failed with status ${authRes.status}.`
    );
    process.exit(1);
  }
  const data = await authRes.json().catch(() => null);
  if (!data || data.status !== 'ok') {
    outputWarn(
      'Health endpoint returned unexpected body but status 200 (continuing).'
    );
  }
  outputOk('Health endpoint returns 200 with a valid token.');
};

const verifyOAuthSetup = async () => {
  console.log('Verifying OAuth metadata and token endpoint...');
  const metadataUrl = buildUrl(MCP_OAUTH_METADATA_PATH);
  const metadataRes = await performRequest(metadataUrl, undefined, 'OAuth metadata');
  if (metadataRes.status !== 200) {
    outputFail(`OAuth metadata endpoint returned ${metadataRes.status}.`);
    process.exit(1);
  }
  const metadataJson = await metadataRes.json().catch(() => null);
  const tokenEndpoint = metadataJson?.token_endpoint;
  if (!tokenEndpoint) {
    outputFail('OAuth metadata missing token_endpoint.');
    process.exit(1);
  }

  const credentials = Buffer.from(`${MCP_OAUTH_CLIENT_ID}:${MCP_OAUTH_CLIENT_SECRET}`).toString('base64');
  const tokenPayload = new URLSearchParams({
    grant_type: 'client_credentials'
  });

  const tokenRes = await performRequest(
    tokenEndpoint,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: tokenPayload.toString()
    },
    'OAuth token exchange'
  );

  if (!tokenRes.ok) {
    outputFail(`OAuth token endpoint returned ${tokenRes.status}.`);
    process.exit(1);
  }

  const tokenJson = await tokenRes.json().catch(() => null);
  if (!tokenJson?.access_token) {
    outputFail('OAuth token response missing access_token.');
    process.exit(1);
  }

  if (tokenJson.access_token !== MCP_AUTH_TOKEN) {
    outputFail('OAuth token mismatch with MCP_AUTH_TOKEN.');
    process.exit(1);
  }

  outputOk('OAuth metadata and token endpoint exchange the MCP token.');
};

const closeSession = async (sessionId) => {
  if (!sessionId) return;
  await performRequest(
    mcpUrl,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${MCP_AUTH_TOKEN}`,
        'Mcp-Session-Id': sessionId
      }
    },
    'Close MCP session'
  );
};

const runMcpInitAndList = async () => {
  console.log('Initializing MCP session and listing tools...');
  const initPayload = {
    jsonrpc: '2.0',
    id: 'init-ops',
    method: 'initialize',
    params: {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: {
        name: 'ops-smoke-test',
        version: '0.1.0'
      }
    }
  };

  const initRes = await performRequest(
    mcpUrl,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MCP_AUTH_TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream'
      },
      body: JSON.stringify(initPayload)
    },
    'MCP initialize'
  );

  if (!initRes.ok) {
    outputFail(`MCP initialize failed with status ${initRes.status}`);
    process.exit(1);
  }

  const sessionId = initRes.headers.get('mcp-session-id');
  if (!sessionId) {
    outputFail('MCP initialize response missing Mcp-Session-Id header.');
    process.exit(1);
  }
  outputOk(`Received MCP session id.`);

  let listJson;
  try {
    const listPayload = {
      jsonrpc: '2.0',
      id: 'list-tools',
      method: 'tools/list',
      params: {}
    };

    const listRes = await performRequest(
      mcpUrl,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${MCP_AUTH_TOKEN}`,
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'Mcp-Session-Id': sessionId
        },
        body: JSON.stringify(listPayload)
      },
      'tools/list call'
    );

    if (!listRes.ok) {
      outputFail(`tools/list call returned status ${listRes.status}`);
      process.exit(1);
    }

    listJson = await listRes.json().catch(() => null);
  } finally {
    await closeSession(sessionId);
  }


  if (!listJson || !listJson.result?.tools) {
    outputFail('tools/list response missing result.tools.');
    process.exit(1);
  }
  const tools = listJson.result.tools;
  if (!Array.isArray(tools) || tools.length === 0) {
    outputFail('tools/list returned no tools.');
    process.exit(1);
  }

  const missingName = tools.find((tool) => !tool?.name);
  if (missingName) {
    outputFail('Found tool without a name in tools/list response.');
    process.exit(1);
  }

  outputOk(`tools/list returned ${tools.length} named tools.`);
};

run().catch((error) => {
  outputFail(`Unhandled error: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
