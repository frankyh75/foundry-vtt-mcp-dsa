# Bewertung: PDF-Review-Workbench für DSA5-Abenteuer

Stand: 2026-05-10  
Branch-Kontext: `feat/pdf-review-local-config-toolchain`

## Kurzfazit

Das Projekt ist eine gute Wahl für einen lokalen DSA-Abenteuerbuch-PDF-Extractor, aber nicht als "fertiges Extraktionsprodukt". Es ist in seiner jetzigen Form vor allem eine starke **Review-Workbench mit lokaler Import-Pipeline**. Genau das ist für DSA5-Abenteuer der richtige Ansatz, weil OCR, Layout und Buchstruktur in der Praxis fast immer Korrekturen brauchen.

Die beste Stärke des Projekts ist nicht das reine Auslesen von PDF-Text, sondern die Kombination aus:

- lokalem Ingest
- OCR-/Layout-Pipeline
- IR als stabile Zwischenrepräsentation
- Review-UI mit manueller Korrektur
- Importplan für Foundry

Für Buchabenteuer ist das produktiv, weil es den typischen Fehler vermeidet, alles sofort in Foundry zu schreiben. Stattdessen wird aus dem PDF erst eine kontrollierbare, korrigierbare Struktur.

## Einordnung im Gesamtprojekt

Dein Foundry-MCP-Projekt wirkt insgesamt wie eine **Import- und Automationsplattform** für Foundry VTT, nicht wie ein einzelnes Tool. Der PDF-Review-Teil ist darin ein sehr sinnvoller Baustein:

- Foundry ist das Zielsystem.
- MCP ist die Brücke bzw. Orchestrierung.
- Der PDF-Review-Teil ist die lokale Vorstufe für Buchabenteuer.

Das ist architektonisch stimmig, solange die Review-Workbench nicht versucht, selbst das ganze Produkt zu werden. Sie sollte die Stelle sein, an der du aus unstrukturiertem Abenteuerbuchmaterial verlässliche, reviewbare Daten machst.

## Was daran gut ist

### 1. Lokal-first ist die richtige Produktentscheidung

Für DSA-Abenteuerbücher ist lokale Verarbeitung nicht nur ein Nice-to-have, sondern ein echter Produktvorteil:

- keine Cloud-Abhängigkeit
- bessere Kontrolle über Copyright- und Datenschutzfragen
- reproduzierbare Verarbeitung
- bessere Offline-Fähigkeit

Gerade beim Import von Buchabenteuern ist das ein sehr starkes Argument.

### 2. Review-first ist für Abenteuer realistisch

Die wichtigste Designentscheidung ist nicht OCR, sondern Review-first.

Warum das wichtig ist:

- OCR produziert fast immer Fehler.
- DSA-Layouts sind visuell komplex.
- Kapitel, Szenen, Regelboxen und Meisterwissen sind semantisch wichtiger als bloßer Text.
- Der Nutzer will am Ende nicht "Text", sondern strukturierte Foundry-Objekte.

Die Workbench passt dazu, weil sie das Laden, Prüfen, Korrigieren und Exportieren unterstützt.

### 3. Die IR-Schicht ist der richtige Kern

Die IR ist der eigentliche Hebel. Solange die Zwischenrepräsentation sauber bleibt, kann man später:

- bessere Heuristiken einbauen
- andere OCR-Engines austauschen
- Importpläne anpassen
- neue Exportziele ergänzen

Das Projekt wirkt so, als würde es genau in diese Richtung wachsen.

### 4. DSA5-spezifische Logik ist im richtigen Layer

Die DSA5-Spezifik sitzt nicht im generischen Foundry-Kern, sondern in systemnahen Dateien. Das ist gut, weil es die langfristige Wartbarkeit verbessert.

## Browser- und GUI-Eindruck

Ich habe die UI lokal mit Playwright gegen die laufende Instanz auf `http://127.0.0.1:4173` geprüft und eine echte Session aus `~/.foundry-mcp/pdf-review` geladen.

### Positive Beobachtungen

- Die UI lädt zuverlässig.
- Backend-Status wird sichtbar angezeigt.
- Session-Laden funktioniert.
- Die Toolbar ist klar und vollständig.
- Die Seitenliste und der Viewer sind für Review-Zwecke brauchbar.
- Auf einer realen PDF-Seite mit vielen Overlays bleibt die Oberfläche noch bedienbar.

