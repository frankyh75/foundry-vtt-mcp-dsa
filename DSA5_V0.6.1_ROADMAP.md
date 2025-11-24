# DSA5 v0.6.1 Contribution Roadmap

**Ziel:** DSA5-Support als offizieller v0.6.1-Release zum Upstream-Repository beitragen

**Geschätzte Arbeitszeit:** 15-20 Stunden
**Aktueller Stand:** Phase 2 abgeschlossen (DSA5 Adapter Layer auf feature/dsa5-adapter-layer)
**Wiederverwendbarkeit:** 60-70% der existierenden Code-Basis ist portierbar

---

## 📋 Phase 1: Koordination & Setup (1-2 Stunden)

### 1.1 Upstream-Koordination
- [ ] **Kommentar auf GitHub Issue #11 posten:**
  ```markdown
  @adambdooley Thank you for creating the v0.6.0 Registry Pattern! I've analyzed the
  architecture and I'm ready to contribute DSA5 support for v0.6.1.

  I have ~1400 lines of working DSA5 code (character import, creature index) on my
  feature branch. Based on your v0.6.0 structure, I estimate 15-20 hours to migrate
  to the new Registry Pattern.

  Questions before I start:
  1. Is the v0.6.0 branch stable for me to base DSA5 work on?
  2. Should I create a feature/dsa5-v0.6.1 branch off of feature/registry-pattern-v0.6.0?
  3. Any specific preferences for DSA5 naming conventions (e.g., "Das Schwarze Auge 5" vs "DSA5")?
  4. Do you want German or English comments/docs for DSA5-specific code?

  I'll start analysis this week and can submit a PR within 1-2 weeks.
  ```

- [ ] **Warten auf Antwort** (1-2 Tage) - währenddessen mit Phase 2 beginnen

### 1.2 Lokales Repository vorbereiten
```bash
# v0.6.0 Branch lokal auschecken
git fetch upstream
git checkout -b feature/dsa5-v0.6.1 upstream/feature/registry-pattern-v0.6.0

# Arbeitsbranch für Migration erstellen
git checkout -b local/dsa5-migration-work

# Referenz auf aktuellen DSA5-Code behalten
git branch backup/dsa5-adapter-layer-phase2 feature/dsa5-adapter-layer
```

---

## 🔍 Phase 2: v0.6.0 Architektur-Analyse (2-3 Stunden)

### 2.1 SystemAdapter Interface studieren
- [ ] **Datei lesen:** `packages/mcp-server/src/systems/types.ts`
  - SystemAdapter: 11 Methoden die implementiert werden müssen
  - IndexBuilder: 3 Methoden
  - SystemId Type erweitern: `'dnd5e' | 'pf2e' | 'dsa5'`

- [ ] **D&D5e Template analysieren:**
  - `packages/mcp-server/src/systems/dnd5e/adapter.ts` (150+ Zeilen)
  - `packages/mcp-server/src/systems/dnd5e/filters.ts` (200+ Zeilen)
  - `packages/mcp-server/src/systems/dnd5e/index-builder.ts` (300+ Zeilen)

### 2.2 Registrierungs-Mechanismus verstehen
- [ ] **System Registry:** `packages/mcp-server/src/systems/system-registry.ts`
  - Wie werden Adapter registriert?
  - Wie funktioniert `systemRegistry.getAdapter(systemId)`?

- [ ] **Index Builder Registry:** `packages/mcp-server/src/systems/index-builder-registry.ts`
  - Wo wird `DnD5eIndexBuilder` registriert?
  - Wo muss `Dsa5IndexBuilder` registriert werden?

### 2.3 Existierenden Code mappen
Erstelle Mapping-Dokument (kann als Kommentar in dieser Datei sein):

| Existierender Code | v0.6.0 Ziel | Migration |
|-------------------|-------------|-----------|
| `tools/dsa5/types.ts` (271 Zeilen) | `systems/dsa5/types.ts` + `types.ts` erweitern | 70% direkt kopierbar, 30% Anpassung |
| `tools/dsa5/field-mappings.ts` (200 Zeilen) | `systems/dsa5/constants.ts` | 90% direkt kopierbar |
| `tools/dsa5/creature-index.ts` (244 Zeilen) | `systems/dsa5/index-builder.ts` | 80% portierbar, Interface anpassen |
| `tools/dsa5/character-import.ts` (243 Zeilen) | `systems/dsa5/adapter.ts::extractCharacterStats()` | 60% portierbar, Umstrukturierung nötig |
| `tools/dsa5/index.ts` (101 Zeilen) | `systems/dsa5/index.ts` + Registry | 40% portierbar, neue Exports |

---

## 🛠️ Phase 3: Dateistruktur erstellen (1 Stunde)

### 3.1 DSA5 Package-Struktur anlegen
```bash
# Verzeichnis erstellen
mkdir -p packages/mcp-server/src/systems/dsa5

# Leere Dateien erstellen
touch packages/mcp-server/src/systems/dsa5/adapter.ts
touch packages/mcp-server/src/systems/dsa5/filters.ts
touch packages/mcp-server/src/systems/dsa5/index-builder.ts
touch packages/mcp-server/src/systems/dsa5/types.ts
touch packages/mcp-server/src/systems/dsa5/constants.ts
touch packages/mcp-server/src/systems/dsa5/index.ts
```

### 3.2 Core Types erweitern
**Datei:** `packages/mcp-server/src/systems/types.ts`

