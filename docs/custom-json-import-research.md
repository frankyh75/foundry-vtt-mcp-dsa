# Custom JSON Actor Import Research (DSA5)

Date: 2026-02-17
Branch: `feat/dsa5-custom-json-actor-import`

## Goal

Evaluate multiple import paths for custom DSA5 JSON actor files.
Primary source: `Loreley.json`.
Secondary fallback reference: `Loreley -Charbogen.pdf`.

## Inputs Reviewed

- `c:\Users\Frank\iCloudDrive\Documents\DSA_\Charactere\aktuell\loreley\Loreley.json`
- DSA5 Optolith package page: <https://foundryvtt.com/packages/dsa5-optolith>
- Foundry Actor API root: <https://foundryvtt.com/api/#actor>
- Foundry Actor class docs: <https://foundryvtt.com/api/classes/foundry.documents.Actor.html>
- Foundry Actors collection docs: <https://foundryvtt.com/api/classes/foundry.documents.collections.Actors.html>

## Key Finding About Loreley JSON

`Loreley.json` is a custom, German-labeled domain format with semantic fields, e.g.:

- `attribute.mut|klugheit|intuition|...`
- `vorteile`, `nachteile`, `sonderfertigkeiten`
- `talente`, `kampftechniken`, `zauberUndLiturgien`
- `nahkampfwaffen`, `fernkampfwaffen`, `gegenstände`

This is not in native Foundry document shape and not in Optolith export shape.

## Evaluated Paths

### Path A: Directly reuse `dsa5-optolith`

Assessment: **Not viable as direct import path for Loreley.json**.

Reasoning:

- The module parser expects Optolith-structured keys (`r`, `c`, `p`, `attr.values`, `talents`, `ct`, etc.), not Loreley schema.
- The module is primarily UI/file-dialog driven (`openDialog()`), not exposed as a stable automation API for MCP.
- It is useful as a reference for lookup/mapping patterns, but not as a drop-in importer for this custom JSON format.

Conclusion: Reuse concepts only, not direct runtime dependency for custom JSON import.

### Path B: Native Foundry Actor API only

Assessment: **Viable** for persistence, but requires robust mapping.

Reasoning:

- Actor creation/update is naturally handled via Actor document APIs.
- Clean ownership and compatibility with Foundry data lifecycle.
- Still requires heavy system-specific mapping from Loreley schema to DSA5 actor/items.

Conclusion: Good persistence layer, but not sufficient by itself.

### Path C: Hybrid (recommended)

Assessment: **Best option**.

Approach:

1. Parse + validate custom JSON in MCP server (DSA5 system layer).
2. Map semantic fields to canonical actor creation payload (actor + embedded items).
3. Persist via Foundry actor creation APIs through bridge query handlers.
4. Return structured `warnings` and `unmappedFields`.

Why best:

- Lowest data-loss risk for custom format.
- Clear testability in MCP server.
- Uses native Foundry persistence while keeping import intelligence in DSA5 layer.

### Path D: Full custom persistence logic in Foundry module

Assessment: **Not preferred**.

Reasoning:

- Pushes too much domain logic to browser-side module.
- Harder to test and maintain.
- Increases coupling and upgrade risk.

## Decision

Choose **Path C (Hybrid)**.

- Import intelligence in `packages/mcp-server/src/systems/dsa5/`.
- Persistence through Foundry Actor document APIs via bridge.
- Keep `packages/foundry-module/src/data-access.ts` changes minimal and generic.

## Proposed MVP Contract

Tool: `import-dsa5-actor-from-json`

Input:

- `jsonPayload` (string | object) required
- `mode` (`create` | `upsertByName`, default `create`)
- `sourceLabel` optional

Output:

- `success` boolean
- `actorId`, `actorName`
- `createdItems`, `updatedItems`
- `warnings[]`
- `unmappedFields[]`
- `errors[]` (path-aware)

## Mapping Strategy (MVP)

1. Actor core:
- `name`, species/culture/profession, social status, AP totals
- characteristics and energy values

2. Embedded items (best-effort by name lookup):
- advantages/disadvantages/special abilities
- skills/combat techniques/spells
- weapons/equipment

3. Non-blocking warnings for unmapped/unknown entries.

## Validation and Error Handling

- Fail fast for malformed JSON and missing required roots.
- Semantic validation for numeric ranges and required character core fields.
- Distinguish `bridge_not_connected` from `validation_failed`.
- Never report domain errors as transport hangs.

## Test Plan (MVP)

1. Unit tests:
- parser and schema validation
- DSA5 mapping functions

2. Integration tests:
- tool call with `Loreley.json`
- bridge disconnected path returns explicit bridge error

3. Smoke tests (with Foundry world):
- actor created
- essential characteristics/energies correct
- expected warnings for unmapped fields only

## Open Questions

1. Should import try strict compendium matching first or fuzzy matching immediately?
2. Should upsert default to by name only or include uid hash strategy?
3. Which Loreley fields are allowed to remain informational-only in MVP?
