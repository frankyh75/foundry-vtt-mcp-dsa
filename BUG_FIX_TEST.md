# Bug Fix Test: BUG #1 und BUG #2

**Zweck:** Teste die beiden Bug-Fixes für DSA5 Kompatibilität

**Voraussetzungen:**
- ✅ Foundry VTT v13 läuft
- ✅ DSA5 Welt geladen
- ✅ Foundry MCP Bridge aktiviert
- ✅ Code gepullt und neu gebaut (`npm run build`)

---

## 🐛 BUG #2 Test: Actor Creation (create-actor-from-compendium)

**Was wurde gefixt:**
Type-Check akzeptiert jetzt beide `'npc'` und `'character'` Types für DSA5 Creatures

### Test 1: DSA5 Creature Import (Primär-Test)

**Anweisung:**
```
Verwende create-actor-from-compendium um einen DSA5 Ork zu importieren:
- Pack ID: [DEINE DSA5 CREATURES PACK ID]
- Entry ID: [ORK ENTRY ID]
- Namen: ["Test-Ork", "Grimbold", "Thrak"]
- Quantity: 3
```

**Falls du die IDs nicht kennst, verwende zuerst:**
```
1. Verwende list-compendium-packs um DSA5 Creature Packs zu finden
2. Verwende search-compendium mit query: "Ork" um die Entry ID zu bekommen
3. Verwende get-compendium-entry-full für den Ork um zu bestätigen, dass er 87 Items hat
```

**Erwartetes Ergebnis:** ✅
- Erfolgreich: 3 Orks erstellt ("Test-Ork", "Grimbold", "Thrak")
- Alle 87 Items sind vorhanden
- Keine Fehler

**Fehler-Fall (Vorher):** ❌
```
Error: Document is not an actor/NPC (type: character)
```

---

### Test 2: D&D5e Creature Import (Regressions-Test)

**Anweisung:**
```
Falls du eine D&D5e Welt verfügbar hast, teste:
Verwende create-actor-from-compendium um einen Goblin zu importieren.
```

**Erwartetes Ergebnis:** ✅
- Funktioniert weiterhin ohne Probleme
- Keine Breaking Changes

**Falls keine D&D5e Welt:** SKIP diesen Test

---

## 🐛 BUG #1 Test: Creature Filtering (list-creatures-by-criteria)

**Was wurde gefixt:**
DSA5 gibt jetzt einen hilfreichen Error mit Alternativen statt leere Resultate

### Test 3: DSA5 Challenge Rating Query (Error Message Test)

**Anweisung:**
```
Verwende list-creatures-by-criteria mit DSA5:
- challengeRating: {min: 5, max: 10}
```

**Erwartetes Ergebnis:** ✅
```json
{
  "error": "DSA5 does not use Challenge Rating or Level for creatures",
  "system": "dsa5",
  "explanation": "Das Schwarze Auge 5 uses an Experience Points (AP) system...",
  "alternatives": [
    {
      "method": "search-compendium",
      "example": "{ query: \"*\", packType: \"Actor\", limit: 50 }",
      "description": "Search all actors and use size/type filters"
    },
    // ... weitere Alternativen
  ],
  "note": "Future enhancement: Native DSA5 Erfahrungsgrad filtering (Level 1-7) is planned"
}
```

**Fehler-Fall (Vorher):** ❌
```json
{
  "creatures": [],
  "totalFound": 0
}
```

---

### Test 4: DSA5 Level Query (Error Message Test)

**Anweisung:**
```
Verwende list-creatures-by-criteria mit DSA5:
- level: {min: 3, max: 5}
```

**Erwartetes Ergebnis:** ✅
- Gleicher hilfreicher Error wie Test 3
- Zeigt Alternativen
- Erklärt DSA5 System-Unterschiede

---

### Test 5: DSA5 Alternative Search (Workaround Test)

