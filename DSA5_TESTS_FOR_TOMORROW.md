# DSA5 v0.6.1 - Test-Checkliste für Foundry Console + MCP

**Datum:** Für erste Tests (nachdem Code migriert wurde)
**Tools:** Foundry VTT Browser Console (F12) + Claude Desktop MCP

---

## 🎯 Ziel der Tests

Diese Tests validieren, dass die DSA5-Migration korrekt funktioniert:
1. **Wound-Inversion** (LeP = wounds.max - wounds.value)
2. **Eigenschaften** (8 Attribute statt 6)
3. **Filter-System** (Species, Culture, Level)
4. **Character Stats** (Flache Struktur)
5. **Creature Index** (Deutsche UI-Messages)

---

## A. Foundry Console Tests (Browser F12)

### Voraussetzungen:
- Foundry VTT läuft (DSA5-Welt geöffnet)
- Module "Foundry MCP Bridge" aktiv
- Mindestens 1 DSA5-Charakter im Actor Directory

### Test 1: Constants laden ✅

```javascript
// 1. Module laden
const moduleId = 'foundry-mcp-bridge';
const module = game.modules.get(moduleId);
console.log("Module aktiv:", module?.active);  // true

// 2. Constants prüfen (wenn constants.ts fertig)
// HINWEIS: Dieser Import funktioniert nur wenn das Modul die Datei exportiert
// Alternativ: Direkt im Code testen
```

### Test 2: WOUNDS_HELPER (KRITISCH!) ⚠️

**Szenario:** Charakter hat 35 LeP max, hat 15 Wunden genommen

```javascript
// In deiner constants.ts ist WOUNDS_HELPER definiert
// Test direkt im Code:
const WOUNDS_HELPER = {
  toHitPoints: (wounds) => ({
    current: wounds.max - wounds.value,
    max: wounds.max,
  })
};

// Test-Fall 1: 15 Wunden bei 35 LeP max
const wounds1 = { value: 15, max: 35 };
console.log("15 Wunden → HP:", WOUNDS_HELPER.toHitPoints(wounds1));
// ✅ ERWARTUNG: { current: 20, max: 35 }

// Test-Fall 2: 0 Wunden (unverletzt)
const wounds2 = { value: 0, max: 35 };
console.log("0 Wunden → HP:", WOUNDS_HELPER.toHitPoints(wounds2));
// ✅ ERWARTUNG: { current: 35, max: 35 }

// Test-Fall 3: 35 Wunden (tot)
const wounds3 = { value: 35, max: 35 };
console.log("35 Wunden → HP:", WOUNDS_HELPER.toHitPoints(wounds3));
// ✅ ERWARTUNG: { current: 0, max: 35 }
```

### Test 3: SIZE_MAP_DE_TO_EN ✅

```javascript
const SIZE_MAP_DE_TO_EN = {
  'winzig': 'tiny',
  'klein': 'small',
  'mittel': 'medium',
  'groß': 'large',
  'riesig': 'huge',
};

console.log("Groß → EN:", SIZE_MAP_DE_TO_EN['groß']);
// ✅ ERWARTUNG: "large"

console.log("Mittel → EN:", SIZE_MAP_DE_TO_EN['mittel']);
// ✅ ERWARTUNG: "medium"
```

### Test 4: EIGENSCHAFT_NAMES ✅

```javascript
const EIGENSCHAFT_NAMES = {
  MU: { short: 'MU', german: 'Mut', english: 'Courage' },
  KL: { short: 'KL', german: 'Klugheit', english: 'Cleverness' },
  // ... etc.
};

console.log("MU:", EIGENSCHAFT_NAMES.MU);
// ✅ ERWARTUNG: { short: 'MU', german: 'Mut', english: 'Courage' }

console.log("Alle Eigenschaften:", Object.keys(EIGENSCHAFT_NAMES));
// ✅ ERWARTUNG: ['MU', 'KL', 'IN', 'CH', 'FF', 'GE', 'KO', 'KK']
//               (genau 8!)
```

---

### Test 4b: Erfahrungsgrad-Mapping (EXPERIENCE_LEVELS) ✅

**Siehe:** `DSA5_EXPERIENCE_LEVELS.md` für vollständige Tabelle

