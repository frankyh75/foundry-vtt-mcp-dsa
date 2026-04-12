# DSA5 Adventure Import Workflow

> Ziel: Aus Text aus einem konvertierten PDF oder aus einer vorbereiteten Textdatei strukturierte DSA5-Abenteuerdaten erzeugen und kontrolliert in Foundry VTT importieren.

## Überblick

Die aktuelle Pipeline im Repo besteht aus fünf Schritten:

1. **Text vorbereiten**
   - PDF vorher mit externem Tool in Text umwandeln.
   - Scans/OCR sind hier nicht Teil der Pipeline.
2. **Text normalisieren**
   - Seitenzahlen, Kopf-/Fußzeilen und andere Störtexte entfernen.
3. **Gemma-Extraktion**
   - Rohtext wird in ein stabiles JSON-Schema überführt.
4. **Validierung & Preview**
   - Das JSON wird gegen das Adventure-Schema geprüft.
   - Dry-Run zeigt, welche Journale und Actors angelegt würden.
5. **Foundry-Import**
   - Journale anlegen.
   - NPCs als Actors anlegen.
   - Optional: Journal mit Actor-Referenzen ergänzen.

## Verfügbare Bausteine im Repo

- `packages/mcp-server/src/adventure-import/text-normalizer.ts`
- `packages/mcp-server/src/adventure-import/schema.ts`
- `packages/mcp-server/src/adventure-import/prompt.ts`
- `packages/mcp-server/src/adventure-import/llm-worker.ts`
- `packages/mcp-server/src/adventure-import/foundry-importer.ts`
- `packages/mcp-server/src/tools/adventure-import.ts`

## MCP-Tool

Neues Tool:

- `import-dsa5-adventure-from-text`

### Eingaben

- `title` – Abenteuertitel
- `sourceText` – der vorbereitete Text
- `mode` – `dry-run` oder `import`
- `createActors` – NPCs als Actors anlegen
- `createJournals` – Journal/Seiten anlegen
- `linkNpcs` – Journal mit Actor-Referenzen ergänzen
- `languageHint` – optionaler Sprachhinweis

### Ausgaben

- `summary`
- `warnings`
- `createdEntityIds`
- `unresolvedReferences`
- `plan`

## Empfohlener Arbeitsablauf

### 1. Text vorbereiten

Beispiel:

```bash
pdftotext input.pdf output.txt
```

Oder ein anderes lokales Tool deiner Wahl. Wichtig ist nur: am Ende braucht die Pipeline **Text**, nicht Pixelzauberei.

### 2. Dry-Run

Nutze zuerst den Dry-Run, damit du siehst, was extrahiert wurde und was später erstellt würde.

### 3. Import

Wenn die Vorschau passt, denselben Input im Modus `import` ausführen.

### 4. Kontrolle in Foundry

Prüfe danach:

- Journal-Inhalt
- zusätzliche Seiten
- Actor-Liste
- evtl. Warnungen oder unresolved References

## Design-Prinzipien

- **Local-first**: Texte bleiben lokal, solange möglich.
- **Keine Halluzinationen**: Unsicheres gehört in `warnings`.
- **MVP zuerst**: Journal + NPCs + Links, Szenen später.
- **Preview vor Write**: Erst ansehen, dann schreiben.

## Was noch nicht Teil des MVP ist

- OCR direkt auf gescannten PDFs
- automatische Layout-Rekonstruktion
- vollautomatische Szenen- oder Karten-Erzeugung
- Regelinterpretation ohne menschliche Freigabe

## Nächste Ausbaustufen

- PDF-Import direkt aus einer Datei statt aus Text
- NPC-Mapping auf DSA5-Archetypen
- Import-Preview als formatiertes Review-Gate
- E2E-Test mit einem echten Abenteuer-Fixture
