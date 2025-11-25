# DSA5 v0.6.0 Migration - Detaillierte Code-Analyse

**Erstellt:** 2024 (für v0.6.1 Contribution)
**Basis:** Vergleich existierender DSA5 Adapter Layer mit v0.6.0 Registry Pattern

---

## 📊 Übersicht: Code-Wiederverwendbarkeit

| Datei | Zeilen | Portierbar | Aufwand | Ziel-Datei |
|-------|--------|-----------|---------|------------|
| `types.ts` | 271 | 30% | 1h | `systems/dsa5/types.ts` (nur Dsa5CreatureIndex) + v0.6.0 `types.ts` erweitern |
| `field-mappings.ts` | 200 | **95%** ✅ | 30min | `systems/dsa5/constants.ts` (fast 1:1 Copy) |
| `creature-index.ts` | 244 | **85%** ✅ | 2-3h | `systems/dsa5/index-builder.ts` (Interface anpassen) |
| `character-import.ts` | 243 | 40% | 3-4h | `systems/dsa5/adapter.ts::extractCharacterStats()` (Umstrukturierung!) |
| **NEU** | ~220 | 20% | 2-3h | `systems/dsa5/filters.ts` (Zod-Schemas neu) |
| **NEU** | ~150 | 0% | 2h | `systems/dsa5/adapter.ts` (Formatting-Methoden) |

**Gesamt:** ~1200 Zeilen, davon ~700 Zeilen wiederverwendbar (58%)

---

## 🔍 Datei-für-Datei Analyse

### 1. `constants.ts` - ✅ EINFACH (95% Copy-Paste + NEU: Erfahrungsgrade)

**Quelle:** `field-mappings.ts` (200 Zeilen) + NEU: Erfahrungsgrad-Mapping
**Aufwand:** 1 Stunde (30min Copy + 30min Erfahrungsgrade)
**Schwierigkeit:** ⭐⭐ Einfach

#### Was direkt kopiert wird:
- ✅ `EIGENSCHAFT_NAMES` (Zeilen 11-20) - 1:1 kopieren
- ✅ `SIZE_MAP_DE_TO_EN` (Zeilen 26-34) - 1:1 kopieren
- ✅ `SIZE_MAP_EN_TO_DE` (Zeilen 39-47) - 1:1 kopieren
- ✅ `RESOURCE_TYPES` (Zeilen 52-62) - 1:1 kopieren
- ✅ `ITEM_TYPES` (Zeilen 67-80) - 1:1 kopieren
- ✅ `ACTOR_TYPES` (Zeilen 85-89) - 1:1 kopieren
- ✅ **WOUNDS_HELPER** (Zeilen 102-134) - **KRITISCH!** 1:1 kopieren
- ✅ `EIGENSCHAFT_HELPER` (Zeilen 140-156) - 1:1 kopieren
- ✅ `SKILL_GROUPS` (Zeilen 161-167) - 1:1 kopieren
- ✅ `ADVANCEMENT_CATEGORIES` (Zeilen 172) - 1:1 kopieren

#### Was NEU hinzukommt:
- ✨ **EXPERIENCE_LEVELS** - Erfahrungsgrad-Definitionen (Unerfahren bis Legendär)
- ✨ **getExperienceLevel(AP)** - Mapping: Abenteuerpunkte → Erfahrungsgrad
- ✨ **getExperienceLevelByNumber(level)** - Level 0-6 → Erfahrungsgrad-Info

**Siehe:** `DSA5_EXPERIENCE_LEVELS.md` für vollständige Struktur

#### Was NICHT übernommen wird:
- ❌ `FIELD_PATHS` (Zeilen 177-200) - wird zu `adapter.ts::getDataPaths()` Methode

#### Migration-Schritte:
```bash
# 1. Datei erstellen
cp packages/foundry-module/src/tools/dsa5/field-mappings.ts \
   packages/mcp-server/src/systems/dsa5/constants.ts

# 2. Header ändern (Zeile 1-6)
# 3. FIELD_PATHS entfernen (Zeilen 177-200)
# 4. Exports anpassen
```