```javascript
const { getExperienceLevel, EXPERIENCE_LEVELS } = /* import from constants.ts */;

// Test 1: Unerfahren (0-900 AP) → Level 1
console.log(getExperienceLevel(0));
// ✅ ERWARTUNG: { name: 'Unerfahren', nameEn: 'Inexperienced', level: 1, min: 0, max: 900 }

console.log(getExperienceLevel(500));
// ✅ ERWARTUNG: { name: 'Unerfahren', level: 1, ... }

// Test 2: Durchschnittlich (901-1800 AP) → Level 2
console.log(getExperienceLevel(1200));
// ✅ ERWARTUNG: { name: 'Durchschnittlich', nameEn: 'Average', level: 2, ... }

// Test 3: Erfahren (1801-2700 AP) → Level 3
console.log(getExperienceLevel(2400));
// ✅ ERWARTUNG: { name: 'Erfahren', nameEn: 'Experienced', level: 3, ... }

// Test 4: Kompetent (2701-3600 AP) → Level 4
console.log(getExperienceLevel(3200));
// ✅ ERWARTUNG: { name: 'Kompetent', nameEn: 'Competent', level: 4, ... }

// Test 5: Meisterlich (3601-4500 AP) → Level 5
console.log(getExperienceLevel(4000));
// ✅ ERWARTUNG: { name: 'Meisterlich', nameEn: 'Masterful', level: 5, ... }

// Test 6: Brillant (4501-5400 AP) → Level 6
console.log(getExperienceLevel(5000));
// ✅ ERWARTUNG: { name: 'Brillant', nameEn: 'Brilliant', level: 6, ... }

// Test 7: Legendär (5401+ AP) → Level 7
console.log(getExperienceLevel(6000));
// ✅ ERWARTUNG: { name: 'Legendär', nameEn: 'Legendary', level: 7, ... }

console.log(getExperienceLevel(10000));
// ✅ ERWARTUNG: { name: 'Legendär', level: 7, ... } (Maximum!)

// Test 8: Alle Erfahrungsgrade (Level 1-7)
console.log("Anzahl Erfahrungsgrade:", EXPERIENCE_LEVELS.length);
// ✅ ERWARTUNG: 7 (Unerfahren bis Legendär)

console.log("Level-Bereich:", EXPERIENCE_LEVELS[0].level, "-", EXPERIENCE_LEVELS[6].level);
// ✅ ERWARTUNG: 1 - 7

console.log("Namen (DE):", EXPERIENCE_LEVELS.map(l => l.name));
// ✅ ERWARTUNG: ['Unerfahren', 'Durchschnittlich', 'Erfahren', 'Kompetent', 'Meisterlich', 'Brillant', 'Legendär']
```

---

### Test 5: Character Stats extrahieren (wenn adapter.ts fertig) ⚠️

**Voraussetzung:** Du hast einen DSA5-Charakter namens "Thorwal" (oder passe Namen an)

```javascript
// 1. Actor laden
const actor = game.actors.getName("Thorwal der Krieger");
console.log("Actor gefunden:", actor?.name);

// 2. System-Daten prüfen (RAW)
console.log("System Wounds:", actor.system.status.wounds);
// ✅ ERWARTUNG: { value: X, max: Y, ... }

console.log("System Characteristics:", actor.system.characteristics);
// ✅ ERWARTUNG: { mu: {...}, kl: {...}, in: {...}, ... }

// 3. Adapter laden (wenn registriert)
const systemRegistry = game.modules.get('foundry-mcp-bridge')?.api?.systemRegistry;
const adapter = systemRegistry?.getAdapter('dsa5');

if (!adapter) {
  console.error("DSA5 Adapter nicht gefunden! Ist er registriert?");
}

// 4. Character Stats extrahieren
const stats = adapter.extractCharacterStats(actor);
console.log("=== EXTRACTED STATS ===");
console.log("Name:", stats.name);
console.log("System:", stats.system);  // 'dsa5'

// 5. Eigenschaften (8 Attribute)
console.log("\nEigenschaften:", stats.attributes);
// ✅ ERWARTUNG: { MU: 12, KL: 14, IN: 11, CH: 10, FF: 13, GE: 14, KO: 15, KK: 16 }
//               (genau 8 Eigenschaften!)

// 6. Health (LeP mit Inversion!)
console.log("\nHealth:", stats.health);
// ✅ ERWARTUNG: { current: <max - wounds.value>, max: <wounds.max>, wounds: <wounds.value> }
// BEISPIEL: Wenn wounds = { value: 5, max: 35 }
//           Dann health = { current: 30, max: 35, wounds: 5 }

// 7. Ressourcen (AsP, KaP)
console.log("\nResources:", stats.resources);
// ✅ ERWARTUNG: [
//   { name: 'AsP', type: 'mana', current: 28, max: 32 },
//   { name: 'KaP', type: 'karma', current: 5, max: 8 }
// ]

// 8. Profil
console.log("\nSpecies:", stats.species);     // z.B. "Elf"
console.log("Culture:", stats.culture);       // z.B. "Auelfen"
console.log("Profession:", stats.profession); // z.B. "Wildniskundiger"

// 9. Skills (Top 5)
console.log("\nSkills (erste 5):", stats.skills.slice(0, 5));
// ✅ ERWARTUNG: [
//   { name: "Klettern", value: 8, category: "body" },
//   { name: "Überreden", value: 6, category: "social" },
//   ...
// ]

// 10. Combat Skills
console.log("\nCombat Skills:", stats.combatSkills);
// ✅ ERWARTUNG: [
//   { name: "Raufen", at: 10, pa: 8 },
//   { name: "Schwerter", at: 12, pa: 10 },
//   ...
// ]
```

