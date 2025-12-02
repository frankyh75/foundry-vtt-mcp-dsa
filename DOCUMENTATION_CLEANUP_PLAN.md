# Dokumentations-Bereinigung: Vorgehen

**Erstellt:** 2025-12-02
**Status:** Empfehlung zur Umsetzung

---

## 📊 Ist-Zustand Analyse

### Branch: `claude/review-project-features-01PmrvNF2QLWT277NpZaTkhg` (AKTUELL)

**Vorhandene .md Dateien (8):**
```
✅ README.md                      - Haupt-README (sollte bleiben)
✅ Claude.md                      - Aktueller Entwicklungsstand (✅ aktualisiert)
✅ CHANGELOG.md                   - Änderungshistorie
✅ INSTALLATION.md                - Installationsanleitung
✅ MERGE_SUMMARY.md              - Merge-Dokumentation (NEU, ✅ aktuell)
📋 BRANCH_MERGE_ANALYSIS.md      - Temporäre Merge-Analyse (BEHALTEN oder ARCHIV?)
📋 DOCUMENTATION_PROPOSAL.md     - Vorschlag zur Dokumentation (BEHALTEN oder UMSETZEN?)
✅ installer/BUILD_DMG_INSTRUCTIONS.md
```

**Status:**
- ✅ Claude.md ist aktuell (zeigt vollständigen DSA5 Support)
- ✅ MERGE_SUMMARY.md dokumentiert den v0.6.0 Merge
- ⚠️ Temporäre Analyse-Dateien vorhanden (BRANCH_MERGE_ANALYSIS, DOCUMENTATION_PROPOSAL)

### Branch: `claude/dsa5-system-adapter-01QvdK2JiF6vRxwsjJQGT1F9` (ALT)

**Vorhandene .md Dateien (12):**
```
✅ README.md
❌ Claude.md                      - VERALTET (zeigt Phase 8, nicht aktuell)
✅ CHANGELOG.md
✅ INSTALLATION.md
✅ ADDING_NEW_SYSTEMS.md          - Anleitung zum Hinzufügen neuer Systeme
✅ DSA5_ROADMAP.md                - DSA5 Entwicklungs-Roadmap (Phase 1-10)
📋 DSA5_UPSTREAM_COMPARISON.md    - Vergleich mit Upstream (teilweise veraltet?)
📋 INSTALL_DSA5.md                - DSA5-spezifische Installation (relevant?)
📋 dsa5-mcp-bug-report-remaining-issues.md  - Bug-Reports (veraltet?)
📋 dsa5-mcp-test-report.md        - Test-Reports (veraltet?)
✅ installer/BUILD_DMG_INSTRUCTIONS.md
✅ packages/mcp-server/src/systems/dsa5/README.md
```

**Status:**
- ⚠️ Mehr Dokumentation vorhanden
- ❌ Claude.md ist veraltet
- ✅ Einige wertvolle Dokumente (ADDING_NEW_SYSTEMS, DSA5_ROADMAP)
- ❌ Test/Bug-Reports möglicherweise veraltet

---

## 🎯 Empfohlenes Vorgehen

### Phase 1: Bestandsaufnahme & Entscheidung (15-30 Min)

**Ziel:** Entscheide für jedes Dokument: BEHALTEN, ARCHIVIEREN, LÖSCHEN, MERGEN

#### 1.1 Aktuellen Branch analysieren

```bash
# Prüfe jede Datei einzeln
less BRANCH_MERGE_ANALYSIS.md       # → Archivieren? (war nur für Merge relevant)
less DOCUMENTATION_PROPOSAL.md      # → Umsetzen oder archivieren?
```

**Empfehlung:**
- `BRANCH_MERGE_ANALYSIS.md` → **ARCHIVIEREN** (in docs/archive/)
- `DOCUMENTATION_PROPOSAL.md` → **UMSETZEN** dann löschen ODER archivieren

#### 1.2 Alten Branch analysieren