```typescript
// 1. SystemId erweitern (Zeile ~14)
export type SystemId = 'dnd5e' | 'pf2e' | 'dsa5';

// 2. DSA5CreatureIndex interface hinzufügen (nach PF2eCreatureIndex)
export interface Dsa5CreatureIndex extends SystemCreatureIndex {
  system: 'dsa5';
  systemData: {
    level?: number;                // Level/Stufe
    species?: string;              // Spezies (Mensch, Elf, etc.)
    culture?: string;              // Kultur
    experience?: number;           // Abenteuerpunkte
    size?: string;                 // Größe (klein, mittel, groß)
    lifePoints?: number;           // LeP (max)
    meleeDefense?: number;         // Verteidigungswert Nahkampf
    rangedDefense?: number;        // Verteidigungswert Fernkampf
    hasSpells: boolean;            // Zauber/Liturgien vorhanden
    traits?: string[];             // Merkmale
    rarity?: string;               // Seltenheit (optional)
  };
}

// 3. AnyCreatureIndex erweitern (Zeile ~200+)
export type AnyCreatureIndex =
  | DnD5eCreatureIndex
  | PF2eCreatureIndex
  | Dsa5CreatureIndex      // NEU
  | GenericCreatureIndex;
```

---

## 📝 Phase 4: Filter-System implementieren (2-3 Stunden)

### 4.1 Filter Schema definieren
**Datei:** `packages/mcp-server/src/systems/dsa5/filters.ts`

**Basis-Template:**
```typescript
import { z } from 'zod';
import type { Dsa5CreatureIndex } from './types.js';

// DSA5 Kreatur-Typen
export const Dsa5CreatureTypes = [
  'npc',           // Spielercharakter-ähnliche NSCs
  'character',     // Importierte Charaktere
  'creature',      // Monster/Kreaturen
] as const;

export type Dsa5CreatureType = typeof Dsa5CreatureTypes[number];

// DSA5 Größenkategorien
export const Dsa5SizeCategories = [
  'tiny',      // winzig
  'small',     // klein
  'medium',    // mittel
  'large',     // groß
  'huge',      // riesig
] as const;

// Filter Schema
export const Dsa5FiltersSchema = z.object({
  // Stufe (analog zu CR in D&D)
  level: z.union([
    z.number(),
    z.object({
      min: z.number().optional(),
      max: z.number().optional()
    })
  ]).optional(),

  // Spezies (Mensch, Elf, Zwerg, etc.)
  species: z.string().optional(),

  // Kultur
  culture: z.string().optional(),

  // Größe
  size: z.enum(Dsa5SizeCategories).optional(),

  // Zauberkundigkeit
  hasSpells: z.boolean().optional(),

  // Merkmale (traits)
  traits: z.array(z.string()).optional(),

  // Seltenheit
  rarity: z.string().optional(),

  // Kreatur-Typ
  creatureType: z.enum(Dsa5CreatureTypes).optional(),
});

export type Dsa5Filters = z.infer<typeof Dsa5FiltersSchema>;

/**
 * Prüft ob Kreatur die DSA5-Filter erfüllt
 */
export function matchesDsa5Filters(
  creature: Dsa5CreatureIndex,
  filters: Dsa5Filters
): boolean {
  // Level-Filter (Stufe)
  if (filters.level !== undefined) {
    const level = creature.systemData?.level;
    if (level === undefined) return false;

    if (typeof filters.level === 'number') {
      if (level !== filters.level) return false;
    } else {
      const min = filters.level.min ?? 0;
      const max = filters.level.max ?? 30;
      if (level < min || level > max) return false;
    }
  }

  // Spezies-Filter
  if (filters.species !== undefined) {
    const species = creature.systemData?.species?.toLowerCase();
    if (!species || !species.includes(filters.species.toLowerCase())) {
      return false;
    }
  }

  // Kultur-Filter
  if (filters.culture !== undefined) {
    const culture = creature.systemData?.culture?.toLowerCase();
    if (!culture || !culture.includes(filters.culture.toLowerCase())) {
      return false;
    }
  }

  // Größen-Filter
  if (filters.size !== undefined) {
    if (creature.systemData?.size !== filters.size) {
      return false;
    }
  }

  // Zauber-Filter
  if (filters.hasSpells !== undefined) {
    if (creature.systemData?.hasSpells !== filters.hasSpells) {
      return false;
    }
  }

  // Merkmale-Filter (traits)
  if (filters.traits && filters.traits.length > 0) {
    const creatureTraits = creature.systemData?.traits || [];
    const hasAllTraits = filters.traits.every(trait =>
      creatureTraits.some(ct => ct.toLowerCase().includes(trait.toLowerCase()))
    );
    if (!hasAllTraits) return false;
  }

  // Seltenheits-Filter
  if (filters.rarity !== undefined) {
    if (creature.systemData?.rarity !== filters.rarity) {
      return false;
    }
  }

  // Kreatur-Typ Filter
  if (filters.creatureType !== undefined) {
    if (creature.type !== filters.creatureType) {
      return false;
    }
  }

  return true;
}

/**
 * Erstellt lesbare Beschreibung der Filter
 */
export function describeDsa5Filters(filters: Dsa5Filters): string {
  const parts: string[] = [];

  if (filters.level !== undefined) {
    if (typeof filters.level === 'number') {
      parts.push(`Stufe ${filters.level}`);
    } else {
      const min = filters.level.min ?? 0;
      const max = filters.level.max ?? 30;
      parts.push(`Stufe ${min}-${max}`);
    }
  }

  if (filters.species) {
    parts.push(`Spezies: ${filters.species}`);
  }

  if (filters.culture) {
    parts.push(`Kultur: ${filters.culture}`);
  }

  if (filters.size) {
    parts.push(`Größe: ${filters.size}`);
  }

  if (filters.hasSpells !== undefined) {
    parts.push(filters.hasSpells ? 'Mit Magie' : 'Ohne Magie');
  }

  if (filters.traits && filters.traits.length > 0) {
    parts.push(`Merkmale: ${filters.traits.join(', ')}`);
  }

  if (filters.rarity) {
    parts.push(`Seltenheit: ${filters.rarity}`);
  }

  if (filters.creatureType) {
    parts.push(`Typ: ${filters.creatureType}`);
  }

  return parts.length > 0 ? parts.join(' | ') : 'Keine Filter';
}
```

