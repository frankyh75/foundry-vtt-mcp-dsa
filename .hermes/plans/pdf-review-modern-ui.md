# PDF-Review Moderne UI — Integrationsplan

## Aktueller Stand (05.05.2026)

### Erledigt in dieser Session
- Backend-Pfad-Bug repariert (`pdftoppm` generiert jetzt korrekte PNG-Pfade)
- `getPageImageUrl` von `async` auf synchron geändert (kein `[object Promise]` mehr)
- SVG-Canvas mit `data-testid="page-canvas"` versehen
- Moderne Toolbar (`EditorToolbar`) in `App.tsx` integriert
- `PropertyPanel` in die rechte Detail-Spalte eingebunden
- `activeTool`-State und `editTextValue`-State in `App.tsx` ergänzt
- `applySelectedDelete`-Funktion für PropertyPanel-Lösch-Action erstellt
- Root-Stack-Command von `--host 192.168.178.133` auf `--host 0.0.0.0` geändert

### Noch offen / verbleibend
1. **PDF-Hintergrund sichtbar?** → Visuell noch zu verifizieren; Technisch sollte es funktionieren (Bugfixes sind drin)
2. **Block-Click auf dem Canvas** müssen nun mit PropertyPanel statt mit alter `detail-grid` interagieren
3. **Die Beispielseite/Session** ist noch überladen — es gibt keine Möglichkeit, nur eine Seite zu reviewen statt alle Blöcke gleichzeitig
4. **Playwright-Tests** nur Basis (3 Tests), keine visuellen Assertions
5. **Hermes /goal** wurde noch nicht formal erstellt

## Ziel

Das modernere Layout aus dem Screenshot (3. Mai 2026) vollständig aktivieren:

- PDF-Hintergrund im Canvas sichtbar
- Moderne Toolbar mit Icons (Auswählen, Box zeichnen, Teilen, Vereinigen, Löschen, Text korrigieren, KI-Chat)
- PropertyPanel auf der rechten Seite mit DSA-Typ-Badge-Grid
- ClassificationBox mit Farben
- Weniger überladen: Import-Wizard optional ein-/ausblendbar, JSON-Panel optional
- GUI-Tests via Playwright mit Screenshots

## Aufgaben

### Phase 1: Visuelle Verifikation (jetzt)
1. Browser-Test: Session laden → PDF-Hintergrund sichtbar?
2. Block klicken → PropertyPanel zeigt Detail?
3. Screenshot für die Dokumentation

### Phase 2: Layout abschließen
1. Import-Wizard in App.tsx optional machen (zusammenklappbar oder unterhalb verschieben)
2. JSON/Debug-Panel hinter "Expertenansicht"-Toggle verstecken
3. Block-Boxen im Canvas: Label-Texte kürzer machen (nur Typ, kein Volltext)

### Phase 3: Tests ausbauen
1. Playwright: Toolbar-Buttons sichtbar prüfen
2. Playwright: Block klicken → PropertyPanel öffnet sich
3. Playwright: Classification-Grid zeigt alle DSA-Typen
4. Playwright: Screenshot-Vergleich für visuelle Regression

### Phase 4: Cleanup & Commit
1. `npm run typecheck` → grün
2. `npm run build` → grün
3. `npx playwright test` → grün
4. Altes Backup (`App.tsx.modern-bak`, `App.tsx.backup`) entfernen
5. Git-Commit mit sauberer Message
