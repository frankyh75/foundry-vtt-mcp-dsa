# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Fork of `foundry-vtt-mcp` adding DSA5 (Das Schwarze Auge 5) support. An MCP (Model Context Protocol) bridge connecting Foundry VTT to AI assistants (Claude Desktop, ChatGPT Pro) for AI-powered campaign management.

- **Repository:** https://github.com/frankyh75/foundry-vtt-mcp-dsa
- **Upstream:** https://github.com/adambdooley/foundry-vtt-mcp
- **Supported Systems:** D&D 5e, Pathfinder 2e, DSA5

## Commands

```bash
# Build all packages
npm run build

# Build specific packages
npm run build:server     # MCP server only
npm run build:foundry    # Foundry module only
npm run build:shared     # Shared types only

# Development
npm run dev              # Watch mode for MCP server

# Testing
npm run test             # Run all tests
npm -w @foundry-mcp/server run test          # MCP server tests only
npm -w @foundry-mcp/server run test:watch    # Watch mode
npm run test:mcp:schema  # MCP schema smoke test
npm run test:ops         # Ops smoke test (requires running stack)

# Linting & Formatting
npm run lint
npm run lint:fix
npm run format
npm run typecheck        # TypeScript check across all workspaces

# ChatGPT HTTP Bridge
npm run tunnel:localtunnel    # Start localtunnel for ChatGPT connector
npm run cloudflare:url        # Get current Cloudflare tunnel URL
docker compose up             # Start HTTP bridge container

# Auditing
npm run audit:deps       # Security audit
npm run audit:unused     # Find unused dependencies (knip)
npm run audit:circular   # Detect circular imports (madge)
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Claude/ChatGPT │────▶│   MCP Server    │────▶│  Foundry Module │────▶ Foundry VTT
└─────────────────┘     │  (Node.js)      │     │  (Browser)      │
                        │                 │     │                 │
                        │  backend.ts     │◀───▶│  socket-bridge  │
                        │  http-bridge.ts │     │  data-access.ts │
                        └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │    ComfyUI      │ (Map generation, optional)
                        └─────────────────┘
```

### Monorepo Structure

- **`packages/mcp-server/`** - MCP server (Node.js, communicates with Claude/ChatGPT)
- **`packages/foundry-module/`** - Foundry VTT module (browser, runs inside Foundry)
- **`shared/`** - Shared TypeScript types and schemas

### Key Files

| File | Purpose |
|------|---------|
| `packages/mcp-server/src/backend.ts` | Main backend process, tool routing, ComfyUI management |
| `packages/mcp-server/src/http-bridge.ts` | HTTP/OAuth bridge for ChatGPT Pro |
| `packages/mcp-server/src/foundry-client.ts` | WebSocket/WebRTC connection to Foundry |
| `packages/mcp-server/src/systems/` | System adapter registry (multi-system support) |
| `packages/foundry-module/src/data-access.ts` | Foundry API queries (runs in browser) |
| `packages/foundry-module/src/socket-bridge.ts` | WebSocket server for MCP communication |

### System Adapter Pattern

Multi-system support uses a Registry pattern in `packages/mcp-server/src/systems/`:

```
systems/
├── types.ts              # SystemAdapter interface, CreatureIndex types
├── system-registry.ts    # Central adapter registry
├── index-builder-registry.ts  # Browser-side index builders
├── dnd5e/adapter.ts      # D&D 5e implementation
├── pf2e/adapter.ts       # Pathfinder 2e implementation
└── dsa5/                 # DSA5 implementation
    ├── adapter.ts        # Character stats extraction, filtering
    ├── filters.ts        # DSA5-specific filter schemas (Zod)
    ├── constants.ts      # Field paths, attribute names
    └── index-builder.ts  # Creature index builder
```

To add a new system: implement `SystemAdapter` interface and register in `backend.ts`.

## DSA5-Specific Development

### Architecture Principle: "Adapter, not Integration"

DSA5 support is built as an external adapter layer. Core files (`data-access.ts`) stay upstream-compatible for conflict-free merges.

### DSA5 Field Mappings

**Critical: Inverted Wound Logic**
```typescript
// DSA5 tracks wounds, not HP!
system.status.wounds.value  // Current WOUNDS (damage taken)
system.status.wounds.max    // Maximum LeP (life energy)

// Conversion:
currentHP = wounds.max - wounds.value
newWounds = wounds.max - newHP
```

**Eigenschaften (8 Attributes)**
```
system.characteristics.[mu|kl|in|ch|ff|ge|ko|kk].value
```

**Resources**
```
system.status.astralenergy.value/max  // AsP (Astralenergie/Mana)
system.status.karmaenergy.value/max   // KaP (Karmaenergie)
```

**Profile**
```
system.details.species.value   // Spezies
system.details.culture.value   // Kultur
system.details.career.value    // Profession (NOT "profession"!)
system.details.experience.total // Abenteuerpunkte
```

