# Repository Guidelines

## Project Structure & Module Organization
- `packages/mcp-server/`: Node.js MCP server (main backend, system adapters).
- `packages/foundry-module/`: Foundry VTT module (browser-side bridge).
- `packages/mcp-remote-proxy/`: Remote proxy tooling.
- `shared/`: Shared TypeScript types and schemas.
- `scripts/`: Operational scripts (smoke tests, tunnels, setup).
- `installer/`, `docker-compose.yml`: Installer and container packaging.

## Build, Test, and Development Commands
- `npm run dev`: Watch mode for the MCP server.
- `npm run build`: Build all workspaces.
- `npm run build:server`, `npm run build:foundry`, `npm run build:shared`: Targeted builds.
- `npm -w @foundry-mcp/server run start`: Start the MCP server (required for Foundry bridge WebSocket connections).
- `npm run test`: Run workspace tests.
- `npm run test:mcp:schema`: MCP schema smoke test.
- `npm run test:ops`: End-to-end ops smoke test (requires running stack).
- `npm run lint`, `npm run format`, `npm run typecheck`: Lint, format, and type checks.

## Coding Style & Naming Conventions
- TypeScript-first; keep changes aligned with existing patterns.
- Format with Prettier and lint with ESLint (`.prettierrc`, `.eslintrc.json`).
- Tests use `*.test.ts` (example: `packages/mcp-server/src/systems/dsa5/filters.test.ts`).
- DSA5 logic stays in `packages/mcp-server/src/systems/dsa5/`.
- Avoid changing `packages/foundry-module/src/data-access.ts` unless a generic, upstream-safe fix is required.

## Testing Guidelines
- Unit tests run via Vitest in the server package (`npm -w @foundry-mcp/server run test`).
- Smoke tests live in `scripts/` (e.g., `scripts/ops-smoke-test.mjs`).
- Name new tests with `.test.ts` and keep them close to the feature area.

## Commit & Pull Request Guidelines
- Commit messages follow Conventional Commits with scope:
  - `feat(dsa5): add experience level calculation`
  - `fix(mcp-server): correct wound/HP inversion`
- Main branch is `master`.
- No formal PR template; include a concise summary, test results, and any relevant config or migration notes.

## Configuration & Security
- Copy `.env.example` to `.env` for local setup.
- Treat `MCP_AUTH_TOKEN` and OAuth secrets as sensitive; do not commit them.

## Session Notes (2026-01-15)
- Verified MCP tool list via stdio (34 tools exposed).
- Added backend routing for character tools in `packages/mcp-server/src/backend.ts` (get-character-entity, use-item, search-character-items).
- Observed `search-character-items` and `get-character` timing out via backend control channel; needs follow-up in Foundry logs or tool handler.
- Reminder: Foundry bridge requires MCP server running on localhost:31415 (`npm -w @foundry-mcp/server run start`).
