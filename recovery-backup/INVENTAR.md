# Recovery Backups für foundry-vtt-mcp-dsa

**Erstellt:** 2026-05-29
**Upstream-Master:** `eb36890`
**Unser Master (vor rebuild):** `$(git rev-parse --short master)`

---

## Inventar der divergierten Commits

### A. Upstream Cherry-Picks (diese Commits stammen aus upstream, werden NICHT portiert)
Diese sind bereits in `upstream/master` enthalten oder wurden dort ersetzt:

| Commit | Message | Datei(en) |
|--------|---------|-----------|
| b63f452 | docs: sync upstream PR #48 — update README tool count and DSA5 labels | README.md |
| 7b08c61 | feat(dsa5): sync upstream PR #48 - consolidate world/actor item tools | backend.ts, character.ts, README.md |
| 105a7c2 | feat: add folder support to journal and quest creation (cherry-pick d51f153) | data-access.ts, queries.ts, backend.ts |
| 6e0b0ed | feat: add create-world-items tool (cherry-pick 36ce50a with DSA5 merge fix) | data-access.ts, queries.ts, character.ts |
| 4251b8c | chore: sync upstream v0.8.0 Foundry v14 + Mac installer (#36) | README.md, package.json, module.json |

### B. TEMP / Broken Commits (werden übersprungen)

| Commit | Message | Datei(en) |
|--------|---------|-----------|
| 4ed6ebe | TEMP: cherry-pick 9a76613 add actor items tool | data-access.ts, queries.ts, backend.ts — **SKIP** |

### C. DSA5-eigene Features (portieren, sind NICHT in upstream)

| Commit | Feature | Datei(en) |
|--------|---------|-----------|
| fcd0f16 | refactor(dsa5): move identity-type preservation out of data-access | systems/dsa5/* |
| ff8fca8 | feat(dsa5): add custom json actor import | systems/dsa5/json-actor-importer.ts, test |
| b4af2f3 | feat(dsa5): integrate character/archetype tools | tools/character.ts (DSA5-Pfade), systems/dsa5/adapter.ts |
| cb44c27 | refactor(dsa5): complete optolith mapping | systems/dsa5/ |
| 2d99c2c | test(dsa5): convert filter smoke script to vitest suite | systems/dsa5/filters.test.ts |
| 43b3a12 | fix(dsa5): address codex PR14 review findings | systems/dsa5/ |
| b922b3e | test(dsa5): convert filter script into vitest suite | systems/dsa5/ |
| ed94e05 | feat(dsa5): add create-actor-from-description tool | tools/actor-from-description.ts |
| 0166176 | feat(adventure-import): add local DSA5 adventure pipeline | tools/adventure-import.ts, test |
| 67c3fd2 | feat(journal): add create-journal-entry tool | tools/... |
| a154698 | feat(scene): add create-scene-placeholder tool | tools/... |
| 24695de | fix(dsa5): align actor extraction prompt schema hints | tools/character.ts |

### D. PDF Review Pipeline (eigenentwickelt)

| Commit | Feature | Datei(en) |
|--------|---------|-----------|
| b0d7bc1 | feat(pdf): add local review backend | Pakete im PDF-Review-Bereich |
| a2aae32 | feat(pdf): add projected IR and merge/split tools | ... |
| 04c2652 | feat(pdf): add review ui and import pipeline | ... |

### E. Infrastruktur / Build (müssen neu auf upstream angewendet werden)

| Commit | Feature | Datei(en) |
|--------|---------|-----------|
| 9881e7a | chore: Fix broken ESLint config | .eslintrc.json, tsconfig.eslint.json |
| d9f6527 | fix: Write Claude config to MSIX virtualised path | installer/nsis/configure-claude.ps1 |
| 580a808 | fix(backend): make debug file logging opt-in | ... |
| 28c04a2 | fix(config): default stun servers to empty | ... |
| 8195baf | chore(foundry-module): point manifest metadata to fork | module.json |

---

## Kritische Dateien mit Divergenzen

| Datei | Was wir geändert haben | Was upstream geändert hat | Strategie beim Rebuild |
|-------|-----------------------|--------------------------|------------------------|
| `data-access.ts` | DSA5 `preserveItemTypes`, Duplikat-Fixes, cherry-pick Artefakte | Cosmere RPG Types, Prettier, structure | Upstream-Basis, generische Hooks re-add |
| `character.ts` | DSA5-Extract-Logik, actor-from-description hooks | Cosmere async-Adapter-Muster, folder support | Upstream-Basis, DSA5-Adapter-Pfade portieren |
| `backend.ts` | DSA5-Tool-Registrierungen, cherry-pick Artefakte | Prettier, Cosmere-Registrierung, cleaner structure | Upstream-Basis, DSA5-Tools neu registrieren |
| `compendium.ts` | DSA5-Filter, Index-Builder | (minimal, hauptsächlich Prettier) | Unsere DSA5-Dateien prüfen, Prettier anwenden |
| `quest-creation.ts` | Folder-Support cherry-pick | Upstream Folder-Support (identisch) | Upstream-Version übernehmen |
| `systems/types.ts` | DSA5-spezifische Typen | Cosmere RPG Union-Typen | Beide Erweiterungen kombinieren |
| `systems/dsa5/*` | Komplettes DSA5-Modul | (existiert nicht upstream) | Direkt von master übernehmen |

---

## Recovery Branch

Der aktuelle Stand ist in `sync/rebuild-from-upstream` aufgebaut.
Als Referenz: `eb36890` ist der upstream-master-Commit.

## Patches-Verzeichnis

`recovery-backup/patches/` enthält:
- `00_DSA5_FULL_DIFF.patch` — Gesamtdiff des DSA5-Moduls gegen upstream
- `00_queries_FULL_DIFF.patch` — Gesamtdiff von queries.ts
- Einzelne Patches für alle 38 Commits (diese können NICHT direkt auf upstream angewendet werden, nur als Referenz)

