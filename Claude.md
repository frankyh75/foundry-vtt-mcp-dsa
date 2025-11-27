# DSA5 MCP Foundry Fork

## Projekt-Übersicht

Fork von `foundry-vtt-mcp` mit DSA5 (Das Schwarze Auge 5) Support.

**Repository:** https://github.com/frankyh75/foundry-vtt-mcp-dsa
**Upstream:** https://github.com/adambdooley/foundry-vtt-mcp

## Architektur-Prinzip

> **“Adapter, nicht Integration”**

DSA5-Support wird als externe Adapter-Schicht gebaut, NICHT durch Änderungen am Core.

- `data-access.ts` bleibt möglichst nah an Upstream
- DSA5-Logik lebt isoliert in `src/tools/dsa5/`
- Ziel: Merge-Konflikt-freie Coexistenz mit Upstream

## 🎯 Aktuelle Phase: v0.6.1 Migration

**Status: Phase 10 ABGESCHLOSSEN ✅ (~90% fertig)**

**Branch:** `feature/dsa5-v0.6.1` → Remote: `claude/dsa5-system-adapter-01QvdK2JiF6vRxwsjJQGT1F9`

### v0.6.1 Migration Progress (11 Phasen)

- [x] **Phase 1:** Koordination & Setup ✅
- [x] **Phase 2:** v0.6.0 Analyse ✅
- [x] **Phase 3:** Dateistruktur erstellen ✅
- [x] **Phase 4:** Filter System (202 Zeilen) ✅
- [x] **Phase 5:** Index Builder (319 Zeilen) ✅
- [x] **Phase 6:** System Adapter (378 Zeilen) ✅
- [x] **Phase 7:** Constants & Helper (201 Zeilen) ✅ (in Phase 6 erledigt)
- [x] **Phase 8:** Exports & Registry ✅
  - DSA5Adapter in backend.ts registriert
  - DSA5CreatureIndex in systems/index.ts exportiert
  - Basiert auf v0.6.0 Registry Pattern
- [x] **Phase 9:** Testing & QA ✅
  - npm install erfolgreich (851 packages)
  - npm run build ✅ kompiliert ohne Fehler
  - Type-Fixes: DSA5CreatureIndex + SystemId erweitert
  - Commit 0b05a76: Type definitions vollständig
- [x] **Phase 10:** Dokumentation ✅ **← GERADE FERTIG!**
  - systems/dsa5/README.md (komplette API-Doku)
  - INSTALL_DSA5.md (Schritt-für-Schritt Guide)
  - CHANGELOG.md v0.6.1 Entry
  - Commit 834906d: 547 Zeilen Dokumentation
- [ ] **Phase 11:** Pull Request (1h) ⏳ **← NÄCHSTER SCHRITT**

**Geschätzt verbleibend:** ~1 Stunde

### v0.6.1 Implementierung Status

**Neue Architektur:** `packages/mcp-server/src/systems/dsa5/` (1.248 Zeilen)

```
systems/dsa5/
├── ✅ adapter.ts         (378 Zeilen) - 11 SystemAdapter Methoden
├── ✅ constants.ts       (201 Zeilen) - EIGENSCHAFT_NAMES, FIELD_PATHS
├── ✅ filters.ts         (202 Zeilen) - Zod Schemas, matchesDSA5Filters()
├── ✅ filters.test.ts    (102 Zeilen) - Unit Tests
├── ✅ index-builder.ts   (319 Zeilen) - DSA5IndexBuilder
└── ✅ index.ts           (46 Zeilen)  - Public API
```

**Key Features implementiert:**
- ✅ 11/11 SystemAdapter Methoden (getMetadata, canHandle, matchesFilters, etc.)
- ✅ extractCharacterStats() - Eigenschaften, LeP/AsP/KaP, Talente, Erfahrungsgrad
- ✅ DSA5 Filter System - level, species, culture, size, hasSpells, traits
- ✅ Experience Level 1-7 (Erfahrungsgrad mit AP-Ranges)
- ✅ Korrekte Feld-Extraktion: wounds.current (nicht Inversion!), career (nicht profession)
- ✅ Deutsche UI-Texte ("DSA5 Kreaturen-Index wird erstellt...")