**✅ Diese Datei ist ~200 Zeilen und zu 90% aus field-mappings.ts portierbar**

---

## 🏗️ Phase 5: Index Builder migrieren (3-4 Stunden)

### 5.1 Index Builder implementieren
**Datei:** `packages/mcp-server/src/systems/dsa5/index-builder.ts`

**Migrations-Quelle:** `packages/foundry-module/src/tools/dsa5/creature-index.ts` (244 Zeilen)

**Änderungen:**
1. ✅ **Direkt portierbar (80%):**
   - `buildDsa5CreatureIndex()` → `buildIndex()`
   - `extractDsa5DataFromPack()` → `extractDataFromPack()`
   - `extractDsa5CreatureData()` → `extractCreatureData()`
   - SIZE_MAP_DE_TO_EN Import (wird zu constants.ts)

2. ⚠️ **Anpassungen nötig (20%):**
   - Interface: `IndexBuilder` implementieren statt standalone functions
   - Return-Type: `Dsa5CreatureIndex[]` statt `EnhancedCreatureIndex[]`
   - Constructor: `moduleId` als Parameter
   - Methoden-Signaturen an Interface anpassen

**Template-Struktur:**
```typescript
import type { IndexBuilder, Dsa5CreatureIndex } from '../types.js';
import { SIZE_MAP_DE_TO_EN } from './constants.js';

declare const ui: any; // Foundry browser global

export class Dsa5IndexBuilder implements IndexBuilder {
  private moduleId: string;

  constructor(moduleId: string = 'foundry-mcp-bridge') {
    this.moduleId = moduleId;
  }

  getSystemId() {
    return 'dsa5' as const;
  }

  async buildIndex(packs: any[], force = false): Promise<Dsa5CreatureIndex[]> {
    // KOPIERE HIER: buildDsa5CreatureIndex() aus creature-index.ts
    // Zeilen 22-77 fast 1:1 übernehmen
    // Nur Änderungen:
    //   - Verwende this.moduleId statt moduleId parameter
    //   - Return type ist Dsa5CreatureIndex[]
    //   - Deutsche UI-Texte beibehalten ("Starte DSA5 Kreaturen-Index...")
  }

  async extractDataFromPack(pack: any): Promise<{
    creatures: Dsa5CreatureIndex[];
    errors: number
  }> {
    // KOPIERE HIER: extractDsa5DataFromPack() aus creature-index.ts
    // Zeilen 87-122 fast 1:1 übernehmen
  }

  private extractCreatureData(
    doc: any,
    pack: any
  ): { creature: Dsa5CreatureIndex; errors: number } | null {
    // KOPIERE HIER: extractDsa5CreatureData() aus creature-index.ts
    // Zeilen 133-243 fast 1:1 übernehmen
    // WICHTIG: Return type ändern zu Dsa5CreatureIndex
  }
}
```

**⏱️ Zeitaufwand:** 2-3 Stunden (hauptsächlich Copy-Paste + Interface-Anpassungen)

**💡 TIPP:** Siehe `DSA5_MIGRATION_ANALYSIS.md` Abschnitt 3 für:
- Exakte Zeilen-Nummern zum Kopieren
- Welche Funktionen → welche Methoden
- Deutsche UI-Messages beibehalten (ja/nein)

---

## 🎯 Phase 6: System Adapter implementieren (4-5 Stunden)

### 6.1 Adapter-Klasse erstellen
**Datei:** `packages/mcp-server/src/systems/dsa5/adapter.ts`

**Migrations-Quellen:**
- `character-import.ts` (243 Zeilen) → `extractCharacterStats()`
- Neue Methoden für Formatting und Filtering

