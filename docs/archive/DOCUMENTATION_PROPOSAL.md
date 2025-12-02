# 📚 Dokumentations-Vorschlag: foundry-vtt-mcp-dsa

**Analysedatum:** 2. Dezember 2025
**Analysiert von:** Claude
**Branches:** `claude/review-project-features-01PmrvNF2QLWT277NpZaTkhg` (aktuell), `claude/dsa5-system-adapter-01QvdK2JiF6vRxwsjJQGT1F9` (alt)

---

## 🔍 Aktuelle Situation

### Branch: `claude/review-project-features-01PmrvNF2QLWT277NpZaTkhg` (AKTUELL)
**.md Dateien:**
- ✅ `README.md` - Upstream README (keine DSA5 Erwähnung)
- ⚠️ `Claude.md` - **VERALTET** (sagt Phase 2 pending, aber Phase 2+3 sind fertig)
- ✅ `CHANGELOG.md` - Vorhanden
- ✅ `INSTALLATION.md` - Vorhanden
- ✅ `installer/BUILD_DMG_INSTRUCTIONS.md` - Build-Anleitung für macOS

**Status:** Minimale Dokumentation, veraltete Infos

---

### Branch: `claude/dsa5-system-adapter-01QvdK2JiF6vRxwsjJQGT1F9` (ALT)
**.md Dateien:**
- ✅ `README.md` - Upstream README
- ⚠️ `Claude.md` - Adapter Pattern Doku (teilweise veraltet)
- ✅ `CHANGELOG.md`
- ✅ `INSTALLATION.md`
- ✅ `INSTALL_DSA5.md` - DSA5-spezifische Installation
- ✅ `DSA5_ROADMAP.md` - **SEHR DETAILLIERT** - Phase 1-10+ Status
- ✅ `DSA5_UPSTREAM_COMPARISON.md` - Vergleich mit Upstream
- ✅ `ADDING_NEW_SYSTEMS.md` - Guide für neue Systeme
- ⚠️ `dsa5-mcp-bug-report-remaining-issues.md` - Bug Report (veraltet?)
- ⚠️ `dsa5-mcp-test-report.md` - Test Report (veraltet?)
- ✅ `packages/mcp-server/src/systems/dsa5/README.md` - Technische DSA5 Doku

**Status:** Sehr umfangreich, aber teilweise veraltet

---

## 🎯 Probleme

### 1. **Verstreute Information**
- Wichtige Infos sind im alten Branch, nicht im aktuellen
- Keine zentrale Dokumentation des aktuellen Stands

### 2. **Veraltete Dateien**
- `Claude.md` - Status nicht aktuell
- `dsa5-mcp-bug-report-remaining-issues.md` - Bug aus November
- `dsa5-mcp-test-report.md` - Test aus November

### 3. **Fehlende Dokumentation im aktuellen Branch**
- Kein DSA5 Development Status
- Keine Branch-Erklärungen
- Kein Hinweis auf abgeschlossene Phasen 2+3

### 4. **README.md ist Upstream-Version**
- Erwähnt nur DnD5e und PF2e
- Kein Hinweis auf DSA5 Support

---

## ✅ Vorschlag: Neue Dokumentations-Struktur

### Kern-Dokumentation (Root-Level)

#### 1. **README.md** (⚡ AKTUALISIEREN)
**Zweck:** Projekt-Overview für Besucher
**Inhalt:**
```markdown
# Foundry VTT MCP Bridge (DSA5 Fork)

> Fork mit **DSA5 (Das Schwarze Auge 5)** Support

Unterstützte Systeme:
- ✅ D&D 5e (Upstream)
- ✅ Pathfinder 2e (Upstream)
- ✅ **DSA5 (Dieser Fork)**

## DSA5 Features
- Character Import/Export mit allen 8 Eigenschaften
- LeP/AsP/KaP Ressourcen-Management
- Creature Filtering nach Species, Culture, Level
- Deutschsprachige UI-Integration

📖 [DSA5 Entwicklungs-Status](./docs/DSA5_STATUS.md)
📖 [Installation Guide](./INSTALLATION.md)
📖 [Branch Overview](./docs/BRANCHES.md)
```

---