**Kritische Validierung - Wound-Inversion:**

```javascript
// Manuelle Verifikation:
const rawWounds = actor.system.status.wounds;
const extractedHealth = stats.health;

console.log("\n=== WOUND INVERSION CHECK ===");
console.log("RAW wounds.value:", rawWounds.value);
console.log("RAW wounds.max:", rawWounds.max);
console.log("CALCULATED current HP:", rawWounds.max - rawWounds.value);
console.log("EXTRACTED health.current:", extractedHealth.current);

// ✅ MUSS GLEICH SEIN:
const isCorrect = (rawWounds.max - rawWounds.value) === extractedHealth.current;
console.log("✅ Inversion korrekt:", isCorrect);

if (!isCorrect) {
  console.error("❌ FEHLER: Wound-Inversion ist falsch!");
  console.error("Erwartet:", rawWounds.max - rawWounds.value);
  console.error("Erhalten:", extractedHealth.current);
}
```

---

### Test 6: Index Builder (wenn index-builder.ts fertig) ✅

```javascript
// 1. Index Builder Instanz erstellen
const Dsa5IndexBuilder = game.modules.get('foundry-mcp-bridge')?.api?.Dsa5IndexBuilder;
const builder = new Dsa5IndexBuilder('foundry-mcp-bridge');

console.log("System ID:", builder.getSystemId());
// ✅ ERWARTUNG: 'dsa5'

// 2. Index neu bauen (VORSICHT: Kann 1-2 Minuten dauern!)
// Settings → Module Settings → Foundry MCP → "Rebuild Enhanced Creature Index"
// ODER direkt:
const packs = game.packs.filter(p => p.metadata.type === 'Actor');
console.log(`Rebuilding index from ${packs.length} packs...`);

const index = await builder.buildIndex(packs, true);  // force = true
console.log(`✅ Index gebaut: ${index.length} Kreaturen`);

// 3. Deutsche UI-Messages prüfen
// Während des Builds sollten erscheinen:
// - "Starte DSA5 Kreaturen-Index aus X Paketen..."
// - "Erstelle DSA5 Index: Paket Y/X (...)"
// - "DSA5 Kreaturen-Index fertig! X Kreaturen indiziert..."
```

---

### Test 7: Filter-Matching (wenn filters.ts fertig) ✅