```bash
# Wichtige Docs aus altem Branch prüfen
git show claude/dsa5-system-adapter-01QvdK2JiF6vRxwsjJQGT1F9:ADDING_NEW_SYSTEMS.md | less
git show claude/dsa5-system-adapter-01QvdK2JiF6vRxwsjJQGT1F9:DSA5_ROADMAP.md | less
git show claude/dsa5-system-adapter-01QvdK2JiF6vRxwsjJQGT1F9:DSA5_UPSTREAM_COMPARISON.md | less
git show claude/dsa5-system-adapter-01QvdK2JiF6vRxwsjJQGT1F9:dsa5-mcp-test-report.md | less
```

**Empfehlung:**
- `ADDING_NEW_SYSTEMS.md` → **MERGEN** in aktuellen Branch (wichtig für Erweiterung!)
- `DSA5_ROADMAP.md` → **MERGEN + AKTUALISIEREN** (zeigt Entwicklungsverlauf)
- `DSA5_UPSTREAM_COMPARISON.md` → **PRÜFEN**, ggf. aktualisieren oder archivieren
- `dsa5-mcp-test-report.md` → **ARCHIVIEREN** (historisch relevant)
- `dsa5-mcp-bug-report-remaining-issues.md` → **ARCHIVIEREN** oder löschen
- `INSTALL_DSA5.md` → **PRÜFEN**, ggf. in INSTALLATION.md integrieren

---

### Phase 2: Neue Dokumentations-Struktur erstellen (30-45 Min)

**Ziel:** Klare, saubere Struktur im Hauptverzeichnis

#### 2.1 Verzeichnisstruktur anlegen

```bash
# Erstelle saubere Struktur
mkdir -p docs/archive
mkdir -p docs/development
mkdir -p docs/dsa5
```

#### 2.2 Empfohlene Zielstruktur

```
/
├── README.md                           # Haupt-README (kurz, verweist auf docs/)
├── CHANGELOG.md                        # Versionshistorie
├── INSTALLATION.md                     # Installation (allgemein)
├── Claude.md                           # ✅ Entwicklungsstand (AKTUELL)
│
├── docs/
│   ├── README.md                       # Dokumentations-Index
│   │
│   ├── dsa5/
│   │   ├── README.md                   # DSA5 Übersicht
│   │   ├── ROADMAP.md                  # Entwicklungs-Roadmap (aus altem Branch)
│   │   ├── FIELD_MAPPINGS.md           # Feldmappings (aus Claude.md extrahieren)
│   │   └── INSTALL_DSA5.md             # DSA5-spezifische Installation (optional)
│   │
│   ├── development/
│   │   ├── ADDING_NEW_SYSTEMS.md       # Anleitung (aus altem Branch)
│   │   ├── ARCHITECTURE.md             # v0.6.0 Registry Pattern Architektur
│   │   └── MERGE_SUMMARY.md            # v0.6.0 Merge Dokumentation
│   │
│   └── archive/
│       ├── BRANCH_MERGE_ANALYSIS.md    # Temporäre Merge-Analyse
│       ├── DOCUMENTATION_PROPOSAL.md   # Ursprünglicher Vorschlag
│       ├── DSA5_UPSTREAM_COMPARISON.md # Upstream-Vergleich (historisch)
│       ├── dsa5-mcp-test-report.md     # Test-Reports (historisch)
│       └── dsa5-mcp-bug-report.md      # Bug-Reports (historisch)
│
├── packages/mcp-server/src/systems/dsa5/
│   └── README.md                       # Technische DSA5-Docs (✅ bereits vorhanden)
│
└── installer/
    └── BUILD_DMG_INSTRUCTIONS.md
```

---

### Phase 3: Umsetzung im aktuellen Branch (1-2 Std)

#### 3.1 Struktur erstellen

```bash
# Erstelle Verzeichnisse
mkdir -p docs/dsa5
mkdir -p docs/development
mkdir -p docs/archive
```

#### 3.2 Wichtige Docs aus altem Branch übernehmen

```bash
# ADDING_NEW_SYSTEMS.md (wichtig für Entwickler!)
git show claude/dsa5-system-adapter-01QvdK2JiF6vRxwsjJQGT1F9:ADDING_NEW_SYSTEMS.md > docs/development/ADDING_NEW_SYSTEMS.md

# DSA5_ROADMAP.md (zeigt Entwicklungsverlauf)
git show claude/dsa5-system-adapter-01QvdK2JiF6vRxwsjJQGT1F9:DSA5_ROADMAP.md > docs/dsa5/ROADMAP.md
```