**Test für morgen:**
```javascript
// In Foundry Console:
const wounds = { value: 15, max: 35 };  // 15 Wunden bei 35 LeP max
const hp = WOUNDS_HELPER.toHitPoints(wounds);
console.log(hp);  // Sollte { current: 20, max: 35 } sein
```

---

### 2. `filters.ts` - ⚠️ MITTEL (30% aus D&D5e Template)

**Quelle:** D&D5e `filters.ts` als Template + DSA5-Logik
**Aufwand:** 2-3 Stunden
**Schwierigkeit:** ⭐⭐⭐ Mittel

#### Struktur (von D&D5e übernehmen):
```typescript
// 1. Konstanten definieren
export const Dsa5CreatureTypes = ['npc', 'character', 'creature'] as const;
export const Dsa5SizeCategories = ['tiny', 'small', 'medium', 'large', 'huge'] as const;

// 2. Zod-Schema (NEU für DSA5!)
export const Dsa5FiltersSchema = z.object({
  level: z.union([z.number(), z.object({ min, max })]).optional(),
  species: z.string().optional(),
  culture: z.string().optional(),
  size: z.enum(Dsa5SizeCategories).optional(),
  hasSpells: z.boolean().optional(),
  traits: z.array(z.string()).optional(),
});

// 3. Matcher-Funktion (analog zu D&D5e matchesDnD5eFilters)
export function matchesDsa5Filters(creature, filters): boolean {
  // Level-Check (statt CR)
  if (filters.level !== undefined) { ... }

  // Species-Check (statt creatureType)
  if (filters.species !== undefined) { ... }

  // Culture-Check (DSA5-spezifisch!)
  if (filters.culture !== undefined) { ... }

  return true;
}

// 4. Describer-Funktion
export function describeDsa5Filters(filters): string {
  const parts = [];
  if (filters.level) parts.push(`Stufe ${filters.level}`);
  if (filters.species) parts.push(`Spezies: ${filters.species}`);
  return parts.join(' | ');
}
```

#### DSA5-spezifische Filter:

| Filter | Typ | Beschreibung | D&D5e-Äquivalent |
|--------|-----|--------------|------------------|
| `experienceLevel` | `number \| string \| {min, max}` | **Erfahrungsgrad** (0-6 oder "Erfahren") | challengeRating |
| `experiencePoints` | `number \| {min, max}` | Abenteuerpunkte (Detail-Filter) | - (NEU!) |
| `species` | `string` | Spezies (Mensch, Elf, Zwerg) | creatureType |
| `culture` | `string` | Kultur (Thorwal, Mittelreich) | - (NEU!) |
| `size` | `enum` | Größe (klein, mittel, groß) | size |
| `hasSpells` | `boolean` | Hat Zauber/Liturgien | spellcaster |
| `traits` | `string[]` | Merkmale (Nachtsicht, etc.) | - (ähnlich tags) |

**WICHTIG:** `experienceLevel` ist der **Erfahrungsgrad** (Unerfahren, Durchschnittlich, Erfahren, Kompetent, Meisterlich, Brillant, Legendär), NICHT die Abenteuerpunkte!
- Numerisch: 0-6 (0=Unerfahren, 6=Legendär)
- String: "Erfahren", "Kompetent", etc.
- Bereich: `{ min: 2, max: 4 }` = Erfahren bis Meisterlich

**Siehe:** `DSA5_EXPERIENCE_LEVELS.md` für vollständige Mapping-Tabelle

**Test für morgen:**
```javascript
// In MCP Tools via Claude Desktop:
// 1. Filter nach Elfen mit Magie
{
  "species": "Elf",
  "hasSpells": true
}

// 2. Filter nach Erfahrungsgrad (numerisch: Erfahren bis Meisterlich)
{
  "experienceLevel": { "min": 2, "max": 4 },
  "size": "medium"
}

// 3. Filter nach Erfahrungsgrad (Name)
{
  "experienceLevel": "Kompetent"
}

// 4. Filter nach Abenteuerpunkten (präzise)
{
  "experiencePoints": { "min": 2000, "max": 3500 }
}

// Erwartung: matchesDsa5Filters() gibt true/false zurück
```