```javascript
// Mock-Kreatur für Test
const testCreature = {
  id: 'test-elf-1',
  name: 'Auelfen-Zaubererin',
  type: 'npc',
  packName: 'test-pack',
  packLabel: 'Test Pack',
  system: 'dsa5',
  systemData: {
    level: 5,
    species: 'Elf',
    culture: 'Auelfen',
    size: 'medium',
    lifePoints: 30,
    meleeDefense: 12,
    rangedDefense: 10,
    hasSpells: true,
    traits: ['Nachtsicht', 'Zaubersinn']
  }
};

// Filter-Funktion laden
const { matchesDsa5Filters } = game.modules.get('foundry-mcp-bridge').api;

// Test 1: Level-Filter
console.log("Level 5:", matchesDsa5Filters(testCreature, { level: 5 }));
// ✅ ERWARTUNG: true

console.log("Level 3:", matchesDsa5Filters(testCreature, { level: 3 }));
// ✅ ERWARTUNG: false

// Test 2: Species-Filter
console.log("Species Elf:", matchesDsa5Filters(testCreature, { species: 'Elf' }));
// ✅ ERWARTUNG: true

console.log("Species Zwerg:", matchesDsa5Filters(testCreature, { species: 'Zwerg' }));
// ✅ ERWARTUNG: false

// Test 3: hasSpells-Filter
console.log("hasSpells true:", matchesDsa5Filters(testCreature, { hasSpells: true }));
// ✅ ERWARTUNG: true

console.log("hasSpells false:", matchesDsa5Filters(testCreature, { hasSpells: false }));
// ✅ ERWARTUNG: false

// Test 4: Multi-Filter
console.log("Elf + Magie + Level 3-7:", matchesDsa5Filters(testCreature, {
  species: 'Elf',
  hasSpells: true,
  level: { min: 3, max: 7 }
}));
// ✅ ERWARTUNG: true
```

---

## B. MCP Tools Tests (Claude Desktop)

**Voraussetzung:**
- Foundry VTT läuft mit DSA5-Welt
- MCP Server aktiv
- Claude Desktop verbunden

### Test 1: List Creatures (Filter nach Species) 🔍

**In Claude Desktop:**
```
Zeige mir alle Elfen-Kreaturen
```

**Erwartete Tool-Nutzung:**
```json
{
  "tool": "list-creatures-by-criteria",
  "filters": {
    "species": "Elf"
  }
}
```

**Erwartete Ausgabe:**
- Liste von Kreaturen mit `species: "Elf"`
- Jede Kreatur zeigt: name, experienceLevel ("Erfahren"), species, culture, lifePoints
- Keine D&D5e-Felder (challengeRating, hitPoints, armorClass)

---

### Test 2: List Creatures (Filter nach Erfahrungsgrad + Magie) 🔍

**In Claude Desktop:**
```
Zeige mir magiekundige Kreaturen mit Erfahrungsgrad "Erfahren" bis "Meisterlich"
```

**Erwartete Tool-Nutzung:**
```json
{
  "tool": "list-creatures-by-criteria",
  "filters": {
    "experienceLevel": { "min": 3, "max": 5 },
    "hasSpells": true
  }
}
```

**Erwartete Ausgabe:**
- Nur Kreaturen mit `hasSpells: true`
- Erfahrungsgrad zwischen 3 (Erfahren) und 5 (Meisterlich)
- Sortiert nach experienceLevel

**Alternative (Filter nach Name):**
```json
{
  "tool": "list-creatures-by-criteria",
  "filters": {
    "experienceLevel": "Kompetent",  // Level 4
    "hasSpells": true
  }
}
```

---

### Test 2b: List Creatures (Filter nach Abenteuerpunkten) 🔍

**In Claude Desktop:**
```
Zeige mir Kreaturen mit 2000-3500 Abenteuerpunkten
```

**Erwartete Tool-Nutzung:**
```json
{
  "tool": "list-creatures-by-criteria",
  "filters": {
    "experiencePoints": { "min": 2000, "max": 3500 }
  }
}
```

**Erwartete Ausgabe:**
- Kreaturen mit total AP zwischen 2000-3500
- Entspricht ungefähr Erfahrungsgrad 2-3 (Erfahren bis Kompetent)

---

### Test 3: Get Character (DSA5 Charakter anzeigen) 📋

**In Claude Desktop:**
```
Zeige mir den Charakter "Thorwal der Krieger"
```

**Erwartete Tool-Nutzung:**
```json
{
  "tool": "get-character",
  "name": "Thorwal der Krieger"
}
```

**Erwartete Ausgabe:**
```
Name: Thorwal der Krieger
System: dsa5
Species: Thorwaler
Culture: Thorwal
Profession: Krieger

Eigenschaften (Attributes):
  MU (Mut): 14
  KL (Klugheit): 10
  IN (Intuition): 11
  CH (Charisma): 12
  FF (Fingerfertigkeit): 13
  GE (Gewandtheit): 14
  KO (Konstitution): 16
  KK (Körperkraft): 17

Health:
  LeP: 42/50  (8 Wunden genommen)

Resources:
  AsP: 0/0  (kein Zauberer)
  KaP: 3/5

Top Skills:
  - Einschüchtern: 10
  - Körperbeherrschung: 9
  - Zechen: 12

Combat Skills:
  - Schwerter: AT 14 / PA 12
  - Raufen: AT 12 / PA 10
```

