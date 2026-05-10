# Verbesserungsbericht: PDF-Review-Workbench

Stand: 2026-05-10  
Branch: `feat/pdf-review-local-config-toolchain`  
Basis: Code-Analyse der Kernmodule + Bewertung `pdf-review-workbench-bewertung.md`

---

## Zusammenfassung

Dieser Bericht dokumentiert konkrete Verbesserungsvorschläge für die PDF-Review-Workbench auf Basis einer direkten Code-Analyse. Er ist nach Dringlichkeit sortiert und enthält für jeden Punkt die betroffene Datei, das Problem und einen konkreten Lösungsweg.

Die Architektur ist grundsätzlich richtig — IR-Schicht, Pipeline-Orchestrator, Review-Gate. Aber es gibt zwei konkrete Bugs und einen strukturellen Schuldenblock in der UI, die behoben werden müssen, bevor das System produktiv nutzbar ist.

---

## Kritisch — sofort beheben

### K1: Bug in `foundry_mapping.ts` — `missingFields` immer belegt

**Datei:** [`packages/mcp-server/src/adventure-import/pdf/foundry_mapping.ts`](../packages/mcp-server/src/adventure-import/pdf/foundry_mapping.ts)  
**Zeile:** 69–71

**Problem:**

```typescript
if (stubType === 'npc_stub') {
  if (!isPresent(minimumPayload.name)) fields.push('name');
  fields.push('attributes', 'skills');  // immer, egal was im payload steht
}
```

`attributes` und `skills` werden bedingungslos in `missingFields` eingetragen — unabhängig davon, ob diese Felder im `minimumPayload` vorhanden sind. Identisches Muster bei `location_stub` (`description`, `sceneLinks`) und `scene_stub` (`trigger`, `summary`).

**Konsequenz:** `missingFields.length > 0` ist für jeden Stub immer wahr, daher ist `requiresReview` immer `true`. Der Importplan markiert jeden einzelnen Eintrag als unvollständig — auch wenn er vollständige Daten enthält. Das macht den Importplan als Qualitätssignal wertlos.

**Lösung:**

```typescript
function mapMissingFields(
  stubType: AdventurePdfEntityStubV1['stubType'],
  minimumPayload: Record<string, unknown>,
): string[] {
  const fields: string[] = [];
  if (stubType === 'npc_stub') {
    if (!isPresent(minimumPayload.name)) fields.push('name');
    if (!isPresent(minimumPayload.attributes)) fields.push('attributes');
    if (!isPresent(minimumPayload.skills)) fields.push('skills');
  }
  if (stubType === 'location_stub') {
    if (!isPresent(minimumPayload.name)) fields.push('name');
    if (!isPresent(minimumPayload.description)) fields.push('description');
    if (!isPresent(minimumPayload.sceneLinks)) fields.push('sceneLinks');
  }
  if (stubType === 'scene_stub') {
    if (!isPresent(minimumPayload.title)) fields.push('title');
    if (!isPresent(minimumPayload.trigger)) fields.push('trigger');
    if (!isPresent(minimumPayload.summary)) fields.push('summary');
  }
  return Array.from(new Set(fields));
}
```

**Aufwand:** ~30 Minuten. Bestehende Tests für `foundry_mapping.ts` müssen angepasst werden.

---

### K2: Typ-Duplikation in `App.tsx`

**Datei:** [`packages/pdf-review-ui/src/App.tsx`](../packages/pdf-review-ui/src/App.tsx)  
**Zeilen:** 10–68

**Problem:**

App.tsx definiert `PdfBlock`, `PdfPage`, `PdfAnnotation`, `PdfIr` als lokale Typen — parallel zu den kanonischen Zod-Schemas in `ir.ts`. Diese zwei Definitionen werden zwangsläufig auseinanderlaufen, sobald `ir.ts` erweitert wird (neues Feld, neuer Block-Typ etc.).

Konkret:
- `PdfAnnotation.action` in App.tsx enthält `'add_comment'`, das im `annotationActionSchema` in `ir.ts` fehlt.
- `PdfIr.sections` ist in App.tsx als `Array<Record<string, unknown>>` typisiert, in `ir.ts` als vollständig strukturiertes `AdventurePdfSectionV1[]`.

**Lösung:**

Ein `shared`-Package (oder eine barrel-Exportdatei in `mcp-server/src/adventure-import/pdf/`) exportiert die abgeleiteten TypeScript-Typen aus den Zod-Schemas:

```typescript
// ir_types.ts (neues shared export)
export type PdfBlock = z.infer<typeof blockSchema>;
export type PdfPage = z.infer<typeof pageSchema>;
export type PdfAnnotation = z.infer<typeof annotationSchema>;
export type PdfIr = z.infer<typeof adventureLayoutIrV1Schema>;
```

App.tsx importiert diese statt eigene Typen zu definieren. Das erzwingt zur Compile-Zeit, dass UI und Backend dasselbe Schema haben.

**Aufwand:** 1–2 Stunden für den Export + Import-Umbau in App.tsx.

---

## Hoch — nächste Iteration

### H1: `App.tsx` — God Component aufteilen

**Datei:** [`packages/pdf-review-ui/src/App.tsx`](../packages/pdf-review-ui/src/App.tsx)  
**Umfang:** 1811 Zeilen

**Problem:**

Folgende Verantwortlichkeiten liegen alle in einer Datei:
- PDF-Canvas-Rendering mit pdf.js (inklusive Lifecycle-Management)
- Session-Laden und -Persistenz via Backend-API
- Block-Auswahl, -Annotation und -Relabeling
- Importplan-Darstellung
- OCR-Konfigurations-Panel
- Backend-Healthcheck
- KI-Chat-Stub
- Workflow-Stepper

Das Canvas-Race-Condition-Problem ("Cannot use the same canvas during multiple render() operations") ist direkt auf fehlende Isolation der Canvas-Lifecycle-Logik zurückzuführen. Weil Canvas-Ref, Session-State und Render-Trigger alle im selben React-Scope liegen, führen schnelle State-Updates zu parallelen `render()`-Aufrufen auf demselben Canvas.

**Vorgeschlagene Aufteilung:**

```
src/
├── App.tsx                    (~200 Zeilen — nur Layout + Routing)
├── components/
│   ├── PdfCanvasRenderer.tsx  (isolierter Canvas + pdf.js lifecycle)
│   ├── SessionSidebar.tsx     (Workflow-Stepper + Seitenliste)
│   ├── BlockAnnotationPanel.tsx (Block-Auswahl + Annotationsformen)
│   ├── ImportPlanPanel.tsx    (Importplan-Anzeige + Export)
│   └── OcrConfigPanel.tsx     (OCR-Engine-Auswahl + Profil)
├── hooks/
│   ├── useIrSession.ts        (Backend-Calls + IR-Zustand + Persistenz)
│   ├── usePdfRenderer.ts      (Canvas-Ref + Seiten-Rendering + Cleanup)
│   └── useAnnotations.ts      (Annotation-Zustand + Dispatch-Logik)
└── dsaTypes.ts                (bereits vorhanden)
```

**Wichtigster erster Schritt:** `PdfCanvasRenderer.tsx` als eigenständige Komponente extrahieren, die:
- einen eigenen `useRef<HTMLCanvasElement>` verwaltet
- das `pdfjs.getPage().render()`-Promise mit einem Abort-Flag abfängt
- bei Unmount den laufenden Render abbricht

Das behebt die Race Condition strukturell, nicht durch einen Workaround.

**Aufwand:** 4–8 Stunden für PdfCanvasRenderer + useIrSession. Vollständige Aufteilung: ~1–2 Tage.

---

### H2: Text-Layer-Seiten erzeugen einen Block pro Seite

**Datei:** [`packages/mcp-server/src/adventure-import/pdf/layout_ocr.ts`](../packages/mcp-server/src/adventure-import/pdf/layout_ocr.ts)  
**Zeilen:** 58–63

**Problem:**

Wenn eine Seite einen extrahierbaren Text-Layer hat, erzeugt `layoutOcrPdf()` genau einen `PdfLayoutRawBlock` für die gesamte Seite via `buildTextLayerBlock()`. Die Heuristiken in `heuristics_classification.ts` laufen dann auf diesem Gesamtblock.

DSA-Bücher haben jedoch typischerweise:
- Zweispaltige Layouts
- Vorlesetext-Boxen (grau hinterlegt oder gerahmt)
- Meisterwissen-Kästen
- Stimmungsblöcke und Zitate
- Statblöcke (tabellarisch, mehrzeilig)

