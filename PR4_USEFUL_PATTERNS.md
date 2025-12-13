# PR #4 Nützliche Patterns für Bug-Fixes

**Zweck:** Dokumentation von Code-Snippets aus PR #4 die für BUG #1 und BUG #2 Fixes relevant sind.

**Quelle:** `claude/fix-dsa-token-tools-01XjfWKx8w6XuZ6onXv4dJ4f` Branch

---

## 🎯 Relevanz für Bugs

| Bug | Relevante Patterns aus PR #4 | Verwendbar? |
|-----|------------------------------|-------------|
| **BUG #1** | DSA5 Filter-System (Level statt CR) | ✅ JA |
| **BUG #2** | Actor Creation mit vollständigem `toObject()` | ✅ JA |

---

## 🐛 BUG #1: list-creatures-by-criteria - DSA5 Filter System

### Problem
Aktueller Code verwendet D&D5e Challenge Rating (CR) System.
DSA5 hat **kein CR** - stattdessen **Experience Levels 1-7**.

### Lösung aus PR #4

#### 1. DSA5 Experience Levels (Erfahrungsgrade)

**Datei:** `packages/mcp-server/src/systems/dsa5/constants.ts`

```typescript
/**
 * Erfahrungsgrad-Definitionen (DSA5 "Levels")
 * Level 1-7, nicht 0-6!
 */
export const EXPERIENCE_LEVELS = [
  { name: 'Unerfahren', nameEn: 'Inexperienced', min: 0, max: 900, level: 1 },
  { name: 'Durchschnittlich', nameEn: 'Average', min: 901, max: 1800, level: 2 },
  { name: 'Erfahren', nameEn: 'Experienced', min: 1801, max: 2700, level: 3 },
  { name: 'Kompetent', nameEn: 'Competent', min: 2701, max: 3600, level: 4 },
  { name: 'Meisterlich', nameEn: 'Masterful', min: 3601, max: 4500, level: 5 },
  { name: 'Brillant', nameEn: 'Brilliant', min: 4501, max: 5400, level: 6 },
  { name: 'Legendär', nameEn: 'Legendary', min: 5401, max: Infinity, level: 7 },
] as const;

/**
 * Konvertiert Abenteuerpunkte zu Erfahrungsgrad
 */
export function getExperienceLevel(totalAP: number): DSA5ExperienceLevel {
  for (const level of EXPERIENCE_LEVELS) {
    if (totalAP >= level.min && totalAP <= level.max) {
      return level;
    }
  }
  return EXPERIENCE_LEVELS[6]; // Fallback: Legendär
}
```

**Verwendung für BUG #1:**
- ✅ Verwenden um AP → Level zu konvertieren
- ✅ Level-basiertes Filtering implementieren
- ✅ CR-Queries auf Level-Queries mappen

---

#### 2. DSA5 Filter Schema

**Datei:** `packages/mcp-server/src/systems/dsa5/filters.ts`

```typescript
/**
 * DSA5 Species (Spezies/Rassen)
 */
export const DSA5Species = [
  'mensch',      // Human
  'elf',         // Elf
  'halbelf',     // Half-Elf
  'zwerg',       // Dwarf
  'goblin',      // Goblin
  'ork',         // Orc
  'halborc',     // Half-Orc
  'achaz',       // Achaz (lizard folk)
  'troll',       // Troll
  'oger',        // Ogre
  'drache',      // Dragon
  'dämon',       // Demon
  'elementar',   // Elemental
  'untot',       // Undead
  'tier',        // Animal/Beast
  'chimäre',     // Chimera/Hybrid
] as const;

/**
 * DSA5 filter schema
 */
export const DSA5FiltersSchema = z.object({
  // Level filter (1-7) - replaces D&D5e's Challenge Rating
  level: z.union([
    z.number().min(1).max(7),
    z.object({
      min: z.number().min(1).max(7).optional(),
      max: z.number().min(1).max(7).optional()
    })
  ]).optional(),

  // Species filter (Spezies/Rasse)
  species: z.enum(DSA5Species).optional(),

  // Culture filter
  culture: z.string().optional(),

  // Size filter
  size: z.enum(CreatureSizes).optional(),

  // Has spells (Zauber)
  hasSpells: z.boolean().optional(),

  // Experience points range (AP)
  experiencePoints: z.union([
    z.number(),
    z.object({
      min: z.number().optional(),
      max: z.number().optional()
    })
  ]).optional(),
});

export type DSA5Filters = z.infer<typeof DSA5FiltersSchema>;
```