**Letzte Commits (19 total):**
- `834906d` - docs(dsa5): Add comprehensive documentation for v0.6.1 (27.11.2025) ← Phase 10
- `73a342f` - docs: Update Claude.md for Phase 9 completion (27.11.2025)
- `0b05a76` - fix(dsa5): Add DSA5CreatureIndex type definition (27.11.2025) ← Phase 9
- `ca7499b` - feat(dsa5): Add DSA5 system support for v0.6.1 - Phase 8 complete (27.11.2025)
- `d66b919` - feat(dsa5): Phase 6 - Implement DSA5 System Adapter (27.11.2025)

---

## 📚 Alte Phase 2 Arbeit (Archiviert)

<details>
<summary>⚠️ Alte foundry-module Implementierung - Nur für Referenz (Click to expand)</summary>

**Phase 2 Complete: DSA5 Adapter Layer fertig ✅**

- [x] Phase 1: Git-Cleanup, data-access.ts auf Upstream-Stand
- [x] Phase 2A: DSA5 Character Import Module erstellt (types, field-mappings, character-import)
- [x] Phase 2B: DSA5 Creature Index extrahiert und integriert
- [x] Phase 2C: Integration in data-access.ts (minimal, ~100 Zeilen)

### Branch-Status (Alt)

**Branch:** `feature/dsa5-adapter-layer` (3 Commits ahead of origin/master)

**Commits:**
1. `641c1c9` - feat(dsa5): Add DSA5 adapter layer (Phase 1 - Character Import)
2. `d5e2b1d` - feat(dsa5): Integrate DSA5 adapter into data-access.ts (Phase 2)
3. `9e5f031` - feat(dsa5): Add DSA5 creature index support (Phase 2B)

**Änderungen:** +1477 Zeilen, -20 Zeilen

</details>

## Dateistruktur

```
packages/foundry-module/src/
├── data-access.ts          # Minimale DSA5-Integration (~100 Zeilen)
├── tools/
│   └── dsa5/               # <<< DSA5 Adapter Layer (isoliert)
│       ├── types.ts        # DSA5 Typdefinitionen (271 Zeilen)
│       ├── field-mappings.ts     # DE↔EN Mappings, WOUNDS_HELPER (200 Zeilen)
│       ├── character-import.ts   # extractDsa5CharacterData() (243 Zeilen)
│       ├── character-export.ts   # Phase 4 Placeholder (123 Zeilen)
│       ├── creature-index.ts     # buildDsa5CreatureIndex() (244 Zeilen)
│       ├── index.ts              # Public API exports (101 Zeilen)
│       └── README.md             # DSA5-Adapter Dokumentation (205 Zeilen)
```

### data-access.ts Navigation Guide

Die `data-access.ts` ist eine sehr große Datei (~1100+ Zeilen). Hier ist der Navigations-Header zur Orientierung:

```typescript
// 🧭 NAVIGATION GUIDE (data-access.ts)
// Use Ctrl+F (or Cmd+F) to jump to sections using [#TAGS]:
//
// Main Sections:
//   [#TYPES]          Line ~7      - Type definitions & interfaces
//   [#PERSIST_INDEX]  Line ~240    - PersistentCreatureIndex class
//   [#DATA_ACCESS]    Line ~1116   - FoundryDataAccess class (main)
//   [#CHAR_MGMT]      Line ~1165   - Character management methods
//   [#COMP_SEARCH]    Line ~1220   - Compendium search methods
//   [#ACTOR_CREATE]   Line ~2400   - Actor creation & token placement
//   [#QUEST_MGMT]     Line ~2800   - Quest & journal management
//   [#PLAYER_MGMT]    Line ~3500   - Player roll requests
//   [#UTILITIES]      Line ~4000   - Utility & helper methods
//
// DSA5 Integration Points:
//   Line 4-5:    import { extractDsa5CharacterData, ... }
//   Line 15:     interface CharacterInfo { dsa5?: Dsa5CharacterData }
//   Line 91:     type EnhancedCreatureIndex = ... | Dsa5CreatureIndex
//   Line 530:    case 'dsa5': buildDsa5Index()
//   Line 1079:   buildDsa5Index() method
//   Line 1125:   isDsa5CreatureIndex() type guard
//   Line 1154:   if (isDsa5System()) { characterData.dsa5 = ... }
//   Line 1648:   DSA5 creature summary format
```