#### 3.3 Bestehende Docs verschieben/archivieren

```bash
# Archiviere temporäre Analyse-Docs
git mv BRANCH_MERGE_ANALYSIS.md docs/archive/
git mv DOCUMENTATION_PROPOSAL.md docs/archive/

# Verschiebe Merge-Summary
git mv MERGE_SUMMARY.md docs/development/

# Optional: Upstream-Vergleich archivieren
git show claude/dsa5-system-adapter-01QvdK2JiF6vRxwsjJQGT1F9:DSA5_UPSTREAM_COMPARISON.md > docs/archive/DSA5_UPSTREAM_COMPARISON.md
```

#### 3.4 Neue Dokumentation erstellen

**docs/README.md** - Dokumentations-Index:
```markdown
# Foundry VTT MCP - Dokumentation

## 📖 Haupt-Dokumentation
- [Installation](../INSTALLATION.md)
- [Changelog](../CHANGELOG.md)
- [Entwicklungsstand](../Claude.md)

## 🎲 DSA5 System
- [DSA5 Übersicht](dsa5/README.md)
- [Entwicklungs-Roadmap](dsa5/ROADMAP.md)
- [Feld-Mappings](dsa5/FIELD_MAPPINGS.md)

## 🔧 Entwickler-Dokumentation
- [Neue Systeme hinzufügen](development/ADDING_NEW_SYSTEMS.md)
- [v0.6.0 Registry Pattern](development/MERGE_SUMMARY.md)
- [Architektur](development/ARCHITECTURE.md)

## 📦 Archive
- [Temporäre Merge-Analysen](archive/)
```

**docs/dsa5/README.md** - DSA5 Übersicht:
```markdown
# DSA5 System Support

Das Schwarze Auge 5 (DSA5) Support für Foundry VTT MCP.

## Verfügbare MCP Tools
- `get-dsa5-character-summary` - Charakter-Übersicht
- `update-dsa5-character` - Eigenschaften, LeP, AsP, KaP ändern
- `create-dsa5-character-from-archetype` - Archetyp-basierte Erstellung

## Dokumentation
- [Entwicklungs-Roadmap](ROADMAP.md)
- [Feld-Mappings](FIELD_MAPPINGS.md)
- [Technische Details](../../packages/mcp-server/src/systems/dsa5/README.md)
```

**docs/dsa5/FIELD_MAPPINGS.md** - Extrahiert aus Claude.md:
```markdown
# DSA5 Feld-Mappings

Mapping zwischen Foundry DSA5 Datenstruktur und MCP.

## Eigenschaften (8 Attribute)
[... Inhalt aus Claude.md kopieren ...]

## Lebenspunkte
[... Korrekter LeP-Code aus Claude.md ...]

## Ressourcen
[... AsP/KaP Mappings ...]
```

#### 3.5 Claude.md vereinfachen

**Ziel:** Claude.md sollte nur aktuellen Stand + Verweise enthalten

```markdown
# DSA5 MCP Foundry Fork

## Status: ✅ DSA5 Support vollständig implementiert

Siehe [Entwicklungs-Roadmap](docs/dsa5/ROADMAP.md) für Details.

## Verfügbare Features
[... kompakte Liste ...]

## Dokumentation
- [DSA5 System](docs/dsa5/README.md)
- [Entwickler-Guide](docs/development/ADDING_NEW_SYSTEMS.md)
- [Installation](INSTALLATION.md)

## Architektur
[... kurze Übersicht, Details in docs/development/ ...]
```

---

### Phase 4: Alten Branch bereinigen (Optional, 30 Min)

**Entscheidung treffen:**

#### Option A: Branch archivieren (EMPFOHLEN)
```bash
# Branch als archiviert markieren (Tag)
git tag archive/dsa5-system-adapter claude/dsa5-system-adapter-01QvdK2JiF6vRxwsjJQGT1F9
git push origin archive/dsa5-system-adapter

# Optional: Lokalen Branch löschen
# git branch -d claude/dsa5-system-adapter-01QvdK2JiF6vRxwsjJQGT1F9
```

