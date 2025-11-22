# DSA5 Adapter Layer

**Status:** Phase 1 Complete (Character Import) ✅
**Version:** 0.1.0

## Overview

This directory contains the **DSA5 (Das Schwarze Auge 5) Adapter Layer** for the Foundry VTT MCP Bridge.

**Architecture Principle:** "Adapter, not Integration"

All DSA5-specific logic is isolated here, keeping `data-access.ts` clean and upstream-compatible.

## File Structure

```
src/tools/dsa5/
├── README.md                # This file
├── index.ts                 # Public API exports
├── types.ts                 # DSA5 type definitions
├── field-mappings.ts        # Mapping tables (German ↔ English)
├── character-import.ts      # Extract DSA5 data from actors (Phase 1 ✅)
└── character-export.ts      # Apply updates to actors (Phase 4 ⏳)
```

## Usage

### From `data-access.ts`

```typescript
import { extractDsa5CharacterData, isDsa5System } from './tools/dsa5/index.js';

async getCharacterInfo(identifier: string): Promise<CharacterInfo> {
  // ... existing code ...

  // Add DSA5 extension
  if (isDsa5System()) {
    characterData.dsa5 = extractDsa5CharacterData(actor);
  }

  return characterData;
}
```

### Standalone Usage

```typescript
import {
  extractDsa5CharacterData,
  getDsa5CharacterSummary,
  EIGENSCHAFT_NAMES,
  WOUNDS_HELPER,
} from './tools/dsa5/index.js';

const actor = game.actors.getName('Thorwal der Krieger');
const dsa5Data = extractDsa5CharacterData(actor);

console.log(getDsa5CharacterSummary(actor));

// Convert wounds to HP
const hp = WOUNDS_HELPER.toHitPoints(dsa5Data.status.wounds);
console.log(`Current HP: ${hp.current}/${hp.max}`);
```

## Key Features

### Phase 1: Character Import ✅

- **Eigenschaften (8 Attributes):** MU, KL, IN, CH, FF, GE, KO, KK
- **Status Values:** LeP (with wound inversion), AsP, KaP, Speed, Initiative
- **Skills & Combat:** Talente, Kampftechniken
- **Identity:** Species, Culture, Profession, Size
- **Meta:** Experience, Tradition, Advantages/Disadvantages

### Phase 4: Character Export ⏳ (Planned)

- Update characteristics
- Modify LeP/AsP/KaP (with proper wound logic)
- Apply damage/healing
- Update skill values

## Important DSA5 Concepts

### Wound Inversion Logic ⚠️

DSA5 uses **inverted hit point logic**:

```typescript
system.status.wounds.value = current WOUNDS (0 = healthy)
system.status.wounds.max = maximum Lebensenergie

Current HP = wounds.max - wounds.value
```

Use `WOUNDS_HELPER` to handle conversions:

```typescript
import { WOUNDS_HELPER } from './field-mappings.js';

// DSA5 → HP
const hp = WOUNDS_HELPER.toHitPoints({ value: 5, max: 30 });
// Result: { current: 25, max: 30 }

// HP → DSA5
const wounds = WOUNDS_HELPER.toWounds({ current: 25, max: 30 });
// Result: { value: 5, max: 30 }
```

### Eigenschaften (Characteristics)

8 core attributes, calculated as:

```
Total = initial + species + modifier + advances
```

Use `EIGENSCHAFT_HELPER.calculateTotal()` for safe calculation.

### German Field Names

DSA5 uses German terminology internally. Use `field-mappings.ts` for conversions:

```typescript
import { EIGENSCHAFT_NAMES, SIZE_MAP_DE_TO_EN } from './field-mappings.js';

EIGENSCHAFT_NAMES.MU.german;   // "Mut"
EIGENSCHAFT_NAMES.MU.english;  // "Courage"

SIZE_MAP_DE_TO_EN['groß'];     // "large"
```

## Development Status

### ✅ Phase 1: Character Import

- [x] Type definitions
- [x] Field mappings
- [x] Character data extraction
- [x] Skills & combat skills
- [x] Summary generation

### ⏳ Phase 2: Creature Index (Planned)

- [ ] DSA5 creature index builder
- [ ] Compendium search integration
- [ ] Species/culture/trait filtering

### ⏳ Phase 3: Integration (Planned)

- [ ] Integrate into `characters.ts` (minimal changes)
- [ ] Add DSA5 system detection
- [ ] End-to-end testing

### ⏳ Phase 4: Character Export (Planned)

- [ ] MCP update interface
- [ ] Write operations
- [ ] Transaction management
- [ ] Validation & preview

## Testing

### Manual Testing in Foundry Console

```javascript
// Test character extraction
const actor = game.actors.getName('Your DSA5 Character');
const { extractDsa5CharacterData } = await import('./tools/dsa5/index.js');
const dsa5Data = extractDsa5CharacterData(actor);
console.log(dsa5Data);

// Test summary generation
const { getDsa5CharacterSummary } = await import('./tools/dsa5/index.js');
console.log(getDsa5CharacterSummary(actor));
```

## Upstream Compatibility

This adapter layer is designed to **NOT conflict with upstream** changes:

- ✅ No modifications to `data-access.ts` core logic
- ✅ Isolated in separate directory
- ✅ Clean import/export boundaries
- ✅ System detection guards (`isDsa5System()`)

When syncing with upstream:

```bash
git fetch upstream
git merge upstream/main  # Should be conflict-free!
```

## Contributing

When adding DSA5 features:

1. ✅ Keep all DSA5 code in `src/tools/dsa5/`
2. ✅ Export through `index.ts`
3. ✅ Use `isDsa5System()` guards
4. ✅ Document German ↔ English mappings
5. ✅ Add examples to this README

## License

MIT (same as parent project)