#### 2. **docs/DSA5_STATUS.md** (🆕 NEU ERSTELLEN)
**Zweck:** Aktueller Stand der DSA5-Entwicklung
**Inhalt:**
```markdown
# DSA5 Development Status

**Letztes Update:** 2. Dezember 2025
**Branch:** `claude/review-project-features-01PmrvNF2QLWT277NpZaTkhg`
**Status:** ✅ Phase 1-3 Abgeschlossen (Character Tools funktionsfähig)

## Abgeschlossene Phasen

### ✅ Phase 1: System Adapter (v0.6.0 Registry Pattern)
- DSA5Adapter implementiert
- DSA5IndexBuilder implementiert
- Filter-System für Species, Culture, Level
- Character Creator von Archetypes

**Branch:** `claude/dsa5-system-adapter-01QvdK2JiF6vRxwsjJQGT1F9`
**Commits:** 10+ Commits, ~2000 Zeilen Code

### ✅ Phase 2: Character Import/Export Tools (Adapter Pattern)
- `tools/dsa5/types.ts` - System-agnostic types
- `tools/dsa5/character-import.ts` - DSA5 → MCP conversion
- `tools/dsa5/character-export.ts` - MCP → DSA5 conversion
- `tools/characters.ts` - Multi-System Router

**Branch:** `claude/review-project-features-01PmrvNF2QLWT277NpZaTkhg`
**Commit:** `7c986b7` (933 Zeilen)
**Datum:** 1. Dezember 2025

### ✅ Phase 3: MCP Tool Integration
- `tools/dsa5-character-tools.ts` - MCP Tool Wrapper
- Backend Integration in `backend.ts`
- 2 neue MCP Tools:
  - `get-dsa5-character-summary`
  - `update-dsa5-character`

**Commit:** `9b21e8b` (312 Zeilen)
**Datum:** 1. Dezember 2025

### ✅ Bugfix: LeP/Wounds Calculation
- Korrektur der Lebensenergie-Berechnung
- Foundry DSA5 speichert current LeP in `wounds.value`
- Nicht invertiert wie ursprünglich gedacht

**Commit:** `d16b81e` (23 Zeilen geändert)
**Datum:** 2. Dezember 2025

## Aktuelle Features

### MCP Tools
1. **get-dsa5-character-summary**
   - Formatierte Zusammenfassung mit allen 8 Eigenschaften
   - LeP/AsP/KaP Ressourcen
   - Top 5 Talente
   - Deutsche Ausgabe

2. **update-dsa5-character**
   - Eigenschaften setzen
   - LeP ändern (absolut oder delta)
   - AsP/KaP ändern
   - Skill-Updates

### Architektur
- ✅ Adapter Pattern (keine Änderungen an `data-access.ts`)
- ✅ DSA5-Logik isoliert in `tools/dsa5/`
- ✅ Upstream-kompatibel
- ✅ Build erfolgreich

## Nächste Schritte

### Optional: Browser Integration (Phase 12)
- DSA5IndexBuilder in Foundry Module integrieren
- "Rebuild Creature Index" Button für DSA5
- **Hinweis:** Benötigt Modifikation von `data-access.ts` (gegen Adapter-Prinzip)

### Optional: Pull Request
- PR zu Upstream erstellen
- DSA5 als offizielles System vorschlagen

## Testing

**Test Status:** ⚠️ Manuelles Testing ausstehend

Test-Prompts verfügbar in `docs/DSA5_TEST_PROMPTS.md`
```

---