Ein Gesamtblock pro Seite macht es unmöglich, diese Strukturen zu unterscheiden. Eine Vorlesetext-Box mitten auf der Seite ist textlich nicht von Fließtext zu trennen, wenn alles in einem Block landet.

**Lösung:**

Für Text-Layer-Seiten eine Zeilentrennung auf Basis von Leerzeilen oder Einrückungsmustern vornehmen. Eine pragmatische Minimalversion:

```typescript
function splitTextIntoBlocks(text: string, minBlockLength: number = 20): string[] {
  // Leere Zeilen als Trennmerkmal
  return text
    .split(/\n{2,}/)
    .map(s => s.trim())
    .filter(s => s.length >= minBlockLength);
}
```

Das erzeugt aus einem Seitentext mehrere Blöcke, auf die die Heuristiken einzeln angewendet werden können.

Mittelfristig: Marker oder Surya für Text-Layer-Seiten nutzen, um Bounding-Boxes zu bekommen — nicht nur den reinen Text.

**Aufwand:** ~2 Stunden für die einfache Zeilentrennung. Vollständige bbox-basierte Segmentierung: Aufwand abhängig von Marker/Surya-Integration.

---

### H3: Foundry-Mapping erzeugt leere Akteur-Schalen

**Datei:** [`packages/mcp-server/src/adventure-import/pdf/foundry_mapping.ts`](../packages/mcp-server/src/adventure-import/pdf/foundry_mapping.ts)  
**Zeilen:** 89–95

**Problem:**

Ein NPC-Stub erzeugt nach dem Mapping diesen Foundry-Payload:

```json
{
  "name": "Bäuerin Marta",
  "notes": "Aus PDF importiert. Bitte manuell pruefen.",
  "summary": "",
  "sourceBlockIds": ["..."]
}
```

Das ist ein leerer Foundry-Aktor ohne DSA5-Attribute, Kampfwerte, Skills oder Spezies. Der Import produziert Schalen, keine spielbaren Akteure.

**Lösung:**

`buildPlanPayload()` sollte DSA5-Felder aus `minimumPayload` extrahieren und in das Foundry-Schema übersetzen:

```typescript
if (stub.stubType === 'npc_stub') {
  return {
    name: stub.label,
    type: 'npc',
    system: {
      // Aus minimumPayload extrahieren, falls vorhanden
      characteristics: extractAttributes(stub.minimumPayload),
      status: {
        wounds: extractWounds(stub.minimumPayload),
      },
      details: {
        species: stub.minimumPayload.species ?? '',
        career: stub.minimumPayload.career ?? '',
      },
    },
    notes: 'Aus PDF importiert. Bitte manuell pruefen.',
    sourceBlockIds: [...stub.sourceBlockIds],
  };
}
```

Felder, die nicht extrahiert werden konnten, bleiben leer und werden als `missingFields` markiert (nach Fix K1).

**Aufwand:** 2–4 Stunden. Erfordert Abstimmung mit dem DSA5-Aktor-Schema aus `packages/mcp-server/src/systems/dsa5/`.

---

## Mittel — übernächste Iteration

### M1: `heuristics_classification.ts` — NPC-Vokabular erweitern

**Datei:** [`packages/mcp-server/src/adventure-import/pdf/heuristics_classification.ts`](../packages/mcp-server/src/adventure-import/pdf/heuristics_classification.ts)  
**Zeile:** 294

**Problem:**

Das aktuelle NPC-Erkennungsvokabular:

```typescript
/\b(wirt(in)?|händler(in)?|meister(in)?|bäuer(in)?|jäger(in)?|priester(in)?|guard|wachen?|schreiber(in)?|npc)\b/i
```

Typische DSA-Buchcharaktere werden damit nicht erkannt: `Alrik`, `Hauptmann`, `Ratsherr`, `Zauberer`, `Söldner`, `Leibwächter`, `Diener`, `Magier`, `Hexe`, `Geweihter`, `Druide`, `Schankwirt` usw.

**Lösung:**

```typescript
const DSA_NPC_ROLES = [
  'wirt(in)?', 'händler(in)?', 'meister(in)?', 'bäuer(in)?',
  'jäger(in)?', 'priester(in)?', 'geweihte[rn]?', 'geweihter',
  'wachen?', 'hauptmann', 'ratsherr', 'bürgermeister',
  'söldner(in)?', 'leibwächter(in)?', 'magier(in)?', 'hexe',
  'druide', 'druiden?', 'schreiber(in)?', 'diener(in)?',
  'zauberer', 'zauberin', 'kundschafter(in)?',
  'räuber(in)?', 'schankwirt(in)?', 'npc',
];
const npcRolePattern = new RegExp(`\\b(${DSA_NPC_ROLES.join('|')})\\b`, 'i');
```

