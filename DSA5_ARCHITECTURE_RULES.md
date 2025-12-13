# DSA5 Architecture Rules - Adam's Official Design Guidelines

**Source:** https://github.com/adambdooley/foundry-vtt-mcp/blob/master/ADDING_NEW_SYSTEMS.md

**Purpose:** Mandatory architectural rules when adding or modifying DSA5 features in Foundry VTT MCP

---

## 🚨 CRITICAL: Read Before Any DSA5 Changes

Diese Regeln sind **PFLICHT** für alle DSA5 Entwicklungen. Verstöße führen zu:
- ❌ Upstream Merge-Konflikten
- ❌ Breaking Changes für andere Systeme
- ❌ Schwierigen Refactorings später

---

## 🏗️ Adams Registry Pattern (v0.6.0+)

### Kern-Prinzip: **"Adapter, nicht Integration"**

**✅ RICHTIG:**
```typescript
// Neues System in separatem Adapter
packages/mcp-server/src/systems/dsa5/
├── adapter.ts           # SystemAdapter implementation
├── filters.ts           # Filter schemas (Zod)
└── index-builder.ts     # IndexBuilder implementation
```

**❌ FALSCH:**
```typescript
// DSA5-Logik direkt in Core-Files
if (game.system.id === 'dsa5') {
  // DSA5-specific code in data-access.ts
}
```

---

## 📐 Required File Structure

**Für DSA5 System müssen existieren:**

```
packages/mcp-server/src/systems/dsa5/
├── adapter.ts           # MANDATORY - SystemAdapter interface
├── filters.ts           # MANDATORY - Filter schemas + matching
├── index-builder.ts     # MANDATORY - IndexBuilder interface
├── constants.ts         # OPTIONAL  - Experience Levels, Field Paths
├── character-creator.ts # OPTIONAL  - Character creation from archetypes
└── token-adapter.ts     # OPTIONAL  - Token/Condition handling
```

**Registrierung in:**
```
packages/mcp-server/src/backend.ts
```

---

## 🔒 Mandatory Interfaces

### 1. SystemAdapter Interface

**File:** `packages/mcp-server/src/systems/types.ts`

**Must Implement:**
```typescript
export interface SystemAdapter {
  // Metadata
  getMetadata(): SystemMetadata;
  canHandle(systemId: string): boolean;

  // Filtering
  getFilterSchema(): z.ZodSchema;
  matchesFilters(creature: SystemCreatureIndex, filters: Record<string, any>): boolean;

  // Data Extraction
  extractCreatureData(doc: any, pack: any): { creature: SystemCreatureIndex; errors: number } | null;
  extractCharacterStats(actor: any): CharacterStats;

  // Formatting
  formatCreatureForList(creature: SystemCreatureIndex): any;
  formatCreatureForDetails(creature: SystemCreatureIndex): any;

  // Power Level
  getPowerLevel(creature: SystemCreatureIndex): number | undefined;

  // System Paths
  getDataPaths(): Record<string, string | null>;
}
```

---

### 2. IndexBuilder Interface

**File:** `packages/mcp-server/src/systems/types.ts`

**Must Implement:**
```typescript
export interface IndexBuilder {
  // System identification
  canHandle(systemId: string): boolean;

  // Index building
  buildIndex(
    packs: any[],
    onProgress?: (current: number, total: number, packName: string) => void
  ): Promise<{
    creatures: SystemCreatureIndex[];
    errors: number;
    totalProcessed: number;
  }>;
}
```

---

## 🎯 DSA5-Specific Rules

### ✅ ERLAUBT in data-access.ts:

**Minimale System-Checks mit Helper-Functions:**

```typescript
// data-access.ts - ACCEPTABLE PATTERN
async toggleTokenCondition(data: any) {
  const systemId = (game.system as any)?.id;

  if (systemId === 'dsa5') {
    return await this.toggleTokenConditionDSA5(data);
  }

  return this.toggleTokenConditionDefault(data);
}

// Extract to separate helper
private async toggleTokenConditionDSA5(data: any) {
  // All DSA5-specific logic here
  const effectData = this.formatDSA5ConditionEffect(data.condition);
  // ...
}
```