---

### 3. `index-builder.ts` - ✅ GUT PORTIERBAR (85%)

**Quelle:** `creature-index.ts` (244 Zeilen)
**Aufwand:** 2-3 Stunden
**Schwierigkeit:** ⭐⭐ Einfach-Mittel

#### Änderungen:

**3.1 Klassen-Wrapper statt Funktionen:**
```typescript
// VORHER (creature-index.ts):
export async function buildDsa5CreatureIndex(moduleId, actorPacks) { ... }

// NACHHER (index-builder.ts):
export class Dsa5IndexBuilder implements IndexBuilder {
  private moduleId: string;

  constructor(moduleId: string = 'foundry-mcp-bridge') {
    this.moduleId = moduleId;
  }

  getSystemId() {
    return 'dsa5' as const;
  }

  async buildIndex(packs: any[], force = false): Promise<Dsa5CreatureIndex[]> {
    // KOPIERE HIER: buildDsa5CreatureIndex() Zeilen 22-77
    // Verwende this.moduleId statt Parameter
  }

  async extractDataFromPack(pack: any): Promise<{ creatures, errors }> {
    // KOPIERE HIER: extractDsa5DataFromPack() Zeilen 87-122
  }

  private extractCreatureData(doc, pack): { creature, errors } | null {
    // KOPIERE HIER: extractDsa5CreatureData() Zeilen 133-243
  }
}
```

**3.2 Return-Type ändern:**
```typescript
// VORHER:
creatures: Dsa5CreatureIndex[]  // Lokaler Type

// NACHHER:
creatures: Dsa5CreatureIndex[]  // Type aus ../types.ts importiert
```

**3.3 Deutsche UI-Messages BEIBEHALTEN:**
```typescript
// Diese Zeilen 1:1 übernehmen (Deutsch ist OK für DSA5!):
ui.notifications?.info(`Starte DSA5 Kreaturen-Index aus ${actorPacks.length} Paketen...`);
ui.notifications?.info(`DSA5 Kreaturen-Index fertig! ${enhancedCreatures.length} ...`);
```

#### Migration-Tabelle:

| Funktion (Alt) | Methode (Neu) | Zeilen | Änderungen |
|----------------|---------------|--------|------------|
| `buildDsa5CreatureIndex()` | `buildIndex()` | 22-77 | Signature ändern, `moduleId` Parameter → `this.moduleId` |
| `extractDsa5DataFromPack()` | `extractDataFromPack()` | 87-122 | Signature ändern (kein `moduleId` Parameter) |
| `extractDsa5CreatureData()` | `extractCreatureData()` | 133-243 | `private` machen, Signature ändern |

**Test für morgen:**
```javascript
// In Foundry Console:
const builder = new Dsa5IndexBuilder('foundry-mcp-bridge');
console.log(builder.getSystemId());  // 'dsa5'

// Rebuild Index testen:
// Settings → Module Settings → Foundry MCP → Rebuild Enhanced Creature Index
// Erwartung: Deutsche Notifications erscheinen
```

---

### 4. `adapter.ts::extractCharacterStats()` - ⚠️ KOMPLEX (40% portierbar)

**Quelle:** `character-import.ts::extractDsa5CharacterData()` (Zeilen 17-103)
**Aufwand:** 3-4 Stunden
**Schwierigkeit:** ⭐⭐⭐⭐ Schwer

#### Problem: Unterschiedliche Output-Struktur!

**VORHER (character-import.ts):**
```typescript
// Verschachtelt, DSA5-spezifisch
return {
  eigenschaften: {
    MU: { initial: 8, species: 0, value: 12, ... },
    KL: { initial: 8, species: 0, value: 14, ... },
    // ... 8 Eigenschaften
  },
  status: {
    wounds: { value: 5, max: 35, ... },
    astralenergy: { value: 28, max: 32, ... },
    // ...
  },
  talente: [ { name: "Klettern", value: 8, eigenschaften: ["MU","GE","KK"] }, ... ],
  kampftechniken: [ { name: "Raufen", at: 10, pa: 8 }, ... ],
  details: { species: "Elf", culture: "Auelfen", ... },
  // ...
}
```

