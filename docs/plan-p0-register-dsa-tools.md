# P0: 3 tote DSA-Tools in backend.ts registrieren

> Stand: 2026-08-23 · Reponame: `~/.hermes/foundry-vtt-mcp-dsa` · Branch: `feat/actor-crud-upstream-compat` (1217ab6)
> Ziel: die 3 existierenden, aber im Backend nicht registrierten DSA-Tools nutzbar machen.

## Was ist das Problem

In `packages/mcp-server/src/backend.ts` werden ~18 Tool-Klassen instantiiert
(`new XxxTools(...)`) und in die `allTools`-Liste + den `switch(name)`-Dispatch
eingebunden. Drei DSA-spezifische Klassen existieren als fertiger Code, werden
**aber weder instantiiert noch dispatched**:

| Tool                              | Implementierung                                                 | Status im Backend                      |
| --------------------------------- | --------------------------------------------------------------- | -------------------------------------- |
| `create-actor-from-description`   | `tools/actor-from-description.ts` (`ActorFromDescriptionTools`) | ❌ nicht instantiiert, nicht dispatcht |
| `import-dsa5-adventure-from-text` | `tools/adventure-import.ts` (`AdventureImportTools`)            | ❌ nicht instantiiert, nicht dispatcht |
| `import-dsa5-actor-from-json`     | `systems/dsa5/json-actor-importer.ts` (`DSA5JsonActorImporter`) | ❌ nicht instantiiert, nicht dispatcht |

Die Implementierungen sind fertig: `getToolDefinitions()` + Handler + Tests (alle grün).
Es fehlt nur der Klebstuff-Code in `backend.ts`. Folge: kein MCP-Client kommt jemals
daran — die Tools sind toter Code.

## Die drei Handler (bereits verifiziert)

1. **`ActorFromDescriptionTools`** — `tools/actor-from-description.ts`
   - Konstruktor: `new ActorFromDescriptionTools({ foundryClient, logger })`
   - Handler: `handleCreateActorFromDescription(args)` → `{ mode, extractedPayload, rawText, message }`
   - Tool: `create-actor-from-description` (dry-run/import, resolveItems)
   - Nutzt intern `DSA5JsonActorImporter` (→ Tool 3 hängt zusammen).

2. **`AdventureImportTools`** — `tools/adventure-import.ts`
   - Konstruktor: `new AdventureImportTools({ foundryClient, logger })`
     (intern `AdventureImportWorker` + `FoundryAdventureImporter`, beide optional)
   - Handler: `handleImportAdventureFromText(args)` → `{ mode, title, summary, warnings, plan }`
   - Tool: `import-dsa5-adventure-from-text` (dry-run/import, createActors, createJournals, linkNpcs)

3. **`DSA5JsonActorImporter`** — `systems/dsa5/json-actor-importer.ts`
   - Konstruktor: `new DSA5JsonActorImporter({ foundryClient, logger })`
   - Handler: `handleImportActorFromJson(args)` → Import via `auto/custom_dsa5/optolith_like/raw_foundry`
   - Tool: `import-dsa5-actor-from-json` (jsonPayload/filePath, strategy, resolveItems, addToScene, updateExisting)
   - Macht `assertDsa5World()` → warnt in nicht-DSA5-Welten.

## Änderungen an backend.ts (4 Stellen, alle inline)

### 1) Import (Zeile ~42, nach `DSA5CharacterCreator`)

```ts
import { ActorFromDescriptionTools } from './tools/actor-from-description.js';
import { AdventureImportTools } from './tools/adventure-import.js';
import { DSA5JsonActorImporter } from './systems/dsa5/json-actor-importer.js';
```

`DSA5JsonActorImporter` ist aktuell nur via `systems/dsa5/index.ts` exportiert — der
direkte Import aus `systems/dsa5/json-actor-importer.js` ist sauberer.

### 2) Instantiierung (Zeile ~1197, nach `dsa5CharacterCreator`)

```ts
const actorFromDescriptionTools = new ActorFromDescriptionTools({ foundryClient, logger });
const adventureImportTools = new AdventureImportTools({ foundryClient, logger });
const dsa5JsonActorImporter = new DSA5JsonActorImporter({ foundryClient, logger });
```

`foundryClient` + `logger` sind in diesem Scope verfügbar (bestätigt, Zeilen 1188–1197).