**Warum erlaubt:**
- `data-access.ts` läuft im Foundry Browser
- Kein Zugriff auf MCP Server Adapters
- Muss direkt mit Foundry API kommunizieren

---

### ❌ VERBOTEN überall:

**Scattered System Checks:**

```typescript
// ❌ FORBIDDEN - Scattered throughout method
async updateToken(data: any) {
  const token = getToken(data.id);

  if (game.system.id === 'dsa5') {  // ❌ DON'T
    // DSA5 logic here
  }

  token.update(data);

  if (game.system.id === 'dsa5') {  // ❌ DON'T
    // More DSA5 logic
  }
}
```

**Korrekt:**
```typescript
// ✅ CORRECT - Single system check, delegate to helper
async updateToken(data: any) {
  const systemId = (game.system as any)?.id;

  if (systemId === 'dsa5') {
    return this.updateTokenDSA5(data);
  }

  return this.updateTokenDefault(data);
}

private updateTokenDSA5(data: any) {
  // ALL DSA5 logic in one place
}
```

---

## 📋 Implementation Checklist

**Beim Hinzufügen von DSA5 Features:**

- [ ] ✅ Feature in `systems/dsa5/adapter.ts` implementiert?
- [ ] ✅ Falls neue Filters: In `systems/dsa5/filters.ts`?
- [ ] ✅ Falls Index-Änderung: In `systems/dsa5/index-builder.ts`?
- [ ] ✅ Adapter in `backend.ts` registriert?
- [ ] ✅ Keine DSA5-Logik in MCP Server `tools/*.ts` Files?
- [ ] ✅ Falls `data-access.ts` Änderung: Helper-Function extrahiert?
- [ ] ✅ Tests für D&D5e/PF2e weiterhin funktionsfähig?

---

## 🔍 Enforcement Commands

**Vor jedem Commit prüfen:**

```bash
# MUST return 0 results:
grep -r "game\.system\.id === 'dsa5'" packages/mcp-server/src/tools/

# ALLOWED (aber sollte in Helpers extrahiert werden):
grep -r "game\.system\.id === 'dsa5'" packages/foundry-module/src/data-access.ts

# Zeige Helper Functions (sollten existieren):
grep -r "Dsa5\|DSA5" packages/foundry-module/src/data-access.ts | grep "private.*function"
```

---

## 🎓 Real-World Examples

### ✅ GOOD Example: DSA5 Filters

**File:** `packages/mcp-server/src/systems/dsa5/filters.ts`

```typescript
import { z } from 'zod';

// DSA5 Species (Spezies)
export const DSA5Species = [
  'mensch', 'elf', 'zwerg', 'ork', 'goblin',
  'drache', 'dämon', 'untot', 'tier'
] as const;

// Experience Levels (1-7) - NOT Challenge Rating!
export const DSA5FiltersSchema = z.object({
  level: z.union([
    z.number().min(1).max(7),
    z.object({
      min: z.number().min(1).max(7).optional(),
      max: z.number().min(1).max(7).optional()
    })
  ]).optional(),

  species: z.enum(DSA5Species).optional(),
  culture: z.string().optional(),
  size: z.enum(['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan']).optional(),
  hasSpells: z.boolean().optional(),
});

export function matchesDSA5Filters(creature: any, filters: any): boolean {
  if (filters.level !== undefined) {
    const level = creature.systemData?.level;
    if (typeof filters.level === 'number') {
      if (level !== filters.level) return false;
    } else {
      const min = filters.level.min ?? 1;
      const max = filters.level.max ?? 7;
      if (level < min || level > max) return false;
    }
  }

  // ... weitere Filter
  return true;
}
```

---

### ❌ BAD Example: DSA5 in Core

```typescript
// ❌ FORBIDDEN - Don't do this!
// In packages/mcp-server/src/tools/compendium.ts

async function listCreaturesByCriteria(filters: any) {
  let creatures = await getCreatures();

  // ❌ System-specific logic in core tool
  if (game.system.id === 'dsa5') {
    creatures = creatures.filter(c => {
      const ap = c.system.details.experience.total;
      const level = convertAPtoLevel(ap);
      return level >= filters.level.min && level <= filters.level.max;
    });
  }

  return creatures;
}
```