**NACHHER (adapter.ts::extractCharacterStats()):**
```typescript
// Flach, system-agnostic (wie D&D5e)
return {
  name: "Thorwal der Krieger",
  type: "character",
  system: "dsa5",

  // Eigenschaften als flaches Object
  attributes: {
    MU: 12, KL: 14, IN: 11, CH: 10,
    FF: 13, GE: 14, KO: 15, KK: 16
  },

  // LeP mit Wound-Inversion
  health: {
    current: 30,  // wounds.max - wounds.value
    max: 35,
    wounds: 5     // Original-Wert
  },

  // Ressourcen als Array
  resources: [
    { name: "AsP", type: "mana", current: 28, max: 32 },
    { name: "KaP", type: "karma", current: 5, max: 8 }
  ],

  // Profil
  species: "Elf",
  culture: "Auelfen",
  profession: "Wildniskundiger",

  // Experience
  experience: {
    total: 1200,
    spent: 980,
    available: 220
  },

  // Skills (vereinfacht)
  skills: [
    { name: "Klettern", value: 8, category: "body" },
    { name: "Überreden", value: 6, category: "social" },
    // ... nur Namen und Werte, keine volle DSA5-Struktur
  ],

  // Combat (vereinfacht)
  combatSkills: [
    { name: "Raufen", at: 10, pa: 8 },
    // ...
  ],

  // DSA5-spezifische Zusatzdaten (optional)
  dsa5Details: {
    size: "Mittel",
    initiative: 13,
    dodge: 8,
    tradition: { magical: "Gildenmagier" },
    advantages: ["Eisern", "Schnelle Heilung"],
    // ... alles DSA5-spezifische
  }
}
```

#### Migrations-Strategie:

**4.1 Eigenschaften umwandeln:**
```typescript
// VORHER (character-import.ts:26-36):
dsa5Data.eigenschaften = {
  MU: { ...system.characteristics.mu, species: 0 },
  KL: { ...system.characteristics.kl, species: 0 },
  // ... komplett
};

// NACHHER (adapter.ts):
result.attributes = {
  MU: system.characteristics.mu?.value || 0,
  KL: system.characteristics.kl?.value || 0,
  IN: system.characteristics.in?.value || 0,
  CH: system.characteristics.ch?.value || 0,
  FF: system.characteristics.ff?.value || 0,
  GE: system.characteristics.ge?.value || 0,
  KO: system.characteristics.ko?.value || 0,
  KK: system.characteristics.kk?.value || 0,
};
```

**4.2 LeP mit Wound-Inversion:**
```typescript
// VORHER (character-import.ts:41-42):
dsa5Data.status = {
  wounds: system.status.wounds,  // Komplett
  astralenergy: system.status.astralenergy,
  // ...
};

// NACHHER (adapter.ts):
if (system.status?.wounds) {
  const wounds = system.status.wounds;
  result.health = {
    current: (wounds.max || 0) - (wounds.value || 0),  // Inversion!
    max: wounds.max || 0,
    wounds: wounds.value || 0  // Original für Debugging
  };
}
```

**4.3 Ressourcen als Array:**
```typescript
// VORHER (character-import.ts:41-51):
dsa5Data.status = {
  astralenergy: system.status.astralenergy,
  karmaenergy: system.status.karmaenergy,
  // ...
};

// NACHHER (adapter.ts):
result.resources = [];
if (system.status?.astralenergy && system.status.astralenergy.max > 0) {
  result.resources.push({
    name: 'AsP',
    type: 'mana',
    current: system.status.astralenergy.value || 0,
    max: system.status.astralenergy.max || 0
  });
}
if (system.status?.karmaenergy && system.status.karmaenergy.max > 0) {
  result.resources.push({
    name: 'KaP',
    type: 'karma',
    current: system.status.karmaenergy.value || 0,
    max: system.status.karmaenergy.max || 0
  });
}
```