## DSA5 Feld-Mappings (KRITISCH)

### Eigenschaften (8 Attribute)

```
system.characteristics.mu.value  → MU (Mut/Courage)
system.characteristics.kl.value  → KL (Klugheit/Cleverness)
system.characteristics.in.value  → IN (Intuition)
system.characteristics.ch.value  → CH (Charisma)
system.characteristics.ff.value  → FF (Fingerfertigkeit/Dexterity)
system.characteristics.ge.value  → GE (Gewandtheit/Agility)
system.characteristics.ko.value  → KO (Konstitution/Constitution)
system.characteristics.kk.value  → KK (Körperkraft/Strength)
```

### Lebenspunkte (ACHTUNG: Invertierte Logik!)

```
system.status.wounds.value  → Aktuelle WUNDEN (nicht HP!)
system.status.wounds.max    → Maximale Lebensenergie

Umrechnung:
  Aktuelle HP = wounds.max - wounds.value
  Neue Wunden = wounds.max - neue_HP
```

### Ressourcen

```
system.status.astralenergy.value/max  → AsP (Astralenergie/Mana)
system.status.karmaenergy.value/max   → KaP (Karmaenergie)
```

### Profil

```
system.details.species.value   → Spezies (Mensch, Elf, Zwerg...)
system.details.culture.value   → Kultur
system.details.career.value    → Profession
system.details.experience.total → Abenteuerpunkte gesamt
```

### Physisch

```
system.status.size.value  → Größe in cm
```

### Skills/Talente

```
Items mit type: "skill" oder "talent"
Wert: item.system.talentValue.value
Probe: item.system.characteristic (z.B. "MU/IN/CH" für 3-Eigenschaften-Probe)
```

## Wichtige Interfaces

### MCPCharacter (System-agnostisch)

```typescript
interface MCPCharacter {
  id: string;
  name: string;
  system: 'dsa5' | 'dnd5e' | 'pf2e';
  attributes: Record<string, number>;
  health: { current: number; max: number; temp?: number };
  resources?: Array<{ name: string; current: number; max: number; type: string }>;
  skills: Array<{ id: string; name: string; value: number; metadata?: any }>;
  profile: { species?: string; culture?: string; profession?: string; experience?: number };
  physical?: { size?: number };
  systemData?: { dsa5?: { /* DSA5-spezifisches */ } };
}
```

### MCPCharacterUpdate (Für Änderungen)

```typescript
interface MCPCharacterUpdate {
  id: string;
  attributes?: Partial<Record<string, number>>;
  health?: { current?: number; max?: number; delta?: number };
  resources?: Array<{ name: string; current?: number; delta?: number }>;
  skills?: Array<{ id: string; value?: number; delta?: number }>;
}
```

## Befehle

```bash
# Build
npm run build

# Lint
npm run lint

# TypeScript Check ohne Build
npx tsc --noEmit

# Symlink für Foundry-Testing (bereits eingerichtet)
# ~/.local/share/FoundryVTT/Data/modules/foundry-mcp -> ./dist
```

## Git-Workflow

### Branches

- `main` - Upstream-kompatibel, DSA5 via Adapter
- `archive/dsa5-monolith-integration` - Alte DSA5-in-Core Arbeit (Archiv)

### Commits

```
feat(dsa5): add type definitions for adapter layer
feat(dsa5): implement character import from Foundry actor
fix(dsa5): correct wound/HP inversion logic
refactor: align data-access.ts with upstream
```

### Upstream Sync

```bash
# Remote hinzufügen (einmalig)
git remote add upstream https://github.com/adambdooley/foundry-vtt-mcp.git

# Sync
git fetch upstream
git merge upstream/main  # Sollte konfliktfrei sein!
```

