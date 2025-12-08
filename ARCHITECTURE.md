# Foundry MCP Bridge - Architecture Rules

## 🚨 CRITICAL: READ THIS BEFORE MAKING ANY CODE CHANGES

This document defines **mandatory architectural patterns** that **MUST** be followed.
Violations of these rules will break the system's extensibility and maintainability.

---

## 📐 Core Architecture: Adapter Pattern

The Foundry MCP Bridge uses the **Adapter Pattern** to support multiple game systems (D&D5e, PF2e, DSA5, etc.) without modifying core files.

### Principle: **System-Agnostic Core**

All core logic in `packages/foundry-module/src/data-access.ts` and `packages/mcp-server/src/tools/*.ts` **MUST** be system-agnostic.

**❌ FORBIDDEN:**
```typescript
// NEVER do this in data-access.ts or core tool files:
if (game.system.id === 'dsa5') {
  // DSA5-specific logic
}
```

**✅ REQUIRED:**
```typescript
// Use adapters instead:
const adapter = systemRegistry.getAdapter(game.system.id);
if (adapter) {
  adapter.handleSystemSpecificLogic(data);
}
```

---

## 🗂️ File Structure

```
packages/mcp-server/src/
├── tools/                      # System-agnostic MCP tool handlers
│   ├── character.ts           # ✅ NO game system logic
│   ├── compendium.ts          # ✅ NO game system logic
│   └── token-manipulation.ts  # ✅ NO game system logic
│
├── systems/                    # ALL game system logic goes here
│   ├── types.ts               # SystemAdapter interface
│   ├── system-registry.ts     # Singleton registry
│   ├── index-builder-registry.ts
│   │
│   ├── dnd5e/                 # D&D 5e adapter
│   │   ├── adapter.ts
│   │   ├── filters.ts
│   │   └── index-builder.ts
│   │
│   ├── pf2e/                  # Pathfinder 2e adapter
│   │   ├── adapter.ts
│   │   ├── filters.ts
│   │   └── index-builder.ts
│   │
│   └── dsa5/                  # Das Schwarze Auge adapter
│       ├── adapter.ts         # ✅ ALL DSA5 logic here
│       ├── filters.ts
│       ├── token-adapter.ts   # DSA5 token/condition handling
│       └── character-creator.ts
│
└── backend.ts                  # Registers all adapters

packages/foundry-module/src/
├── data-access.ts              # ✅ System-agnostic Foundry data access
└── queries.ts                  # ✅ System-agnostic query handlers
```

---

## 🔒 Mandatory Rules

### Rule 1: NO System Checks in Core Files

**Files that MUST be system-agnostic:**
- `packages/mcp-server/src/tools/*.ts` (all tool files)
- `packages/mcp-server/src/backend.ts` (except adapter registration)

**Files that MAY contain limited system-specific logic:**
- `packages/foundry-module/src/data-access.ts` - **EXCEPTION**: Runs in Foundry browser, no access to MCP Server adapters
  - ✅ Allowed: Minimal system checks with helper functions
  - ✅ Required: Extract DSA5 logic into well-named helper functions
  - ❌ Forbidden: Scattered `if (game.system.id === 'dsa5')` throughout methods
  - ✅ Pattern: One centralized system detection, delegate to helpers
- `packages/foundry-module/src/queries.ts` - Should remain system-agnostic

**Violation Example:**
```typescript
// ❌ FORBIDDEN in data-access.ts:
async toggleTokenCondition(data: any) {
  if ((game.system as any)?.id === 'dsa5') {
    // DSA5-specific logic ← THIS VIOLATES THE ARCHITECTURE
  }
}
```

**Correct Implementation for MCP Server tools:**
```typescript
// ✅ REQUIRED in MCP Server: Delegate to adapter
async toggleTokenCondition(data: any) {
  const systemId = (game.system as any)?.id;
  const adapter = systemRegistry.getAdapter(systemId);

  if (adapter && adapter.toggleTokenCondition) {
    return await adapter.toggleTokenCondition(data);
  }

  // Fallback to default behavior
  return this.toggleTokenConditionDefault(data);
}
```

