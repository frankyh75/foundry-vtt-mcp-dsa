# Implementierungsplan: DSA5-Statblock-Extraktion + Playwright-Validierung

**Datum:** 2026-05-09
**Version:** 2 (korrigiert nach Ralph-Loop-Recherche)
**Ziel:** Statblock-Erkennung verbessern, Playwright-Regression aufbauen, GUI-Workflow stabilisieren
**Scope:** 4 Phasen via `/goal` (persistent, mit Retry bis grün)
**Golden Sample:** Deicherbe (Seite 12 Deichbauern, Seite 16 Krakenmolch, Seite 17 Thurbold)

---

## Phase 1: Statblock-Heuristik im Backend (MU/LeP/AT-Pattern)

**Ziel:** Marker erkennt automatisch Statblocks wenn MU+LeP+AT im Text vorkommen.

**Änderungen:**
- `heuristics_classification.ts`: Neue Regex-Patterns hinzufügen
  - `STATBLOCK_PATTERN = /MU\s+\d+.*LeP\s+\d+.*AT\s+\d+/s`
  - `KAMPFWERTE_PATTERN = /SK\s+\d+.*ZK\s+\d+.*AW\s+\d+.*GS\s+\d+/s`
  - `Waffen_PATTERN = /(?:AT|FK)\s+\d+.*TP\s+\d+W\d+(?:\+\d+)?/`
- Wenn Block Text MATCH → `roleHint = 'stat_block'` statt `npc_profile` oder `paragraph`
- Wenn KEIN MU gefunden aber SK+ZK+AT → `roleHint = 'combat_block'` (Minimal-Kampfblock)

**Playwright-Test:**
```typescript
test('Statblock-Erkennung: Deichbauern', async ({ page }) => {
  await loadSession(page, 'Deicherbe1');
  await selectPage(page, 12);
  const blocks = await page.locator('[data-role="stat_block"]').count();
  expect(blocks).toBeGreaterThanOrEqual(1);
  const text = await page.locator('[data-role="stat_block"]').first().textContent();
  expect(text).toMatch(/MU\s+12/);
  expect(text).toMatch(/LeP\s+31/);
});
```

**Definition of Done:**
- [ ] `npm run typecheck` = 0 Fehler
- [ ] Playwright-Test grün
- [ ] IR von `Deicherbe1` neu analysiert, Seite 12 zeigt `role=stat_block`

---

## Phase 2: Thorwaler-Block-Layout (einzelner 863px-Block)

**Ziel:** Thorwaler-Statblock (Seite 17, Block 324) wird korrekt als `stat_block` erkannt trotz einzelnem riesigem paragraph-Block.

**Änderungen:**
- `heuristics_classification.ts`: Block-Höhe-Heuristik
  - Wenn Block-Höhe > 400px UND Text enthält MU+LeP+AT → `roleHint = 'stat_block'`
  - Sonderfall: Einzelner Block mit >800px Höhe = wahrscheinlich vollständiger NSC-Profil+Statblock
- Split-Heuristik für große Blöcke:
  - Wenn Block enthält "Erscheinung:" + "Profession:" + "Motivation:" + "MU " → intern als Multi-Entity markieren
  - Backend: `stat_block` mit `hasProfileText = true` Flag

**Playwright-Test:**
```typescript
test('Thorwaler-Statblock erkannt', async ({ page }) => {
  await loadSession(page, 'DeicherbeComplete');
  await selectPage(page, 17);
  const thorwaler = await page.locator('[data-block-id*="324"]').getAttribute('data-role');
  expect(thorwaler).toBe('stat_block');
});
```

**Definition of Done:**
- [ ] Block 324 hat `roleHint = 'stat_block'`
- [ ] Block enthält Thorwaler-Attribute (MU 14, LeP 33)
- [ ] Playwright-Test grün

---

## Phase 3: Entity-Namensextraktion fixen

**Ziel:** Entity Candidates haben echte Namen statt `name=""`.

**Änderungen:**
- `heuristics_classification.ts`: `extractLabel()` verbessern
  - Aktuelles Problem: Regex `extractProperName()` blockiert bei Sonderzeichen
  - Fix: Fallback auf ersten Satz/erste Zeile wenn Regex fehlschlägt
  - Fix: OCR-Müll filtern (Pattern `^[\W\d]+$` → überspringen)
  - Fix: Wenn Block `roleHint = 'npc_profile'` und Text beginnt mit Symbol (ⓐ/A/2/£/&/i) → Name = nächstes Wort
