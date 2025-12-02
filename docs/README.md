# Foundry VTT MCP - Dokumentation

**Model Context Protocol (MCP) Integration für Foundry VTT**

Dieses Verzeichnis enthält die vollständige Dokumentation für die Foundry VTT MCP Integration mit DSA5 Support.

---

## 📖 Haupt-Dokumentation

### Einstieg
- **[Installation](../INSTALLATION.md)** - Setup und Konfiguration
- **[Changelog](../CHANGELOG.md)** - Versionshistorie und Änderungen
- **[Claude.md](../Claude.md)** - Aktueller Entwicklungsstand und Schnelleinstieg

### Hauptdokumentation
- **[README](../README.md)** - Projekt-Übersicht

---

## 🎲 DSA5 System

Das Schwarze Auge 5 (DSA5) Support für Foundry VTT.

- **[DSA5 Übersicht](dsa5/README.md)** - Features, MCP Tools, Getting Started
- **[Entwicklungs-Roadmap](dsa5/ROADMAP.md)** - Phase 1-10 Entwicklungsverlauf
- **[Feld-Mappings](dsa5/FIELD_MAPPINGS.md)** - Foundry DSA5 ↔ MCP Datenstruktur
- **[Technische Details](../packages/mcp-server/src/systems/dsa5/README.md)** - SystemAdapter Implementation

### Verfügbare MCP Tools
```
get-dsa5-character-summary           - Detaillierte DSA5 Charakter-Übersicht
update-dsa5-character                - Eigenschaften, LeP, AsP, KaP ändern
create-dsa5-character-from-archetype - Charakter aus Archetyp erstellen
```

---

## 🔧 Entwickler-Dokumentation

### Architektur
- **[Neue Systeme hinzufügen](development/ADDING_NEW_SYSTEMS.md)** - Guide für neue Game Systems
- **[v0.6.0 Registry Pattern](development/MERGE_SUMMARY.md)** - SystemAdapter & IndexBuilder Architektur

### Registry Pattern (v0.6.0)
Das Projekt nutzt ein modernes Registry Pattern für Multi-System Support:
- **SystemAdapter Interface** - Pluggable Game System Support
- **IndexBuilder Interface** - Enhanced Creature Indexing
- **SystemRegistry** - Dynamic Adapter Registration

Aktuell unterstützte Systeme:
- ✅ **DSA5** (Das Schwarze Auge 5) - Vollständig implementiert

---

## 📦 Archiv

Historische und temporäre Dokumentation:

- **[Branch Merge Analysis](archive/BRANCH_MERGE_ANALYSIS.md)** - Analyse des v0.6.0 Merges
- **[Documentation Proposal](archive/DOCUMENTATION_PROPOSAL.md)** - Ursprünglicher Dokumentations-Vorschlag
- **[Cleanup Plan](archive/DOCUMENTATION_CLEANUP_PLAN.md)** - Dokumentations-Restrukturierung Plan

Diese Dokumente werden für Referenzzwecke aufbewahrt, sind aber nicht mehr aktuell.

---

## 🏗️ Projekt-Struktur

```
foundry-vtt-mcp-dsa/
├── packages/
│   ├── mcp-server/          # MCP Server (Node.js)
│   │   └── src/
│   │       ├── systems/     # Multi-System Support (v0.6.0)
│   │       │   ├── types.ts
│   │       │   ├── system-registry.ts
│   │       │   └── dsa5/    # DSA5 Implementation
│   │       └── tools/
│   │           └── dsa5/    # DSA5 Adapter Layer
│   ├── foundry-module/      # Foundry VTT Module
│   └── shared/              # Shared Types
├── docs/                    # >>> Diese Dokumentation
│   ├── dsa5/               # DSA5-spezifisch
│   ├── development/        # Entwickler-Guides
│   └── archive/            # Historische Docs
└── installer/              # Windows/macOS Installer
```

---

## 🚀 Quick Start

1. **Installation:** Siehe [INSTALLATION.md](../INSTALLATION.md)
2. **DSA5 Setup:** Siehe [docs/dsa5/README.md](dsa5/README.md)
3. **Entwicklung:** Siehe [Claude.md](../Claude.md) für aktuellen Stand

---

## 📞 Support & Contribution

**Repository:** https://github.com/frankyh75/foundry-vtt-mcp-dsa
**Upstream:** https://github.com/adambdooley/foundry-vtt-mcp

Für neue Game Systems: Siehe [ADDING_NEW_SYSTEMS.md](development/ADDING_NEW_SYSTEMS.md)

---

*Letzte Aktualisierung: 2025-12-02*
*Version: v0.5.6 (mit DSA5 v0.6.0 Registry Pattern)*
