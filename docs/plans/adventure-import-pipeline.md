# DSA5 Adventure Import Pipeline Implementation Plan

> **For Hermes:** Use `subagent-driven-development` after this plan is approved.

**Goal:** PDFs bzw. bereits in Text konvertierte Abenteuer so verarbeiten, dass daraus strukturierte DSA5-Abenteuerdaten entstehen und sauber in Foundry VTT importiert werden können.

**Architecture:**
Wir bauen eine mehrstufige Pipeline statt eines Monolithen: erst Extraktion aus Text/PDF, dann Normalisierung in ein stabiles JSON-Schema, dann Import nach Foundry über die vorhandenen MCP-/Foundry-APIs. Die Pipeline soll lokal-first bleiben, damit Gemma 4 als Extraktions- und Strukturierungshelfer arbeiten kann, ohne dass DSA5-Inhalte unnötig in externe Clouds wandern.

**Tech Stack:**
- TypeScript / Node.js
- Vorhandene Foundry MCP Bridge Werkzeuge
- Gemma 4 via lokaler Inferenz (z. B. Lemonade/Claude Code Harness)
- JSON Schema / Zod für Validierung
- Vitest für Parser-/Import-Tests
- Optional später: `pdftotext` oder PDF-Parser, falls Roh-PDFs direkt unterstützt werden sollen

---

## Was schon da ist

Vorhandene Bausteine, die wir wiederverwenden sollten:

- **Journal-Import / Update vorhanden**
  - `packages/foundry-module/src/data-access.ts`
  - `packages/foundry-module/src/queries.ts`
  - Unterstützt bereits:
    - `createJournalEntry`
    - `updateJournalContent`
    - `getJournalContent`
    - `getJournalPageContent`
    - `listJournals`
- **Actor-Import vorhanden**
  - `packages/foundry-module/src/data-access.ts`
  - Unterstützt bereits:
    - `createActorFromData`
    - `createActorFromCompendium`
    - `addActorsToScene`
- **DSA5-spezifische Tools vorhanden**
  - `packages/mcp-server/src/systems/dsa5/character-creator.ts`
  - `packages/mcp-server/src/systems/dsa5/json-actor-importer.ts`
  - `packages/mcp-server/src/tools/quest-creation.ts`
- **Praktische Vorarbeit / Artefakte**
  - `import-npcs.js` als alte manuelle Import-Anleitung
  - `DSA5_GUIDE.md` mit DSA5-Workflow und Fundstellen
  - Beispiel-Abenteuer `deicherbe` war vorhanden, wurde aber wegen Copyright aus dem Repo entfernt und lokal gesichert
- **Local-first Architektur bereits dokumentiert**
  - `B_TARGET_ARCHITECTURE.md`
  - README-Abschnitt zu local LLM setup / DSA5 capabilities

**Implikation:** Wir müssen nicht bei Null anfangen. Der Kern fehlt noch: **ein klares Abenteuer-Schema plus ein Import-Workflow, der Gemma-Extraktion mit den bestehenden Foundry-Write-APIs verbindet**.

---

## Zielbild

Die Pipeline soll diese Form haben:

1. **Input**: Text aus einem konvertierten PDF oder einer bereits extrahierten Textdatei
2. **Gemma-Extraktion**: Strukturierung in ein Abenteuer-JSON
3. **Validierung**: Schema- und Plausibilitätsprüfung
4. **Foundry-Import**:
   - Journal mit mehreren Seiten anlegen
   - NPCs als Actors erzeugen
   - Optional Szenen/Handouts/Items anlegen
   - NPCs mit Abenteuerseiten verlinken
5. **Dry-Run / Review**: Vor dem Import Vorschau der geplanten Objekte

---

## Empfohlenes Abenteuermodell

Wir brauchen ein stabiles Zielschema, z. B.:

- `metadata`
  - title
  - subtitle
  - type
  - system
  - source
  - language
  - difficulty
  - playerCount