**Verwendung für BUG #1:**
- ✅ Filter-Schema als Vorlage für DSA5-kompatibles Filtering
- ✅ Species statt CreatureType
- ✅ Level statt CR
- ✅ AP-Range als Detail-Filter

---

#### 3. DSA5 Filter Matching Logic

**Datei:** `packages/mcp-server/src/systems/dsa5/filters.ts`

```typescript
/**
 * Check if a creature matches DSA5 filters
 */
export function matchesDSA5Filters(creature: any, filters: DSA5Filters): boolean {
  // Level filter (Erfahrungsgrad 1-7)
  if (filters.level !== undefined) {
    const level = creature.systemData?.level;
    if (level === undefined) return false;

    if (typeof filters.level === 'number') {
      // Exact match
      if (level !== filters.level) return false;
    } else {
      // Range match
      const min = filters.level.min ?? 1;
      const max = filters.level.max ?? 7;
      if (level < min || level > max) return false;
    }
  }

  // Species filter
  if (filters.species !== undefined) {
    const species = creature.systemData?.species?.toLowerCase();
    if (species !== filters.species.toLowerCase()) return false;
  }

  // Culture filter
  if (filters.culture !== undefined) {
    const culture = creature.systemData?.culture?.toLowerCase();
    if (!culture || !culture.includes(filters.culture.toLowerCase())) return false;
  }

  // Size filter
  if (filters.size !== undefined) {
    const size = creature.systemData?.size?.toLowerCase();
    if (size !== filters.size.toLowerCase()) return false;
  }

  // Has spells filter
  if (filters.hasSpells !== undefined) {
    const hasSpells = creature.systemData?.hasSpells === true;
    if (hasSpells !== filters.hasSpells) return false;
  }

  return true; // All filters passed
}
```

**Verwendung für BUG #1:**
- ✅ Pattern für DSA5 Creature Filtering
- ✅ Level-Range Logik
- ✅ Species/Culture String-Matching

---

#### 4. DSA5 Field Paths

**Datei:** `packages/mcp-server/src/systems/dsa5/constants.ts`

```typescript
/**
 * Common DSA5 field paths for system data access
 */
export const FIELD_PATHS = {
  // Characteristics (Eigenschaften)
  CHARACTERISTICS: 'system.characteristics',
  CHAR_MU: 'system.characteristics.mu.value',
  CHAR_KL: 'system.characteristics.kl.value',
  CHAR_IN: 'system.characteristics.in.value',
  CHAR_CH: 'system.characteristics.ch.value',
  CHAR_FF: 'system.characteristics.ff.value',
  CHAR_GE: 'system.characteristics.ge.value',
  CHAR_KO: 'system.characteristics.ko.value',
  CHAR_KK: 'system.characteristics.kk.value',

  // Status values
  STATUS_WOUNDS: 'system.status.wounds',
  STATUS_WOUNDS_CURRENT: 'system.status.wounds.current',  // ACTUAL LeP
  STATUS_WOUNDS_MAX: 'system.status.wounds.max',

  // Details
  DETAILS_SPECIES: 'system.details.species.value',
  DETAILS_CULTURE: 'system.details.culture.value',
  DETAILS_CAREER: 'system.details.career.value',  // IMPORTANT: 'career' not 'profession'
  DETAILS_EXPERIENCE_TOTAL: 'system.details.experience.total', // AP

  // Size (in status, not details!)
  STATUS_SIZE: 'system.status.size.value',
} as const;
```

**Verwendung für BUG #1:**
- ✅ Korrekte DSA5 Data Paths
- ✅ `career` statt `profession` (wichtig!)
- ✅ LeP in `status.wounds.current` nicht `wounds.value`

---

### BUG #1 Fix-Strategie (basierend auf PR #4)

**Option A: System Detection + DSA5 Branch**
```typescript
// In compendium.ts list-creatures-by-criteria handler
async function listCreaturesByCriteria(filters: any) {
  const systemId = (game.system as any)?.id;

  if (systemId === 'dsa5') {
    // DSA5-specific filtering
    return listDSA5Creatures({
      level: filters.challengeRating, // Map CR → Level
      species: filters.creatureType,   // Map type → species
      size: filters.size,
      hasSpells: filters.hasSpells
    });
  }

  // D&D5e/PF2e CR-based filtering
  return listCreaturesByCR(filters);
}
```

**Option B: Error Message + Alternative**
```typescript
if (systemId === 'dsa5' && (filters.challengeRating || filters.level)) {
  return {
    error: "DSA5 does not use Challenge Rating. Use 'level' (1-7), 'species', or 'culture' filters instead.",
    suggestion: "Try: {level: {min: 3, max: 5}, species: 'ork'}",
    availableFilters: ['level', 'species', 'culture', 'size', 'hasSpells']
  };
}
```