**4.4 Skills vereinfachen:**
```typescript
// VORHER (character-import.ts:112-131):
export function extractDsa5Skills(actor: Actor): Dsa5Talent[] {
  const talents: Dsa5Talent[] = [];
  actor.items.forEach((item) => {
    if (item.type === 'skill') {
      const system = (item as any).system || {};
      talents.push({
        name: item.name,
        value: system.talentValue?.value || system.value || 0,
        eigenschaften: system.characteristic || [],  // Volle Probe-Info
      });
    }
  });
  return talents;
}

// NACHHER (adapter.ts::extractCharacterStats):
result.skills = [];
if (actorData.items) {
  for (const item of actorData.items) {
    if (item.type === 'skill') {
      const itemSystem = item.system || {};
      result.skills.push({
        name: item.name,
        value: itemSystem.talentValue?.value || itemSystem.value || 0,
        // OPTIONAL: category für Gruppierung
        category: SKILL_GROUPS[itemSystem.category?.toLowerCase()] || 'other'
      });
    }
  }
}
```

#### Was NICHT in extractCharacterStats() kommt:

Diese Funktionen bleiben **intern** (nicht in adapter.ts):
- ❌ `extractDsa5Skills()` - Wird inline in extractCharacterStats()
- ❌ `extractDsa5CombatSkills()` - Wird inline in extractCharacterStats()
- ❌ `getDsa5CharacterSummary()` - Wird zu `formatCreatureForDetails()` oder weggelassen

**Test für morgen:**
```javascript
// In Foundry Console:
const actor = game.actors.getName("Thorwal der Krieger");
const adapter = new Dsa5Adapter();
const stats = adapter.extractCharacterStats(actor);

console.log("Name:", stats.name);
console.log("Attributes:", stats.attributes);
console.log("Health:", stats.health);  // WICHTIG: current sollte LeP sein (max - wounds)
console.log("Resources:", stats.resources);  // AsP, KaP
console.log("Skills (first 5):", stats.skills.slice(0, 5));
```

---

### 5. `adapter.ts` - Formatting-Methoden (NEU, 0% portierbar)

**Quelle:** D&D5e Template + DSA5-Logik
**Aufwand:** 2 Stunden
**Schwierigkeit:** ⭐⭐⭐ Mittel

#### 5.1 `formatCreatureForList()` - Kompakte Darstellung

**D&D5e Beispiel:**
```typescript
formatCreatureForList(creature: SystemCreatureIndex): any {
  const dnd5eCreature = creature as DnD5eCreatureIndex;
  return {
    id: creature.id,
    name: creature.name,
    type: creature.type,
    pack: { id: creature.packName, label: creature.packLabel },
    stats: {
      challengeRating: dnd5eCreature.systemData?.challengeRating,
      creatureType: dnd5eCreature.systemData?.creatureType,
      size: dnd5eCreature.systemData?.size,
      hitPoints: dnd5eCreature.systemData?.hitPoints,
      armorClass: dnd5eCreature.systemData?.armorClass,
    }
  };
}
```

**DSA5 Anpassung:**
```typescript
formatCreatureForList(creature: SystemCreatureIndex): any {
  const dsa5Creature = creature as Dsa5CreatureIndex;
  return {
    id: creature.id,
    name: creature.name,
    type: creature.type,
    pack: { id: creature.packName, label: creature.packLabel },
    stats: {
      level: dsa5Creature.systemData?.level,          // Statt CR
      species: dsa5Creature.systemData?.species,      // Statt creatureType
      culture: dsa5Creature.systemData?.culture,      // DSA5-spezifisch
      size: dsa5Creature.systemData?.size,
      lifePoints: dsa5Creature.systemData?.lifePoints,  // Statt hitPoints
      meleeDefense: dsa5Creature.systemData?.meleeDefense,  // Statt AC
      hasSpells: dsa5Creature.systemData?.hasSpells,
    }
  };
}
```

#### 5.2 `formatCreatureForDetails()` - Erweiterte Darstellung