**Struktur:**
```typescript
import type {
  SystemAdapter,
  SystemMetadata,
  SystemCreatureIndex,
  Dsa5CreatureIndex
} from '../types.js';
import {
  Dsa5FiltersSchema,
  matchesDsa5Filters,
  describeDsa5Filters,
  type Dsa5Filters
} from './filters.js';
import { EIGENSCHAFT_NAMES, WOUNDS_HELPER } from './constants.js';

export class Dsa5Adapter implements SystemAdapter {
  // ========================================================================
  // SystemAdapter Interface Implementation (11 Methoden)
  // ========================================================================

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
        powerLevel: true // Uses Level/Stufe
      }
    };
  }

  canHandle(systemId: string): boolean {
    return systemId.toLowerCase() === 'dsa5';
  }

  extractCreatureData(doc: any, pack: any): {
    creature: SystemCreatureIndex;
    errors: number
  } | null {
    // Delegiert an Dsa5IndexBuilder
    throw new Error(
      'extractCreatureData should be called from Dsa5IndexBuilder, not the adapter'
    );
  }

  getFilterSchema() {
    return Dsa5FiltersSchema;
  }

  matchesFilters(
    creature: SystemCreatureIndex,
    filters: Record<string, any>
  ): boolean {
    const validated = Dsa5FiltersSchema.safeParse(filters);
    if (!validated.success) return false;
    return matchesDsa5Filters(creature as Dsa5CreatureIndex, validated.data);
  }

  getDataPaths(): Record<string, string | null> {
    return {
      // DSA5 spezifische Pfade
      level: 'system.details.level.value',
      species: 'system.details.species.value',
      culture: 'system.details.culture.value',
      profession: 'system.details.career.value', // WICHTIG: "career" nicht "profession"!
      experience: 'system.details.experience.total',
      size: 'system.status.size.value',

      // Eigenschaften (8 Attribute)
      characteristics: 'system.characteristics',
      mu: 'system.characteristics.mu.value',
      kl: 'system.characteristics.kl.value',
      in: 'system.characteristics.in.value',
      ch: 'system.characteristics.ch.value',
      ff: 'system.characteristics.ff.value',
      ge: 'system.characteristics.ge.value',
      ko: 'system.characteristics.ko.value',
      kk: 'system.characteristics.kk.value',

      // Status-Werte
      wounds: 'system.status.wounds',           // ACHTUNG: Invertierte Logik!
      astralenergy: 'system.status.astralenergy',
      karmaenergy: 'system.status.karmaenergy',
      speed: 'system.status.speed',
      initiative: 'system.status.initiative',

      // Kampfwerte
      defense: 'system.status.defense',         // Verteidigung
      armour: 'system.status.armour',
      dodge: 'system.status.dodge',

      // Tradition
      tradition: 'system.tradition',

      // D&D5e-spezifische Pfade (nicht in DSA5)
      challengeRating: null,
      hitPoints: null, // DSA5 verwendet wounds mit invertierter Logik
      armorClass: null,
      legendaryActions: null,
    };
  }

  formatCreatureForList(creature: SystemCreatureIndex): any {
    const dsa5Creature = creature as Dsa5CreatureIndex;
    const formatted: any = {
      id: creature.id,
      name: creature.name,
      type: creature.type,
      pack: {
        id: creature.packName,
        label: creature.packLabel
      }
    };

    if (dsa5Creature.systemData) {
      const stats: any = {};

      // Stufe/Level
      if (dsa5Creature.systemData.level !== undefined) {
        stats.level = dsa5Creature.systemData.level;
      }

      // Spezies & Kultur
      if (dsa5Creature.systemData.species) {
        stats.species = dsa5Creature.systemData.species;
      }
      if (dsa5Creature.systemData.culture) {
        stats.culture = dsa5Creature.systemData.culture;
      }

      // Größe
      if (dsa5Creature.systemData.size) {
        stats.size = dsa5Creature.systemData.size;
      }

      // Lebenspunkte
      if (dsa5Creature.systemData.lifePoints) {
        stats.lifePoints = dsa5Creature.systemData.lifePoints;
      }

      // Verteidigung
      if (dsa5Creature.systemData.meleeDefense) {
        stats.meleeDefense = dsa5Creature.systemData.meleeDefense;
      }

      // Zauberkundigkeit
      if (dsa5Creature.systemData.hasSpells) {
        stats.spellcaster = true;
      }

      if (Object.keys(stats).length > 0) {
        formatted.stats = stats;
      }
    }

    if (creature.img) {
      formatted.hasImage = true;
    }

    return formatted;
  }

  formatCreatureForDetails(creature: SystemCreatureIndex): any {
    const dsa5Creature = creature as Dsa5CreatureIndex;
    const formatted = this.formatCreatureForList(creature);

    // Erweitere mit Details
    if (dsa5Creature.systemData) {
      formatted.detailedStats = {
        level: dsa5Creature.systemData.level,
        species: dsa5Creature.systemData.species,
        culture: dsa5Creature.systemData.culture,
        size: dsa5Creature.systemData.size,
        lifePoints: dsa5Creature.systemData.lifePoints,
        meleeDefense: dsa5Creature.systemData.meleeDefense,
        rangedDefense: dsa5Creature.systemData.rangedDefense,
        hasSpells: dsa5Creature.systemData.hasSpells,
        traits: dsa5Creature.systemData.traits || [],
        experience: dsa5Creature.systemData.experience,
        rarity: dsa5Creature.systemData.rarity,
      };
    }

    return formatted;
  }

  describeFilters(filters: Record<string, any>): string {
    const validated = Dsa5FiltersSchema.safeParse(filters);
    if (!validated.success) return 'Ungültige Filter';
    return describeDsa5Filters(validated.data);
  }

  getPowerLevel(creature: SystemCreatureIndex): number | undefined {
    const dsa5Creature = creature as Dsa5CreatureIndex;
    return dsa5Creature.systemData?.level;
  }

  extractCharacterStats(actorData: any): any {
    // PORTIERE HIER: extractDsa5CharacterData() aus character-import.ts
    // Zeilen 17-103
    //
    // WICHTIG: Diese Methode muss system-agnostic output liefern!
    // Verwende die Struktur von D&D5e als Vorbild
    //
    // Return Format:
    // {
    //   name: string,
    //   level: number,
    //   species: string,
    //   culture: string,
    //   profession: string,
    //   attributes: { MU: X, KL: Y, ... },
    //   health: { current: X, max: Y }, // WOUNDS INVERSION!
    //   resources: [ { name: "AsP", current: X, max: Y }, ... ],
    //   skills: [ { name: "Klettern", value: 8, probe: "MU/GE/KK" }, ... ],
    //   combatSkills: [ { name: "Raufen", at: 10, pa: 8 }, ... ],
    //   dsa5Specific: { ... } // Für DSA5-only Daten
    // }

    const system = actorData.system || {};
    const result: any = {
      name: actorData.name,
      system: 'dsa5'
    };

    // Eigenschaften extrahieren
    if (system.characteristics) {
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
    }

    // LeP mit Wound-Inversion!
    if (system.status?.wounds) {
      const wounds = system.status.wounds;
      result.health = WOUNDS_HELPER.toHitPoints(wounds);
    }

    // Ressourcen (AsP, KaP)
    result.resources = [];
    if (system.status?.astralenergy) {
      result.resources.push({
        name: 'AsP',
        current: system.status.astralenergy.value || 0,
        max: system.status.astralenergy.max || 0,
        type: 'mana'
      });
    }
    if (system.status?.karmaenergy) {
      result.resources.push({
        name: 'KaP',
        current: system.status.karmaenergy.value || 0,
        max: system.status.karmaenergy.max || 0,
        type: 'karma'
      });
    }

    // Profil
    if (system.details) {
      result.species = system.details.species?.value;
      result.culture = system.details.culture?.value;
      result.profession = system.details.career?.value; // career, nicht profession!

      if (system.details.experience) {
        result.experience = {
          total: system.details.experience.total || 0,
          spent: system.details.experience.spent || 0,
          available: (system.details.experience.total || 0) -
                     (system.details.experience.spent || 0)
        };
      }
    }

    // Talente (Skills)
    result.skills = [];
    if (actorData.items) {
      for (const item of actorData.items) {
        if (item.type === 'skill') {
          const itemSystem = item.system || {};
          result.skills.push({
            id: item._id,
            name: item.name,
            value: itemSystem.talentValue?.value || itemSystem.value || 0,
            probe: itemSystem.characteristic || [],
            category: itemSystem.category || 'unknown'
          });
        }
      }
    }

    // Kampftechniken
    result.combatSkills = [];
    if (actorData.items) {
      for (const item of actorData.items) {
        if (item.type === 'combatskill') {
          const itemSystem = item.system || {};
          result.combatSkills.push({
            name: item.name,
            at: itemSystem.at?.value || itemSystem.attack?.value || 0,
            pa: itemSystem.pa?.value || itemSystem.parry?.value || 0
          });
        }
      }
    }

    // DSA5-spezifische Zusatzdaten
    result.dsa5Specific = {
      size: system.status?.size?.value,
      initiative: system.status?.initiative,
      speed: system.status?.speed,
      dodge: system.status?.dodge,
      soulpower: system.status?.soulpower,
      toughness: system.status?.toughness,
      tradition: system.tradition,
    };

    return result;
  }
}
```