- `chapters`
  - scenes / abschnitte / kapitel
  - title
  - summary
  - readAloudText
  - gmNotes
  - challenges
  - linkedNpcs
  - linkedItems
  - linkedLocations
- `npcs`
  - name
  - role
  - archetypeHint
  - attributes
  - skills
  - equipment
  - secrets
  - motivation
- `items`
  - name
  - category
  - description
  - stats
- `locations`
  - name
  - description
  - mapPrompt
  - sceneHint
- `imports`
  - journals
  - actors
  - scenes
  - linkages
- `warnings`
  - ambiguous names
  - uncertain mappings
  - missing stats

**Wichtig:** Das Schema muss auch dann funktionieren, wenn das PDF nur Text ohne Layoutinfos liefert.

---

## Task 1: Ist-Zustand sauber inventarisieren

**Objective:** Alle vorhandenen Import-Fähigkeiten und Lücken einmal strukturiert dokumentieren.

**Files:**
- Read/inspect: `packages/foundry-module/src/data-access.ts`
- Read/inspect: `packages/foundry-module/src/queries.ts`
- Read/inspect: `packages/mcp-server/src/systems/dsa5/json-actor-importer.ts`
- Read/inspect: `packages/mcp-server/src/systems/dsa5/character-creator.ts`
- Read/inspect: `packages/mcp-server/src/tools/quest-creation.ts`
- Read/inspect: `import-npcs.js`
- Read/inspect: `DSA5_GUIDE.md`
- Read/inspect: `adventures/deicherbe-1-preprocessed.json`
- Read/inspect: `adventures/deicherbe-2-preprocessed.json`

**Deliverable:**
- Liste der wiederverwendbaren APIs
- Liste der fehlenden Pipeline-Schritte
- Entscheidung: Wo soll der neue Importer leben? (`packages/mcp-server/src/adventure-importer/*` oder eigener Workspace)

**Verification:**
- Wir können klar sagen, welche Funktion für Journal, Actor, Scene und Linking zuständig ist.

---

## Task 2: Adventure JSON Schema definieren

**Objective:** Ein eindeutiges Zielschema festlegen, das Gemma aus Text erzeugen soll.

**Files:**
- Create: `packages/mcp-server/src/adventure-import/schema.ts`
- Create: `packages/mcp-server/src/adventure-import/types.ts`
- Create: `packages/mcp-server/src/adventure-import/schema.test.ts`

**Step 1: Write failing tests**

Test cases:
- valid minimal adventure passes
- chapter without title fails
- NPC without name fails
- unknown extra fields are either preserved in `warnings` or rejected bewusst
- German umlauts survive normalization

**Step 2: Implement minimal schema**

Use Zod for runtime validation and exported TS types for downstream import.

**Step 3: Verify**

Run:
```bash
npm -w @foundry-mcp/server test -- adventure-import
npm -w @foundry-mcp/server typecheck
```

**Expected:** tests pass, schema is stable enough for prompt output.

---

## Task 3: Text-Input Normalizer bauen

**Objective:** Rohtext aus konvertierten PDFs in saubere, gemma-freundliche Abschnitte zerlegen.

**Files:**
- Create: `packages/mcp-server/src/adventure-import/text-normalizer.ts`
- Create: `packages/mcp-server/src/adventure-import/text-normalizer.test.ts`
- Optional create: `scripts/extract-adventure-text.mjs`

**Scope:**
- Entfernen von Seitenzahlen, Kopf-/Fußzeilen
- Erkennen von Kapitelüberschriften
- Erkennen von Listen, NPC-Namen, Ortsabschnitten
- Chunking für LLM-Extraktion
- Erhaltung von Referenzen wie Seitenzahlen / Abschnittsanker