### Sichtbarer Screenshot-Eindruck

Die Oberfläche ist dunkel, kompakt und funktional. Sie wirkt eher wie ein Arbeitswerkzeug als wie eine hübsche Demo. Das ist für diesen Use Case richtig.

Besonders positiv:

- linke Spalte für Workflow und Seiten
- mittige PDF-Fläche mit Overlays
- rechte Spalte für Korrektur und JSON

Das ist für Review tatsächlich ein brauchbares Informationslayout.

### Was im Browser aufgefallen ist

Es gibt einen echten Canvas-Render-Fehler:

> `Cannot use the same canvas during multiple render() operations`

Das trat beim Laden der Session im Browser auf. Das ist wahrscheinlich eine Race Condition in der PDF-Renderlogik. Funktional scheint die UI trotzdem zu arbeiten, aber das ist ein echter Stabilitätsmangel.

Relevante Stellen:

- [`packages/pdf-review-ui/src/App.tsx`](../packages/pdf-review-ui/src/App.tsx)
- insbesondere die Render-Logik um den PDF-Canvas und das Session-Laden

Zusätzlich ist aufgefallen:

- Der `KI-Chat`-Button ist sichtbar, aber aktuell nur ein Stub.
- Ein klarer Umschalter zwischen Quelle und Projektion ist im UI nicht sichtbar, obwohl die Zustände im Code existieren.
- Die E2E-Tests scheinen teilweise nicht mehr exakt zur aktuellen UI zu passen.

## Architektur-Bewertung

### Sehr gut

Die Pipeline-Idee ist stimmig:

1. Ingest
2. OCR/Layout
3. IR-Aufbau
4. Annotationen
5. Importplan
6. Review in UI

Das ist für DSA-Abenteuer die richtige Form von Komplexität.

### Noch nicht ganz sauber

Ein paar Schichten sind bereits gut getrennt, aber noch nicht perfekt:

- `layout_ocr.ts` macht neben OCR auch schon semantische Vorannahmen.
- `ir_assembly.ts` formt die Daten canonisch, was gut ist, aber die Grenzen zu den heuristischen Vorstufen könnten noch klarer werden.
- Der GUI-Code ist funktional, aber groß und enthält mehrere Verantwortlichkeiten in einer Datei.

Das ist nicht ungewöhnlich in einem aktiven Prototyp, aber für ein robustes Produkt sollte das schrittweise aufgeteilt werden.

### KI-Chat

Der aktuelle KI-Chat-Stummel ist aus meiner Sicht eher Ballast als Feature. Für die aktuelle Phase würde ich ihn:

- entweder entfernen
- oder klar als experimentell markieren

Wenn Chat, dann später als echter lokaler Assistenzmodus mit sauberem Kontext aus selektierten Blöcken.

## OCR- und Modellbewertung

Die aktuelle OCR-Reihenfolge `auto = tesseract -> marker -> surya` ist als Default vertretbar, weil sie schnell und konservativ startet. Für DSA-Bücher ist das aber nicht automatisch die beste Qualitätsreihenfolge.

Meine Einschätzung:

- Für schnelle Verarbeitung: gut.
- Für Qualität auf schwierigen Scans: nicht immer optimal.
- Für Produktreife: wahrscheinlich braucht ihr Qualitätsprofile statt nur eine Kette.

Marker und Surya sind besonders interessant für komplexe Layouts, Tabellen und moderne OCR-Pipelines. Das spricht dafür, sie nicht nur als Fallback zu behandeln, sondern als eigene Modi.

## Was ich als größte Risiken sehe

### 1. UX-Risiko: Canvas-Race

Das ist aktuell der klarste technische Mangel im Browser-Check.

### 2. Produkt-Risiko: zu früh zu viele Assistenten-Features

Wenn ihr zu früh Chat, Assistenz und generische LLM-Features ausbaut, bevor Extraktion und Review robust sind, wächst Komplexität schneller als Nutzen.

### 3. Datenmodell-Risiko: Review-Annotationen und IR müssen synchron bleiben

Wenn UI, IR-Schema und Persistenz auseinanderlaufen, wird Review unzuverlässig. Das ist bei einem Importwerkzeug fatal, weil Vertrauen wichtiger ist als reine Feature-Zahl.

