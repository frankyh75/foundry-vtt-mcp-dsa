## v0.6.1 (2025-11-27) - DSA5 Support

**DSA5 System Adapter** - Full support for Das Schwarze Auge 5 (DSA5) game system

### New Features

- **Registry Pattern Architecture** (v0.6.0 base)
  - SystemAdapter interface for pluggable game system support
  - IndexBuilder interface for browser-context creature indexing
  - SystemRegistry and IndexBuilderRegistry singletons

- **DSA5 System Adapter** (`packages/mcp-server/src/systems/dsa5/`)
  - Complete SystemAdapter implementation (11 methods, 378 lines)
  - Supports all 8 Eigenschaften (MU, KL, IN, CH, FF, GE, KO, KK)
  - LeP (Lebensenergie), AsP (Astralenergie), KaP (Karmaenergie) resource tracking
  - Experience Level 1-7 (Erfahrungsgrad) based on Adventure Points (AP)
  - DSA5-specific filter system: level, species, culture, size, hasSpells, traits

- **DSA5 Creature Indexing**
  - DSA5IndexBuilder for enhanced creature compendium indexing
  - Extracts species, culture, profession, combat stats
  - German UI text ("DSA5 Kreaturen-Index wird erstellt...")

- **Type System**
  - DSA5CreatureIndex interface with 16 system-specific fields
  - Added 'dsa5' to SystemId type union
  - Full TypeScript compilation support

### Implementation Details

- **Files:** 6 TypeScript files, 1,248 lines of code
- **Testing:** Unit tests for filter validation (filters.test.ts)
- **Documentation:** Complete README.md with field mappings and examples
- **Localization:** German/English dual naming for attributes and levels

### API Compatibility

- Fully compatible with existing DnD5e and PF2e adapters
- No breaking changes to core MCP tools
- Isolated adapter architecture (no core file modifications)

### Known Limitations

- IndexBuilder browser context integration pending (v0.6.2+)
- Requires Foundry VTT v13+ with DSA5 system installed
- No installer yet (manual setup only)

### Developer Notes

- Built on upstream `feature/registry-pattern-v0.6.0` branch
- Clean separation: DSA5 logic isolated in `systems/dsa5/` folder
- Upstream merge-friendly (no data-access.ts modifications)

### Installation

See `INSTALL_DSA5.md` for detailed setup instructions.

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