**Acceptable Implementation for Foundry Module (data-access.ts):**
```typescript
// ✅ ACCEPTABLE in Foundry Module: Use helpers
async toggleTokenCondition(data: any) {
  const systemId = (game.system as any)?.id;

  if (systemId === 'dsa5') {
    return await this.toggleTokenConditionDSA5(data);
  }

  // Default behavior for other systems
  return this.toggleTokenConditionDefault(data);
}

// Extract DSA5 logic to separate helper
private async toggleTokenConditionDSA5(data: any) {
  // All DSA5-specific logic here
  const effectData = this.formatDSA5ConditionEffect(data.condition);
  // ... rest of DSA5 logic
}

private formatDSA5ConditionEffect(condition: any) {
  // DSA5-specific condition formatting
  const effectData: any = {
    name: condition.name || condition.label || condition.id,
    icon: condition.icon || condition.img,
  };

  // DSA5: Skip duration to prevent .auto errors
  if (condition.flags) effectData.flags = condition.flags;
  if (condition.changes) effectData.changes = condition.changes;

  return effectData;
}
```

### Rule 2: System-Specific Logic in Adapters ONLY

**All game system logic belongs in:**
- `packages/mcp-server/src/systems/{system-name}/adapter.ts`
- `packages/mcp-server/src/systems/{system-name}/*.ts`

**Examples of system-specific logic that MUST be in adapters:**
- Condition/effect data structure handling
- Character stat extraction
- Creature filtering (CR vs Level vs Challenge)
- Spell/power formatting
- Token property access patterns
- Duration handling

### Rule 3: Extend SystemAdapter Interface

When adding new system-specific features, **extend the `SystemAdapter` interface** in `packages/mcp-server/src/systems/types.ts`:

```typescript
export interface SystemAdapter {
  // Existing methods...
  getMetadata(): SystemMetadata;
  canHandle(systemId: string): boolean;

  // ✅ Add new methods here when needed:
  toggleTokenCondition?(data: TokenConditionData): Promise<Result>;
  getTokenDetails?(tokenId: string): Promise<TokenDetails>;
  formatConditionEffect?(condition: any): EffectData;
}
```

Then implement in each system adapter:
- `packages/mcp-server/src/systems/dsa5/adapter.ts`
- `packages/mcp-server/src/systems/dnd5e/adapter.ts`
- `packages/mcp-server/src/systems/pf2e/adapter.ts`

### Rule 4: Register Adapters in backend.ts

All adapters MUST be registered in `packages/mcp-server/src/backend.ts`:

```typescript
import { SystemRegistry } from './systems/system-registry.js';
import { DND5eAdapter } from './systems/dnd5e/adapter.js';
import { PF2eAdapter } from './systems/pf2e/adapter.js';
import { DSA5Adapter } from './systems/dsa5/adapter.js';

// In Backend class constructor:
this.systemRegistry = new SystemRegistry(this.logger);
this.systemRegistry.register(new DND5eAdapter(this.logger));
this.systemRegistry.register(new PF2eAdapter(this.logger));
this.systemRegistry.register(new DSA5Adapter(this.logger));
```

### Rule 5: Adapter Discovery

Core files can query available adapters:

```typescript
// ✅ Correct usage in data-access.ts:
const systemId = (game.system as any)?.id;
const adapter = systemRegistry.getAdapter(systemId);

if (adapter && adapter.supportsFeature('tokenConditions')) {
  return adapter.handleTokenCondition(data);
}

// Fallback for unsupported systems
return this.handleTokenConditionGeneric(data);
```

---

## 🎯 When to Create a New Adapter

Create a new system adapter when adding support for a new game system:

1. Create directory: `packages/mcp-server/src/systems/{newsystem}/`
2. Implement required files:
   - `adapter.ts` - Implements `SystemAdapter` interface
   - `filters.ts` - System-specific filter logic
   - `index-builder.ts` - Creature indexing logic