---

## 🐛 BUG #2: create-actor-from-compendium - Actor Creation Fix

### Problem
Actor Creation schlägt fehl für DSA5 Creatures.
`get-compendium-entry-full` funktioniert ✅ aber `create-actor-from-compendium` ❌

### Lösung aus PR #4

#### Actor Creation mit vollständigem toObject()

**Datei:** `packages/foundry-module/src/data-access.ts`

```typescript
async createActorFromCompendiumEntry(request: {
  packId: string;
  itemId: string;
  customNames: string[];
  quantity?: number;
  addToScene?: boolean;
  placement?: any;
}): Promise<ActorCreationResult> {

  // ... validation ...

  const pack = game.packs.get(packId);
  const sourceDocument = await pack.getDocument(itemId);

  // ✅ KEY CHANGE: Accept both 'npc' and 'character' types
  if (!['npc', 'character'].includes(sourceDocument.type)) {
    throw new Error(`Document is not a valid actor type (type: ${sourceDocument.type})`);
  }

  const sourceActor = sourceDocument as Actor;

  for (let i = 0; i < finalQuantity; i++) {
    const customName = names[i] || `${sourceActor.name} ${i + 1}`;

    // ✅ KEY: Get FULL actor data with toObject()
    const sourceData = sourceActor.toObject() as any;

    const actorData = {
      name: customName,
      type: sourceData.type,
      img: sourceData.img,

      // ✅ KEY: Include ALL system data
      system: sourceData.system || sourceData.data || {},

      // ✅ KEY: Include ALL items (87 items for DSA5 Ork)
      items: sourceData.items || [],

      // ✅ KEY: Include effects
      effects: sourceData.effects || [],

      folder: null, // Don't inherit folder

      // ✅ KEY: Include prototype token
      prototypeToken: sourceData.prototypeToken,
    };

    // ✅ Fix remote image URLs
    if (actorData.prototypeToken?.texture?.src?.startsWith('http')) {
      actorData.prototypeToken.texture.src = null;
    }

    // Create folder for organization
    const folderId = await this.getOrCreateFolder('Foundry MCP Creatures', 'Actor');
    if (folderId) {
      (actorData as any).folder = folderId;
    }

    // ✅ KEY: Create with full data
    const newActor = await Actor.create(actorData);
    if (!newActor) {
      throw new Error(`Failed to create actor "${customName}"`);
    }

    createdActors.push({
      id: newActor.id,
      name: newActor.name,
      originalName: sourceActor.name,
      sourcePackLabel: pack.metadata.label,
    });
  }

  // ... scene placement logic ...

  return {
    success: createdActors.length > 0,
    totalCreated: createdActors.length,
    actors: createdActors,
    tokensPlaced,
    errors: errors.length > 0 ? errors : undefined,
  };
}
```

### BUG #2 Key Differences vs Current Code

| Aspect | Current Code (Broken) | PR #4 Code (Possibly Working) |
|--------|----------------------|--------------------------------|
| **Type Check** | ❓ Unknown | ✅ `['npc', 'character']` |
| **Data Extraction** | ❓ Unknown | ✅ `sourceActor.toObject()` |
| **System Data** | ❓ Unknown | ✅ `sourceData.system \|\| sourceData.data` |
| **Items Included** | ❓ Unknown | ✅ `sourceData.items \|\| []` (all 87) |
| **Effects Included** | ❓ Unknown | ✅ `sourceData.effects \|\| []` |
| **Prototype Token** | ❓ Unknown | ✅ `sourceData.prototypeToken` |
| **Remote Image Fix** | ❓ Unknown | ✅ Clears http:// URLs |

### BUG #2 Fix-Strategie

**Schritt 1: Vergleiche mit aktuellem Code**
```bash
# Prüfe aktuellen createActorFromCompendiumEntry Code
grep -A 50 "createActorFromCompendiumEntry" packages/foundry-module/src/data-access.ts
```

**Schritt 2: Teste ob Type Check das Problem ist**
- DSA5 Creatures sind möglicherweise type: 'character' nicht 'npc'
- Aktueller Code akzeptiert vielleicht nur 'npc'

**Schritt 3: Teste ob toObject() fehlt**
- Möglicherweise verwendet aktueller Code nur partielle Daten
- `toObject()` gibt ALLE Daten inkl. Items, Effects, System