**Verification:**
- Ein realer Textauszug aus einem Abenteuer wird in reproduzierbare Chunks zerlegt.
- Keine Layout- oder OCR-Abhängigkeit, solange Text bereits vorliegt.

---

## Task 4: Gemma-Extraktionsprompt und Worker definieren

**Objective:** Gemma soll aus Text-Chunks strukturierte Abenteuerdaten erzeugen, nicht nur lose Notizen.

**Files:**
- Create: `packages/mcp-server/src/adventure-import/prompt.ts`
- Create: `packages/mcp-server/src/adventure-import/llm-worker.ts`
- Create: `packages/mcp-server/src/adventure-import/llm-worker.test.ts`
- Optional create: `docs/adventure-import-prompt.md`

**Prompt-Anforderungen:**
- Nur JSON ausgeben
- Schema strikt einhalten
- Unsicherheiten explizit in `warnings` / `confidence` markieren
- Jede NPC-/Ort-/Szenen-Zuordnung begründen oder als unsicher markieren
- Keine Halluzinationen von Stats, wenn sie nicht im Text stehen

**Verification:**
- Ein Beispieltext liefert ein valides JSON, das durch das Schema geht.
- Bei unklaren Stellen erzeugt Gemma Warnungen statt Fantasiewerte.

---

## Task 5: Foundry-Import-Adapter bauen

**Objective:** Das normalisierte Abenteuer-JSON in Foundry-Objekte übersetzen.

**Files:**
- Create: `packages/mcp-server/src/adventure-import/foundry-importer.ts`
- Create: `packages/mcp-server/src/adventure-import/foundry-importer.test.ts`
- Modify: `packages/mcp-server/src/backend.ts`
- Optional modify: `packages/foundry-module/src/queries.ts` nur falls ein neuer Query-Endpoint sinnvoller ist

**Import-Mapping:**
- `metadata` → journal folder / top-level journal title
- `chapters` → JournalEntry pages
- `npcs` → Actors via vorhandenes `createActorFromData`
- `locations` → Journals oder Szenen-Notes je nach Reifegrad
- `items` → Journal-Anhänge oder separate Handouts / später Items
- Links → Journal-Inhalte mit Verweisen auf Actor-IDs und Page-IDs

**Wichtige Designentscheidung:**
Erstmal **Journal + Actor + Linking** als MVP. Szenen-/Map-Automatismus erst in Phase 2.

**Verification:**
- Dry-run zeigt, welche Foundry-Objekte erstellt würden.
- Importer nutzt vorhandene API-Funktionen statt parallel neue Foundry-Logik zu bauen.

---

## Task 6: MCP Tool für Adventure Import ergänzen

**Objective:** Ein MCP-Tool bereitstellen, das den ganzen Prozess für Gemma/Claude/Codex bedienbar macht.

**Files:**
- Modify: `packages/mcp-server/src/backend.ts`
- Create: `packages/mcp-server/src/tools/adventure-import.ts`
- Optional modify: `packages/mcp-server/src/index.ts` nur falls Registrierung hier statt backend passiert

**Tool-Idee:**
- `import-dsa5-adventure-from-text`
- Input:
  - `title`
  - `sourceText`
  - `mode` (`dry-run` | `import`)
  - `createActors` boolean
  - `createJournals` boolean
  - `linkNpcs` boolean
- Output:
  - import summary
  - warnings
  - created entity IDs
  - unresolved references

**Verification:**
- Tool taucht in der MCP-Tool-Liste auf.
- Dry-run funktioniert ohne Foundry-Schreiboperation.
- Import-Modus erstellt echte Journale/Actors.

---

## Task 7: NPC-Mapping mit DSA5-Archetypen verbinden

**Objective:** DSA5-Abenteuer-NPCs möglichst automatisch auf passende Archetypen mappen.

**Files:**
- Modify: `packages/mcp-server/src/systems/dsa5/character-creator.ts`
- Optional create: `packages/mcp-server/src/adventure-import/npc-mapper.ts`
- Optional create: `packages/mcp-server/src/adventure-import/npc-mapper.test.ts`