#### 3. **docs/BRANCHES.md** (🆕 NEU ERSTELLEN)
**Zweck:** Erklärung aller Branches
**Inhalt:**
```markdown
# Branch Overview

## Aktive Branches

### `claude/review-project-features-01PmrvNF2QLWT277NpZaTkhg` ⭐ AKTUELL
**Zweck:** Phase 2+3 Entwicklung - Character Import/Export Tools
**Status:** ✅ Aktiv, Phase 2+3 abgeschlossen
**Letzter Commit:** `d16b81e` - LeP/Wounds Bugfix (2. Dez 2025)

**Enthält:**
- tools/dsa5/ Adapter Layer (Character Import/Export)
- tools/dsa5-character-tools.ts (MCP Tool Wrapper)
- Backend Integration
- LeP Calculation Bugfix

**Nicht enthalten:**
- systems/dsa5/ (System Adapter aus Phase 1)
- DSA5_ROADMAP.md und andere Dokumentation aus altem Branch

**Commits:**
1. `7c986b7` - feat(dsa5): Add character import/export adapter tools - Phase 2
2. `9b21e8b` - feat(dsa5): Add DSA5 character manipulation MCP tools - Phase 3
3. `d16b81e` - fix(dsa5): Correct LeP/wounds calculation for DSA5 characters

---

### `claude/dsa5-system-adapter-01QvdK2JiF6vRxwsjJQGT1F9` 📦 ARCHIV
**Zweck:** Phase 1 Entwicklung - v0.6.0 Registry Pattern Implementation
**Status:** ✅ Abgeschlossen, archiviert
**Zeitraum:** Oktober - November 2025

**Enthält:**
- systems/dsa5/ (DSA5Adapter, DSA5IndexBuilder)
- Character Creator von Archetypes
- Filter-System (Species, Culture, Level)
- Umfangreiche Dokumentation (DSA5_ROADMAP.md, etc.)

**Phase 1-10+ abgeschlossen:**
- Phase 4: Filter System
- Phase 5: Index Builder
- Phase 6: Registry Integration
- Phase 7: Character Creator
- Phase 8+: Verschiedene Bugfixes und Tests

**Dokumentation:**
- `DSA5_ROADMAP.md` - Sehr detaillierte Phase-Dokumentation
- `DSA5_UPSTREAM_COMPARISON.md` - Vergleich mit DnD5e/PF2e
- `systems/dsa5/README.md` - Technische Adapter-Doku

---

## Branch-Beziehungen

```
claude/dsa5-system-adapter-01QvdK2JiF6vRxwsjJQGT1F9 (Phase 1, alt)
    ↓
    ? (Merge-Status unklar)
    ↓
claude/review-project-features-01PmrvNF2QLWT277NpZaTkhg (Phase 2+3, aktuell)
```

**⚠️ Problem:** Die beiden Branches haben unterschiedliche Inhalte:
- Alter Branch hat `systems/dsa5/` (System Adapter)
- Neuer Branch hat `tools/dsa5/` (Character Tools)
- Beide werden wahrscheinlich benötigt!

**✅ Lösung:** Merge oder Cherry-Pick erforderlich, um beide Komponenten zu kombinieren
```

---

#### 4. **docs/DSA5_TEST_PROMPTS.md** (➡️ VERSCHIEBEN)
**Zweck:** Test-Prompts für DSA5 Tools
**Aktion:** Bereits erstellt in vorheriger Session, hier als Datei speichern

---

#### 5. **CHANGELOG.md** (⚡ AKTUALISIEREN)
**Zweck:** Version History
**Aktion:** DSA5-Einträge hinzufügen

---

### Aufräumen / Löschen

#### ❌ Löschen (veraltet):
1. `dsa5-mcp-bug-report-remaining-issues.md` (November Bug Report)
2. `dsa5-mcp-test-report.md` (November Test Report)

#### ➡️ Archivieren (in docs/archive/):
1. `Claude.md` → `docs/archive/Claude_Phase1_Plan.md`
   - Enthält ursprünglichen Plan, aber veraltet
   - Als Referenz behalten

---

### Zusammenführung aus altem Branch

#### ➡️ Übernehmen in aktuellen Branch:
1. `DSA5_ROADMAP.md` → Aktualisieren und in aktuellen Branch mergen
2. `DSA5_UPSTREAM_COMPARISON.md` → Archivieren oder aktualisieren
3. `ADDING_NEW_SYSTEMS.md` → In docs/ verschieben
4. `INSTALL_DSA5.md` → Prüfen und ggf. in INSTALLATION.md integrieren
5. `systems/dsa5/README.md` → Behalten (technische Doku)

---

## 📁 Finale Struktur

