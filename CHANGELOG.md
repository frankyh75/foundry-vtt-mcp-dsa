## v0.6.2 (TBD)

### Improvements

- **CompendiumTools SystemAdapter Integration**
  - Completes v0.6.0 Registry Pattern for CompendiumTools
  - `search-compendium` now uses SystemAdapter for creature stats extraction
  - Enables DSA5 creature stats in search results (LeP, Eigenschaften, etc.)
  - Added `formatCreatureStats()` method with adapter support
  - Added `extractLegacyCreatureStats()` for backward compatibility with D&D5e/PF2e
  - Made `formatCompendiumItem()` async to support adapter pattern
  - Maintains full backward compatibility with existing systems
  - Reduces code duplication by ~80 lines

---

## v0.6.1 (2025-12-03)

### New Features

- **DSA5 System Support** (PR #12 by @frankyh75)
  - Full SystemAdapter implementation for Das Schwarze Auge 5
  - Supports all 8 Eigenschaften (MU/KL/IN/CH/FF/GE/KO/KK)
  - LeP, AsP, KaP resource tracking
  - DSA5-specific filters: level, species, culture, size, hasSpells
  - DSA5IndexBuilder for creature compendium indexing
  - DSA5 character creation from archetypes

- **Token Manipulation Tools** (PR #13)
  - `move-token` - Move tokens with optional animation
  - `update-token` - Update visibility, disposition, size, rotation, elevation
  - `delete-tokens` - Bulk token deletion
  - `get-token-details` - Detailed token info with linked actor data
  - `toggle-token-condition` - Apply/remove status effects (prone, poisoned, etc.)
  - `get-available-conditions` - List system-specific status effects

- **Character API Optimization** (PR #9)
  - Lazy-loading: `get-character` now returns minimal item metadata (no descriptions)
  - New `get-character-entity` tool for on-demand full entity details
  - Removed 20-item limit - now returns ALL items
  - ~37% token reduction per character
  - PF2e: traits, rarity, level, actionType
  - D&D 5e: attunement status

### Improvements

- **Documentation** (PR #8)
  - Clarified search-compendium limitations (name-only search, heuristic filters)
  - Directed users to list-creatures-by-criteria for accurate filtering

---

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

