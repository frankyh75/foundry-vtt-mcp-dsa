# Repository Guidelines

## Arbeitsaufteilung: Claude plant, Codex führt aus

**Claude (claude-sonnet):** Analysiert Architektur, erkennt Probleme, schreibt präzise Codex-Prompts.
**Codex:** Führt die eigentlichen Code-Änderungen aus — kein Analysieren, direkt implementieren.

### Execution Rules für Codex
- Keine Rückfragen — Anforderungen stehen im Prompt oder in den Constraints unten
- Nach jeder Änderung: `npm run typecheck` (muss 0 Fehler liefern)
- Nach jeder Änderung: `npm -w @foundry-mcp/server run test` (alle Tests grün)
- Committen mit Conventional Commits (siehe unten)
- Bei Unklarheiten: Architektur-Constraints aus diesem File priorisieren

### Session Start Kontext (Claude und Codex)
- Bei jeder neuen Session zuerst `ROADMAP.md` lesen.
- `ROADMAP.md` ist die verbindliche Quelle fuer Roadmap und priorisiertes Feature-Backlog.

---

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
- **Do not modify `packages/foundry-module/src/data-access.ts`** unless the change is generic and upstream-safe. No system-specific (DSA5/PF2e/D&D5e) logic in this file.

## Architecture: Adapter, not Integration
DSA5 support is an external adapter layer. Core files (`data-access.ts`) stay upstream-compatible.
- System-specific logic → `packages/mcp-server/src/systems/dsa5/`
- Generic parameters only in `data-access.ts` (e.g. `preserveItemTypes?: string[]`, not `['species','culture','career']`)
- Upstream merge must remain conflict-free: `git merge upstream/main`

## Testing Guidelines
- Unit tests run via Vitest in the server package (`npm -w @foundry-mcp/server run test`).
- Smoke tests live in `scripts/` (e.g., `scripts/ops-smoke-test.mjs`).
- Name new tests with `.test.ts` and keep them close to the feature area.

## Commit & Pull Request Guidelines
- Commit messages follow Conventional Commits with scope:
  - `feat(dsa5): add experience level calculation`
  - `fix(mcp-server): correct wound/HP inversion`
  - `refactor(dsa5): move identity-type preservation out of data-access`
- Main branch is `master`.
- No formal PR template; include a concise summary, test results, and any relevant config or migration notes.

## Configuration & Security
- Copy `.env.example` to `.env` for local setup.
- Treat `MCP_AUTH_TOKEN` and OAuth secrets as sensitive; do not commit them.