```typescript
formatCreatureForDetails(creature: SystemCreatureIndex): any {
  const formatted = this.formatCreatureForList(creature);
  const dsa5Creature = creature as Dsa5CreatureIndex;

  // Zusätzliche Details
  formatted.detailedStats = {
    level: dsa5Creature.systemData?.level,
    species: dsa5Creature.systemData?.species,
    culture: dsa5Creature.systemData?.culture,
    experience: dsa5Creature.systemData?.experience,
    size: dsa5Creature.systemData?.size,
    lifePoints: dsa5Creature.systemData?.lifePoints,
    meleeDefense: dsa5Creature.systemData?.meleeDefense,
    rangedDefense: dsa5Creature.systemData?.rangedDefense,
    hasSpells: dsa5Creature.systemData?.hasSpells,
    traits: dsa5Creature.systemData?.traits || [],
    rarity: dsa5Creature.systemData?.rarity,
  };

  return formatted;
}
```

**Test für morgen:**
```javascript
// In MCP Tools via Claude Desktop:
// Suche nach "Goblin" und schaue dir die Ausgabe an
// Erwartung: Sollte species, culture, level zeigen (nicht CR, creatureType)
```

---

### 6. `adapter.ts` - Weitere Methoden (NEU)

**6.1 `getDataPaths()` - Feldpfade definieren:**
```typescript
getDataPaths(): Record<string, string | null> {
  return {
    // DSA5 Pfade
    level: 'system.details.level.value',
    species: 'system.details.species.value',
    culture: 'system.details.culture.value',
    profession: 'system.details.career.value',  // WICHTIG: 'career' nicht 'profession'!

    // Eigenschaften
    characteristics: 'system.characteristics',
    mu: 'system.characteristics.mu.value',
    kl: 'system.characteristics.kl.value',
    // ... alle 8

    // Status
    wounds: 'system.status.wounds',
    astralenergy: 'system.status.astralenergy',
    karmaenergy: 'system.status.karmaenergy',

    // D&D5e-Pfade (nicht in DSA5)
    challengeRating: null,
    hitPoints: null,
    armorClass: null,
    legendaryActions: null,
  };
}
```

**6.2 `getPowerLevel()` - Für Sortierung:**
```typescript
getPowerLevel(creature: SystemCreatureIndex): number | undefined {
  const dsa5Creature = creature as Dsa5CreatureIndex;
  return dsa5Creature.systemData?.level;  // Stufe als Power Level
}
```

**6.3 `canHandle()` - System-Erkennung:**
```typescript
canHandle(systemId: string): boolean {
  return systemId.toLowerCase() === 'dsa5';
}
```

**6.4 `getMetadata()` - System-Info:**
```typescript
getMetadata(): SystemMetadata {
  return {
    id: 'dsa5',
    name: 'dsa5',
    displayName: 'Das Schwarze Auge 5',
    version: '1.0.0',
    description: 'Support for DSA5 (Das Schwarze Auge 5. Edition) mit Eigenschaften, Talenten, LeP/AsP/KaP',
    supportedFeatures: {
      creatureIndex: true,
      characterStats: true,
      spellcasting: true,
      powerLevel: true  // Uses Level/Stufe
    }
  };
}
```

---

## 🧪 Test-Checkliste für morgen

### A. Foundry Console Tests (Browser F12)

```javascript
// 1. Constants laden
const { WOUNDS_HELPER, SIZE_MAP_DE_TO_EN, EIGENSCHAFT_NAMES } =
  await import('./systems/dsa5/constants.js');

// 2. Wound-Inversion testen
const wounds = { value: 15, max: 35 };
console.log("Wunden → HP:", WOUNDS_HELPER.toHitPoints(wounds));
// Erwartung: { current: 20, max: 35 }

// 3. Größen-Mapping testen
console.log("Groß → EN:", SIZE_MAP_DE_TO_EN['groß']);
// Erwartung: "large"

// 4. Eigenschaften-Namen testen
console.log("MU:", EIGENSCHAFT_NAMES.MU);
// Erwartung: { short: 'MU', german: 'Mut', english: 'Courage' }

// 5. Character Stats extrahieren (wenn adapter.ts fertig)
const actor = game.actors.getName("Dein DSA5 Charakter");
const adapter = new Dsa5Adapter();
const stats = adapter.extractCharacterStats(actor);
console.log("Stats:", stats);
// Prüfe: attributes (8 Eigenschaften), health (LeP invertiert), resources (AsP/KaP)

// 6. Index Builder testen (wenn fertig)
const builder = new Dsa5IndexBuilder('foundry-mcp-bridge');
console.log("System ID:", builder.getSystemId());  // 'dsa5'
```