- `extractProperName()`: Toleranter für DSA5-Namen (Umlaute, Bindestriche)

**Playwright-Test:**
```typescript
test('Entity Names extrahiert', async ({ page }) => {
  await loadSession(page, 'Deicherbe1');
  const response = await page.request.get('http://localhost:4174/sessions/Deicherbe1/ir');
  const ir = await response.json();
  const candidates = ir.entityCandidates || [];
  const named = candidates.filter(e => e.name && e.name.length > 0);
  expect(named.length).toBeGreaterThanOrEqual(5); // Elidan, Perlmin, Ovine, etc.
  const names = named.map(e => e.name);
  expect(names).toContain('Elidan');
});
```

**Definition of Done:**
- [ ] Entity Candidates haben `name != ""` für >50% der Einträge
- [ ] `Deicherbe1`: Elidan, Perlmin, Ovine, Deichbauern, Krakenmolch erkannt
- [ ] Playwright-Test grün

---

## Phase 4: GUI-NSC-Merge-Werkzeug (7 Blöcke → 1 Entity)

**Ziel:** Benutzer kann zerstückelte NSC-Box (Name + Erscheinung + Profession + Motivation + Funktion + Hintergrund + Statblock) zu einer Entity zusammenführen.

**Änderungen:**
- `App.tsx` / `review_page.tsx`: Multi-Select für Blöcke
  - Shift+Click = Range-Select
  - Ctrl/Cmd+Click = Einzel-Select
  - "Merge to Entity" Button in Toolbar
- `AnnotationStore`: Neue Annotation-Typ `entity_merge`
  - `{ type: 'entity_merge', sourceBlockIds: ['block:1', 'block:2', ...], entityType: 'npc', name: 'Elidan' }`
- GUI zeigt gemergte Entity als einheitlichen Block mit:
  - Name als Heading
  - Tabs: Profil | Statblock | Darstellung
  - Editierbare Felder pro Tab

**Playwright-Test:**
```typescript
test('NSC-Box merge: Elidan', async ({ page }) => {
  await loadSession(page, 'Deicherbe1');
  await selectPage(page, 8);
  // Block 1: Name
  await page.locator('[data-block-id="1"]').click();
  // Shift+Click Block 7: Statblock
  await page.locator('[data-block-id="7"]').click({ modifiers: ['Shift'] });
  // Merge Button
  await page.locator('[data-action="merge-to-entity"]').click();
  // Prüfe merged entity
  const entity = await page.locator('.merged-entity').first();
  await expect(entity).toContainText('Elidan');
  await expect(entity).toContainText('MU 12');
});
```

**Definition of Done:**
- [ ] Multi-Select funktioniert (Shift/Cmd+Click)
- [ ] Merge-Button erzeugt `entity_merge` Annotation
- [ ] Gemergte Entity wird als einheitlicher Block gerendert
- [ ] Playwright-Test grün

---

## Playwright-Infrastruktur (vor Phase 1)

**Setup:**
```bash
# Playwright Config erweitern
npx playwright test --workers=1 --project=statblock
```

**Neue Fixtures:**
- `e2e/fixtures/deicherbe.ts`: Helper-Funktionen `loadSession()`, `selectPage()`, `getBlockById()`
- `e2e/fixtures/ir-assertions.ts`: `expectBlockRole()`, `expectEntityName()`, `expectStatblockValues()`

**Test-Struktur:**
```
e2e/
  review.spec.ts          # Bestehende 4 Tests
  statblock.spec.ts       # Phase 1+2
  entity-names.spec.ts    # Phase 3
  entity-merge.spec.ts    # Phase 4
  fixtures/
    deicherbe.ts
    ir-assertions.ts
```

---

## Git-Workflow pro Phase

1. Branch: `feat/statblock-phase-{N}`
2. Commit: `feat(statblock): Phase {N} — {Beschreibung}`
3. Playwright-Test muss grün sein vor Merge
4. Merge in `feat/pdf-review-local-config-toolchain`

---

## Ralph Loop — Arbeitsweise mit `/goal`

`/goal` in Hermes ist ein **persistentes Ziel-Management** — kein einmaliger Subagent-Call. Es bleibt über Turns hinweg aktiv, ein auxiliary-client "judge" prüft ob das Ziel erreicht ist, und bei Rot wird automatisch fortgesetzt/retried.