Außerdem: Die Threshold-Logik anpassen. Derzeit braucht ein Block SOWOHL einen NPC-Rollenname ALS AUCH einen Eigennamen für Score 0.72. Ein alleinstehender Statblock ohne Rollenwort erreicht nur Score 0.05. Das verfehlt echte DSA-Statblöcke, die oft nur mit Namen beginnen.

**Aufwand:** ~1 Stunde.

---

### M2: Sections werden aus dem ersten Block inferiert — Abschnittsgrenzen fehlen

**Datei:** [`packages/mcp-server/src/adventure-import/pdf/heuristics_classification.ts`](../packages/mcp-server/src/adventure-import/pdf/heuristics_classification.ts)  
**Zeile:** 108–126

**Problem:**

Der `sectionType` einer Section wird aus dem ersten Block der Section inferiert. Das bedeutet: wenn der erste Block ein Heading ist (das eine Szene ankündigt), aber das Heading selbst keine NPC/Location/Scene-Keywords enthält, bleibt der `sectionType` `'unknown'`.

In DSA-Büchern stehen Kapitelüberschriften oft als kurze, nicht-beschreibende Titel (`"3. Die Mühle"`, `"Das Verhör"`). Diese werden als `heading_short_title.v1` erkannt, aber der `sectionType` bleibt `unknown`.

**Lösung:**

Section-Typ nicht nur aus dem ersten Block inferieren, sondern aus den ersten 2–3 Blöcken akkumulieren. Wenn irgendein Block in den ersten 3 Blöcken einen NPC/Location/Scene-Score ≥ 0.45 hat, gilt das für die gesamte Section.

**Aufwand:** ~2 Stunden.

---

### M3: `ir_assembly.ts` ist zu dünn — Section-Grenzen fehlen

**Datei:** [`packages/mcp-server/src/adventure-import/pdf/ir_assembly.ts`](../packages/mcp-server/src/adventure-import/pdf/ir_assembly.ts)  
**Umfang:** 106 Zeilen

**Problem:**

`ir_assembly.ts` erzeugt Sections auf Basis von Heading-Blöcken. Die Logik ist korrekt, aber minimal: eine Section endet genau dort, wo die nächste beginnt. Es gibt keine Behandlung von:
- Seiten ohne Heading (Section läuft über mehrere Seiten ohne neues Heading)
- Heading in der Mitte einer inhaltlich zusammenhängenden Section
- Kapitel-Hierarchien (Section-Level 1 enthält mehrere Section-Level 2)

**Lösung:**

Hierarchische Sections: Headings mit hohem Score (Kapitel-Heading, z.B. `heading_numbered.v1`) erzeugen Parent-Sections. Headings mit niedrigerem Score erzeugen Sub-Sections. Das benötigt ein zweistelliges `sectionDepth`-Feld im `AdventurePdfSectionV1`-Schema.

**Aufwand:** 3–5 Stunden. Erfordert Schema-Erweiterung in `ir.ts`.

---

### M4: E2E-Tests driften von der UI

**Verzeichnis:** [`packages/pdf-review-ui/e2e/`](../packages/pdf-review-ui/e2e/)

**Problem:**

Die bestehende Bewertung hat festgestellt, dass E2E-Tests und aktuelle UI-Selektoren auseinandergegangen sind. Das ist ein starkes Signal, dass die Tests nicht Teil der normalen Entwicklungsschleife waren.

**Lösung:**

Playwright-Tests auf die aktuelle UI anpassen und in die CI-Pipeline einbinden (als eigener Job, nicht als Teil des Unit-Test-Runs, da sie einen laufenden Dev-Server benötigen). Mindestens diese Pfade testen:
1. Session laden
2. Seite navigieren, PDF-Canvas rendern
3. Block auswählen + Annotieren (Relabel)
4. Importplan anzeigen

**Aufwand:** 2–4 Stunden.

---

## Niedrig — gut zu haben

### N1: KI-Chat-Stub entfernen oder klar deaktivieren