**Ansatz:**
- Namen, Rolle, Beruf, Kultur, Alter aus dem Abenteuer-JSON ableiten
- passende Archetypen über vorhandene DSA5-Suche wählen
- bei Unsicherheit Alternativen ausgeben
- niemals stillschweigend falsche Werte erfinden

**Verification:**
- Mindestens 2–3 reale NPC-Beispiele aus `deicherbe` lassen sich konsistent mappen.

---

## Task 8: Import-Preview und Review-Gate

**Objective:** Vor dem Foundry-Import klar zeigen, was passieren wird.

**Files:**
- Create: `packages/mcp-server/src/adventure-import/preview.ts`
- Create: `packages/mcp-server/src/adventure-import/preview.test.ts`
- Optional modify: README / Doku

**Preview soll zeigen:**
- Anzahl Kapitel / Journalseiten
- Anzahl NPCs / Actors
- Unklare Stellen
- Welche Daten nur geschätzt sind
- Welche Handlungen potentiell riskant sind

**Verification:**
- Preview ist lesbar und dient als Freigabe-Gate vor Import.

---

## Task 9: Dokumentation und Beispielpipeline

**Objective:** Die Pipeline so dokumentieren, dass du und Gemma sie später wiederverwenden könnt.

**Files:**
- Modify: `README.md`
- Create: `docs/ADVENTURE_IMPORT_WORKFLOW.md`
- Create: `docs/examples/adventure-import-example.md`
- Optional update: `DSA5_GUIDE.md`

**Doku-Inhalte:**
- Einlesen von Text-PDFs
- Gemma-Extraktion
- Validierung
- Dry-run
- Import in Foundry
- Umgang mit Unsicherheiten

---

## Task 10: End-to-End Test mit einem echten Abenteuer

**Objective:** Ein vollständiger Durchlauf mit einem echten Beispiel wie `Deicherbe`.

**Files:**
- Add test fixture(s): `tests/fixtures/adventures/deicherbe.txt` oder `.json`
- Add integration test: `packages/mcp-server/src/adventure-import/*.test.ts`

**Testziel:**
- Text rein
- JSON raus
- Preview valid
- Dry-run valid
- Import erstellt Journale und NPCs
- Warnings sind nachvollziehbar

**Verification:**
- Ein kompletter Durchlauf ist reproduzierbar.

---

## Reihenfolge / Priorität

1. Ist-Zustand inventarisieren
2. Schema festzurren
3. Text normalisieren
4. Gemma-Extraktion
5. Foundry-Import
6. MCP-Tool
7. DSA5-Archetyp-Mapping
8. Preview-Gate
9. Doku
10. E2E-Test

---

## Nicht in Scope für die erste Version

- Direktes OCR auf gescannten PDFs
- Automatisches Layout-Rekonstruktionstraining
- Vollautomatische Szene-/Map-Erzeugung aus jedem Abenteuer
- Komplette Regelinterpretation oder Abenteueranalyse ohne menschliche Freigabe

---

## Erfolgsdefinition für MVP

Das MVP ist fertig, wenn du folgendes kannst:

1. Einen Abenteuertext einlesen
2. Mit Gemma eine saubere Struktur erzeugen
3. Vorab eine Preview sehen
4. Mit einem Klick/Command Journale und NPCs in Foundry erstellen
5. Unsichere Stellen transparent markiert bekommen
6. Das Ganze lokal-first und nachvollziehbar betreiben

---

## Nächster sinnvoller Schritt

Wenn du willst, setze ich als nächstes **Task 1 + Task 2** um:
- Inventarisierung der bestehenden Importpfade
- Definition des Adventure-Schemas

Danach kann Gemma auf einer festen Struktur arbeiten statt auf improvisierten Halbinformationen.
