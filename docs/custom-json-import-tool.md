# import-dsa5-actor-from-json

## Purpose

Imports custom DSA5 actor JSON through MCP using a multi-path strategy:

- `custom_dsa5` for German custom exports like `Loreley.json`
- `optolith_like` for Optolith-shaped exports
- `raw_foundry` for already Foundry-shaped actor documents
- `auto` to detect format and choose a path

## Tool Input

- `jsonPayload`: `object | string` (optional when `filePath` is provided)
- `filePath`: local path to JSON file (optional when `jsonPayload` is provided)
- `strategy`: `auto | custom_dsa5 | optolith_like | raw_foundry` (default `auto`)
- `resolveItems`: boolean (default `true`)
- `addToScene`: boolean (default `false`)
- `strict`: boolean (default `false`)

## Behavior

1. Load payload from `jsonPayload` or `filePath`.
2. Detect format (unless strategy is explicitly set).
3. Map core actor fields.
4. Optionally resolve item-like names via compendium lookups.
5. Create actor through bridge query `foundry-mcp-bridge.createActorFromData`.
6. Return structured warnings and unresolved names.

## Notes

- Successful `tools/list` does not guarantee bridge connectivity.
- Actor creation requires active Foundry world + enabled Foundry MCP Bridge module.
- With `strict: true`, unresolved item names abort import.

## Smoke Test

```bash
node scripts/test-import-dsa5-json.mjs
```

Environment overrides:

```bash
DSA5_IMPORT_FILE=/path/to/file.json
DSA5_IMPORT_STRATEGY=auto
DSA5_IMPORT_RESOLVE_ITEMS=true
DSA5_IMPORT_STRICT=false
DSA5_IMPORT_ADD_TO_SCENE=false
```
