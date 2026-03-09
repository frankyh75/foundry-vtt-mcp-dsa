# LM Studio → Foundry/Forge Local-Only Pipeline (Cloud-LLM verboten)

## Ziel

Eine robuste Import-Pipeline für große Abenteuer-PDFs (z. B. 76 MB), komplett lokal:
- kein Cloud-LLM
- chunk-fähig für LM-Studio-Kontextlimits
- Review/Diff vor jedem World-Write
- Apply via bestehender MCP-Bridge

---

## Architektur

```text
PDF/Image/Text
   ↓
[1] Ingest + Preflight (Dateityp, Seitenzahl, Textlayer?)
   ↓
[2] Text/OCR-Extraktion lokal
   ↓
[3] Chunking (seiten- und zeichenbasiert)
   ↓
[4] Lokale Strukturierung (LM Studio + JSON-Schema)
   ↓
[5] Merge + Validierung + Referenzauflösung
   ↓
[6] Preview + Diff + Confirm
   ↓
[7] Apply (MCP -> Foundry/Forge)
```

---

## Phase 1 (jetzt umgesetzt): Chunk-Planer

Neu im Repo:
- `scripts/pdf-local-pipeline.py`

Funktionen:
1. PDF-Preflight (Dateigröße, Seiten)
2. Lokale Textextraktion (`pymupdf` bevorzugt, fallback `pypdf`)
3. Chunking per:
   - max Seiten pro Chunk (`--max-pages-per-chunk`)
   - max Zeichen pro Chunk (`--max-chars-per-chunk`)
4. Ausgabe:
   - `manifest.json` (Chunk-Metadaten)
   - `chunk-XX.txt` (Prompt-ready Textblöcke)

---

## Installation (lokal)

Optional, aber empfohlen:

```bash
pip install pymupdf pypdf
```

---

## Nutzung

```bash
python3 scripts/pdf-local-pipeline.py \
  --pdf /pfad/zu/deinem-abenteuer.pdf \
  --output-dir adventures/pipeline-run \
  --max-pages-per-chunk 12 \
  --max-chars-per-chunk 28000
```

Ergebnis:
- `adventures/pipeline-run/manifest.json`
- `adventures/pipeline-run/chunk-01.txt`, `chunk-02.txt`, ...

---

## Empfohlene LM-Studio-Verarbeitung pro Chunk

Prompt-Strategie (pro `chunk-XX.txt`):
1. Gib nur den Chunk-Text ins Modell
2. Fordere **striktes JSON** (kein Markdown)
3. Zielschema (MVP):
   - journals[]
   - scenes[]
   - npcs[]
   - quests[]

Wichtig:
- keine gesamten 76 MB hochladen
- immer chunkweise arbeiten
- pro Chunk strukturiertes Teilergebnis speichern (`chunk-XX.structured.json`)

---

## Merge/Apply-Plan (nächster Schritt)

Als nächstes implementieren:
1. `scripts/merge-structured-chunks.py`
   - führt `chunk-*.structured.json` zusammen
   - dedupliziert NPCs/Orte (fuzzy)
2. `schemas/adventure.v1.json`
   - harte Validierung vor Apply
3. `scripts/apply-adventure-to-foundry.mjs`
   - preview/diff/confirm
   - danach MCP-Tool-Aufrufe

---

## Foundry/Forge Apply-Prinzipien

- **Default: Dry-Run**
- Erst bei `--confirm` schreiben
- Reihenfolge beim Schreiben:
  1. Journals
  2. Actors/NPCs
  3. Scenes
  4. Links/Quest-Referenzen

---

## Compliance (Ulisses-Vorgabe)

- Kein Cloud-LLM notwendig
- Lokaler Parser + lokales LM Studio
- OCR kann lokal bleiben (Lens/Google-Export als Vorstufe ist möglich, solange keine Cloud-LLM-Nachverarbeitung)

---

## Testdaten-Hinweis

Für sehr große Quellen (z. B. 76 MB):
- zuerst mit `--max-pages-per-chunk 8` starten
- dann stufenweise auf 12–20 erhöhen, je nach Modellkontext und Qualität
