# DSA5 Erfahrungsgrade - Level-Mapping

**Quelle:** https://dsa.ulisses-regelwiki.de/Heldenerschaffung.html
**Wichtig:** In DSA5 ist **Erfahrungsgrad** das Äquivalent zu "Level", NICHT die Abenteuerpunkte!

---

## Erfahrungsgrade und AP-Bereiche

| Erfahrungsgrad | AP-Bereich | Numerischer Level |
|----------------|------------|-------------------|
| **Unerfahren** | 0 - 900 AP | **1** (Starting Level!) |
| **Durchschnittlich** | 901 - 1800 AP | **2** |
| **Erfahren** | 1801 - 2700 AP | **3** |
| **Kompetent** | 2701 - 3600 AP | **4** |
| **Meisterlich** | 3601 - 4500 AP | **5** |
| **Brillant** | 4501 - 5400 AP | **6** |
| **Legendär** | 5401+ AP | **7** |

**WICHTIG:** DSA5 verwendet Level 1-7 (Unerfahren bis Legendär). Beide Systeme starten bei Level 1!

**Quelle:** https://github.com/Plushtoast/dsa5-foundryVTT/blob/master/template.json
- DSA5 hat kein "level" Feld im template.json
- Nur `experience.total` und `experience.spent`
- Erfahrungsgrad wird aus AP berechnet

---

## Mapping-Funktion für constants.ts

```typescript
/**
 * Erfahrungsgrad-Definitionen (DSA5 "Levels")
 * Quelle: https://dsa.ulisses-regelwiki.de/Heldenerschaffung.html
 *
 * WICHTIG: Level 1-7, nicht 0-6!
 * DSA5 startet bei Level 1 (Unerfahren), genau wie D&D5e
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
 * Erfahrungsgrad-Typ
 */
export type Dsa5ExperienceLevel = typeof EXPERIENCE_LEVELS[number];

/**
 * Konvertiert Abenteuerpunkte zu Erfahrungsgrad
 * @param totalAP - Gesamt-Abenteuerpunkte
 * @returns Erfahrungsgrad-Info (Name, Level, AP-Bereich)
 */
export function getExperienceLevel(totalAP: number): Dsa5ExperienceLevel {
  for (const level of EXPERIENCE_LEVELS) {
    if (totalAP >= level.min && totalAP <= level.max) {
      return level;
    }
  }
  // Fallback: Legendär
  return EXPERIENCE_LEVELS[6];
}

/**
 * Konvertiert numerischen Level zu Erfahrungsgrad
 * @param level - Level (1-7)
 * @returns Erfahrungsgrad-Info
 */
export function getExperienceLevelByNumber(level: number): Dsa5ExperienceLevel {
  const clamped = Math.max(1, Math.min(7, Math.floor(level)));
  return EXPERIENCE_LEVELS[clamped - 1]; // Array ist 0-indexed, aber Level 1-7
}

/**
 * Erfahrungsgrad-Namen (Deutsch)
 */
export const EXPERIENCE_LEVEL_NAMES_DE = EXPERIENCE_LEVELS.map(l => l.name);

/**
 * Erfahrungsgrad-Namen (Englisch)
 */
export const EXPERIENCE_LEVEL_NAMES_EN = EXPERIENCE_LEVELS.map(l => l.nameEn);
```

---

## Anpassungen für Dsa5CreatureIndex

**VORHER (in types.ts):**
```typescript
export interface Dsa5CreatureIndex {
  // ...
  level: number;          // ❌ Missverständlich - ist das AP oder Erfahrungsgrad?
  experience: number;     // Total AP
  // ...
}
```

**NACHHER (korrigiert):**
```typescript
export interface Dsa5CreatureIndex {
  // ...

  // Erfahrungsgrad (DSA5 "Level" - basiert auf AP)
  experienceLevel: number;        // 0-6 (Unerfahren bis Legendär)
  experienceLevelName: string;    // "Erfahren", "Kompetent", etc.

  // Abenteuerpunkte (Detail)
  experiencePoints: number;       // Total AP (z.B. 2400)

  // ...
}
```

---

## Filter-Schema Anpassungen

**In filters.ts:**