3. Register in `backend.ts`
4. Add system ID to `SystemId` type in `types.ts`

See `ADDING_NEW_SYSTEMS.md` for detailed instructions.

---

## 🔧 Token/Condition Handling (DSA5 Example)

### Current Problem (As of this commit):

**`data-access.ts` contains DSA5-specific logic:**
```typescript
// ❌ VIOLATION in data-access.ts line 4535:
if ((game.system as any)?.id === 'dsa5') {
  if (condition.flags) { effectData.flags = condition.flags; }
  if (condition.changes) { effectData.changes = condition.changes; }
  // DSA5 duration: Skip duration property...
}
```

### Required Fix:

**Move to DSA5 adapter:**

1. Create `packages/mcp-server/src/systems/dsa5/token-adapter.ts`:
```typescript
export class DSA5TokenAdapter {
  formatConditionEffect(condition: any): EffectData {
    const effectData: any = {
      name: condition.name || condition.label || condition.id,
      icon: condition.icon || condition.img,
    };

    // DSA5-specific property handling
    if (condition.flags) effectData.flags = condition.flags;
    if (condition.changes) effectData.changes = condition.changes;
    // Skip duration for DSA5 (prevents .auto errors)

    return effectData;
  }

  getTokenProperties(token: any): TokenDetails {
    // DSA5-specific token property access
    return {
      x: token.x || token.document?.x,
      y: token.y || token.document?.y,
      // ... DSA5-specific extraction
    };
  }
}
```

2. Update `packages/mcp-server/src/systems/dsa5/adapter.ts`:
```typescript
import { DSA5TokenAdapter } from './token-adapter.js';

export class DSA5Adapter implements SystemAdapter {
  private tokenAdapter: DSA5TokenAdapter;

  constructor(logger?: Logger) {
    this.tokenAdapter = new DSA5TokenAdapter();
  }

  toggleTokenCondition(data: any): Promise<any> {
    return this.tokenAdapter.formatConditionEffect(data.condition);
  }

  getTokenDetails(tokenId: string): Promise<any> {
    return this.tokenAdapter.getTokenProperties(tokenId);
  }
}
```

3. Update `data-access.ts` to use adapter:
```typescript
async toggleTokenCondition(data: any): Promise<any> {
  const systemId = (game.system as any)?.id;
  const adapter = systemRegistry.getAdapter(systemId);

  if (adapter && typeof adapter.toggleTokenCondition === 'function') {
    return await adapter.toggleTokenCondition(data);
  }

  // Generic fallback
  return this.toggleTokenConditionGeneric(data);
}
```

---

## 📚 Related Documentation

- **ADDING_NEW_SYSTEMS.md** - Step-by-step guide for adding new game systems
- **DSA5_ROADMAP.md** - DSA5 implementation roadmap
- **packages/mcp-server/src/systems/dsa5/README.md** - DSA5 adapter documentation

---

## ⚠️ Enforcement

**Before merging any PR:**
1. ✅ Run: `grep -r "game\.system\.id === 'dsa5'" packages/foundry-module/src/data-access.ts`
   - **MUST return 0 results**
2. ✅ Run: `grep -r "game\.system\.id === 'dsa5'" packages/mcp-server/src/tools/`
   - **MUST return 0 results**
3. ✅ All system-specific logic in `packages/mcp-server/src/systems/{system}/`

**Violations will:**
- Break extensibility for future systems
- Create technical debt
- Require costly refactoring later

---

## 🤝 Questions?

If unclear whether logic should be in core or adapter, ask:

1. **Does it work the same way for ALL game systems?** → Core file
2. **Does D&D5e handle it differently than PF2e or DSA5?** → Adapter
3. **Does it reference system-specific properties (e.g., `duration.auto`)?** → Adapter

**When in doubt:** Put it in the adapter. It's easier to generalize later than to de-tangle system-specific code.

---

## 📝 Version

- **Created**: 2025-12-08
- **Author**: Claude (Anthropic)
- **Purpose**: Prevent architecture violations in multi-system support