**Kritische Prüfung:**
- ✅ **8 Eigenschaften** (nicht 6!)
- ✅ **LeP korrekt berechnet** (50 - 8 = 42, nicht 8!)
- ✅ **Keine D&D5e-Felder** (HP, AC, CR)
- ✅ **Deutsche Begriffe** wo sinnvoll (MU, KL, LeP, AsP, KaP)

---

### Test 4: Search Compendium (Creature Index) 🔍

**In Claude Desktop:**
```
Suche nach "Goblin" in den Kompendien
```

**Erwartete Tool-Nutzung:**
```json
{
  "tool": "search-compendium",
  "query": "Goblin",
  "type": "Actor"
}
```

**Erwartete Ausgabe:**
- Liste von Goblin-Varianten
- Zeigt: level, species, size, lifePoints, meleeDefense
- Kein challengeRating oder hitPoints

---

### Test 5: Filter Description (Deutsch) 📝

**In Claude Desktop:**
```
Filtere Kreaturen: Erfahrungsgrad Meisterlich, Spezies Zwerg, mit Magie
```

**Erwartete Filter-Beschreibung (via describeDsa5Filters):**
```
Erfahrungsgrad: Meisterlich | Spezies: Zwerg | Mit Magie
```

**NICHT:**
```
Level 4 | creatureType: dwarf | spellcaster
```

**Alternative (numerisch):**
```
Filtere Kreaturen: Erfahrungsgrad 3-5, Spezies Elf
```
**Erwartung:**
```
Erfahrungsgrad: Erfahren bis Meisterlich | Spezies: Elf
```

**Level-Mapping zur Erinnerung:**
- Level 1 = Unerfahren
- Level 2 = Durchschnittlich
- Level 3 = Erfahren
- Level 4 = Kompetent
- Level 5 = Meisterlich
- Level 6 = Brillant
- Level 7 = Legendär

---

## C. Kritische Edge Cases ⚠️

### Edge Case 1: Unverletzter Charakter (0 Wunden)

```javascript
// Charakter hat volle LeP
const actor = game.actors.getName("Unverletzter Held");
const wounds = actor.system.status.wounds;
console.log("Wounds:", wounds);  // { value: 0, max: 40 }

const stats = adapter.extractCharacterStats(actor);
console.log("Health:", stats.health);
// ✅ ERWARTUNG: { current: 40, max: 40, wounds: 0 }
```

### Edge Case 2: Bewusstloser Charakter (LeP = 0)

```javascript
// Charakter hat LeP auf 0
const actor = game.actors.getName("Bewusstloser Held");
const wounds = actor.system.status.wounds;
console.log("Wounds:", wounds);  // { value: 40, max: 40 }

const stats = adapter.extractCharacterStats(actor);
console.log("Health:", stats.health);
// ✅ ERWARTUNG: { current: 0, max: 40, wounds: 40 }
```

### Edge Case 3: Charakter ohne Magie (AsP = 0)

```javascript
const actor = game.actors.getName("Krieger ohne Magie");
const stats = adapter.extractCharacterStats(actor);
console.log("Resources:", stats.resources);
// ✅ ERWARTUNG: [
//   { name: 'KaP', current: 3, max: 5 }
// ]
// (AsP sollte NICHT in der Liste sein wenn max = 0)
```

### Edge Case 4: Filter mit leerem Ergebnis

**In Claude Desktop:**
```
Zeige mir Drachen mit Stufe 20+
```

**Erwartung:**
- Leere Liste (wenn keine Drachen in Kompendien)
- Freundliche Nachricht: "Keine Kreaturen gefunden für: Stufe 20+ | Spezies: Drache"

---

## D. Performance-Tests 🚀

### Test 1: Index-Build-Zeit

```javascript
const start = Date.now();
const packs = game.packs.filter(p => p.metadata.type === 'Actor');
const index = await builder.buildIndex(packs, true);
const duration = (Date.now() - start) / 1000;

console.log(`✅ ${index.length} Kreaturen indiziert in ${duration}s`);
// ✅ ZIEL: < 60 Sekunden für 500+ Kreaturen
```

### Test 2: Filter-Performance