```
foundry-vtt-mcp-dsa/
├── README.md                          ⚡ Aktualisiert - DSA5 Fork Overview
├── INSTALLATION.md                    ✅ Behalten - Installation Guide
├── CHANGELOG.md                       ⚡ Aktualisiert - Version History
│
├── docs/
│   ├── DSA5_STATUS.md                 🆕 NEU - Aktueller Entwicklungsstand
│   ├── BRANCHES.md                    🆕 NEU - Branch-Erklärungen
│   ├── DSA5_TEST_PROMPTS.md           🆕 NEU - Test-Prompts
│   ├── DSA5_ROADMAP.md                ➡️ Übernommen aus altem Branch
│   ├── ADDING_NEW_SYSTEMS.md          ➡️ Übernommen aus altem Branch
│   │
│   └── archive/
│       ├── Claude_Phase1_Plan.md      ➡️ Claude.md archiviert
│       └── DSA5_UPSTREAM_COMPARISON.md ➡️ Optional archiviert
│
├── packages/mcp-server/src/
│   ├── systems/dsa5/
│   │   └── README.md                  ✅ Behalten - Technische DSA5 Adapter Doku
│   └── tools/dsa5/
│       └── (keine README nötig, in DSA5_STATUS.md dokumentiert)
│
└── installer/
    └── BUILD_DMG_INSTRUCTIONS.md      ✅ Behalten - macOS Build
```

---

## 🎯 Vorteile dieser Struktur

### ✅ Klarheit
- Jeder Branch hat klare Dokumentation
- Aktueller Status ist sofort ersichtlich
- Abgeschlossene Phasen sind dokumentiert

### ✅ Maintainability
- Veraltete Docs sind archiviert, nicht gelöscht
- Zentrale Doku in `docs/`
- README zeigt DSA5 Support prominent

### ✅ Entwickler-Freundlichkeit
- BRANCHES.md erklärt alle Branches
- DSA5_STATUS.md zeigt, was fertig ist
- Test-Prompts sind verfügbar

### ✅ Upstream-Kompatibilität
- Dokumentation macht Fork-Unterschiede klar
- Upstream README bleibt erkennbar
- Merge-freundliche Struktur

---

## 🚀 Umsetzungsplan

### Phase 1: Neue Docs erstellen (30 min)
1. ✅ `DOCUMENTATION_PROPOSAL.md` (diese Datei)
2. `docs/DSA5_STATUS.md` erstellen
3. `docs/BRANCHES.md` erstellen
4. `docs/DSA5_TEST_PROMPTS.md` erstellen

### Phase 2: README aktualisieren (15 min)
1. README.md um DSA5 Section erweitern
2. Links zu neuer Dokumentation hinzufügen

### Phase 3: Aufräumen (15 min)
1. Veraltete Dateien löschen (Bug Reports)
2. Claude.md archivieren
3. docs/archive/ Ordner erstellen

### Phase 4: Merge aus altem Branch (30 min)
1. DSA5_ROADMAP.md übernehmen und aktualisieren
2. ADDING_NEW_SYSTEMS.md übernehmen
3. Prüfen, ob systems/dsa5/ Code fehlt

### Phase 5: Commit & Push (5 min)
1. Alle neuen Docs committen
2. Branch-Beschreibung aktualisieren

**Gesamtdauer:** ~1.5 Stunden

---

## ❓ Offene Fragen

1. **Branch-Merge:** Sollen beide Branches (alt + neu) zusammengeführt werden?
   - Alter Branch hat `systems/dsa5/` (Phase 1)
   - Neuer Branch hat `tools/dsa5/` (Phase 2+3)
   - Beide könnten zusammen benötigt werden

2. **Main Branch:** Gibt es einen main/master Branch als Basis?
   - Falls ja: Soll dort die Haupt-Doku leben?

3. **DSA5_ROADMAP.md:** Aktualisieren oder neu schreiben?
   - Enthält sehr detaillierte Phase 1-10 Doku
   - Sollte um Phase 2+3 ergänzt werden

4. **Test Status:** Sollen Test-Reports behalten werden?
   - Veraltet, aber zeigen historische Tests
   - Archivieren statt löschen?

---

## 📝 Nächster Schritt

**Empfehlung:** Zustimmung zu dieser Struktur einholen, dann Phase 1 umsetzen (neue Docs erstellen).

**Frage an Dich:** Soll ich mit der Umsetzung beginnen? Gibt es Änderungswünsche zur vorgeschlagenen Struktur?
