# DSA5 Support in Foundry MCP Bridge

## Overview

DSA5 (Das Schwarze Auge 5. Edition) is fully supported by the Foundry MCP Bridge with dedicated tools and adapters.

## DSA5-Specific MCP Tools

### 1. list-dsa5-archetypes

**Lists DSA5 character archetypes from compendium packs.**

**Parameters:**
- `packId` (optional) – Specific pack to search (e.g., "dsa5-core.corecharacters")
- `filterBySpecies` (optional) – Filter by species: "Mensch", "Elf", "Zwerg", "Halbelf", "Goblin", "Ork", etc.
- `filterByProfession` (optional) – Filter by profession: "Bauer", "Krieger", "Magier", "Hexe", etc.

**Important:** Uses **substring matching** for professions!
- `filterByProfession: "bauer"` finds: "Bauer", "Hofbauer", "Landwirt/Bauer", etc.

**Example:**
```
list-dsa5-archetypes(filterByProfession: "krieger")
```

Returns:
- Archetype name
- Pack ID and Archetype ID
- Species and Profession
- Image (if available)

---

### 2. create-dsa5-character-from-archetype

**Creates a DSA5 character from an archetype with customizations.**

**Parameters:**
- `archetypePackId` (required) – Compendium pack ID
- `archetypeId` (required) – Archetype ID within the pack
- `characterName` (required) – Name for the new character
- `customization` (optional) – Character customizations:
  - `age` (12-100) – Character age in years
  - `biography` (string) – Background story
  - `gender` ("male" | "female" | "diverse")
  - `eyeColor` (string) – Eye color
  - `hairColor` (string) – Hair color
  - `height` (number) – Height in cm
  - `weight` (number) – Weight in kg
  - `species` (string) – Species/race (e.g., "Mensch", "Elf")
  - `culture` (string) – Culture (e.g., "Mittelreich", "Thorwal")
  - `profession` (string) – Profession/career
- `addToWorld` (boolean, default: true) – Add to current world

**Example:**
```
create-dsa5-character-from-archetype(
  archetypePackId: "dsa5-core.corecharacters",
  archetypeId: "Finwaen",
  characterName: "Elidan",
  customization: {
    age: 32,
    biography: "Ein Bauer an der nostrischen Küste.",
    gender: "male",
    culture: "Nostria",
    profession: "Bauer"
  }
)
```

---

## DSA5 Data Structure

### Key Differences from D&D5e/PF2e

| Feature | D&D5e/PF2e | DSA5 |
|---------|------------|------|
| **Classes** | Fighter, Wizard, etc. | **Professionen** (Bauer, Krieger, Magier) |
| **Attributes** | STR, DEX, CON, INT, WIS, CHA | **Eigenschaften** (MU, KL, IN, CH, FF, GE, KO, KK) |
| **HP** | Hit Points | **LeP** (Lebensenergie) |
| **Mana** | Spell Slots | **AsP** (Astralenergie) / **KaP** (Karmaenergie) |
| **Level** | 1-20 | **Erfahrungsgrad** (1-7) |
| **XP** | Experience Points | **AP** (Abenteuerpunkte) |

---

## Field Paths (DSA5)

### Important Paths for Character Data

```typescript
// Identity
system.details.species.value        // Spezies (Mensch, Elf, etc.)
system.details.culture.value        // Kultur (Mittelreich, Thorwal, etc.)
system.details.career.value         // Profession (Bauer, Krieger, etc.)
system.details.experience.total     // Gesamt-Abenteuerpunkte (AP)

// Characteristics (Eigenschaften)
system.characteristics.mu.value     // Mut (Courage)
system.characteristics.kl.value     // Klugheit (Intelligence)
system.characteristics.in.value     // Intuition (Intuition)
system.characteristics.ch.value     // Charisma (Charisma)
system.characteristics.ff.value     // Fingerfertigkeit (Dexterity)
system.characteristics.ge.value     // Gewandtheit (Agility)
system.characteristics.ko.value     // Konstitution (Constitution)
system.characteristics.kk.value     // Körperkraft (Strength)

// Status Values
system.status.wounds.value          // Aktuelle Wunden (Schaden)
system.status.wounds.max            // Maximale LeP
system.status.wounds.current        // Berechnete LeP (max - value)
system.status.astralenergy.value    // Aktuelle AsP
system.status.astralenergy.max      // Maximale AsP
system.status.karmaenergy.value     // Aktuelle KaP
system.status.karmaenergy.max       // Maximale KaP
system.status.speed.value           // Geschwindigkeit (GS)
system.status.initiative.value      // Initiative (INI)
system.status.dodge.value           // Ausweichen (PAW)
system.status.armour.value          // Rüstungsschutz (RS)

// Tradition
system.tradition.magical            // Magische Tradition (z.B. "Hesinde")
system.tradition.clerical           // Geweihte Tradition (z.B. "Praios")
```

---

## Experience Levels (Erfahrungsgrade)

DSA5 has 7 experience levels based on Adventure Points (AP):