**Anweisung:**
```
Folge dem Vorschlag aus dem Error und verwende search-compendium stattdessen:
- query: "*"
- packType: "Actor"
- limit: 50
```

**Erwartetes Ergebnis:** ✅
- Findet DSA5 Creatures erfolgreich
- Liste von Orks, Goblins, Menschen, etc.
- Kann mit size/name weiter gefiltert werden

---

### Test 6: D&D5e/PF2e Regression Test

**Anweisung:**
```
Falls du eine D&D5e Welt verfügbar hast:
Verwende list-creatures-by-criteria mit:
- challengeRating: {min: 5, max: 10}
- creatureType: "humanoid"
```

**Erwartetes Ergebnis:** ✅
- Funktioniert weiterhin normal
- Gibt Liste von Creatures zurück
- Keine Fehler

**Falls keine D&D5e Welt:** SKIP diesen Test

---

## 📊 Test-Ergebnis Template

**BUG #2 (create-actor-from-compendium):**
```
Test 1 (DSA5 Ork Import): ✅ PASS / ❌ FAIL
  - 3 Orks erstellt: Ja/Nein
  - 87 Items vorhanden: Ja/Nein
  - Fehler: [falls vorhanden]

Test 2 (D&D5e Regression): ✅ PASS / ❌ FAIL / ⏭️ SKIPPED
  - Goblin import funktioniert: Ja/Nein
  - Fehler: [falls vorhanden]
```

**BUG #1 (list-creatures-by-criteria):**
```
Test 3 (DSA5 CR Error): ✅ PASS / ❌ FAIL
  - Error Message erhalten: Ja/Nein
  - Alternatives vorgeschlagen: Ja/Nein
  - Erklärung enthalten: Ja/Nein

Test 4 (DSA5 Level Error): ✅ PASS / ❌ FAIL
  - Gleicher Error wie Test 3: Ja/Nein

Test 5 (DSA5 Workaround): ✅ PASS / ❌ FAIL
  - search-compendium findet Creatures: Ja/Nein
  - Anzahl gefunden: [Zahl]

Test 6 (D&D5e Regression): ✅ PASS / ❌ FAIL / ⏭️ SKIPPED
  - CR filtering funktioniert: Ja/Nein
  - Creatures gefunden: [Anzahl]
```

---

## 🎯 Erfolgs-Kriterien

**BUG #2 gefixt wenn:**
- ✅ Test 1 PASS (DSA5 Ork import funktioniert)
- ✅ Test 2 PASS oder SKIPPED (D&D5e nicht broken)

**BUG #1 gefixt wenn:**
- ✅ Test 3 PASS (Hilfreicher Error statt leere Liste)
- ✅ Test 4 PASS (Konsistente Error Message)
- ✅ Test 5 PASS (Workaround funktioniert)
- ✅ Test 6 PASS oder SKIPPED (D&D5e nicht broken)

---

## 🚀 Quick Start für Claude Desktop

**Kopiere diesen Prompt:**

```
Ich möchte die beiden DSA5 Bug-Fixes testen:

BUG #2 TEST:
1. Finde einen DSA5 Ork im Compendium (verwende list-compendium-packs und search-compendium)
2. Verwende create-actor-from-compendium um 3 Orks zu erstellen: "Test-Ork", "Grimbold", "Thrak"
3. Bestätige dass alle 87 Items importiert wurden

BUG #1 TEST:
1. Verwende list-creatures-by-criteria mit challengeRating: {min: 5, max: 10}
2. Prüfe ob ich einen hilfreichen Error mit Alternativen bekomme statt leere Resultate
3. Teste die vorgeschlagene Alternative (search-compendium)

Dokumentiere für jeden Test: PASS/FAIL und Details.
```

---

**Test-Datei erstellt:** 2024-12-13
**Fixes getestet:** BUG #2 (create-actor), BUG #1 (list-creatures)
**Commits:** 59623bf (BUG #2), e91f40d (BUG #1)