**⏱️ Zeitaufwand:** 4-5 Stunden (viel Copy-Paste, aber auch Umstrukturierung)

**⚠️ KRITISCH:** Siehe `DSA5_MIGRATION_ANALYSIS.md` Abschnitt 4 für:
- **Wound-Inversion-Logik** (LeP = wounds.max - wounds.value)
- Flache vs. verschachtelte Struktur
- Skills/Talents Vereinfachung
- Vor-/Nachher Code-Vergleiche

---

## 🔧 Phase 7: Konstanten & Helper (1 Stunde)

### 7.1 Constants Datei erstellen
**Datei:** `packages/mcp-server/src/systems/dsa5/constants.ts`

**Migrations-Quelle:** `field-mappings.ts` (200 Zeilen) - **90% direkt kopierbar!**

```typescript
// KOPIERE VOLLSTÄNDIG aus field-mappings.ts:
// - EIGENSCHAFT_NAMES (Zeilen ~20-30)
// - SIZE_MAP_DE_TO_EN (Zeilen ~35-42)
// - SIZE_MAP_EN_TO_DE (Zeilen ~44-51)
// - RESOURCE_TYPES (Zeilen ~56-60)
// - ITEM_TYPES (Zeilen ~65-75)
// - ACTOR_TYPES (Zeilen ~80-84)
// - WOUNDS_HELPER (Zeilen ~95-120) ⚠️ KRITISCH FÜR LeP!
// - EIGENSCHAFT_HELPER (Zeilen ~125-140)
// - SKILL_GROUPS (Zeilen ~145-165)
// - ADVANCEMENT_CATEGORIES (Zeilen ~170-180)
// - FIELD_PATHS (Zeilen ~185-200)

export const EIGENSCHAFT_NAMES = {
  MU: { de: 'Mut', en: 'Courage' },
  KL: { de: 'Klugheit', en: 'Cleverness' },
  // ... rest kopieren
};

export const SIZE_MAP_DE_TO_EN: Record<string, string> = {
  'winzig': 'tiny',
  'klein': 'small',
  // ... rest kopieren
};

// WICHTIG: WOUNDS_HELPER komplett übernehmen!
export const WOUNDS_HELPER = {
  toHitPoints: (wounds: { value: number; max: number }) => ({
    current: wounds.max - wounds.value,  // Inversion!
    max: wounds.max,
  }),
  fromHitPoints: (hp: { current: number; max: number }) => ({
    value: hp.max - hp.current,  // Rück-Inversion!
    max: hp.max,
  }),
  // ... rest kopieren
};
```

**⏱️ Zeitaufwand:** 30-60 Minuten (hauptsächlich Copy-Paste + Importe anpassen)

---

## 📦 Phase 8: Exports & Registry (1-2 Stunden)

### 8.1 DSA5 Index Datei
**Datei:** `packages/mcp-server/src/systems/dsa5/index.ts`

```typescript
/**
 * DSA5 System Support - Public API
 */

export { Dsa5Adapter } from './adapter.js';
export { Dsa5IndexBuilder } from './index-builder.js';

export type { Dsa5Filters } from './filters.js';
export { Dsa5FiltersSchema, describeDsa5Filters } from './filters.js';

export * from './constants.js';

// Re-export types
export type { Dsa5CreatureIndex } from '../types.js';
```

### 8.2 System Registry aktualisieren
**Datei:** `packages/mcp-server/src/systems/system-registry.ts`