### Upstream Sync

```bash
git remote add upstream https://github.com/adambdooley/foundry-vtt-mcp.git
git fetch upstream
git merge upstream/main  # Should be conflict-free
```

## Environment Configuration

Copy `.env.example` to `.env`. Key variables:

| Variable | Purpose |
|----------|---------|
| `MCP_AUTH_TOKEN` | Bearer token for ChatGPT HTTP bridge |
| `MCP_OAUTH_CLIENT_ID/SECRET` | OAuth credentials for ChatGPT connector |
| `FOUNDRY_HOST` | Foundry connection (use `host.docker.internal` in Docker) |
| `FOUNDRY_PORT` | Default 31415 |
| `LOG_LEVEL` | `error`, `warn`, `info`, `debug` |

## Git Conventions

- **Main branch:** `master`
- **Commit style:** Conventional commits with scope
  ```
  feat(dsa5): add experience level calculation
  fix(mcp-server): correct wound/HP inversion
  refactor: align data-access.ts with upstream
  ```

## Constraints

- Do not modify `data-access.ts` except for generic bugfixes (upstream compatibility)
- DSA5 logic must stay isolated in `packages/mcp-server/src/systems/dsa5/`
- No breaking changes for D&D 5e or PF2e functionality

## ChatGPT Integration Status (WIP)

**Branch:** `feature/chatgpt-desktop-mcp-http-bridge`

### Was funktioniert
- HTTP-Bridge (`http-bridge.ts`) mit StreamableHTTPServerTransport
- OAuth Metadata Endpoints (alle Varianten für ChatGPT-Kompatibilität)
- Token Exchange (`/oauth/token`)
- MCP `initialize` + `tools/list` via POST
- Docker + Cloudflare Quick-Tunnel Setup
- No-Auth Modus (`MCP_NO_AUTH=true`)

### Bekannte Probleme (Stand: 2026-01-15)

1. **SSE-Streaming hängt:** ChatGPT erwartet SSE GET-Requests, aber unser Backend pusht keine Events → Timeout nach ~80s
2. **Session-Handling:** ChatGPT sendet parallele Requests von verschiedenen IPs ohne Session-ID, nur der erste `initialize` klappt
3. **OAuth nicht vollständig:** ChatGPT erwartet Authorization Code Flow + PKCE, nicht nur client_credentials

### Kern-Erkenntnis: Zwei Transport-Patterns

ChatGPT unterstützt zwei MCP Transport-Varianten:

**Pattern 1: HTTP/SSE (älter, aber stabil)**
```
GET  /sse       → Etabliert SSE-Verbindung, gibt Response-Objekt an Transport
POST /messages  → Empfängt Client-Nachrichten
```
Verwendet `SSEServerTransport` aus dem MCP SDK:
```typescript
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  await transport.handlePostMessage(req, res);
});
```

**Pattern 2: Streamable HTTP (neuer)**
```
POST /mcp  → Alle MCP-Nachrichten (initialize, tools/list, tools/call)
GET  /mcp  → SSE für Server-initiierte Nachrichten (optional)
```
Verwendet `StreamableHTTPServerTransport` (unser aktueller Ansatz).

**Problem:** Wir verwenden Pattern 2, aber ChatGPT scheint Pattern 1 zu erwarten oder hat Probleme mit unserem SSE-Handling.

### Nächste Schritte

1. **Pattern 1 ausprobieren:** Auf `SSEServerTransport` mit `/sse` + `/messages` Endpoints umstellen
2. **Referenz-Implementierungen studieren:**
   - [openai/openai-apps-sdk-examples](https://github.com/openai/openai-apps-sdk-examples) - Offizielle Node.js Beispiele
   - [nerding-io/mcp-sse-example](https://github.com/nerding-io/mcp-sse-example) - SSE Reference Implementation
   - [jaw9c/awesome-remote-mcp-servers](https://github.com/jaw9c/awesome-remote-mcp-servers) - Kuratierte Liste
3. **Alternative:** Vercel MCP Adapter mit Redis für SSE

### Test-Befehle
```bash
# Container starten
docker compose up -d

# Tunnel URL holen
docker compose logs cloudflared | grep trycloudflare.com

# Logs beobachten
docker compose logs -f mcp-http-bridge

# Smoke Test
MCP_PUBLIC_URL="https://YOUR-URL.trycloudflare.com" MCP_AUTH_TOKEN="testtoken" node scripts/ops-smoke-test.mjs
```

### ChatGPT Konfiguration (Developer Mode)
- URL: `https://YOUR-URL.trycloudflare.com/mcp` (oder `/sse` wenn Pattern 1)
- Authentication: `Keine Authentifizierung` (solange OAuth nicht vollständig)
- Checkbox: "Ich vertraue dieser Anwendung" aktivieren