| Level | Name | AP Range | Description |
|-------|------|----------|-------------|
| 1 | Unerfahren | 0-900 | Inexperienced |
| 2 | Durchschnittlich | 901-1800 | Average |
| 3 | Erfahren | 1801-2700 | Experienced |
| 4 | Kompetent | 2701-3600 | Competent |
| 5 | Meisterlich | 3601-4500 | Masterful |
| 6 | Brillant | 4501-5400 | Brilliant |
| 7 | Legendär | 5401+ | Legendary |

**Important:** DSA5 starts at Level 1, not Level 0!

---

## Filters for list-creatures-by-criteria

When using the generic `list-creatures-by-criteria` tool with DSA5:

```typescript
{
  level: 1-7,                    // Erfahrungsgrad
  species: "mensch",            // Spezies (nicht "creatureType"!)
  culture: "tulamidisch",        // Kultur (optional)
  size: "medium",                // Größe
  hasSpells: true,               // Hat Zauber
  experiencePoints: { min: 0, max: 100 }  // AP-Bereich
}
```

**Common Mistake:** Don't use `creatureType: "humanoid"` – that's D&D5e!
**Correct:** `species: "mensch"` for DSA5.

---

## Supported DSA5 Species

```
mensch, elf, halbelf, zwerg, goblin, ork, halborc,
achaz, troll, oger, drache, dämon, elementar, untot,
tier, chimäre
```

---

## Common Professions for NPC Creation

```
- Bauern (farmers): bauer, hofbauer, landwirt
- Krieger (warriors): krieger, söldner, wache, thorwaler
- Magier (mages): magier, zauberer, hexe, druide
- Bürger (commoners): bürger, händler, handwerker
- Spezialisierte: dieb, schmied, kräuterhexe, barde
```

---

## Workflow: Creating NPCs for DSA5 Adventures

### Step 1: Discover Archetypes

```
list-dsa5-archetypes(filterByProfession: "bauer")
list-dsa5-archetypes(filterByProfession: "krieger")
list-dsa5-archetypes(filterByProfession: "magier")
```

### Step 2: Create NPCs

For each archetype found:
```
create-dsa5-character-from-archetype(
  archetypePackId: "<pack ID>",
  archetypeId: "<archetype ID>",
  characterName: "<NPC Name>",
  customization: { ... }
)
```

### Step 3: Verify

```
list-characters()
```

---

## Examples from "Deicherbe" Adventure

### NPCs Created

1. **Elidan** (Bauer, 32 Jahre)
   - Archetyp: Finwaen (Bauer)
   - Profession: Bauer
   - Culture: Nostria

2. **Alsilio** (Kind, 8 Jahre)
   - Archetyp: Finwaen (angepasst für Kind)
   - Age: 8 (reduzierte Stats)

3. **Karlitha** (Hexe, 45 Jahre)
   - Archetyp: Celissa (Magier)
   - Profession: Hexe
   - Has: AsP (Astralenergie)

4. **Thorbold Vaarnason** (Thorwaler-Krieger, 35 Jahre)
   - Archetyp: Finwaen (angepasst für Krieger)
   - Profession: Krieger
   - Culture: Thorwal

---

## Troubleshooting

### "list-dsa5-archetypes returns empty"

**Cause:** No DSA5 Actor packs found or not indexed.

**Solution:**
1. Check that DSA5 Compendiums are installed in Foundry
2. Verify pack contains Actor-type entries (type: "character")
3. Try without filters: `list-dsa5-archetypes()`

### "Archetype not found"

**Cause:** Wrong packId or archetypeId.

**Solution:**
1. Use `list-dsa5-archetypes()` to get correct IDs
2. Check that packId matches exactly (case-sensitive)
3. Verify archetypeId is from the correct pack

### "NPC created but has wrong stats"

**Cause:** Used generic archetype instead of profession-specific one.

**Solution:**
1. Search with `filterByProfession` for matching archetype
2. Use `filterBySpecies` to match species
3. Don't reuse same archetype for different NPC types

---

## Technical Implementation

### Files

- **Adapter:** `packages/mcp-server/src/systems/dsa5/adapter.ts`
- **Filters:** `packages/mcp-server/src/systems/dsa5/filters.ts`
- **Character Creator:** `packages/mcp-server/src/systems/dsa5/character-creator.ts`
- **Constants:** `packages/mcp-server/src/systems/dsa5/constants.ts`
- **Index Builder:** `packages/mcp-server/src/systems/dsa5/index-builder.ts`

### Registration

DSA5 tools are registered in `packages/mcp-server/src/backend.ts`:

```typescript
import { DSA5CharacterCreator } from './systems/dsa5/character-creator.js';

const dsa5CharacterCreator = new DSA5CharacterCreator({ foundryClient, logger });

// In tool definitions:
...dsa5CharacterCreator.getToolDefinitions(),
```

---

## See Also

- [ADDING_NEW_SYSTEMS.md](./ADDING_NEW_SYSTEMS.md) – How to add new game systems
- [CLAUDE.md](./CLAUDE.md) – Project documentation
- [DSA5 Archetypes](https://dsa-ulisses.de) – Official DSA5 character archetypes