## Einschränkungen / Don’ts

❌ **NICHT `data-access.ts` ändern** - außer für generische Bugfixes
❌ **NICHT `character.ts` anfassen** - kommt in Phase 4
❌ **KEINE DSA5-Logik außerhalb von `src/tools/dsa5/`**
❌ **KEINE Breaking Changes für DnD5e/PF2e**

## Kontext für AI-Assistenz

Dieses Projekt ist Teil einer “Story Engine, not Rules Engine” Vision:

- KI-unterstützte Spielleiter-Tools für Narrative
- NPC-Erstellung, Weltenbau, Story-Generierung
- NICHT: Regelautomatisierung oder Würfelersatz

DSA5 ist ein deutsches Pen&Paper-RPG mit komplexem Regelwerk.
Die MCP-Integration soll Claude Zugriff auf Foundry-VTT-Daten geben.

## ⚡ WICHTIG: v0.6.0 Registry Pattern ist Live!

**Update 2024:** Upstream hat v0.6.0-Branch mit neuem Registry Pattern erstellt.
DSA5-Integration wird nun als **v0.6.1-Beitrag** zum Upstream entwickelt!

### Neue Strategie

- ❌ ~~Direkter Merge auf master~~ (veraltet)
- ✅ **Migration zu v0.6.0 Registry Pattern**
- ✅ **DSA5 als v0.6.1 zum Upstream beitragen**

### Aktuelle Situation

**Existierende Arbeit (Phase 2 abgeschlossen):**
- Branch: `feature/dsa5-adapter-layer` (3 Commits, +1477/-20 Zeilen)
- Status: Funktionsfähiger DSA5 Adapter Layer (isoliert in `src/tools/dsa5/`)
- Code: 60-70% wiederverwendbar für v0.6.0

**v0.6.0 Anforderungen:**
- Neue Architektur: SystemAdapter + IndexBuilder Interfaces
- Dateien in `packages/mcp-server/src/systems/dsa5/` (nicht foundry-module!)
- 3 Dateien: adapter.ts, filters.ts, index-builder.ts
- Geschätzter Migrationsaufwand: 15-20 Stunden

### Roadmap

**Siehe:** `DSA5_V0.6.1_ROADMAP.md` für detaillierte 11-Phasen-Roadmap

**Kurz:**
1. Kommentar auf GitHub Issue #11 (Koordination mit @adambdooley)
2. v0.6.0 lokal auschecken und analysieren (2-3h)
3. Code migrieren zu Registry Pattern (10-15h)
4. Testing & Dokumentation (3-4h)
5. Pull Request für v0.6.1 erstellen

**Nächster Schritt:** Siehe `DSA5_V0.6.1_ROADMAP.md` Phase 1.1

## Alte Nächste Schritte (Phase 3) - ARCHIVIERT

<details>
<summary>⚠️ Veraltet - Nur für Referenz (Click to expand)</summary>

### Vor dem Push

1. [ ] **Testing:** Build erfolgreich? (✅ bereits getestet)
2. [ ] **Upstream Sync Check:** Merge-konfliktfrei mit upstream/master?
   ```bash
   git fetch upstream
   git merge upstream/master --no-commit --no-ff
   # Konflikte prüfen, dann abbrechen:
   git merge --abort
   ```
3. [ ] **Optional: Lokaler Test** mit Foundry VTT + DSA5 System
   - Character Import testen
   - Creature Index rebuild testen

### Push & PR

4. [ ] **Push Branch:**
   ```bash
   git push -u origin feature/dsa5-adapter-layer
   ```

5. [ ] **Pull Request erstellen** auf GitHub:
   - Base: `master`
   - Compare: `feature/dsa5-adapter-layer`
   - Titel: `feat(dsa5): Add DSA5 adapter layer with character import & creature index`
   - Beschreibung: Siehe unten

### Optional: Phase 4 Vorbereitung

6. [ ] MCP Server (`packages/mcp-server`) DSA5-Formatierung prüfen
7. [ ] Character Export Implementierung planen (Write Operations)
8. [ ] End-to-End Test mit echtem DSA5-Actor

</details>
