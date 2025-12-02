# PR Preparation Plan - SystemRegistry Integration

**Ziel:** CharacterTools & CompendiumTools v0.6.0-konform machen für PR an Adam
**Deadline:** VOR PR an Adam (GitHub Issue #11)
**Priorität:** 🔴 P0 - KRITISCH
**Effort:** 2-3 Stunden

---

## 📋 Überblick

### Was muss gemacht werden?

1. ✅ CharacterTools SystemRegistry Integration (1-2 Std)
2. ✅ CompendiumTools SystemRegistry Integration (30-60 Min)
3. ✅ Testing mit DSA5 Character (30 Min)
4. ✅ Dokumentation Update (15 Min)
5. ✅ Commit & Push (10 Min)

### Warum?

- ✅ Adam erwartet v0.6.0-konformen Code (Issue #11)
- ✅ `get-character` muss für DSA5 funktionieren
- ✅ PR wird sonst nicht gemerged

---

## 🚀 Phase 1: CharacterTools Integration (1-2 Std)

### Ziel
`get-character --identifier "Thorald"` soll DSA5-Charaktere korrekt anzeigen

### Änderungen

#### 1.1 Interface erweitern (5 Min)

**Datei:** `packages/mcp-server/src/tools/character.ts`

**Änderung:** Zeile 5-8

```typescript
// VORHER:
export interface CharacterToolsOptions {
  foundryClient: FoundryClient;
  logger: Logger;
}

// NACHHER:
export interface CharacterToolsOptions {
  foundryClient: FoundryClient;
  logger: Logger;
  systemRegistry?: SystemRegistry;  // ← HINZUFÜGEN
}
```

**Benötigt:** Import hinzufügen:
```typescript
import { SystemRegistry } from '../systems/system-registry.js';
import { detectGameSystem, type GameSystem } from '../utils/system-detection.js';
```

---

#### 1.2 Class-Felder erweitern (5 Min)

**Datei:** `packages/mcp-server/src/tools/character.ts`

**Änderung:** Zeile 10-17

```typescript
// VORHER:
export class CharacterTools {
  private foundryClient: FoundryClient;
  private logger: Logger;

  constructor({ foundryClient, logger }: CharacterToolsOptions) {
    this.foundryClient = foundryClient;
    this.logger = logger.child({ component: 'CharacterTools' });
  }

// NACHHER:
export class CharacterTools {
  private foundryClient: FoundryClient;
  private logger: Logger;
  private systemRegistry: SystemRegistry | null;      // ← HINZUFÜGEN
  private cachedGameSystem: GameSystem | null = null; // ← HINZUFÜGEN

  constructor({ foundryClient, logger, systemRegistry }: CharacterToolsOptions) {
    this.foundryClient = foundryClient;
    this.logger = logger.child({ component: 'CharacterTools' });
    this.systemRegistry = systemRegistry || null;  // ← HINZUFÜGEN
  }
```

---

#### 1.3 Game System Detection hinzufügen (5 Min)

**Datei:** `packages/mcp-server/src/tools/character.ts`

**Einfügen:** Nach Constructor (Zeile ~20)

```typescript
  /**
   * Get or detect the game system (cached)
   */
  private async getGameSystem(): Promise<GameSystem> {
    if (!this.cachedGameSystem) {
      this.cachedGameSystem = await detectGameSystem(
        this.foundryClient,
        this.logger
      );
    }
    return this.cachedGameSystem;
  }
```

---

#### 1.4 extractStats() erweitern (15 Min)

**Datei:** `packages/mcp-server/src/tools/character.ts`

**Änderung:** Zeile ~172-217

```typescript
// VORHER:
  private extractStats(characterData: any): any {
    const system = characterData.system || {};
    const stats: any = {};

    // Ability scores (D&D 5e style)
    if (system.abilities) {
      stats.abilities = {};
      // ...
    }
    // ...
    return stats;
  }

// NACHHER:
  private async extractStats(characterData: any): Promise<any> {
    // ✅ TRY: Use SystemAdapter if available
    if (this.systemRegistry) {
      try {
        const gameSystem = await this.getGameSystem();
        const adapter = this.systemRegistry.getAdapter(gameSystem);

        if (adapter) {
          this.logger.debug('Using system adapter for character stats extraction', {
            system: gameSystem
          });
          return adapter.extractCharacterStats(characterData);
        }
      } catch (error) {
        this.logger.warn('Failed to use system adapter, falling back to legacy extraction', {
          error
        });
      }
    }

    // ⚠️ FALLBACK: Legacy extraction (backwards compatibility)
    const system = characterData.system || {};
    const stats: any = {};

    // Ability scores (D&D 5e style)
    if (system.abilities) {
      stats.abilities = {};
      for (const [key, ability] of Object.entries(system.abilities)) {
        if (typeof ability === 'object' && ability !== null) {
          stats.abilities[key] = {
            score: (ability as any).value || 10,
            modifier: (ability as any).mod || 0,
          };
        }
      }
    }

    // Skills
    if (system.skills) {
      stats.skills = {};
      for (const [key, skill] of Object.entries(system.skills)) {
        if (typeof skill === 'object' && skill !== null) {
          stats.skills[key] = {
            value: (skill as any).value || 0,
            proficient: (skill as any).proficient || false,
            ability: (skill as any).ability || '',
          };
        }
      }
    }

    // Saves
    if (system.saves) {
      stats.saves = {};
      for (const [key, save] of Object.entries(system.saves)) {
        if (typeof save === 'object' && save !== null) {
          stats.saves[key] = {
            value: (save as any).value || 0,
            proficient: (save as any).proficient || false,
          };
        }
      }
    }

    return stats;
  }
```

---

#### 1.5 formatCharacterResponse() async machen (5 Min)

**Datei:** `packages/mcp-server/src/tools/character.ts`

**Änderung:** Zeile ~115-128

```typescript
// VORHER:
  private formatCharacterResponse(characterData: any): any {
    const response = {
      id: characterData.id,
      name: characterData.name,
      type: characterData.type,
      basicInfo: this.extractBasicInfo(characterData),
      stats: this.extractStats(characterData),  // ← SYNC
      items: this.formatItems(characterData.items || []),
      effects: this.formatEffects(characterData.effects || []),
      hasImage: !!characterData.img,
    };

    return response;
  }

// NACHHER:
  private async formatCharacterResponse(characterData: any): Promise<any> {
    const response = {
      id: characterData.id,
      name: characterData.name,
      type: characterData.type,
      basicInfo: this.extractBasicInfo(characterData),
      stats: await this.extractStats(characterData),  // ← ASYNC!
      items: this.formatItems(characterData.items || []),
      effects: this.formatEffects(characterData.effects || []),
      hasImage: !!characterData.img,
    };

    return response;
  }
```

---

#### 1.6 handleGetCharacter() anpassen (5 Min)

**Datei:** `packages/mcp-server/src/tools/character.ts`

**Änderung:** Zeile ~75

```typescript
// VORHER:
      return this.formatCharacterResponse(characterData);

// NACHHER:
      return await this.formatCharacterResponse(characterData);
```

---

#### 1.7 Backend Integration (5 Min)

**Datei:** `packages/mcp-server/src/backend.ts`

**Änderung:** Zeile ~1055 (wo characterTools erstellt wird)

```typescript
// VORHER:
  const characterTools = new CharacterTools({ foundryClient, logger });

// NACHHER:
  const characterTools = new CharacterTools({
    foundryClient,
    logger,
    systemRegistry  // ← HINZUFÜGEN (bereits vorhanden weiter oben!)
  });
```

**Hinweis:** `systemRegistry` ist bereits in Zeile ~1048 erstellt:
```typescript
const systemRegistry = getSystemRegistry(logger);
systemRegistry.register(new DSA5Adapter());
```

---

### 1.8 Build Test (5 Min)

```bash
npm run build
```

**Erwartung:** ✅ Keine Fehler

---

## 🚀 Phase 2: CompendiumTools Integration (30-60 Min)

### Ziel
`search-compendium` mit DSA5-Filtern funktioniert

### Änderungen (Analog zu CharacterTools)

**Datei:** `packages/mcp-server/src/tools/compendium.ts`

#### 2.1 Interface erweitern (5 Min)

```typescript
export interface CompendiumToolsOptions {
  foundryClient: FoundryClient;
  logger: Logger;
  systemRegistry?: SystemRegistry;  // ← HINZUFÜGEN
}
```

**Import hinzufügen:**
```typescript
import { SystemRegistry } from '../systems/system-registry.js';
```

---

#### 2.2 Class-Felder erweitern (5 Min)

```typescript
export class CompendiumTools {
  private foundryClient: FoundryClient;
  private logger: Logger;
  private systemRegistry: SystemRegistry | null;  // ← HINZUFÜGEN
  private gameSystem: GameSystem | null = null;

  constructor({ foundryClient, logger, systemRegistry }: CompendiumToolsOptions) {
    this.foundryClient = foundryClient;
    this.logger = logger.child({ component: 'CompendiumTools' });
    this.systemRegistry = systemRegistry || null;  // ← HINZUFÜGEN
  }
```

---

#### 2.3 getGameSystem() hinzufügen (5 Min)

```typescript
  private async getGameSystem(): Promise<GameSystem> {
    if (!this.gameSystem) {
      this.gameSystem = await detectGameSystem(
        this.foundryClient,
        this.logger
      );
    }
    return this.gameSystem;
  }
```

---

#### 2.4 matchesFilters() erweitern (10 Min)

**Suche nach:** `matchesFilters` Methode

**Erweitern um:**
```typescript
  private async matchesFilters(creature: any, filters: any): Promise<boolean> {
    // ✅ TRY: Use SystemAdapter if available
    if (this.systemRegistry) {
      try {
        const gameSystem = await this.getGameSystem();
        const adapter = this.systemRegistry.getAdapter(gameSystem);

        if (adapter) {
          this.logger.debug('Using system adapter for filter matching', {
            system: gameSystem
          });
          return adapter.matchesFilters(creature, filters);
        }
      } catch (error) {
        this.logger.warn('Failed to use system adapter for filtering', {
          error
        });
      }
    }

    // ⚠️ FALLBACK: Legacy filter matching
    // ... existing filter logic ...
  }
```

---

#### 2.5 Backend Integration (5 Min)

**Datei:** `packages/mcp-server/src/backend.ts`

**Änderung:** Zeile ~1057 (wo compendiumTools erstellt wird)

```typescript
// VORHER:
  const compendiumTools = new CompendiumTools({ foundryClient, logger });

// NACHHER:
  const compendiumTools = new CompendiumTools({
    foundryClient,
    logger,
    systemRegistry  // ← HINZUFÜGEN
  });
```

---

#### 2.6 Build Test (5 Min)

```bash
npm run build
```

**Erwartung:** ✅ Keine Fehler

---

## 🧪 Phase 3: Testing (30 Min)

### 3.1 DSA5 Character Test (10 Min)

**Voraussetzung:** Foundry VTT läuft mit DSA5 Character "Thorald"

**Test 1: get-character**
```bash
# In Claude Desktop:
get-character --identifier "Thorald"
```

**Erwartete Ausgabe:**
```json
{
  "id": "abc123",
  "name": "Thorald",
  "type": "character",
  "stats": {
    "characteristics": {
      "MU": { "value": 14, "initial": 14 },
      "KL": { "value": 11, "initial": 11 },
      "IN": { "value": 12, "initial": 12 },
      "CH": { "value": 13, "initial": 13 },
      "FF": { "value": 10, "initial": 10 },
      "GE": { "value": 12, "initial": 12 },
      "KO": { "value": 13, "initial": 13 },
      "KK": { "value": 14, "initial": 14 }
    },
    "lifePoints": {
      "current": 31,
      "max": 31,
      "wounds": 0
    },
    "astralEnergy": { "current": 0, "max": 0 },
    "karmaEnergy": { "current": 12, "max": 12 },
    "experience": {
      "total": 1200,
      "level": 2
    }
  }
}
```

**Falls es NICHT funktioniert:**
- Check Logs: DSA5Adapter wird verwendet?
- Check: `detectGameSystem()` erkennt "dsa5"?
- Check: `systemRegistry.getAdapter('dsa5')` funktioniert?

---

### 3.2 Compendium Test (10 Min)

**Test 2: search-compendium mit DSA5 Filtern**
```bash
# In Claude Desktop:
search-compendium --filters '{"minLevel": 3, "maxLevel": 5, "hasSpells": true}'
```

**Erwartung:** DSA5 Creatures werden gefiltert

---

### 3.3 D&D5e Backward Compatibility (10 Min)

**Test 3: Fallback funktioniert**
```bash
# Falls D&D5e Character vorhanden:
get-character --identifier "Gandalf"
```

**Erwartung:** Funktioniert wie vorher (D&D5e Felder)

---

## 📝 Phase 4: Dokumentation Update (15 Min)

### 4.1 Claude.md aktualisieren (10 Min)

**Datei:** `Claude.md`

**Update:** Zeile ~216-220

```markdown
**Mögliche zukünftige Erweiterungen:**
- [ ] Creature filtering mit DSA5 filters (level, species, hasSpells, etc.)
- [ ] Enhanced creature index building (DSA5IndexBuilder)
- [ ] Multi-system support (D&D5e, PF2e Adapter hinzufügen)
- [x] Integration von systemRegistry in CharacterTools/CompendiumTools  ← DONE!
```

---

### 4.2 PR_PREPARATION_PLAN.md updaten (5 Min)

**Datei:** `PR_PREPARATION_PLAN.md`

**Am Ende hinzufügen:**

```markdown
## ✅ Completion Status

- [x] Phase 1: CharacterTools Integration
- [x] Phase 2: CompendiumTools Integration
- [x] Phase 3: Testing
- [x] Phase 4: Dokumentation

**Ready for PR!** 🎉
```

---

## 💾 Phase 5: Commit & Push (10 Min)

### 5.1 Git Status prüfen (2 Min)

```bash
git status
```

**Erwartete Änderungen:**
- `packages/mcp-server/src/tools/character.ts`
- `packages/mcp-server/src/tools/compendium.ts`
- `packages/mcp-server/src/backend.ts`
- `Claude.md`
- `PR_PREPARATION_PLAN.md`

---

### 5.2 Commit (5 Min)

```bash
git add packages/mcp-server/src/tools/character.ts \
        packages/mcp-server/src/tools/compendium.ts \
        packages/mcp-server/src/backend.ts \
        Claude.md \
        PR_PREPARATION_PLAN.md

git commit -m "feat: Integrate SystemRegistry in CharacterTools and CompendiumTools

Make CharacterTools and CompendiumTools v0.6.0 compliant for Adam's PR.

## Changes

CharacterTools:
- Add optional systemRegistry parameter
- Use adapter.extractCharacterStats() if available
- Fall back to legacy D&D5e extraction
- get-character now works for DSA5!

CompendiumTools:
- Add optional systemRegistry parameter
- Use adapter.matchesFilters() for filtering
- Fall back to legacy filter logic

Backend:
- Pass systemRegistry to CharacterTools
- Pass systemRegistry to CompendiumTools

## Testing

✅ get-character works for DSA5 (8 Eigenschaften, LeP, AsP, KaP)
✅ search-compendium works with DSA5 filters
✅ Backward compatible with D&D5e
✅ Build passes

## Related

- Addresses GitHub Issue #11 requirement
- Completes v0.6.0 Registry Pattern integration
- Ready for PR to Adam

Closes: Preparation for Issue #11 PR"
```

---

### 5.3 Push (3 Min)

```bash
git push -u origin claude/review-project-features-01PmrvNF2QLWT277NpZaTkhg
```

---

## 🎯 Success Criteria

### Checklist vor PR

- [ ] ✅ CharacterTools nutzt SystemRegistry
- [ ] ✅ CompendiumTools nutzt SystemRegistry
- [ ] ✅ `get-character` funktioniert für DSA5
  - [ ] Zeigt 8 Eigenschaften (MU, KL, IN, CH, FF, GE, KO, KK)
  - [ ] Zeigt LeP korrekt (current, max, wounds)
  - [ ] Zeigt AsP, KaP
  - [ ] Zeigt Experience Level
- [ ] ✅ `search-compendium` funktioniert mit DSA5 Filtern
- [ ] ✅ D&D5e Backward Compatibility (Fallback funktioniert)
- [ ] ✅ Build passed (`npm run build`)
- [ ] ✅ Dokumentation updated
- [ ] ✅ Committed & Pushed

**Wenn alle ✅:** Ready for PR! 🚀

---

## 📊 Zeitplan

| Phase | Aufgabe | Effort | Status |
|-------|---------|--------|--------|
| **Phase 1** | CharacterTools Integration | 1-2 Std | ⏳ TODO |
| **Phase 2** | CompendiumTools Integration | 30-60 Min | ⏳ TODO |
| **Phase 3** | Testing | 30 Min | ⏳ TODO |
| **Phase 4** | Dokumentation | 15 Min | ⏳ TODO |
| **Phase 5** | Commit & Push | 10 Min | ⏳ TODO |
| **TOTAL** | | **2-3 Std** | ⏳ TODO |

---

## 🔗 Referenzen

- **GitHub Issue:** https://github.com/adambdooley/foundry-vtt-mcp/issues/11
- **Upstream character.ts:** `git show upstream/master:packages/mcp-server/src/tools/character.ts`
- **DSA5Adapter:** `packages/mcp-server/src/systems/dsa5/adapter.ts`
- **v0.6.0 Types:** `packages/mcp-server/src/systems/types.ts`

---

## 💡 Tipps

### Falls Probleme auftreten

**Build-Fehler:**
- Prüfe Imports: `SystemRegistry`, `detectGameSystem`
- Prüfe async/await: `extractStats` muss `Promise<any>` returnen

**Tests schlagen fehl:**
- Check Logs: `this.logger.debug('Using system adapter...')`
- Check: `systemRegistry.getAdapter('dsa5')` nicht null?
- Check: DSA5Adapter registriert im Backend?

**DSA5 Character zeigt keine Stats:**
- Check: `detectGameSystem()` erkennt "dsa5"?
- Check: DSA5Adapter.extractCharacterStats() wird aufgerufen?
- Check: Fallback-Logic korrekt?

---

*Erstellt: 2025-12-02*
*Kontext: GitHub Issue #11 - Adam wartet auf v0.6.0-konformen PR*
*Next: Umsetzung in Session (2-3 Stunden)*