### 4. Test-Risiko: UI-Tests und echte UI drifteten bereits auseinander

Das ist ein starkes Signal, dass Browser-Tests und aktuelle Komponentennamen/Selektoren wieder angeglichen werden sollten.

## Wie man am meisten aus dem Projekt herausholt

### Empfehlung 1: IR als zentrales Produktobjekt behandeln

Die IR sollte nicht nur ein technisches Zwischenformat sein. Sie ist das eigentliche Produkt:

- sie beschreibt die Struktur des Buchs
- sie trägt Review-Ergebnisse
- sie bestimmt den Importplan
- sie bleibt exportierbar und wiederverwendbar

### Empfehlung 2: DSA5-Semantik stärker machen

Für Buchabenteuer sind diese Semantiken besonders wichtig:

- Kapitel
- Szene
- Ort
- NSC
- Meisterwissen
- Vorlesetext
- Regelbox
- Tabelle
- Illustration
- Stimmungsblock

Je besser diese semantische Vorstruktur ist, desto weniger manuelle Korrektur brauchst du später.

### Empfehlung 3: Importplan vor UI-Magie

Der entscheidende Output ist nicht das hübsche Overlay, sondern der Importplan für Foundry:

- Journale
- Szenen
- Actors
- Items
- Stubs
- Encounters

Wenn der Importplan zuverlässig wird, fühlt sich das Produkt wirklich nützlich an.

### Empfehlung 4: Review-Gates konsequent beibehalten

Für Buchabenteuer ist das Review-Gate kein Luxus, sondern Kernfunktion:

- keine direkten Schreiboperationen ohne Review
- keine unklaren automatischen Datenflüsse
- immer eine Möglichkeit zur Korrektur

Das ist wahrscheinlich der wichtigste Produktwert des gesamten Projekts.

### Empfehlung 5: Release-Weg pragmatisch halten

Für diese Phase würde ich eher einen einfachen ZIP-/Preview-Release bevorzugen als sofort einen komplexen Installer-Workflow.

Warum:

- weniger Verpackungsaufwand
- schneller iterieren
- gut für lokale Entwickler- und Power-User-Workflows

Ein Installer lohnt sich eher, wenn das Tool wirklich für Endanwender oder häufige Team-Nutzung stabilisiert wird.

## Gesamturteil in einem Satz

Das Projekt ist eine sehr gute Basis für einen DSA5-Abenteuerbuch-Extractor, wenn das Ziel nicht "vollautomatisches Auslesen", sondern "lokale, reviewbare und effiziente Foundry-Import-Pipeline" ist.

## Bewertungsskala

- Produkt-Fit für DSA5-Buchimport: 8.5/10
- Architektur-Fit: 8/10
- UI-Fit: 7.5/10
- Stabilität aktuell: 6.5/10
- Potenzial mit den nächsten 2-3 Iterationen: 9/10

## Konkrete Fragen an Claude Code

Wenn du Claude Code nach seiner Meinung fragen willst, ist das hier ein guter Prompt:

> Bitte bewerte dieses Projekt als DSA5-PDF-Extractor für Buchabenteuer.  
> Schwerpunkt: lokale OCR/Review-Pipeline, IR-Architektur, Foundry-Importplan und UI-Workflow.  
> Sag mir ehrlich, ob die Architektur eher produktreif, prototypisch oder riskant ist.  
> Nenne bitte die drei wichtigsten technischen Risiken und die drei wichtigsten Prioritäten für die nächsten Änderungen.  
> Achte besonders auf:  
> - `layout_ocr.ts` vs. `ir_assembly.ts`  
> - OCR-Engine-Strategie  
> - Review-UI und Canvas-Rendering  
> - DSA5-Adapter-Abgrenzung  
> - Release-/Packaging-Strategie

## Mein Schlussbild

Wenn das Ziel ist, Buchabenteuer möglichst einfach und effizient in Foundry zu importieren, dann ist diese Richtung richtig.  
Nicht perfekt, aber klar gut genug, um daraus ein starkes Produkt zu machen.

Der größte Gewinn entsteht nicht durch immer mehr Automatisierung, sondern durch:

- bessere Zwischenstruktur
- weniger falsche Annahmen
- saubere Review-Schritte
- stabile Importpläne
- lokale, austauschbare Engines

Genau dort liegt das Potenzial dieses Projekts.