#### Option B: Branch dokumentation aktualisieren
```bash
# Checkout alter Branch
git checkout claude/dsa5-system-adapter-01QvdK2JiF6vRxwsjJQGT1F9

# Füge README mit Hinweis hinzu
echo "# ⚠️ Archivierter Branch" > ARCHIVED.md
echo "Dieser Branch wurde in claude/review-project-features-01PmrvNF2QLWT277NpZaTkhg gemerged." >> ARCHIVED.md
git add ARCHIVED.md
git commit -m "docs: Mark branch as archived"
git push

# Zurück zum aktuellen Branch
git checkout claude/review-project-features-01PmrvNF2QLWT277NpZaTkhg
```

---

### Phase 5: Commit & Push (15 Min)

```bash
# Status prüfen
git status

# Alle Änderungen stagen
git add docs/
git add Claude.md
git add README.md  # falls geändert

# Commit
git commit -m "docs: Restructure documentation with clear hierarchy

- Create docs/ directory with dsa5/, development/, archive/ subdirectories
- Move ADDING_NEW_SYSTEMS.md from old branch to docs/development/
- Move DSA5_ROADMAP.md from old branch to docs/dsa5/
- Archive temporary analysis files (BRANCH_MERGE_ANALYSIS, DOCUMENTATION_PROPOSAL)
- Move MERGE_SUMMARY to docs/development/
- Create docs/README.md as documentation index
- Simplify Claude.md and add references to detailed docs
- Extract DSA5 field mappings to docs/dsa5/FIELD_MAPPINGS.md"

# Push
git push -u origin claude/review-project-features-01PmrvNF2QLWT277NpZaTkhg
```

---

## ✅ Checkliste

### Aktueller Branch
- [ ] `docs/` Struktur erstellt (dsa5/, development/, archive/)
- [ ] ADDING_NEW_SYSTEMS.md aus altem Branch übernommen
- [ ] DSA5_ROADMAP.md aus altem Branch übernommen
- [ ] BRANCH_MERGE_ANALYSIS.md archiviert
- [ ] DOCUMENTATION_PROPOSAL.md archiviert
- [ ] MERGE_SUMMARY.md nach docs/development/ verschoben
- [ ] docs/README.md als Index erstellt
- [ ] docs/dsa5/README.md erstellt
- [ ] docs/dsa5/FIELD_MAPPINGS.md extrahiert
- [ ] Claude.md vereinfacht und aktualisiert
- [ ] README.md ggf. angepasst
- [ ] Commit & Push

### Alter Branch
- [ ] Entscheidung getroffen (archivieren oder aktualisieren)
- [ ] Git tag `archive/dsa5-system-adapter` erstellt (falls archiviert)
- [ ] ARCHIVED.md hinzugefügt (falls aktualisiert)

---

## 📋 Priorisierung

**Must-Have (Phase 2-3):**
1. ✅ docs/ Struktur anlegen
2. ✅ ADDING_NEW_SYSTEMS.md übernehmen (wichtig!)
3. ✅ Temporäre Dateien archivieren
4. ✅ docs/README.md erstellen

**Should-Have (Phase 3-4):**
5. DSA5_ROADMAP.md übernehmen
6. docs/dsa5/ Struktur aufbauen
7. Claude.md vereinfachen

**Nice-to-Have (Phase 4-5):**
8. Alter Branch archivieren
9. Test/Bug-Reports archivieren
10. Upstream-Vergleich aktualisieren

---

## 🎯 Erwartetes Ergebnis

**Nach Bereinigung:**
- ✅ Klare 3-Ebenen-Struktur: Root → docs/ → Subkategorien
- ✅ Alle wichtigen Dokumente erhalten und auffindbar
- ✅ Temporäre/veraltete Dokumente archiviert (nicht gelöscht!)
- ✅ Claude.md bleibt als Entwickler-Schnelleinstieg
- ✅ docs/README.md als zentraler Index
- ✅ Alter Branch als archiviert markiert

**Vorteile:**
- Neue Entwickler finden schnell relevante Docs
- Historische Informationen bleiben erhalten (Archive)
- Klare Trennung: Nutzer-Docs vs. Entwickler-Docs vs. Archiv
- Skalierbar für zukünftige Systeme (pf2e, dnd5e)

---

*Erstellt: 2025-12-02*
*Für: Branch-Dokumentations-Bereinigung*