### B. MCP Tools Tests (Claude Desktop)

```json
// 1. Filter nach Spezies
{
  "tool": "list-creatures-by-criteria",
  "filters": {
    "species": "Elf",
    "hasSpells": true
  }
}

// 2. Filter nach Stufe
{
  "tool": "list-creatures-by-criteria",
  "filters": {
    "level": { "min": 3, "max": 7 },
    "size": "medium"
  }
}

// 3. Character anzeigen
{
  "tool": "get-character",
  "name": "Thorwal der Krieger"
}
// Prüfe: Eigenschaften (MU, KL, ...), LeP korrekt, AsP/KaP vorhanden

// 4. Creature Index suchen
{
  "tool": "search-compendium",
  "query": "Goblin",
  "type": "Actor"
}
```

### C. Kritische Validierungen

**LeP Wound-Inversion (WICHTIGSTER TEST!):**
```javascript
// In Foundry: Charakter hat 35 LeP max, 15 Wunden genommen
const actor = game.actors.getName("Test-Charakter");
console.log("System Wounds:", actor.system.status.wounds);
// Erwartung: { value: 15, max: 35 }

const stats = adapter.extractCharacterStats(actor);
console.log("Extracted Health:", stats.health);
// Erwartung: { current: 20, max: 35, wounds: 15 }
//              ^^^^^^^ = 35 - 15 (INVERSION!)
```

**Eigenschaften (8 Attribute):**
```javascript
const stats = adapter.extractCharacterStats(actor);
console.log("Attributes:", Object.keys(stats.attributes));
// Erwartung: ['MU', 'KL', 'IN', 'CH', 'FF', 'GE', 'KO', 'KK']
//            (genau 8, nicht 6 wie D&D5e!)
```

**Deutsche vs. Englische Begriffe:**
```javascript
// Filter sollten Deutsch akzeptieren:
const filters = { species: "Elf" };  // Nicht "elf"
const matches = matchesDsa5Filters(creature, filters);
// Erwartung: Case-insensitive Matching
```

---

## 🎯 Prioritäten für Code-Migration

### Phase 1 (Morgen startbar):
1. ✅ **constants.ts** - 30min, trivial
2. ✅ **filters.ts Grundgerüst** - 1h, Schema + Konstanten

### Phase 2 (Nach Test-Feedback):
3. ⚠️ **index-builder.ts** - 2-3h, Class-Wrapper
4. ⚠️ **adapter.ts extractCharacterStats()** - 3-4h, Umstrukturierung

### Phase 3 (Nach Core-Funktionen):
5. ✅ **adapter.ts Formatting** - 2h, Templates
6. ✅ **adapter.ts Metadata** - 30min, trivial

---

## 📝 Offene Fragen für @adambdooley

1. **Deutsche UI-Messages:** OK für DSA5-spezifische Notifications? (Index-Build)
2. **Deutsche Begriffe in Filtern:** `species: "Elf"` statt `species: "elf"`?
3. **Wound-Inversion Dokumentation:** Wo am besten dokumentieren? README vs. Code-Kommentare?
4. **Testing:** Gibt es Unit-Test-Vorgaben für neue Systeme?
5. **Eigenschaften-Anzeige:** Alle 8 Eigenschaften anzeigen oder nur relevante?

---

## 🔗 Referenzen

- **v0.6.0 D&D5e Adapter:** `packages/mcp-server/src/systems/dnd5e/adapter.ts`
- **v0.6.0 Types:** `packages/mcp-server/src/systems/types.ts`
- **DSA5 Foundry System:** https://github.com/Plushtoast/dsa5-foundryVTT
- **Roadmap:** `DSA5_V0.6.1_ROADMAP.md`
