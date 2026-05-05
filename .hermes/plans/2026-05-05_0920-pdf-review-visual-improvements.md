# Plan: PDF-Review-UI — Visualisierung, Beispiel-PDFs und automatisierte GUI-Tests

## Ziel

1. **PDF als Hintergrund** — Die gerenderte Seite muss im Mittelpanel als Hintergrund sichtbar sein, damit Boxen über dem realen PDF-Inhalt liegen.
2. **Bessere Beispiel-PDFs** — Die aktuell geladene Seite hat ~30 überlappende Boxen und ist unbrauchbar. Zwei repräsentative DSA-PDFs (z. B. "Die Wächter" und "Der Hexenhammer") sollen im Review-Data-Verzeichnis liegen und als Testdaten dienen.
3. **GUI-Validierung via Browser-Automation** — Ein reproduzierbarer Weg, die UI automatisch zu prüfen (z. B. mit Playwright, Puppeteer oder einem MCP-Server). Screenshots, DOM-Checks und Funktions-Tests sollen möglich sein.

---

## Aktueller Kontext

### Code-Stand
- **Frontend:** `packages/pdf-review-ui/src/` (React + Vite + SVG-Canvas)
- **Backend:** `packages/mcp-server/src/adventure-import/pdf/review_backend.ts` (Express, Port 4174)
- **Start:** `npm run pdf:review-stack` im Root (neu hinzugefügt)

### Gefundene Probleme
1. **PDF-Hintergrund fehlt** — `SvgCanvas` empfängt `pageImageUrl`, aber `App.tsx` übergibt nur dann ein Bild, wenn `sessionId` gesetzt ist. Der Screenshot zeigt ein Raster-Gitter (`#grid`) statt Seiten-Bild. Das `pageImageUrl` kommt von `getPageImageUrl(sessionId, activePage)` — vermutlich liefert der Backend-Endpunkt `/page-image` oder ähnlich das PNG. Es ist unklar, ob das Bild korrekt generiert wird oder ob der Pfad im Frontend nicht auflösbar ist.
2. **Überladene Beispielseite** — Die geladene Session hat Dutzende Boxen auf einer Seite. Das ist entweder ein schlechtes Test-PDF oder die Analyse-Pipeline produziert zu viele Fragmente.
3. **Keine GUI-Tests** — Keine Test-Infrastruktur für visuelle Regression oder End-to-End.

---

## Schritt-für-Schritt-Plan

### Phase 1: PDF-Hintergrund debuggen und fixen

1. **Backend-Image-Endpunkt prüfen**
   - Datei: `packages/mcp-server/src/adventure-import/pdf/review_backend.ts`
   - Suche nach `/page-image` oder `pageImage` oder `renderPage`
   - Prüfen, ob der Endpunkt ein PNG/JPG zurückgibt und ob der Pfad korrekt ist.

2. **Frontend-Image-URL prüfen**
   - Datei: `packages/pdf-review-ui/src/reviewApi.ts`
   - Funktion `getPageImageUrl` — prüfen, ob sie den richtigen Endpunkt und die richtige URL zurückgibt.
   - Browser-DevTools: Netzwerk-Tab zeigen, ob ein 404 für das Bild kommt.

3. **Fix falls nötig**
   - Wenn der Endpunkt fehlt: `review_backend.ts` erweitern um `/api/session/:sessionId/page/:pageNumber/image` (rendert PDF-Seite als PNG via `pdf2pic` oder `pdftoppm` + `sharp`).
   - Wenn die URL falsch ist: `getPageImageUrl` korrigieren.
   - Wenn das Bild existiert aber nicht angezeigt wird: `SvgCanvas.tsx` prüfen — die `<image>`-SVG-Logik sieht korrekt aus, aber `preserveAspectRatio="none"` kann zu Skalierungsproblemen führen.

### Phase 2: Zwei DSA-PDFs als Testdaten bereitstellen

1. **PDFs beschaffen**
   - "Die Wächter" (GRW-Kurzabenteuer, ~10 Seiten, gemischte Layouts)
   - "Der Hexenhammer" (längeres Abenteuer, komplexe Tabellen, NSC-Profile)
   - Falls Frank keine lokalen Kopien hat: Nachfragen oder aus dem Foundry-Modul-Verzeichnis kopieren.