**Schritt 4: Teste ob Items/Effects fehlen**
- DSA5 Ork hat 87 Items
- Wenn diese nicht kopiert werden → Actor ist leer

---

## 📊 Pattern-Zusammenfassung

### Was aus PR #4 übernehmen?

#### Für BUG #1 (list-creatures-by-criteria)

✅ **VERWENDEN:**
1. `EXPERIENCE_LEVELS` Konstante (Level 1-7 Mapping)
2. `getExperienceLevel(totalAP)` Funktion
3. DSA5 Species Liste
4. Level-Range Filtering Logic
5. `FIELD_PATHS` Konstanten (korrekte DSA5 Pfade)

❌ **NICHT VERWENDEN:**
- Komplettes Adapter Pattern (zu komplex)
- Zod Schema Validation (optional)
- Vollständiges Registry System

**Implementierung:**
```typescript
// Minimal-Version für BUG #1
function listCreaturesDSA5(filters: any) {
  const creatures = /* ... get from index ... */;

  return creatures.filter(c => {
    // Level filter
    if (filters.level) {
      const ap = c.system?.details?.experience?.total || 0;
      const level = getExperienceLevel(ap).level;

      if (typeof filters.level === 'number') {
        if (level !== filters.level) return false;
      } else {
        const min = filters.level.min ?? 1;
        const max = filters.level.max ?? 7;
        if (level < min || level > max) return false;
      }
    }

    // Species filter
    if (filters.species) {
      const species = c.system?.details?.species?.value?.toLowerCase();
      if (species !== filters.species.toLowerCase()) return false;
    }

    return true;
  });
}
```

---

#### Für BUG #2 (create-actor-from-compendium)

✅ **VERWENDEN:**
1. Type Check: `['npc', 'character']` statt nur `['npc']`
2. Vollständiges `toObject()` Extraction
3. System Data Fallback: `sourceData.system || sourceData.data`
4. Items Array Inklusion
5. Effects Array Inklusion
6. Prototype Token Inklusion
7. Remote Image URL Fix

**Implementierung:**
```typescript
// Minimal-Version für BUG #2
const sourceData = sourceActor.toObject() as any;

const actorData = {
  name: customName,
  type: sourceData.type,
  img: sourceData.img,
  system: sourceData.system || sourceData.data || {},  // ← KEY
  items: sourceData.items || [],                        // ← KEY (87 items!)
  effects: sourceData.effects || [],                    // ← KEY
  prototypeToken: sourceData.prototypeToken,           // ← KEY
  folder: folderId
};

// Fix remote URLs
if (actorData.prototypeToken?.texture?.src?.startsWith('http')) {
  actorData.prototypeToken.texture.src = null;
}

const newActor = await Actor.create(actorData);
```

---

## 🎯 Nächste Schritte

### Vor PR #4 Schließung

1. ✅ **Dokumentation erstellt** - Diese Datei
2. ⏳ **Test der Patterns** - Optional: Teste Fix lokal
3. ⏳ **PR #4 schließen** - Mit Referenz zu dieser Dokumentation

### Nach PR #4 Schließung

1. **BUG #2 fixen** (HIGH Priority)
   - Verwende Actor Creation Pattern aus PR #4
   - Teste mit DSA5 Ork (87 Items)
   - Validiere dass alle Items mitkommen

2. **BUG #1 fixen** (MEDIUM Priority)
   - Verwende Level-Filter Pattern aus PR #4
   - System Detection hinzufügen
   - Alternative Filter für DSA5 implementieren

3. **Graduelle Verbesserung**
   - Helper Functions extrahieren
   - DSA5 Konstanten in shared/ Package
   - Dokumentation erweitern

---

## 📁 Dateien aus PR #4 die relevant sind

**Für Referenz (NICHT mergen!):**

```
packages/mcp-server/src/systems/dsa5/
├── constants.ts           ✅ EXPERIENCE_LEVELS, FIELD_PATHS
├── filters.ts             ✅ DSA5FiltersSchema, matchesDSA5Filters
├── adapter.ts             ⚠️ Komplex, nur Konzepte übernehmen
└── index-builder.ts       ⚠️ Nur wenn Index-Rebuild nötig

packages/foundry-module/src/
└── data-access.ts         ✅ createActorFromCompendiumEntry() Methode

docs/
└── ARCHITECTURE.md        ✅ Rules für system-agnostic code
```

---

**Dokumentiert:** 2024-12-13
**Zweck:** Patterns aus PR #4 extrahieren OHNE den gesamten Branch zu mergen
**Status:** Bereit für Bug-Fixes
