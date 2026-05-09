# Marker Evaluierung + Zweiter-Lauf-Konzept

## Marker Ergebnis (Deicherbe-p12, Surya OCR)

| Kriterium | Marker | Tesseract (unser Stack) |
|-----------|--------|------------------------|
| OCR-Qualität | ✅ Gut | ⚠️ Fragmentiert |
| DSA-Statblock | ✅ Vollständig | ❌ 3–4 Fragmente |
| Block-Segmentation | ❌ Keine (nur Markdown) | ✅ 19 Blöcke |
| Bounding-Boxes | ❌ Nein | ✅ Ja |
| Speed (1 Seite, CPU) | ⚠️ 2:30 min | ✅ Sekunden |
| GUI-Integration | ❌ Nur Text | ✅ Canvas + Overlays |
| Lokales Modell | ✅ Ja (Surya) | ✅ Ja (Tesseract) |

## Fazit Marker

Marker (Surya OCR) ist **deutlich besser in Text-Erkennung**, aber liefert **keine Bounding-Boxes** und **keine Block-Struktur** — nur flaches Markdown.

Für unsere GUI-Nacharbeit (Box-Selektion, Typ-Änderung, Position) ist Marker **unbrauchbar**.

Unser Stack (Tesseract + eigene Heuristik) hat **schlechtere OCR**, aber **vollständige Block-Struktur** mit Bounding-Boxes.

## Zweiter-Lauf-Strategie

### Option 1: Marker als optionaler OCR-Backend
Wenn User "OCR-Qualität" priorisiert (keine GUI-Nacharbeit nötig):
- Marker läuft auf dem PDF
- Ergebnis: sauberes Markdown
- Keine Bounding-Boxes, keine Block-Typen
- Einfachster Export nach Foundry

### Option 2: Tesseract + Heuristik-Verbesserung (empfohlen)
Wenn User GUI-Nacharbeit will:
- Tesseract bleibt primär (Bounding-Boxes)
- User ändert Block-Typen, Kommentare, Positionen
- Annotation-Patches werden gespeichert
- **Zweiter Lauf: Lokales LLM (qwen2.5)** nimmt Patches + Original-IR

### Option 3: Hybrid (Zukunft)
- Marker für OCR-Text
- Tesseract für Bounding-Boxes
- Alignment: Welcher Marker-Text gehört zu welcher Tesseract-Box?
- Aufwand: Hoch

## Empfohlene Implementierung: Option 2

### Datenfluss

```
1. Upload PDF → Tesseract OCR → IR mit Bounding-Boxes
2. User reviewt in GUI:
   - Block-Typ ändern → Annotation: relabel
   - Kommentar hinzufügen → Annotation: add_comment
   - Box verschieben → Annotation: move
3. User klickt "Re-Analyse mit Feedback"
4. Backend sammelt alle Annotationen
5. Lokales LLM (qwen2.5) bekommt:
   - Original-IR (JSON)
   - User-Annotationen (JSON)
   - Aufgabe: "Wende Korrekturen an, verfeinere Klassifikationen"
6. Neue IR wird generiert
7. User reviewt erneut oder exportiert
```

### LLM-Prompt für zweiten Lauf

```
Du bist ein DSA5-PDF-Analyse-Experte.

INPUT:
- Original-IR: {ir_json}
- User-Korrekturen: {annotations_json}

AUFGABE:
1. Wende jede User-Annotation auf die IR an
2. Für 'relabel': Ändere blockType auf den vom User gewählten Typ
3. Für 'add_comment': Berücksichtige den Kommentar bei der Klassifikation
4. Wenn Kommentar sagt "Das ist ein NSC-Profil", klassifiziere als 'npc_profile'
5. Wenn Kommentar sagt "Statblock", klassifiziere als 'stat_block'
6. Verfeinere alle unbekannten/poor-confidence Blöcke basierend auf Kontext

OUTPUT:
- Vollständige neue IR im gleichen JSON-Format
- Nur geänderte Blöcke im diff-Format für den User
```

### API-Endpunkt

```
POST /sessions/{id}/reanalyze
Body: {
  "strategy": "llm_feedback",  // oder "marker_ocr"
  "model": "qwen2.5:7b",
  "annotations": [...]  // optional, sonst aus Session laden
}
```

### Wann welche Strategie?

| Szenario | Strategie | Warum |
|----------|-----------|-------|
| User will schnellen Export, keine Nacharbeit | Marker OCR | Bester Text, keine Boxen |
| User will Boxen prüfen/korrigieren | Tesseract + LLM-Re-Analysis | Bounding-Boxes + User-Feedback |
| User hat OCR gut, aber Typen falsch | Tesseract + LLM-Re-Analysis | Nur Klassifikation fixen |
| User hat komplexes Layout | Tesseract + manuelle Nacharbeit | Keine Automation möglich |

## Nächste Schritte

1. ✅ GUI-Nacharbeit implementiert (Block-Typ, Kommentar, Löschen)
2. 🔄 Re-Analyse-Endpunkt implementieren
3. 🔄 LLM-Prompt für qwen2.5 optimieren
4. 🔄 Playwright-Test für End-to-End (Upload → Review → Re-Analyse → Export)
5. 🔄 Marker als optionaler Backend (später)

## Datenschutz

- Alle Prozesse lokal auf Mac mini
- Kein Cloud-LLM für sensitive PDFs
- qwen2.5:7b (4.7 GB) passt in 16 GB RAM
- Marker-Modelle (~2 GB) auf externer SSD