2. **Testdaten-Ordner**
   - Ziel: `~/.foundry-mcp/pdf-review/test-pdfs/` oder im Repo unter `packages/mcp-server/test/fixtures/`
   - Die PDFs sollten ins Repo committed werden (DSA-PDFs sind gekauft — nur wenn Frank will).

3. **Upload-Shortcut**
   - Im UI: "Test-PDF laden"-Button oder im Backend: Auto-Upload bei `npm run pdf:review-stack`.

### Phase 3: GUI-Validierung via Playwright

1. **Playwright installieren**
   - `npm install -D @playwright/test` im `packages/pdf-review-ui/`
   - `npx playwright install chromium`

2. **Test-Setup**
   - `playwright.config.ts` — Frontend auf `http://192.168.178.133:4173`, Backend auf `4174`
   - Before-All: `npm run pdf:review-stack` starten (oder bereits laufende Instanz voraussetzen)

3. **Erste Tests schreiben**
   - Test 1: "Frontend zeigt PDF-Hintergrund" — Screenshot der Canvas, prüfen ob `<image>`-Element im SVG vorhanden ist.
   - Test 2: "Backend liefert Health-OK" — `fetch('/health')` prüfen.
   - Test 3: "Boxen sind über dem Hintergrund sichtbar" — Screenshot-Comparison mit Baseline.

4. **Alternative: MCP-Playwright**
   - Es gibt einen MCP-Server für Playwright (https://github.com/executeautomation/mcp-playwright). Dieser erlaubt es Jarvis, direkt Browser-Actions durchzuführen: Screenshots, Klicks, DOM-Queries.
   - Vorteil: Jarvis kann selbstständig die GUI testen, ohne einen separaten Test-Runner zu schreiben.

### Phase 4: Boxen-Dichte verbessern

1. **Merge-Heuristik**
   - Wenn die Pipeline zu viele kleine Fragmente produziert: `review_backend.ts` — Post-Processing nach der Analyse, das Boxen mit ähnlichem `blockType` und überlappenden Koordinaten merged.

2. **UI-Filter**
   - Im Frontend: Toggle "Nur Blöcke > X Pixel" oder "Nur bestimmte Typen anzeigen".

---

## Risiken

| Risiko | Wahrscheinlichkeit | Mitigation |
|--------|-------------------|------------|
| Backend-Image-Rendering ist nicht implementiert | Hoch | Neu implementieren mit `pdf2pic` |
| DSA-PDFs dürfen nicht ins Repo | Mittel | Nicht committen, nur lokal nutzen |
| Playwright braucht GUI auf dem Mac mini (kein Display) | Mittel | Headless-Mode + `xvfb` falls nötig |

---

## Offene Fragen

1. Hat Frank zwei DSA-PDFs lokal verfügbar (z. B. im Foundry-Modul oder Downloads)?
2. Soll der MCP-Playwright-Server als Dauer-Tool eingerichtet werden, oder reichen statische Playwright-Tests?
3. Soll die Analyse-Pipeline (zu viele Boxen) verbessert werden, oder erstmal nur die Darstellung?

---

## Dateien, die sich ändern werden

- `packages/pdf-review-ui/src/SvgCanvas.tsx` — Image-Rendering/Scaling fix
- `packages/pdf-review-ui/src/App.tsx` — ggf. Loading-State für Bilder
- `packages/mcp-server/src/adventure-import/pdf/review_backend.ts` — Image-Endpunkt, Merge-Heuristik
- `packages/pdf-review-ui/package.json` — Playwright-DevDependency
- `packages/pdf-review-ui/playwright.config.ts` — neu
- `packages/pdf-review-ui/e2e/*.spec.ts` — neu

---

## Nächster Schritt

1. `review_backend.ts` auf Image-Endpunkt prüfen
2. `reviewApi.ts` auf URL-Generierung prüfen
3. Browser-Network-Tab prüfen (manuell oder via Playwright-MCP)
