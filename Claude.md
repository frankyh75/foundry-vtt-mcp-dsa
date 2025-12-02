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

## Aktuelle Phase

**✅ DSA5 Support vollständig implementiert**

- [x] Phase 1: Git-Cleanup, data-access.ts auf Upstream-Stand
- [x] Phase 2: DSA5 Import/Export Module erstellen
- [x] Phase 3: Integration in backend.ts
- [x] Phase 4: DSA5 Character Tools (Summary, Updates)
- [x] Phase 5: v0.6.0 Registry Pattern + SystemAdapter
- [x] Phase 6: Character Creator (Archetypes)

### Aktueller Stand (2025-12-02)

**Merged:** v0.6.0 Registry Pattern mit vollständigem DSA5 System Support
- System Registry Infrastructure (`systems/types.ts`, `system-registry.ts`, etc.)
- DSA5 System Adapter (`systems/dsa5/adapter.ts`, `filters.ts`, `constants.ts`)
- DSA5 Character Creator (`systems/dsa5/character-creator.ts`)
- Backend Integration (DSA5Adapter registriert, Character Creator Tools aktiv)

Siehe `MERGE_SUMMARY.md` für Details.

## Dateistruktur

```
packages/mcp-server/src/
├── backend.ts              # MCP Server - DSA5 registriert
├── systems/                # <<< v0.6.0 Registry Pattern
│   ├── types.ts           # SystemAdapter, IndexBuilder interfaces
│   ├── system-registry.ts # Central adapter registry
│   ├── index-builder-registry.ts
│   ├── index.ts           # Public API
│   └── dsa5/              # <<< DSA5 System Implementation
│       ├── adapter.ts     # DSA5Adapter (SystemAdapter interface)
│       ├── constants.ts   # Experience levels, field paths, mappings
│       ├── filters.ts     # Zod schemas, filter matching
│       ├── filters.test.ts
│       ├── index-builder.ts  # DSA5IndexBuilder (browser context)
│       ├── character-creator.ts  # Archetype-based creation
│       ├── index.ts       # DSA5 public API
│       └── README.md      # Technical docs
├── tools/
│   ├── dsa5-character-tools.ts  # MCP tools (summary, updates)
│   └── dsa5/              # <<< DSA5 Adapter Layer (Phase 2-3)
│       ├── types.ts       # MCPCharacter, MCPCharacterUpdate, Dsa5Actor
│       ├── character-import.ts  # fromDsa5Actor(), getDsa5CharacterSummary()
│       ├── character-export.ts  # applyMcpUpdateToDsa5Actor()
│       └── index.ts       # Public API exports
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

### Lebenspunkte (WICHTIG: Korrekte Interpretation!)

```
system.status.wounds.value  → CURRENT LeP (Lebensenergie-Punkte)
system.status.wounds.max    → MAXIMUM LeP

DIREKTE Zuordnung:
  Aktuelle HP = wounds.value        (NICHT max - value!)
  Neue HP     = wounds.value = newHP

Wundenzähler (abgeleitet):
  Wunden = wounds.max - wounds.value
```

**⚠️ BUGFIX:** Frühere Version hatte invertierte Logik (wounds.value = Wunden).
Korrekt: `wounds.value` speichert direkt die aktuellen LeP!

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

## Nächste Schritte

**Completed (2025-12-02):**
1. [x] **Git-Sicherung:** Branch `archive/dsa5-monolith-integration` erstellt
1. [x] `src/tools/dsa5/types.ts` erstellt
1. [x] `src/tools/dsa5/character-import.ts` implementiert (mit LeP Bugfix)
1. [x] `src/tools/dsa5/character-export.ts` implementiert (mit LeP Bugfix)
1. [x] `src/tools/dsa5/index.ts` als Public API
1. [x] Integration in `backend.ts` (MCP tools)
1. [x] v0.6.0 Registry Pattern merged (systems/ infrastructure)
1. [x] DSA5 SystemAdapter implementiert und registriert
1. [x] DSA5 Character Creator (Archetype-based) integriert
1. [x] Build erfolgreich getestet

**Verfügbare MCP Tools:**
- `get-dsa5-character-summary` - Detaillierte Charakterinformationen
- `update-dsa5-character` - Eigenschaften, LeP, AsP, KaP ändern
- `create-dsa5-character-from-archetype` - Charakter aus Archetyp erstellen

**Mögliche zukünftige Erweiterungen:**
- [ ] Creature filtering mit DSA5 filters (level, species, hasSpells, etc.)
- [ ] Enhanced creature index building (DSA5IndexBuilder)
- [ ] Multi-system support (D&D5e, PF2e Adapter hinzufügen)
- [ ] Integration von systemRegistry in CharacterTools/CompendiumTools