```typescript
export const Dsa5FiltersSchema = z.object({
  // Erfahrungsgrad-Filter (1-7 oder Name)
  experienceLevel: z.union([
    z.number().min(1).max(7),           // Numerisch: 1 (Unerfahren) - 7 (Legendär)
    z.string(),                         // String: "Erfahren", "Kompetent"
    z.object({                          // Bereich
      min: z.number().min(1).max(7).optional(),
      max: z.number().min(1).max(7).optional()
    })
  ]).optional(),

  // ODER: Filter nach Abenteuerpunkten
  experiencePoints: z.union([
    z.number(),
    z.object({
      min: z.number().optional(),
      max: z.number().optional()
    })
  ]).optional(),

  // Andere Filter...
  species: z.string().optional(),
  culture: z.string().optional(),
  // ...
});

export type Dsa5Filters = z.infer<typeof Dsa5FiltersSchema>;

/**
 * Prüft ob Kreatur die DSA5-Filter erfüllt
 */
export function matchesDsa5Filters(
  creature: Dsa5CreatureIndex,
  filters: Dsa5Filters
): boolean {
  // Erfahrungsgrad-Filter
  if (filters.experienceLevel !== undefined) {
    const creatureLevel = creature.experienceLevel;

    if (typeof filters.experienceLevel === 'number') {
      // Exakter Level
      if (creatureLevel !== filters.experienceLevel) return false;
    } else if (typeof filters.experienceLevel === 'string') {
      // Level-Name (z.B. "Erfahren")
      if (creature.experienceLevelName.toLowerCase() !== filters.experienceLevel.toLowerCase()) {
        return false;
      }
    } else {
      // Bereich
      const min = filters.experienceLevel.min ?? 1;
      const max = filters.experienceLevel.max ?? 7;
      if (creatureLevel < min || creatureLevel > max) return false;
    }
  }

  // AP-Filter (optional, für präzise Suchen)
  if (filters.experiencePoints !== undefined) {
    const creatureAP = creature.experiencePoints;

    if (typeof filters.experiencePoints === 'number') {
      if (creatureAP !== filters.experiencePoints) return false;
    } else {
      const min = filters.experiencePoints.min ?? 0;
      const max = filters.experiencePoints.max ?? 10000;
      if (creatureAP < min || creatureAP > max) return false;
    }
  }

  // ... andere Filter
  return true;
}

/**
 * Erstellt lesbare Beschreibung der Filter
 */
export function describeDsa5Filters(filters: Dsa5Filters): string {
  const parts: string[] = [];

  if (filters.experienceLevel !== undefined) {
    if (typeof filters.experienceLevel === 'number') {
      const levelName = getExperienceLevelByNumber(filters.experienceLevel).name;
      parts.push(`Erfahrungsgrad: ${levelName}`);
    } else if (typeof filters.experienceLevel === 'string') {
      parts.push(`Erfahrungsgrad: ${filters.experienceLevel}`);
    } else {
      const min = filters.experienceLevel.min ?? 0;
      const max = filters.experienceLevel.max ?? 6;
      const minName = getExperienceLevelByNumber(min).name;
      const maxName = getExperienceLevelByNumber(max).name;
      parts.push(`Erfahrungsgrad: ${minName} bis ${maxName}`);
    }
  }

  if (filters.experiencePoints !== undefined) {
    if (typeof filters.experiencePoints === 'number') {
      parts.push(`${filters.experiencePoints} AP`);
    } else {
      const min = filters.experiencePoints.min ?? 0;
      const max = filters.experiencePoints.max ?? 10000;
      parts.push(`${min}-${max} AP`);
    }
  }

  // ... andere Filter

  return parts.length > 0 ? parts.join(' | ') : 'Keine Filter';
}
```

---

## Index Builder Anpassungen

**In index-builder.ts::extractCreatureData():**

```typescript
// Extract experience points (total AP)
const experiencePoints = system.details?.experience?.total ??
                         system.experience?.total ??
                         system.status?.experience ??
                         0;

// Calculate experience level from AP
const experienceLevelInfo = getExperienceLevel(experiencePoints);

return {
  creature: {
    id: doc._id,
    name: doc.name,
    type: doc.type,
    packName: pack.metadata.id,
    packLabel: pack.metadata.label,

    // Erfahrungsgrad (berechnet aus AP)
    experienceLevel: experienceLevelInfo.level,           // 0-6
    experienceLevelName: experienceLevelInfo.name,        // "Erfahren", etc.

    // Abenteuerpunkte (Detail)
    experiencePoints: experiencePoints,

    // ... rest
  },
  errors: 0
};
```

---

## Character Stats Anpassungen

**In adapter.ts::extractCharacterStats():**

```typescript
extractCharacterStats(actorData: any): any {
  const system = actorData.system || {};

  // ... andere Felder

  // Experience (mit Erfahrungsgrad)
  if (system.details?.experience) {
    const totalAP = system.details.experience.total || 0;
    const spentAP = system.details.experience.spent || 0;
    const availableAP = totalAP - spentAP;

    const levelInfo = getExperienceLevel(totalAP);

    result.experience = {
      total: totalAP,
      spent: spentAP,
      available: availableAP,
      level: levelInfo.level,              // 0-6
      levelName: levelInfo.name,           // "Erfahren", etc.
      levelNameEn: levelInfo.nameEn        // "Experienced"
    };
  }

  return result;
}
```

---

## Adapter Formatting Anpassungen

**In adapter.ts::formatCreatureForList():**

```typescript
formatCreatureForList(creature: SystemCreatureIndex): any {
  const dsa5Creature = creature as Dsa5CreatureIndex;

  return {
    id: creature.id,
    name: creature.name,
    type: creature.type,
    pack: { id: creature.packName, label: creature.packLabel },
    stats: {
      experienceLevel: dsa5Creature.systemData?.experienceLevelName,  // "Erfahren"
      experiencePoints: dsa5Creature.systemData?.experiencePoints,    // 2400 AP
      species: dsa5Creature.systemData?.species,
      culture: dsa5Creature.systemData?.culture,
      // ...
    }
  };
}
```