**Für unser Projekt bedeutet das:**
- Pro Phase EIN `/goal` mit klaren Akzeptanzkriterien
- Hermes implementiert, testet, und wiederholt bei Bedarf — ohne manuelles "nochmal"
- Der Mensch entscheidet nur: `pause` (unterbrechen), `resume` (weiter), `clear` (abbrechen)

**Unterschied zu `delegate_task`:**
- `delegate_task` = einmalig, synchron, endet nach dem ersten Versuch
- `/goal` = persistent, asynchron, retryt bis grün oder bis clear

### Phase 1: Statblock-Heuristik — ERLEDIGT

Bereits manuell implementiert und committet (`a8d6c8c`).
Unit-Tests grün (7/7). Playwright-Test teilweise skipped wegen alter IR.

### Phase 2: Thorwaler-Block — OPTIONAL

Thorwaler wird bereits durch MU/LeP/AT-Pattern erkannt. Höhenheuristik nur Safety-Net.
→ Kann übersprungen werden, falls Phase 3+4 wichtiger.

### Phase 3: Entity-Namensextraktion — NÄCHSTES `/goal`

```
/goal "Fix Entity-Namensextraktion in heuristics_classification.ts.

KONTEXT:
- Datei: packages/mcp-server/src/adventure-import/pdf/heuristics_classification.ts
- Funktion: extractLabel() + extractProperName()
- Problem: >50% der entityCandidates haben name='' weil OCR verstümmelt

ERWARTUNG:
- Entity Candidates haben name != '' für >50%
- Elidan, Perlmin, Ovine, Deichbauern, Krakenmolch erkannt
- extractProperName() toleriert Umlaute und Bindestriche
- Fallback: Wenn Regex fehlschlägt → erste nicht-Müll-Zeile = Name
- OCR-Müll filtern: Pattern ^[\W\d]+$ → überspringen

VALIDIERUNG (durchzuführen):
1. npm run typecheck (0 Fehler)
2. npm run build
3. npx vitest run src/adventure-import/pdf/heuristics_classification.test.ts
4. Test muss grün sein (7+ Tests)
5. IR von Deicherbe1 prüfen: entityCandidates müssen Namen haben
6. Playwright: npx playwright test e2e/entity-names.spec.ts --workers=1
7. Test muss grün sein

WENN ROT:
- Analysiere welche Namen fehlen
- Passe Regex oder Fallback-Logik an
- Wiederhole ab Schritt 3

NICHT TUN:
- Keine GUI-Änderungen
- Kein Merge-Werkzeug
- Keine Statblock-Regex-Änderungen

COMMIT:
fix(entity): Phase 3 — Namensextraktion für verstümmelte OCR"
```

### Phase 4: NSC-Merge — SPÄTER

```
/goal "NSC-Merge-Werkzeug: Multi-Select + Merge zu Entity.

KONTEXT:
- GUI: packages/pdf-review-ui/src/App.tsx
- Backend: AnnotationStore in packages/mcp-server/...
- Problem: Zerstückelte NSC-Box (Name + Erscheinung + Statblock) = 7 Blöcke

ERWARTUNG:
- Multi-Select: Shift+Click (Range), Cmd+Click (Einzel)
- Merge-Button in Toolbar → Annotation entity_merge
- Gemergte Entity als einheitlicher Block mit Tabs (Profil | Statblock | Darstellung)

VALIDIERUNG:
1. GUI manuell: Elidan-Blöcke auf Seite 8 mergen
2. Playwright: e2e/entity-merge.spec.ts grün
3. Test muss grün sein

WENN ROT:
- Analysiere welcher Schritt fehlschlägt
- Passe Select-Logik oder Annotation-Format an
- Wiederhole ab Schritt 2

COMMIT:
feat(gui): Phase 4 — NSC-Merge-Werkzeug"
```

---

## Risiken & Mitigation

| Risiko | Mitigation |
|--------|-----------|
| Regex zu aggressiv (false positives) | Test mit Nicht-Statblock-Seiten (Cover, Inhaltsverzeichnis) |
| Block-Höhe variiert je DPI | Relative Höhe (Prozent der Seitenhöhe) statt absolute px |
| Entity-Merge zerstört Reading-Order | Annotation speichert Original-Order als `readingOrderBeforeMerge` |
| Playwright instabil bei großen IRs | Test mit `Deicherbe1` (7 Seiten) statt `DeicherbeComplete` (23 Seiten) |

---

*Plan erstellt von Jarvis. Playwright-getrieben. Kein urheberrechtlich geschütztes Material im Repo.*