```typescript
// Bestehende Imports...
import { Dsa5Adapter } from './dsa5/index.js';  // NEU

// In der Registrierungs-Funktion:
export function registerDefaultSystems() {
  systemRegistry.register(new DnD5eAdapter());
  systemRegistry.register(new PF2eAdapter());
  systemRegistry.register(new Dsa5Adapter());  // NEU
}
```

### 8.3 Index Builder Registry aktualisieren
**Datei:** `packages/mcp-server/src/systems/index-builder-registry.ts`

```typescript
// Bestehende Imports...
import { Dsa5IndexBuilder } from './dsa5/index.js';  // NEU

// In der Registrierungs-Funktion:
export function registerDefaultIndexBuilders(moduleId: string) {
  indexBuilderRegistry.register(new DnD5eIndexBuilder(moduleId));
  indexBuilderRegistry.register(new PF2eIndexBuilder(moduleId));
  indexBuilderRegistry.register(new Dsa5IndexBuilder(moduleId));  // NEU
}
```

---

## ✅ Phase 9: Testing & Qualitätssicherung (2-3 Stunden)

### 9.1 TypeScript Compilation
```bash
# Im Projekt-Root
npm install
npm run build

# Erwartetes Ergebnis: ✅ Kein Fehler
# Falls Fehler:
#   - Unused imports entfernen
#   - Optional chaining für possibly undefined prüfen
#   - Type assertions korrigieren
```

### 9.2 Lokaler Foundry-Test (optional, aber empfohlen)
**Voraussetzung:** Foundry VTT + DSA5 System installiert

```bash
# 1. Module builden und linken
npm run build
cd ~/.local/share/FoundryVTT/Data/modules
ln -s /path/to/foundry-vtt-mcp-dsa/dist foundry-mcp

# 2. Foundry starten, DSA5-Welt öffnen

# 3. Browser Console öffnen (F12), testen:
game.modules.get('foundry-mcp').active  // sollte true sein

# 4. MCP Tools im Claude Desktop testen:
#    - "List creatures with species Elf"
#    - "Show character Thorwal der Krieger"
#    - "Search creatures with level 5-10 and hasSpells true"

# 5. Creature Index rebuild testen:
#    Settings → Module Settings → Foundry MCP → Rebuild Index
#    Console sollte zeigen: "DSA5 Kreaturen-Index fertig! X Kreaturen indiziert..."
```

### 9.3 Unit Tests erweitern (falls Zeit)
**Datei erstellen:** `packages/mcp-server/src/systems/dsa5/__tests__/filters.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { matchesDsa5Filters, describeDsa5Filters } from '../filters.js';
import type { Dsa5CreatureIndex } from '../../types.js';

describe('DSA5 Filters', () => {
  const testCreature: Dsa5CreatureIndex = {
    id: 'test-1',
    name: 'Test-Elf',
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
      traits: ['Nachtsicht', 'Zaubersinn'],
    }
  };

  it('should match level filter', () => {
    expect(matchesDsa5Filters(testCreature, { level: 5 })).toBe(true);
    expect(matchesDsa5Filters(testCreature, { level: 3 })).toBe(false);
  });

  it('should match species filter', () => {
    expect(matchesDsa5Filters(testCreature, { species: 'Elf' })).toBe(true);
    expect(matchesDsa5Filters(testCreature, { species: 'Zwerg' })).toBe(false);
  });

  it('should match hasSpells filter', () => {
    expect(matchesDsa5Filters(testCreature, { hasSpells: true })).toBe(true);
    expect(matchesDsa5Filters(testCreature, { hasSpells: false })).toBe(false);
  });

  it('should describe filters correctly', () => {
    const desc = describeDsa5Filters({
      level: { min: 3, max: 7 },
      species: 'Elf',
      hasSpells: true
    });
    expect(desc).toContain('Stufe 3-7');
    expect(desc).toContain('Spezies: Elf');
    expect(desc).toContain('Mit Magie');
  });
});
```

```bash
# Tests ausführen
npm run test -- dsa5
```

---

## 📚 Phase 10: Dokumentation (1-2 Stunden)

### 10.1 DSA5 README erstellen
**Datei:** `packages/mcp-server/src/systems/dsa5/README.md`

```markdown
# DSA5 System Support

DSA5 (Das Schwarze Auge 5. Edition) adapter for Foundry VTT MCP Bridge.

## Features

- ✅ Enhanced creature index with DSA5-specific fields (Level, Spezies, Kultur)
- ✅ Character stats extraction (Eigenschaften, LeP/AsP/KaP, Talente, Kampftechniken)
- ✅ Advanced filtering (level, species, culture, size, spells, traits)
- ✅ Proper LeP wound inversion handling

## DSA5 Data Model

### Eigenschaften (8 Attributes)
- MU (Mut / Courage)
- KL (Klugheit / Cleverness)
- IN (Intuition)
- CH (Charisma)
- FF (Fingerfertigkeit / Dexterity)
- GE (Gewandtheit / Agility)
- KO (Konstitution / Constitution)
- KK (Körperkraft / Strength)

### Resources
- **LeP** (Lebenspunkte) - ⚠️ INVERTED: `wounds.value` = current wounds, not HP!
- **AsP** (Astralenergie) - Mana for spellcasting
- **KaP** (Karmaenergie) - Karma for clerical magic

### Wounds Inversion Logic
DSA5 stores *wounds* (damage taken), not hit points:

```
system.status.wounds.value  = Aktuelle Wunden (0 = unverletzt)
system.status.wounds.max    = Maximale LeP

Umrechnung:
  Aktuelle HP = wounds.max - wounds.value
  Neue Wunden = wounds.max - neue_HP