**In adapter.ts::getPowerLevel():**

```typescript
getPowerLevel(creature: SystemCreatureIndex): number | undefined {
  const dsa5Creature = creature as Dsa5CreatureIndex;
  return dsa5Creature.systemData?.experienceLevel;  // 0-6 (statt AP!)
}
```

---

## Test-Beispiele

### Foundry Console:

```javascript
// Test: AP → Erfahrungsgrad
const { getExperienceLevel } = /* import from constants.ts */;

console.log(getExperienceLevel(0));     // { name: "Unerfahren", level: 0, ... }
console.log(getExperienceLevel(1200));  // { name: "Durchschnittlich", level: 1, ... }
console.log(getExperienceLevel(2400));  // { name: "Erfahren", level: 2, ... }
console.log(getExperienceLevel(6000));  // { name: "Legendär", level: 6, ... }

// Test: Character Stats
const actor = game.actors.getName("Thorwal");
const stats = adapter.extractCharacterStats(actor);
console.log("Experience:", stats.experience);
// Erwartung: {
//   total: 2400,
//   spent: 2100,
//   available: 300,
//   level: 2,
//   levelName: "Erfahren",
//   levelNameEn: "Experienced"
// }
```

### MCP Tools:

**Filter nach Erfahrungsgrad (numerisch):**
```json
{
  "tool": "list-creatures-by-criteria",
  "filters": {
    "experienceLevel": 2  // Erfahren
  }
}
```

**Filter nach Erfahrungsgrad (Name):**
```json
{
  "tool": "list-creatures-by-criteria",
  "filters": {
    "experienceLevel": "Kompetent"
  }
}
```

**Filter nach Erfahrungsgrad-Bereich:**
```json
{
  "tool": "list-creatures-by-criteria",
  "filters": {
    "experienceLevel": { "min": 2, "max": 4 }  // Erfahren bis Meisterlich
  }
}
```

**Filter nach AP:**
```json
{
  "tool": "list-creatures-by-criteria",
  "filters": {
    "experiencePoints": { "min": 2000, "max": 3000 }
  }
}
```

---

## Vorteile dieser Struktur

1. ✅ **Semantisch korrekt:** "Level" = Erfahrungsgrad (nicht AP)
2. ✅ **Benutzerfreundlich:** Filter nach "Erfahren" statt "2400 AP"
3. ✅ **Flexibel:** Filter nach Level ODER AP möglich
4. ✅ **Vergleichbar mit D&D5e CR:** `experienceLevel: 2` ≈ `challengeRating: 2`
5. ✅ **Power Level:** Sortierung nach Erfahrungsgrad (1-7)
6. ✅ **Internationalisierung:** Deutsche + Englische Namen
7. ✅ **Konsistent:** Beide Systeme starten bei Level 1

### Vergleich mit anderen Systemen

| System | Metrik | Bereich | Starting Value | Notes |
|--------|--------|---------|----------------|-------|
| **D&D 5e** | Character Level | 1-20 | **Level 1** | Standard Starting Level |
| **D&D 5e** | Challenge Rating | 0-30 | CR 0 (für Kreaturen) | CR 0 = sehr schwach |
| **PF2e** | Level | -1 to 25+ | **Level 1** | Level -1 für sehr schwache Kreaturen |
| **DSA5** | Erfahrungsgrad | **1-7** | **Level 1 (Unerfahren)** | Berechnet aus AP (0-900 AP = Level 1) |

**Wichtig:**
- Alle Systeme starten bei **Level 1** für Spieler-Charaktere
- DSA5: Level wird aus Abenteuerpunkten berechnet (kein "level" Feld in template.json)
- DSA5: Level 1-7, nicht 0-6!

---

## Migration-Checklist

- [ ] `constants.ts`: EXPERIENCE_LEVELS hinzufügen
- [ ] `constants.ts`: getExperienceLevel() Funktion
- [ ] `types.ts`: Dsa5CreatureIndex.experienceLevel + experienceLevelName
- [ ] `index-builder.ts`: AP → Level-Berechnung
- [ ] `filters.ts`: experienceLevel + experiencePoints Filter
- [ ] `adapter.ts`: extractCharacterStats() mit Level-Info
- [ ] `adapter.ts`: formatCreatureForList() mit Level-Name
- [ ] `adapter.ts`: getPowerLevel() → experienceLevel
- [ ] Tests: AP → Level Mapping validieren
- [ ] Tests: Filter nach Erfahrungsgrad

---

**Zusammenfassung:**
- **Erfahrungsgrad** (0-6) ist das DSA5 "Level"
- **Abenteuerpunkte** (AP) sind ein Detail/Ressource
- Mapping: AP → Erfahrungsgrad automatisch in `getExperienceLevel()`
- Filter können nach Level ODER AP filtern
