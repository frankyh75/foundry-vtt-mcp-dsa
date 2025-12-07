## v0.6.3 (2025-12-07)

### New Features

- **Character Entity Tool**: Added `get-character-entity` tool for retrieving detailed information about items, actions, and effects within characters
- **Token Manipulation Suite**: Added 6 new token manipulation tools:
  - `move-token` - Move tokens with optional animation
  - `update-token` - Update token properties (name, scale, visibility, elevation, etc.)
  - `delete-tokens` - Delete one or multiple tokens from the scene
  - `get-token-details` - Get comprehensive token information including position, disposition, and effects
  - `toggle-token-condition` - Apply or remove status conditions/effects from tokens
  - `get-available-conditions` - List all available conditions for the current game system

### Improvements

- Enhanced MCP tool count from 26 to 33 tools
- Added comprehensive Foundry module handlers for all new tools
- Improved error handling and validation for token operations
- Added system-agnostic condition management that works across D&D 5e, PF2e, and DSA5

## v0.4.17 (2025-09-09)

- Wrapper/backend architecture: convert MCP entry to a thin stdio wrapper that proxies to a singleton backend over `127.0.0.1:31414`.
- Backend singleton + lock: backend binds Foundry connector on `31415` and creates `%TEMP%\foundry-mcp-backend.lock`.
- Startup race fix: resolves Claude Desktop duplicate-start race by keeping wrappers alive and ensuring only one backend owns ports.
- Runtime stability: backend now bundled (`dist/backend.bundle.cjs`) and preferred by wrapper for reliable startup in installer environments.
- Shared package now emits JS + d.ts, ensuring runtime availability for both dev and installer.
- Logging: wrapper writes to `%TEMP%\foundry-mcp-server\wrapper.log`; backend logs to `%TEMP%\foundry-mcp-server\mcp-server.log`.
- Installer: enhanced staging to include full server `dist`, bundled wrapper `index.cjs`, bundled backend, and `node_modules/@foundry-mcp/shared`.
- Build scripts: added root convenience scripts (`build:release`, `bundle:server`, `installer:stage`); NSIS script accepts `--skip-download` and `--skip-nsis` for staging-only runs.

Notes
- No changes needed for CI; existing workflows continue to build bundles and the installer.
- Foundry MCP Bridge port remains `31415`. Control channel is `31414` (internal wrapper↔backend only).