```

## Filter Examples

```typescript
// Elfen mit Magie, Stufe 3-7
{
  species: "Elf",
  hasSpells: true,
  level: { min: 3, max: 7 }
}

// Mittelgroße Kreaturen aus Thorwal
{
  size: "medium",
  culture: "Thorwal"
}
```

## Architecture Notes

- **Adapter Pattern:** All DSA5 logic is isolated in this directory
- **Registry Pattern:** Auto-registered via system-registry.ts
- **Upstream Compatible:** No changes to core data-access.ts required

## References

- DSA5 System: https://github.com/Plushtoast/dsa5-foundryVTT
- Field Mappings: See `constants.ts` for complete DSA5 field paths
- Original Implementation: Based on frankyh75/foundry-vtt-mcp-dsa adapter layer
```

### 10.2 CHANGELOG aktualisieren
**Datei:** `CHANGELOG.md` (im Repository-Root)

```markdown
## [0.6.1] - DSA5 Support - TBD

### Added
- 🇩🇪 **DSA5 System Support** (Das Schwarze Auge 5. Edition)
  - Enhanced creature index with DSA5-specific fields (Stufe, Spezies, Kultur, LeP)
  - Character stats extraction (Eigenschaften, Talente, Kampftechniken)
  - DSA5 filter system (level, species, culture, size, spells, traits)
  - Proper LeP wound inversion handling
  - German UI messages for creature index building
- New system adapter: `Dsa5Adapter` implementing 11 SystemAdapter methods
- New index builder: `Dsa5IndexBuilder` for DSA5 creature indexing
- DSA5 filter schemas and matching logic
- Comprehensive DSA5 constants (EIGENSCHAFT_NAMES, SIZE_MAP, WOUNDS_HELPER)

### Changed
- Extended `SystemId` type to include `'dsa5'`
- Extended `AnyCreatureIndex` union type with `Dsa5CreatureIndex`
- Registered DSA5 adapter in system registry
- Registered DSA5 index builder in index-builder registry

### Technical Details
- **New files:** 6 files in `packages/mcp-server/src/systems/dsa5/`
- **Lines of code:** ~1200 lines (adapter, filters, index-builder, constants)
- **Code reuse:** 60-70% ported from frankyh75's DSA5 adapter layer
- **No breaking changes:** Fully backward-compatible with existing D&D5e/PF2e support

### Contributors
- @frankyh75 - DSA5 system implementation
```

---

## 🚀 Phase 11: Pull Request erstellen (1 Stunde)

### 11.1 Final Commit & Push
```bash
# Sicherstellen, dass alles committed ist
git status

# Falls nötig, letzte Änderungen committen
git add .
git commit -m "feat(dsa5): Add DSA5 system support for v0.6.1

- Implement Dsa5Adapter with 11 SystemAdapter methods
- Add Dsa5IndexBuilder for creature indexing
- Create DSA5 filter system (level, species, culture, spells)
- Port DSA5 constants and wound inversion logic
- Register DSA5 in system and index-builder registries
- Add comprehensive documentation and tests

Implements: #11 (DSA5 support contribution)
Migration from: frankyh75/foundry-vtt-mcp-dsa feature/dsa5-adapter-layer"

# Zu feature-Branch wechseln
git checkout -b feature/dsa5-v0.6.1

# Push to origin
git push -u origin feature/dsa5-v0.6.1
```

### 11.2 Pull Request Template
**Titel:** `feat(dsa5): Add DSA5 system support for v0.6.1`