**Datei:** [`packages/pdf-review-ui/src/App.tsx`](../packages/pdf-review-ui/src/App.tsx)

Der KI-Chat-Button ist sichtbar, aber nicht funktional. Das verwirrt Nutzer und macht die UI unprofessioneller als sie ist. Entweder entfernen oder hinter ein Feature-Flag. Wenn Chat: dann als echter lokaler Assistenzmodus mit Kontext aus selektierten Blöcken, nicht als generisches Chat-Widget.

---

### N2: OCR-Qualitätsprofile statt fester Kette

**Datei:** [`packages/mcp-server/src/adventure-import/pdf/tooling.ts`](../packages/mcp-server/src/adventure-import/pdf/tooling.ts) und `review_config.ts`

Die aktuelle Kette `auto = tesseract → marker → surya` ist für einfache Textseiten sinnvoll. Für DSA-Bücher mit komplexen Layouts (Tabellen, Statblöcke, mehrspaltig) sind Marker und Surya nicht Fallback, sondern bessere Erste-Wahl.

Vorschlag: Konfigurierbare OCR-Profile:
- `fast` — nur Tesseract (schnell, ausreichend für einfache Textseiten)
- `quality` — Surya oder Marker bevorzugt (besser für Layout-intensive Seiten)
- `statblock` — Surya mit erhöhter Tabellenempfindlichkeit

**Aufwand:** 2–3 Stunden Konfigurationsumbau.

---

### N3: `provenance`-Feld für Review-Annotationen

**Datei:** [`packages/mcp-server/src/adventure-import/pdf/annotation_store.ts`](../packages/mcp-server/src/adventure-import/pdf/annotation_store.ts)

Annotationen haben bereits ein `provenance`-Feld. Es sollte für manuelle Annotationen immer `producer: 'manual_review'` und den Zeitstempel tragen — damit im IR nachvollziehbar ist, welche Klassifikationen vom Heuristik-System stammen und welche manuell korrigiert wurden. Das ist wichtig für spätere Qualitätsauswertung.

---

## Zusammenfassung: Prioritätsliste

| Nr | Datei | Problem | Aufwand | Prio |
|----|-------|---------|---------|------|
| K1 | `foundry_mapping.ts` | `missingFields` immer belegt — Bug | 30 min | Kritisch |
| K2 | `App.tsx` | Typ-Duplikation vs. `ir.ts` | 1–2 h | Kritisch |
| H1 | `App.tsx` | God Component, 1811 Zeilen | 4–8 h | Hoch |
| H2 | `layout_ocr.ts` | Ein Block pro Seite für Text-Layer | 2 h | Hoch |
| H3 | `foundry_mapping.ts` | Foundry-Payload ohne DSA5-Felder | 2–4 h | Hoch |
| M1 | `heuristics_classification.ts` | NPC-Vokabular zu schmal | 1 h | Mittel |
| M2 | `heuristics_classification.ts` | Section-Typ nur aus Block 1 | 2 h | Mittel |
| M3 | `ir_assembly.ts` | Keine Kapitel-Hierarchie | 3–5 h | Mittel |
| M4 | `e2e/` | Tests driften von UI | 2–4 h | Mittel |
| N1 | `App.tsx` | KI-Chat-Stub sichtbar | 30 min | Niedrig |
| N2 | `tooling.ts` | OCR-Qualitätsprofile | 2–3 h | Niedrig |
| N3 | `annotation_store.ts` | Provenance für manuelle Annotationen | 1 h | Niedrig |

---

## Empfohlene Reihenfolge für die nächsten zwei Sprints

**Sprint 1 (Stabilisierung):**
1. K1 — `foundry_mapping.ts` Bug (macht Importplan nutzbar)
2. K2 — Typ-Exporte aus `ir.ts` (verhindert Drift)
3. H1 — `PdfCanvasRenderer.tsx` extrahieren (behebt Race Condition)
4. M4 — E2E-Tests anpassen

**Sprint 2 (Qualität):**
1. H2 — Text-Layer-Segmentierung (verbessert Heuristik-Input)
2. M1 — NPC-Vokabular
3. H3 — DSA5-Payload im Foundry-Mapping
4. N1 — KI-Chat-Stub entfernen

Ab Sprint 3 lohnt sich die vollständige App.tsx-Aufteilung und die Kapitel-Hierarchie in der IR.
