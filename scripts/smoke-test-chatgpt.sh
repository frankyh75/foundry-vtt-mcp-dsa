#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

MCP_AUTH_TOKEN="${MCP_AUTH_TOKEN:-}"
MCP_HTTP_PORT="${MCP_HTTP_PORT:-3333}"

if [ -z "$MCP_AUTH_TOKEN" ]; then
  echo "FAIL: MCP_AUTH_TOKEN is not set (create .env from .env.example)."
  exit 1
fi

if ! docker compose ps -q mcp-http-bridge >/dev/null 2>&1; then
  echo "Starting docker compose stack..."
  docker compose up -d
fi

BASE_URL="http://127.0.0.1:${MCP_HTTP_PORT}"

echo "Waiting for MCP HTTP bridge at ${BASE_URL}/health..."
status=""
for _ in {1..30}; do
  status=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer ${MCP_AUTH_TOKEN}" \
    "${BASE_URL}/health" || true)
  if [ "$status" = "200" ]; then
    echo "Transport OK"
    break
  fi
  sleep 1
  status=""
  
  if [ "$status" = "" ]; then
    continue
  fi
done

if [ "$status" != "200" ]; then
  echo "FAIL: MCP HTTP bridge did not become ready."
  exit 1
fi

init_payload='{"jsonrpc":"2.0","id":"init-1","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"smoke-test","version":"0.1.0"}}}'

headers=$(mktemp)
init_response=$(curl -sS -D "$headers" \
  -H "Authorization: Bearer ${MCP_AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -X POST "${BASE_URL}/mcp" \
  --data "$init_payload")

session_id=$(awk 'tolower($1)=="mcp-session-id:" {print $2}' "$headers" | tr -d '\r')
if [ -z "$session_id" ]; then
  echo "FAIL: Missing MCP session ID in initialize response."
  echo "$init_response"
  exit 1
fi

list_payload='{"jsonrpc":"2.0","id":"list-1","method":"tools/list","params":{}}'
list_response=$(curl -sS \
  -H "Authorization: Bearer ${MCP_AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: ${session_id}" \
  -X POST "${BASE_URL}/mcp" \
  --data "$list_payload")

if echo "$list_response" | grep -q '"result"'; then
  echo "OK"
  exit 0
fi

if echo "$list_response" | grep -q '"error"'; then
  echo "FAIL: MCP tools/list returned error."
  echo "$list_response"
  exit 1
fi

echo "FAIL: Unexpected response from tools/list."
echo "$list_response"
exit 1
