# MCP Remote Proxy

Minimal HTTP/SSE proxy that exposes a stdio-based MCP server to remote MCP clients (e.g., ChatGPT Desktop) over HTTP.

## Prerequisites

- Node.js >= 18
- Built MCP server output (e.g., `packages/mcp-server/dist/index.js`)

## Configuration

| Env var | Default | Description |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Host to bind the proxy HTTP server. |
| `PROXY_PORT` | `8787` | Port for the proxy HTTP server. |
| `MCP_CHILD_ENTRY` | **required** | Path to the MCP stdio server entry (e.g., `packages/mcp-server/dist/index.js`). |
| `MCP_CHILD_CWD` | _(unset)_ | Optional working directory for the child process. |
| `REQUEST_TIMEOUT_MS` | `30000` | Timeout for JSON-RPC requests. |
| `ALLOWED_ORIGINS` | _(unset)_ | Comma-separated CORS allowlist (supports `*`). |

## Start (Windows PowerShell)

```powershell
$env:MCP_CHILD_ENTRY = "C:\Users\Frank\Documents\foundry-vtt-mcp-dsa\packages\mcp-server\dist\index.js"
$env:HOST = "127.0.0.1"
$env:PROXY_PORT = "8787"
node dist\index.js
```

## Start (macOS/Linux)

```bash
export MCP_CHILD_ENTRY="/path/to/foundry-vtt-mcp/packages/mcp-server/dist/index.js"
export HOST="127.0.0.1"
export PROXY_PORT="8787"
node dist/index.js
```

## Smoke Tests

```bash
curl http://127.0.0.1:8787/health
```

```bash
curl -N http://127.0.0.1:8787/mcp/sse
```

```bash
curl -X POST http://127.0.0.1:8787/mcp/message \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
```

## ChatGPT Desktop Remote MCP Configuration

- **SSE stream URL:** `http://127.0.0.1:8787/mcp/sse`
- **POST message URL:** `http://127.0.0.1:8787/mcp/message`

Use the SSE URL for the streaming transport and the POST URL for sending JSON-RPC requests.

## How to connect this proxy to the MCP server

1. Build the MCP server (`packages/mcp-server`) so that `dist/index.js` exists.
2. Set `MCP_CHILD_ENTRY` to that path.
3. Start this proxy. It will spawn the MCP server as a child process via stdio and forward messages over HTTP/SSE.

## Step-by-step (Windows PowerShell, your local path)

1. Build the MCP server (from the repo root):

```powershell
npm run build:server
```

2. Build the proxy package:

```powershell
npm run build --workspace=packages/mcp-remote-proxy
```

3. Set environment variables for the proxy (using your MCP server path):

```powershell
$env:MCP_CHILD_ENTRY = "C:\Users\Frank\Documents\foundry-vtt-mcp-dsa\packages\mcp-server\dist\index.js"
$env:HOST = "127.0.0.1"
$env:PROXY_PORT = "8787"
```

4. Start the proxy:

```powershell
node packages\mcp-remote-proxy\dist\index.js
```

5. Verify it responds:

```powershell
curl http://127.0.0.1:8787/health
```