```javascript
// Lade vollständigen Index
const fullIndex = await game.modules.get('foundry-mcp-bridge').api.getCreatureIndex();
console.log(`Index Größe: ${fullIndex.length} Kreaturen`);

// Filtere alle Elfen mit Magie
const start = Date.now();
const filtered = fullIndex.filter(c =>
  matchesDsa5Filters(c, { species: 'Elf', hasSpells: true })
);
const duration = Date.now() - start;

console.log(`✅ ${filtered.length} Kreaturen gefiltert in ${duration}ms`);
// ✅ ZIEL: < 100ms für 500+ Kreaturen
```

---

## E. Checklist: Bereit für PR ✅

Vor dem Pull Request erstellen:

- [ ] **Constants:** WOUNDS_HELPER, SIZE_MAP, EIGENSCHAFT_NAMES getestet
- [ ] **Wound-Inversion:** Mindestens 3 verschiedene Charaktere korrekt
- [ ] **Eigenschaften:** Alle 8 Attribute (MU-KK) vorhanden
- [ ] **Filter:** Species, Level, Culture, hasSpells funktionieren
- [ ] **Character Stats:** Flache Struktur, keine Verschachtelung
- [ ] **Index Build:** Deutsche UI-Messages erscheinen
- [ ] **MCP Tools:** `list-creatures-by-criteria` mit DSA5-Filtern
- [ ] **MCP Tools:** `get-character` zeigt DSA5-spezifische Felder
- [ ] **Edge Cases:** 0 Wunden, 0 LeP, kein AsP getestet
- [ ] **Performance:** Index-Build < 60s, Filtering < 100ms
- [ ] **TypeScript:** `npm run build` ohne Fehler
- [ ] **Linting:** `npm run lint` ohne Warnungen

---

## F. Debugging-Tipps 🔧

### Problem: "Adapter nicht gefunden"

```javascript
// 1. Prüfe Registry
const registry = game.modules.get('foundry-mcp-bridge')?.api?.systemRegistry;
console.log("Registrierte Systeme:", registry?.getRegisteredSystems());
// Sollte ['dnd5e', 'pf2e', 'dsa5'] enthalten

// 2. Prüfe DSA5 System erkannt
console.log("Aktuelles System:", game.system.id);
// Sollte 'dsa5' sein

// 3. Manuell Adapter laden
const Dsa5Adapter = game.modules.get('foundry-mcp-bridge').api.Dsa5Adapter;
const adapter = new Dsa5Adapter();
console.log("Adapter Metadata:", adapter.getMetadata());
```

### Problem: "Wound-Inversion falsch"

```javascript
// Debug: Zeige RAW-Daten
const actor = game.actors.getName("Problem-Charakter");
console.log("=== RAW DATA ===");
console.log("wounds.value:", actor.system.status.wounds.value);
console.log("wounds.max:", actor.system.status.wounds.max);

// Debug: Zeige Berechnung Schritt-für-Schritt
const wounds = actor.system.status.wounds;
console.log("=== CALCULATION ===");
console.log("Step 1 - max:", wounds.max);
console.log("Step 2 - value:", wounds.value);
console.log("Step 3 - current = max - value:", wounds.max - wounds.value);

// Debug: Zeige WOUNDS_HELPER Output
const hp = WOUNDS_HELPER.toHitPoints(wounds);
console.log("=== HELPER OUTPUT ===");
console.log(hp);
```

### Problem: "Filter matchen nicht"

```javascript
// Debug: Zeige Creature-Daten
const creature = index[0];  // Erste Kreatur
console.log("=== CREATURE DATA ===");
console.log("species:", creature.systemData?.species);
console.log("level:", creature.systemData?.level);
console.log("hasSpells:", creature.systemData?.hasSpells);

// Debug: Teste einzelne Filter
const filters = { species: 'Elf' };
console.log("Filter:", filters);
console.log("Match:", matchesDsa5Filters(creature, filters));

// Debug: Teste Filter-Schema
const { Dsa5FiltersSchema } = game.modules.get('foundry-mcp-bridge').api;
const validated = Dsa5FiltersSchema.safeParse(filters);
console.log("Schema-Validierung:", validated);
```

---

**Viel Erfolg beim Testen! 🚀**

Bei Problemen: Siehe `DSA5_MIGRATION_ANALYSIS.md` für detaillierte Code-Vergleiche.
