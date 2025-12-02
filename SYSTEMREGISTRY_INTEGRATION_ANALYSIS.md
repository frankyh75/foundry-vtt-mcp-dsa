# SystemRegistry Integration in CharacterTools - Detaillierte Analyse

**Datum:** 2025-12-02
**Kontext:** P1 Feature Gap aus QUEST_TOOLS_EVALUATION.md
**Impact:** 🟡 Mittel (nicht kritisch, aber architektonisch wichtig)

---

## 📊 Executive Summary

**Was fehlt:**
- CharacterTools im Current Branch nutzt KEIN SystemRegistry
- Upstream (Adam's master) nutzt SystemRegistry für Multi-System Support
- 32 Zeilen Code-Unterschied

**Impact:**
- ✅ **Funktional:** KEIN Verlust (character.ts funktioniert für D&D5e/PF2e)
- ⚠️ **DSA5:** Nutzt separate dsa5-character-tools.ts (unabhängig)
- ⚠️ **Architektur:** Suboptimal (sollte v0.6.0 Pattern nutzen)

**Empfehlung:** ⏳ Später integrieren (nicht kritisch, P1)

---

## 🔍 Was ist SystemRegistry?

### Konzept (v0.6.0 Registry Pattern)

**SystemRegistry** ist ein zentrales Register für **SystemAdapter**-Implementierungen.

```typescript
// Registry: Verwaltet alle System-Adapter
class SystemRegistry {
  private adapters: Map<SystemId, SystemAdapter>;

  register(adapter: SystemAdapter): void;
  getAdapter(systemId: string): SystemAdapter | null;
  isSupported(systemId: string): boolean;
}

// Adapter: System-spezifische Logik
interface SystemAdapter {
  getMetadata(): SystemMetadata;
  extractCharacterStats(actorData: any): any;  // ← WICHTIG!
  extractCreatureData(doc: any): any;
  matchesFilters(creature: any, filters: any): boolean;
  // ... 11 Methoden total
}
```

**Zweck:**
- **Modular:** Neue Systeme ohne Core-Änderungen hinzufügen
- **Clean:** System-Logik isoliert in Adaptern
- **Extensible:** Jedes System implementiert eigene Logik

**Aktuell verfügbar:**
- ✅ DSA5Adapter (in unserem Branch)
- ❌ D&D5eAdapter (nur in Upstream)
- ❌ PF2eAdapter (nur in Upstream)

---

## 📂 Current Branch: Wie funktioniert character.ts OHNE SystemRegistry?

### Aktueller Code

```typescript
// packages/mcp-server/src/tools/character.ts

export class CharacterTools {
  private foundryClient: FoundryClient;
  private logger: Logger;
  // ❌ KEIN systemRegistry

  private extractStats(characterData: any): any {
    const system = characterData.system || {};
    const stats: any = {};

    // ✅ Hardcoded D&D5e-Style extraction
    if (system.abilities) {  // D&D 5e
      stats.abilities = {};
      for (const [key, ability] of Object.entries(system.abilities)) {
        stats.abilities[key] = {
          score: (ability as any).value || 10,
          modifier: (ability as any).mod || 0,
        };
      }
    }

    // ✅ Hardcoded skills extraction
    if (system.skills) {
      stats.skills = {};
      // ... D&D5e/PF2e logic
    }

    return stats;
  }
}
```

**Wie es funktioniert:**
1. `get-character` wird aufgerufen
2. Foundry liefert Actor-Daten
3. `extractStats()` versucht D&D5e-Felder zu lesen
4. Falls Felder fehlen → leeres Objekt

**Problem:**
- ✅ Funktioniert für D&D 5e (hardcoded)
- ⚠️ Funktioniert teilweise für PF2e (ähnliche Struktur)
- ❌ Funktioniert NICHT für DSA5 (völlig andere Struktur)

**Warum DSA5 trotzdem funktioniert:**
- DSA5 hat separate Tools: `dsa5-character-tools.ts`
- `get-dsa5-character-summary` statt `get-character`
- Verwendet `tools/dsa5/` Adapter Layer direkt

---

## 🔄 Upstream (Adam): Wie funktioniert es MIT SystemRegistry?

### Upstream Code

```typescript
// packages/mcp-server/src/tools/character.ts (upstream/master)

export class CharacterTools {
  private foundryClient: FoundryClient;
  private logger: Logger;
  private systemRegistry: SystemRegistry | null;  // ✅ REGISTRY!
  private cachedGameSystem: GameSystem | null = null;

  constructor({ foundryClient, logger, systemRegistry }: CharacterToolsOptions) {
    this.systemRegistry = systemRegistry || null;
  }

  private async getGameSystem(): Promise<GameSystem> {
    if (!this.cachedGameSystem) {
      this.cachedGameSystem = await detectGameSystem(
        this.foundryClient,
        this.logger
      );
    }
    return this.cachedGameSystem;
  }

  private async extractStats(characterData: any): Promise<any> {
    // ✅ TRY: Use SystemAdapter if available
    if (this.systemRegistry) {
      try {
        const gameSystem = await this.getGameSystem();
        const adapter = this.systemRegistry.getAdapter(gameSystem);

        if (adapter) {
          this.logger.debug('Using system adapter for stats extraction');
          return adapter.extractCharacterStats(characterData);  // ← MAGIC!
        }
      } catch (error) {
        this.logger.warn('Failed to use adapter, falling back');
      }
    }

    // ⚠️ FALLBACK: Legacy hardcoded extraction (D&D5e)
    const system = characterData.system || {};
    const stats: any = {};

    if (system.abilities) {  // D&D 5e
      // ... hardcoded logic
    }

    return stats;
  }
}
```

**Wie es funktioniert:**
1. `get-character` wird aufgerufen
2. Foundry liefert Actor-Daten
3. `detectGameSystem()` erkennt System (dnd5e/pf2e/dsa5/other)
4. `systemRegistry.getAdapter('dsa5')` → DSA5Adapter
5. `DSA5Adapter.extractCharacterStats()` → DSA5-spezifische Logik!
6. Falls kein Adapter → Fallback zu hardcoded D&D5e

**Vorteile:**
- ✅ DSA5 funktioniert via `get-character` (nicht nur `get-dsa5-character-summary`)
- ✅ PF2e funktioniert besser (eigene Logik)
- ✅ Neue Systeme: Adapter registrieren, fertig!
- ✅ Clean Architecture (Separation of Concerns)

---

## 🎯 DSA5Adapter.extractCharacterStats() - Was macht es?

### Implementation (bereits vorhanden!)

```typescript
// packages/mcp-server/src/systems/dsa5/adapter.ts

extractCharacterStats(actorData: any): any {
  const system = actorData.system || {};
  const stats: any = {};

  // ✅ DSA5-specific: 8 Eigenschaften
  if (system.characteristics) {
    stats.characteristics = {};
    const eigenschaften = ['mu', 'kl', 'in', 'ch', 'ff', 'ge', 'ko', 'kk'];

    for (const prop of eigenschaften) {
      if (system.characteristics[prop]) {
        stats.characteristics[prop.toUpperCase()] = {
          value: system.characteristics[prop].value,
          initial: system.characteristics[prop].initial,
        };
      }
    }
  }

  // ✅ DSA5-specific: LeP (mit korrektem Bugfix!)
  if (system.status?.wounds) {
    const wounds = system.status.wounds;
    stats.lifePoints = {
      current: wounds.value,  // Direkt aktuelle LeP!
      max: wounds.max,
      wounds: wounds.max - wounds.value,
    };
  }

  // ✅ DSA5-specific: AsP, KaP
  if (system.status?.astralenergy) {
    stats.astralEnergy = {
      current: system.status.astralenergy.value,
      max: system.status.astralenergy.max,
    };
  }

  // ✅ Experience Level (AP → Stufe)
  const totalAP = system.details?.experience?.total ?? 0;
  if (totalAP > 0) {
    const expLevel = getExperienceLevel(totalAP);  // 1-7
    stats.experience = {
      total: totalAP,
      level: expLevel,
      // ...
    };
  }

  return stats;
}
```

**Features:**
- ✅ 8 Eigenschaften (MU, KL, IN, CH, FF, GE, KO, KK)
- ✅ LeP mit korrektem Bugfix
- ✅ AsP/KaP Ressourcen
- ✅ Experience Level Mapping
- ✅ Spezies, Kultur, Profession
- ✅ Talente (Skills)

**Status:** ✅ Bereits implementiert und funktional!

---

## 🔧 Was müsste geändert werden?

### Option A: Minimale Integration (EMPFOHLEN)

**Ziel:** CharacterTools kann SystemRegistry nutzen, aber bleibt abwärtskompatibel

**Änderungen:**

#### 1. CharacterToolsOptions erweitern

```typescript
// packages/mcp-server/src/tools/character.ts

export interface CharacterToolsOptions {
  foundryClient: FoundryClient;
  logger: Logger;
  systemRegistry?: SystemRegistry;  // ← OPTIONAL hinzufügen
}
```

#### 2. Constructor anpassen

```typescript
export class CharacterTools {
  private foundryClient: FoundryClient;
  private logger: Logger;
  private systemRegistry: SystemRegistry | null;  // ← Feld hinzufügen
  private cachedGameSystem: GameSystem | null = null;

  constructor({ foundryClient, logger, systemRegistry }: CharacterToolsOptions) {
    this.foundryClient = foundryClient;
    this.logger = logger.child({ component: 'CharacterTools' });
    this.systemRegistry = systemRegistry || null;  // ← Speichern
  }

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
}
```

#### 3. extractStats() erweitern

```typescript
private async extractStats(characterData: any): Promise<any> {
  // ✅ TRY: Use SystemAdapter if available
  if (this.systemRegistry) {
    try {
      const gameSystem = await this.getGameSystem();
      const adapter = this.systemRegistry.getAdapter(gameSystem);

      if (adapter) {
        this.logger.debug('Using system adapter for character stats', {
          system: gameSystem
        });
        return adapter.extractCharacterStats(characterData);
      }
    } catch (error) {
      this.logger.warn('Failed to use system adapter, using fallback', {
        error
      });
    }
  }

  // ⚠️ FALLBACK: Legacy extraction (unchanged)
  const system = characterData.system || {};
  const stats: any = {};

  // ... existing D&D5e extraction code ...

  return stats;
}
```

#### 4. formatCharacterResponse() anpassen

```typescript
private async formatCharacterResponse(characterData: any): Promise<any> {
  const response = {
    id: characterData.id,
    name: characterData.name,
    type: characterData.type,
    basicInfo: this.extractBasicInfo(characterData),
    stats: await this.extractStats(characterData),  // ← async!
    items: this.formatItems(characterData.items || []),
    effects: this.formatEffects(characterData.effects || []),
    hasImage: !!characterData.img,
  };

  return response;
}
```

#### 5. Backend Integration

```typescript
// packages/mcp-server/src/backend.ts

// Bereits vorhanden:
const systemRegistry = getSystemRegistry(logger);
systemRegistry.register(new DSA5Adapter());

// Ändern:
const characterTools = new CharacterTools({
  foundryClient,
  logger,
  systemRegistry  // ← HINZUFÜGEN
});
```

**Effort:** ~1-2 Stunden
- 5 kleine Code-Änderungen
- Copy-paste aus Upstream möglich
- Testen mit DSA5 Character

---

### Option B: Nur DSA5 Tools nutzen (AKTUELLER ZUSTAND)

**Status Quo beibehalten:**
- CharacterTools bleibt wie es ist (D&D5e/PF2e)
- DSA5 nutzt `dsa5-character-tools.ts`
- Zwei separate Tool-Sets

**Vorteile:**
- ✅ Kein Refactoring nötig
- ✅ DSA5 funktioniert perfekt
- ✅ Keine Regressions-Gefahr

**Nachteile:**
- ⚠️ Nicht v0.6.0-konform
- ⚠️ `get-character` funktioniert nicht für DSA5
- ⚠️ Code-Duplikation (zwei Wege für gleiche Aufgabe)

---

## 📊 Vergleichstabelle: Current vs. Upstream

| Aspekt | Current Branch | Upstream (mit Registry) |
|--------|----------------|-------------------------|
| **D&D 5e Support** | ✅ Hardcoded | ✅ Via Adapter |
| **PF2e Support** | ⚠️ Teilweise | ✅ Via Adapter |
| **DSA5 Support** | ❌ Nicht in character.ts | ✅ Via DSA5Adapter |
| **Code-Qualität** | ⚠️ Hardcoded | ✅ Clean Architecture |
| **Erweiterbarkeit** | ❌ Core-Änderungen nötig | ✅ Adapter registrieren |
| **Abwärtskompatibilität** | ✅ Ja | ✅ Ja (Fallback) |
| **DSA5 Tools** | ✅ Separate Tools | ✅ Integriert + Separate |

---

## 🎯 Funktionale Unterschiede

### Was funktioniert im Current Branch?

```bash
# ✅ D&D 5e Character
get-character --identifier "Gandalf"
→ Funktioniert (hardcoded D&D5e logic)

# ⚠️ PF2e Character
get-character --identifier "Amiri"
→ Teilweise (ähnliche Struktur wie D&D5e)

# ❌ DSA5 Character via get-character
get-character --identifier "Thorald"
→ Funktioniert NICHT (keine DSA5 Felder)

# ✅ DSA5 via separates Tool
get-dsa5-character-summary --actorId "abc123"
→ Funktioniert perfekt!
```

### Was funktioniert im Upstream?

```bash
# ✅ D&D 5e
get-character --identifier "Gandalf"
→ Via D&D5eAdapter oder Fallback

# ✅ PF2e
get-character --identifier "Amiri"
→ Via PF2eAdapter

# ✅ DSA5
get-character --identifier "Thorald"
→ Via DSA5Adapter! (8 Eigenschaften, LeP, AsP, KaP)

# ✅ DSA5 via separates Tool (auch verfügbar)
get-dsa5-character-summary --actorId "abc123"
→ Funktioniert auch!
```

**Key Difference:**
- Upstream: `get-character` ist system-agnostisch
- Current: `get-character` nur für D&D5e/PF2e

---

## 🤔 Warum wurde SystemRegistry entfernt?

### Grund beim Merge

**Beim v0.6.0 Merge (Commit d1cf99c) wurde bewusst entschieden:**

```typescript
// Backend Integration Strategie:
// 1. SystemRegistry WIRD integriert (✅ Done)
// 2. DSA5Adapter WIRD registriert (✅ Done)
// 3. CharacterTools/CompendiumTools OHNE Registry (⚠️ Bewusst)
```

**Begründung:**
1. **Build-Fehler vermeiden**
   - CharacterTools im Current Branch hatte noch keine SystemRegistry-Parameter
   - Upstream hatte es, Current nicht
   - Entfernen war schneller als Integrieren

2. **DSA5 funktioniert unabhängig**
   - `dsa5-character-tools.ts` nutzt `tools/dsa5/` direkt
   - Keine Abhängigkeit von SystemRegistry
   - Separate, funktionierende Lösung

3. **Time-Boxing**
   - Merge war schon komplex (12 Dateien, ~2.200 Zeilen)
   - SystemRegistry-Integration hätte 1-2 Std zusätzlich gekostet
   - Entscheidung: "Später machen" (jetzt P1)

**Status:** ⏳ TODO - Geplant, aber nicht kritisch

---

## 💡 Empfehlung

### Was soll gemacht werden?

**Kurzfristig (1-2 Wochen):**
- ✅ **Option A implementieren** (SystemRegistry Integration)
- Effort: 1-2 Stunden
- Impact: Mittel (architektonisch wichtig)
- Risk: Niedrig (Fallback bleibt)

**Warum jetzt machen:**
1. ✅ DSA5Adapter ist bereits fertig
2. ✅ Registry ist bereits integriert
3. ✅ Code kann aus Upstream copy-pasted werden
4. ✅ Tests mit DSA5 Character möglich
5. ✅ Macht v0.6.0 Pattern komplett

**Warum nicht kritisch:**
- DSA5 funktioniert über separate Tools
- Keine User-Blocker
- Rein architektonische Verbesserung

---

## 📋 Integration Checklist

### Vorgehen (1-2 Stunden)

- [ ] **Schritt 1:** CharacterToolsOptions erweitern (5 Min)
- [ ] **Schritt 2:** Constructor anpassen (5 Min)
- [ ] **Schritt 3:** getGameSystem() Methode hinzufügen (5 Min)
- [ ] **Schritt 4:** extractStats() erweitern (15 Min)
- [ ] **Schritt 5:** formatCharacterResponse() async machen (5 Min)
- [ ] **Schritt 6:** handleGetCharacter() await anpassen (5 Min)
- [ ] **Schritt 7:** Backend Integration (systemRegistry übergeben) (5 Min)
- [ ] **Schritt 8:** Build testen (`npm run build`) (5 Min)
- [ ] **Schritt 9:** Mit DSA5 Character testen (15 Min)
  - `get-character --identifier "Thorald"` sollte funktionieren
  - Sollte 8 Eigenschaften, LeP, AsP, KaP zeigen
- [ ] **Schritt 10:** CompendiumTools analog anpassen (30 Min)
- [ ] **Schritt 11:** Commit & Push (5 Min)

**Total:** ~1-2 Stunden

---

## ✅ Zusammenfassung

### Was ist SystemRegistry?

Zentrales Register für System-Adapter (DSA5, D&D5e, PF2e), die system-spezifische Logik kapseln.

### Was fehlt aktuell?

CharacterTools nutzt KEIN SystemRegistry → `get-character` funktioniert nicht für DSA5.

### Warum fehlt es?

Beim Merge bewusst entfernt, um Build-Fehler zu vermeiden und Zeit zu sparen.

### Ist es kritisch?

❌ Nein - DSA5 funktioniert über separate `dsa5-character-tools.ts`

### Sollte es integriert werden?

✅ Ja - Architektonisch sauberer, macht v0.6.0 Pattern komplett

### Wann?

⏳ Kurzfristig (1-2 Wochen), nicht urgent, P1-Priorität

### Effort?

~1-2 Stunden (Copy-paste aus Upstream + Tests)

---

**Status:** 🟡 **P1 - Wichtig, aber nicht kritisch**

**Empfehlung:** In separater kurzer Session machen, wenn DSA5 Core-Features fertig sind.

---

*Erstellt: 2025-12-02*
*Kontext: P1 Gap Analysis aus QUEST_TOOLS_EVALUATION.md*
*Next Step: In 1-2 Wochen integrieren oder bei Bedarf*