### 3) Tool-Liste (`allTools`, ~Zeile 1425, nach `dsa5CharacterCreator`)

```ts
...actorFromDescriptionTools.getToolDefinitions(),
...adventureImportTools.getToolDefinitions(),
...dsa5JsonActorImporter.getToolDefinitions(),
```

### 4) Dispatch-Switch (~Zeile 1626, nach `list-dsa5-archetypes`, vor `// D&D 5e tools`)

```ts
case 'create-actor-from-description':
  result = await actorFromDescriptionTools.handleCreateActorFromDescription(args);
  break;

case 'import-dsa5-adventure-from-text':
  result = await adventureImportTools.handleImportAdventureFromText(args);
  break;

case 'import-dsa5-actor-from-json':
  result = await dsa5JsonActorImporter.handleImportActorFromJson(args);
  break;
```

## Nicht vergessen: gefundene Fehler in der Implementierung

### A) `handleCreateActorFromDescription` wirft nie (Bug)

`actor-from-description.ts:72` ruft `this.worker.extractActor(...)` **ohne `try/catch`**.
Der Rest der Datei ist try/catch-arm. Fehler fliegen unauffällig in den generischen
catch-Block von backend.ts — kein Tool-names-Log, keine strukturierte Fehlerantwort
(im Gegensatz zu den anderen DSA-Tools, die `errorHandler.handleToolError(...)` nutzen).
→ `extractActor` in einen try/catch wickeln, Fehler mit Tool-Name loggen.
**Scope:** P0-Bonus, nicht zwingend für die Registrierung. Trotzdem fixen — sonst sieht
ein Fehler im dry-run wie ein Tool-Ausfall aus.

### B) `handleListArchetypes` filtert auf `pack.system === 'dsa5'` (Verified: hängt an Pack-Metadata)

`character-creator.ts:223` filtert Packs auf `pack.system === 'dsa5'`. `getAvailablePacks()`
liefert `system: pack.metadata.system` (data-access.ts:3519). Der Filter ist **nur so gut
wie die DSA5-Packs**: wenn deren `metadata.system` nicht auf `dsa5` steht → leere Liste.
→ In DSA5-Pack-Erstellung/Manifest prüfen: ist `metadata.system='dsa5'` gesetzt?
Wenn ja → Filter passt, nichts zu tun. Wenn nein → Packs patchen (nicht Code lockern).
**Scope:** P0-Bonus, nur wenn Verifikation negativ. **Kein** Code-Risiko, solange Packs korrekt.

## Build- & Verifikation (nach Edit)

```ts
# Build
cd ~/.hermes/foundry-vtt-mcp-dsa
npm run build:server
npm run typecheck --workspace=packages/mcp-server

# Verify: alle 3 Tool-Namen jetzt in backend.ts registriert
grep -nE "create-actor-from-description|import-dsa5-adventure-from-text|import-dsa5-actor-from-json" packages/mcp-server/src/backend.ts
```

## Deployment (nicht Teil von P0 — Frank macht das)

- Nur **MCP-Server-Code** (dist/), kein Foundry-Modul-Wechsel.
- App komplett beenden (`⌘Q` → `hermes desktop`), dann neuer Chat — `/new` reicht nicht
  (siehe HANDOFF.md Fallstrick 5/7).

## Abgrenzung / Nachbarschaft (nicht in P0)

- **P1 (PDF-Pipeline)** hängt an `AdventureImportTools` — sobald Tool 2 lebt, ist die
  Basis für PDF→Text→Import. Aber die OCR-Vorlage (`pdf-extraction-and-review-workflows`)
  fehlt im Tool — separat.
- **P2/P3** (Archetype-Filter, „Profession ohne Archetyp") stehen in `docs/bugs.md`.
- `json-actor-importer` wird auch von `actor-from-description` intern verwendet — Tool 1
  und Tool 3 hängen funktional zusammen (beide brauchen `dsa5JsonActorImporter`).

## Checklist

- [ ] Import + Instantiierung + Tool-Liste + Dispatch (4 Stellen)
- [ ] Bug A (try/catch um extractActor) fixen
- [ ] Bug B (Archetype-Filter) verifizieren → ggf. lockern
- [ ] Build + typecheck grün
- [ ] `create-actor-from-description`-Test läuft (falls vorhanden: `npm test`)
- [ ] Commit auf Feature-Branch, **nicht** merge