**Beschreibung:**
```markdown
## 🎯 Zusammenfassung

Fügt vollständige Unterstützung für **DSA5 (Das Schwarze Auge 5. Edition)** zum Registry Pattern (v0.6.0) hinzu.

Implementierung basiert auf der v0.6.0-Architektur und portiert ~1200 Zeilen DSA5-Code von meinem feature/dsa5-adapter-layer Branch.

## ✅ Implementierte Features

- [x] **Dsa5Adapter** - 11 SystemAdapter-Methoden implementiert
- [x] **Dsa5IndexBuilder** - Creature Index aus DSA5 Compendiums
- [x] **Filter System** - Level, Spezies, Kultur, Größe, Zauber, Merkmale
- [x] **Character Stats** - Eigenschaften (8 Attribute), LeP/AsP/KaP, Talente, Kampftechniken
- [x] **Wounds Inversion** - Korrekte Behandlung der DSA5-spezifischen LeP-Logik
- [x] **German UI** - Deutschsprachige Benachrichtigungen beim Index-Aufbau
- [x] **Documentation** - Vollständige README und Code-Kommentare

## 📂 Neue Dateien

```
packages/mcp-server/src/systems/dsa5/
├── adapter.ts          (320 Zeilen) - SystemAdapter Implementation
├── filters.ts          (200 Zeilen) - Filter Schemas & Matching
├── index-builder.ts    (300 Zeilen) - IndexBuilder Implementation
├── constants.ts        (200 Zeilen) - DSA5 Konstanten & Mappings
├── types.ts            (50 Zeilen)  - DSA5 TypeScript Types
├── index.ts            (20 Zeilen)  - Public API
└── README.md           (150 Zeilen) - DSA5 Dokumentation
```

**Geänderte Dateien:**
- `packages/mcp-server/src/systems/types.ts` - SystemId + Dsa5CreatureIndex
- `packages/mcp-server/src/systems/system-registry.ts` - Dsa5Adapter registriert
- `packages/mcp-server/src/systems/index-builder-registry.ts` - Dsa5IndexBuilder registriert
- `CHANGELOG.md` - v0.6.1 Eintrag

## 🧪 Testing

- ✅ TypeScript Compilation: `npm run build` erfolgreich
- ✅ Lokaler Foundry-Test: Creature Index mit 450+ DSA5-Kreaturen getestet
- ✅ Filter-Tests: Level, Species, hasSpells, Traits validiert
- ✅ Character Import: Eigenschaften, LeP-Inversion, Talente korrekt extrahiert

## 📖 DSA5-Spezifika

### Eigenschaften (8 Attribute)
DSA5 verwendet 8 statt 6 Eigenschaften:
- MU (Mut), KL (Klugheit), IN (Intuition), CH (Charisma)
- FF (Fingerfertigkeit), GE (Gewandtheit), KO (Konstitution), KK (Körperkraft)

### LeP Wound Inversion ⚠️
DSA5 speichert **Wunden** (Schaden), nicht HP:
```typescript
system.status.wounds.value = Aktuelle Wunden (0 = unverletzt)
Aktuelle HP = wounds.max - wounds.value  // Inversion!
```

Implementierung: `WOUNDS_HELPER` in `constants.ts`

### Ressourcen
- **AsP** (Astralenergie) - Mana für Zauber
- **KaP** (Karmaenergie) - Karma für Liturgien

## 🔗 Referenzen

- **Issue:** #11 (Multi-system support discussion)
- **Upstream DSA5 System:** https://github.com/Plushtoast/dsa5-foundryVTT
- **Original Adapter:** frankyh75/foundry-vtt-mcp-dsa @ feature/dsa5-adapter-layer
- **Code-Portierung:** 60-70% aus existierendem Adapter, 30-40% neue Registry-Integration

## ✨ Backward Compatibility

- ✅ Keine Breaking Changes
- ✅ D&D5e und PF2e unverändert funktionsfähig
- ✅ Core-Dateien außerhalb von `systems/` nicht modifiziert
- ✅ Registry Pattern wie vorgesehen verwendet

## 📋 Checklist

- [x] TypeScript kompiliert ohne Fehler
- [x] Alle 11 SystemAdapter-Methoden implementiert
- [x] IndexBuilder Interface vollständig implementiert
- [x] Filter-Schemas mit Zod validiert
- [x] Wound-Inversion-Logik getestet
- [x] Deutsche UI-Messages für Foundry
- [x] README.md für DSA5 erstellt
- [x] CHANGELOG.md aktualisiert
- [x] Keine eslint-Warnungen
- [x] Code-Review durchgeführt

## 🙏 Danke

Großen Dank an @adambdooley für die v0.6.0-Architektur! Das Registry Pattern hat die DSA5-Integration sehr sauber und maintainbar gemacht. 🎉

---

**Bereit für Review und Merge in v0.6.1! 🚀**
```

### 11.3 PR Labels & Milestones
- Label: `enhancement`, `new-system`, `v0.6.1`
- Milestone: `v0.6.1 - DSA5 Support`
- Assignees: @adambdooley (für Review)
- Reviewers: @adambdooley

---

## 📊 Zusammenfassung

### Zeitaufwand (Gesamt: 15-20 Stunden)

| Phase | Beschreibung | Stunden |
|-------|--------------|---------|
| 1 | Koordination & Setup | 1-2h |
| 2 | v0.6.0 Analyse | 2-3h |
| 3 | Dateistruktur erstellen | 1h |
| 4 | Filter-System | 2-3h |
| 5 | Index Builder migrieren | 3-4h |
| 6 | System Adapter | 4-5h |
| 7 | Konstanten & Helper | 1h |
| 8 | Exports & Registry | 1-2h |
| 9 | Testing | 2-3h |
| 10 | Dokumentation | 1-2h |
| 11 | Pull Request | 1h |

### Code-Migration Übersicht

| Quelle | Ziel | Zeilen | Portierbar |
|--------|------|--------|-----------|
| types.ts | systems/dsa5/types.ts + types.ts | 271 | 70% |
| field-mappings.ts | systems/dsa5/constants.ts | 200 | 90% |
| creature-index.ts | systems/dsa5/index-builder.ts | 244 | 80% |
| character-import.ts | systems/dsa5/adapter.ts | 243 | 60% |
| index.ts | systems/dsa5/index.ts | 101 | 40% |
| **NEU** | systems/dsa5/filters.ts | ~200 | 30% |
| **NEU** | systems/dsa5/adapter.ts (Rest) | ~200 | 0% |

**Gesamt:** ~1200 Zeilen neuer/migrierter Code

### Kritische Pfade

1. **WOUNDS_HELPER:** Muss 100% korrekt portiert werden (LeP-Inversion!)
2. **extractCharacterStats():** Komplexe Umstrukturierung von character-import.ts
3. **Filter-Logik:** Neue Implementation basierend auf Zod-Schemas
4. **Registry Integration:** Korrekte Registrierung in beiden Registries

### Success Metrics

- ✅ `npm run build` ohne Fehler
- ✅ Lokaler Test: Creature Index mit >100 DSA5-Kreaturen
- ✅ Filter-Test: Mindestens 5 verschiedene Filter-Kombinationen
- ✅ Character Import: Eigenschaften, LeP, AsP, KaP, Talente korrekt
- ✅ PR Approval von @adambdooley
- ✅ Merge in upstream/feature/registry-pattern-v0.6.0
- ✅ v0.6.1 Release Notes erwähnen DSA5

---

## 🎯 Next Steps

1. **JETZT:** Kommentar auf Issue #11 posten
2. **Dann:** Mit Phase 2 beginnen (v0.6.0 lokal auschecken)
3. **Parallel:** Auf Antwort von @adambdooley warten
4. **Diese Woche:** Phasen 2-7 abschließen (Analysis + Code)
5. **Nächste Woche:** Phasen 8-11 (Testing + PR)

**Viel Erfolg! 🚀**