**Warum falsch:**
- DSA5-Logik in Core-Tool File
- Verletzt Registry Pattern
- Schwer zu testen
- Merge-Konflikte mit Upstream

**Korrekt:**
```typescript
// ✅ CORRECT
async function listCreaturesByCriteria(filters: any) {
  const systemId = getCachedSystemId();

  if (systemId === 'dsa5') {
    // Return helpful error or delegate to DSA5 adapter
    return {
      error: "Use DSA5-specific filters",
      alternatives: [...]
    };
  }

  // D&D5e/PF2e normal flow
  return await foundryClient.query(...);
}
```

---

## 🚧 Migration Strategy: Quick Fixes vs. Full Adapter

### Quick Fix (Acceptable Short-term)

**Für BUG-Fixes:**
```typescript
// packages/foundry-module/src/data-access.ts
if (systemId === 'dsa5') {
  return this.handleDSA5SpecificCase(data);
}
```

**Requirements:**
- ✅ Extract to private helper function
- ✅ Document with `// DSA5-specific:` comment
- ✅ Add TODO for future adapter migration

---

### Full Adapter (Preferred Long-term)

**Für neue Features:**
```typescript
// packages/mcp-server/src/systems/dsa5/adapter.ts
export class DSA5Adapter implements SystemAdapter {
  // Complete system implementation
}

// packages/mcp-server/src/backend.ts
systemRegistry.register(new DSA5Adapter(logger));
```

---

## 📊 When to Use Which Approach

| Scenario | Quick Fix | Full Adapter |
|----------|-----------|--------------|
| **Bug Fix** | ✅ OK | ⏰ Later |
| **Small tweak** | ✅ OK | ⏰ Later |
| **New Feature** | ❌ NO | ✅ YES |
| **Major refactor** | ❌ NO | ✅ YES |
| **Multiple systems** | ❌ NO | ✅ YES |

---

## 🎯 Key Takeaways

### ✅ DO:
1. **Use Registry Pattern** für neue DSA5 Features
2. **Extract Helper Functions** in data-access.ts
3. **Test D&D5e/PF2e** nach jeder Änderung
4. **Document system-specific logic** mit Kommentaren
5. **Follow Upstream** Structure wo möglich

### ❌ DON'T:
1. **System checks scattered** in Core-Files
2. **DSA5 logic in tools/*.ts** (MCP Server)
3. **Break D&D5e/PF2e** functionality
4. **Skip Adapter registration** in backend.ts
5. **Modify core without reason**

---

## 📖 Related Documentation

- **Official Guide:** https://github.com/adambdooley/foundry-vtt-mcp/blob/master/ADDING_NEW_SYSTEMS.md
- **PR #4 ARCHITECTURE.md:** (in diesem Repo - aus PR #4)
- **PR4_USEFUL_PATTERNS.md:** Extrahierte Patterns für Bug-Fixes
- **PR4_ANALYSIS.md:** Warum PR #4 nicht gemerged wird

---

## 💡 Questions?

**Ask yourself:**

1. **Würde diese Änderung ein anderes System brechen?**
   → Wenn ja: System Detection + separate Logik

2. **Ist das DSA5-spezifisch?**
   → Wenn ja: In `systems/dsa5/` oder Helper-Function

3. **Würde das Merge-Konflikte mit Upstream verursachen?**
   → Wenn ja: Adapter Pattern verwenden

4. **Kann ich das testen ohne DSA5?**
   → Wenn nein: Du bist zu tief im Core

---

**Last Updated:** 2024-12-13
**Enforcement:** Mandatory for all DSA5 development
**Violations:** Will be rejected in code review

---

## 🔗 Quick Reference Links

- **Adam's Repo:** https://github.com/adambdooley/foundry-vtt-mcp
- **ADDING_NEW_SYSTEMS.md:** https://github.com/adambdooley/foundry-vtt-mcp/blob/master/ADDING_NEW_SYSTEMS.md
- **SystemAdapter Interface:** packages/mcp-server/src/systems/types.ts
- **Registration:** packages/mcp-server/src/backend.ts
