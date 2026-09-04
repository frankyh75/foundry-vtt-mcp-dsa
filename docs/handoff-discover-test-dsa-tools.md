# Handoff: DSA-Tools discovern & testen

> Für Jarvis (Worker) oder einen Review-Helfer. Ziel: alle DSA-Tools des Forks
> **entdecken** (nennen + Signatur) und **funktional testen** (Tests + ggf. neue Tests).

## Kontext

- Repo: `~/.hermes/foundry-vtt-mcp-dsa` (Fork `frankyh75/foundry-vtt-mcp-dsa`, v0.8.3.1)
- Branch: `feat/actor-crud-upstream-compat` (kein `main`!)
- MCP-Server: `packages/mcp-server`
- Build: `npm run build:server` · Typecheck: `npm run typecheck --workspace=packages/mcp-server`
- Test: `npm test` (vitest) aus `packages/mcp-server`

## Was zu tun ist

### 1. Discovern — alle DSA-Tools inventarisieren

Alle Tools werden in `packages/mcp-server/src/backend.ts` instantiiert und im
Dispatch-Switch (`switch(name)`) bedient. DSA-spezifische Tools aktuell:

| Tool-Name                              | Handler                                                      | Implementierung                       |
| -------------------------------------- | ------------------------------------------------------------ | ------------------------------------- |
| `create-dsa5-character-from-archetype` | `dsa5CharacterCreator.handleCreateCharacterFromArchetype`    | `systems/dsa5/character-creator.ts`   |
| `list-dsa5-archetypes`                 | `dsa5CharacterCreator.handleListArchetypes`                  | `systems/dsa5/character-creator.ts`   |
| `list-creatures-by-criteria`           | (compendium)                                                 | `systems/dsa5/...`                    |
| `create-actor-from-description`        | `actorFromDescriptionTools.handleCreateActorFromDescription` | `tools/actor-from-description.ts`     |
| `import-dsa5-adventure-from-text`      | `adventureImportTools.handleImportAdventureFromText`         | `tools/adventure-import.ts`           |
| `import-dsa5-actor-from-json`          | `dsa5JsonActorImporter.handleImportActorFromJson`            | `systems/dsa5/json-actor-importer.ts` |

Aufgabe:

- `grep -n "case '" packages/mcp-server/src/backend.ts` → alle Tool-Namen + Handler zuordnen.
- Für jedes DSA-Tool: Input-Schema + Handler-Signatur + Rückgabe dokumentieren.
- Prüfen: ist das Tool **registriert** (in `allTools` + Dispatch) — falls nicht, ist es tot.

### 2. Testen — bestehende Tests ausführen

```bash
cd ~/.hermes/foundry-vtt-mcp-dsa/packages/mcp-server
npm test                      # alle 21 Test-Dateien
npm test src/systems/dsa5/    # nur DSA
npm test src/tools/adventure-import.test.ts   # einzelnes
npm run test:coverage         # Coverage für DSA-Kern
```

Test-Dateien existieren u.a. für:

- `systems/dsa5/normalize-payload.test.ts` · `systems/dsa5/filters.test.ts`
- `systems/dsa5/json-actor-importer.test.ts`
- `tools/adventure-import.test.ts` · `adventure-import/llm-worker.test.ts`

### 3. (optional) Functional/End-to-End

Wenn es keine E2E gibt: kurzes Script, das die Tools **ohne** Live-Foundry testet
(Only mock `foundryClient`). Kein echter Foundry-Zugriff aus dem Task.

## Qualitätskriterien

- [ ] Alle 6 DSA-Tools inventarisiert (Name + Handler + Signatur)
- [ ] `npm test` grün (alle grün, oder Differenz dokumentiert)
- [ ] DSA-spezifische Tests abgedeckt; bei Lücken: neue Tests schreiben
- [ ] Kein `main`-Merge — nur `feat/actor-crud-upstream-compat`

## Ausgabeformat

- Review-Report: Tool-Tabelle + Test-Ergebnis (grün/rot + Differenz)
- Bei fehlenden Tests: Tests ergänzt → Report
- Bei Blockern (Build/Tests rot): Block mit Begründung, nicht complete

## Deploy (NICHT Teil des Tasks)

Nur MCP-Server-Code. Nach Deployment: App komplett quittieren (⌘Q), **neuer Chat**
— `/new` reicht nicht.

## /resume-Session

Falls die Arbeit unterbrochen wurde oder ein Worker/Chat nahtlos weitersetzen soll:
den folgenden Resume-Prompt 1:1 übernehmen. Er liefert allen nötigen Kontext, damit
nicht alles neu gelesen werden muss.

```
/resume --context "Handoff DSA-Tools:discover+test

Repo: ~/.hermes/foundry-vtt-mcp-dsa  (Fork frankyh75/foundry-vtt-mcp-dsa)
Branch: feat/actor-crud-upstream-compat  (NIEMAL main mergen)
MCP-Server: packages/mcp-server
Build: npm run build:server  |  Typecheck: npm run typecheck --workspace=packages/mcp-server  |  Test: npm test (vitest)

Stand:
- 6 DSA-Tools in backend.ts registriert (allTools-Z1433 + Dispatch-Z1640-1653).
- Commit 6f3936a 'fix(mcp-server): register 3 DSA-Tools + guard extractActor' gepusht.
- Kanban T1 (jarvis) + T2 (worker-heavy) done, Review APPROVED.
- Offen: volle Inventarisierung + Test-Abdeckung prüfen.

Aufgabe:
1) Discovern: alle DSA-Tools (Name+Handler+Signatur) inventarisieren.
   grep -n \"case '\" packages/mcp-server/src/backend.ts
2) Testen: npm test (21 Test-Dateien), gefiltert DSA. Lücken → neue Tests.
3) DSA-Tools: create-dsa5-character-from-archetype, list-dsa5-archetypes,
   list-creatures-by-criteria, create-actor-from-description,
   import-dsa5-adventure-from-text, import-dsa5-actor-from-json.
4) DSA-Handler: systems/dsa5/character-creator.ts, tools/actor-from-description.ts,
   tools/adventure-import.ts, systems/dsa5/json-actor-importer.ts.

Ausgabe: Tool-Tabelle + Test-Ergebnis (grün/rot + Differenz).
Qualität: alle grün oder Differenz dokumentiert, bei Blocker kanban_block.
"
```

Kurzversion (nur wenn Kontext schon da): `/resume --context "Handoff DSA-Tools: discover + testen"`
Nur MCP-Server-Code. Nach Deployment: App komplett quittieren (⌘Q), **neuer Chat**
— `/new` reicht nicht.
