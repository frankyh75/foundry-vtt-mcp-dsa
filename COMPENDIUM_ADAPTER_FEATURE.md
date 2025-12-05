# CompendiumTools SystemAdapter Integration

## Overview

This feature completes the v0.6.0 Registry Pattern integration for CompendiumTools, enabling `search-compendium` to use SystemAdapter for creature stats extraction.

## What Changed

### Before (v0.6.1)
- `CompendiumTools` had `systemRegistry` parameter in interface
- **BUT:** Didn't use it for creature stats extraction
- Used hardcoded extraction logic for D&D5e/PF2e only
- DSA5 creatures showed no system-specific stats in search results

### After (v0.6.2)
- `CompendiumTools` **uses** SystemAdapter for stats extraction
- `search-compendium` results now include DSA5-specific stats (LeP, Eigenschaften, etc.)
- Reduced code duplication (~80 lines removed)
- Maintains full backward compatibility

## Technical Implementation

### New Methods

#### `formatCreatureStats(item, gameSystem)`
- Async method that uses SystemAdapter if available
- Calls `adapter.extractCharacterStats()` for system-specific extraction
- Falls back to `extractLegacyCreatureStats()` if adapter unavailable

#### `extractLegacyCreatureStats(item, gameSystem)`
- Extracted from old `formatCompendiumItem()` logic
- Handles D&D5e and PF2e stats extraction
- Provides backward compatibility

### Modified Methods

#### `formatCompendiumItem(item, gameSystem)`
- Changed from sync to **async**
- Now calls `formatCreatureStats()` instead of inline extraction
- Reduced from ~100 lines to ~20 lines

#### `handleSearchCompendium(args)`
- Updated to use `Promise.all()` for async `formatCompendiumItem()` calls
- No functional changes, just async handling

## Benefits

1. **DSA5 Support**: Search results now show DSA5 creature stats correctly
2. **Code Quality**: Eliminated ~80 lines of duplicated code
3. **Consistency**: Uses same pattern as CharacterTools
4. **Extensibility**: New systems automatically work in search results
5. **Backward Compatibility**: D&D5e and PF2e continue to work exactly as before

## Example Usage

```typescript
// DSA5 creature in search results now shows:
{
  id: "...",
  name: "Goblin",
  stats: {
    lifePoints: { current: 25, max: 25 },  // LeP instead of HP!
    characteristics: {
      MU: 10, KL: 8, IN: 9, CH: 7,
      FF: 12, GE: 13, KO: 11, KK: 10
    },
    level: 1,
    species: "Goblin"
  }
}
```

## Testing

Run the build to verify:
```bash
npm run build  # Should pass with 0 errors
```

Test in Foundry VTT:
```bash
# With DSA5 system loaded:
search-compendium --query "goblin"
# Should show DSA5-specific stats
```

## Related

- Issue #11: DSA5 system support requirements
- PR #12: Initial DSA5 implementation
- v0.6.0: Registry Pattern architecture
- v0.6.1: DSA5 system support release
