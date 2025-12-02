# DSA5 System Support

**Das Schwarze Auge 5 (DSA5)** Support für Foundry VTT MCP Integration.

---

## ✅ Status: Vollständig implementiert

Alle geplanten Features sind implementiert und getestet.

**Version:** v0.6.0 mit Registry Pattern
**Letztes Update:** 2025-12-02

---

## 🎯 Features

### 1. Character Management
- ✅ Charakter-Übersicht mit allen 8 Eigenschaften (MU, KL, IN, CH, FF, GE, KO, KK)
- ✅ LeP (Lebensenergie), AsP (Astralenergie), KaP (Karmaenergie) Tracking
- ✅ Eigenschaften und Ressourcen ändern
- ✅ Wunden-Berechnung (korrekte Foundry DSA5 Logik)

### 2. Character Creation
- ✅ Archetyp-basierte Charaktererstellung
- ✅ Anpassung von Name, Alter, Biografie
- ✅ Eigenschaften-Modifikationen
- ✅ Unterstützt alle DSA5 Core-Archetypen (Allacaya, Wulfgrimm, etc.)

### 3. System Architecture
- ✅ **SystemAdapter Interface** - DSA5Adapter implementiert
- ✅ **IndexBuilder** - Enhanced creature indexing
- ✅ **Filters** - Level, Spezies, Kultur, Größe, Zauberfähigkeit
- ✅ **Registry Pattern** - Modularer, erweiterbarer Code

---

## 🛠️ Verfügbare MCP Tools

### `get-dsa5-character-summary`

Liefert detaillierte Charakter-Informationen im formatierten Text.

**Output-Beispiel:**
```
=== Heldenübersicht: Thorald der Krieger ===

EIGENSCHAFTEN (8 von 8):
MU (Mut)              : 14
KL (Klugheit)         : 11
IN (Intuition)        : 12
...

Lebensenergie (LeP): 31 / 31 (Wunden: 0)
Astralenergie (AsP): 0 / 0
Karmaenergie (KaP) : 12 / 12

PROFIL:
Spezies  : Mensch
Kultur   : Mittelreich
Profession: Krieger
Erfahrung: 1200 AP (Stufe ~3)
```

### `update-dsa5-character`

Ändert Charakter-Stats (Eigenschaften, LeP, AsP, KaP).

**Parameter:**
```typescript
{
  actorId: string;              // Foundry Actor ID
  attributes?: {                // Eigenschaften ändern
    MU?: number;
    KL?: number;
    // ... alle 8 Eigenschaften
  };
  health?: {
    current?: number;           // Absolute LeP
    delta?: number;             // Relative Änderung (+/-)
  };
  resources?: {
    AsP?: { current?: number; delta?: number; };
    KaP?: { current?: number; delta?: number; };
  };
}
```

**Beispiel:**
```json
{
  "actorId": "abc123",
  "health": { "delta": -5 },
  "attributes": { "MU": 15 }
}
```

### `create-dsa5-character-from-archetype`

Erstellt neuen Charakter aus DSA5 Archetyp.

**Parameter:**
```typescript
{
  archetypePackId: string;      // z.B. "dsa5-core.corecharacters"
  archetypeId: string;          // Archetyp-ID aus Compendium
  characterName: string;        // Eigener Name
  age?: number;                 // Alter
  biography?: string;           // Hintergrund
  attributeModifiers?: {        // Eigenschaften anpassen
    MU?: number;
    KL?: number;
    // ...
  };
}
```

**Workflow:**
1. Mit `search-compendium` verfügbare Archetypen finden
2. Archetyp wählen (z.B. "Allacaya", "Wulfgrimm")
3. `create-dsa5-character-from-archetype` aufrufen
4. Charakter wird im aktiven Foundry VTT erstellt

---

## 📚 Dokumentation

### Für Nutzer
- **[Feld-Mappings](FIELD_MAPPINGS.md)** - Foundry DSA5 ↔ MCP Datenstruktur
- **[Entwicklungs-Roadmap](ROADMAP.md)** - Entwicklungsverlauf Phase 1-10

### Für Entwickler
- **[Technische Details](../../packages/mcp-server/src/systems/dsa5/README.md)** - SystemAdapter Implementation
- **[Neue Systeme hinzufügen](../development/ADDING_NEW_SYSTEMS.md)** - Guide für weitere Game Systems

---

## 🔧 Architektur

### Adapter-basiert (v0.6.0)

DSA5 Support ist als **externes Modul** implementiert, nicht als Core-Integration:

```
packages/mcp-server/src/
├── systems/dsa5/              # System Implementation
│   ├── adapter.ts            # DSA5Adapter (SystemAdapter interface)
│   ├── constants.ts          # Erfahrungsgrade, Mappings
│   ├── filters.ts            # Creature filters (Zod schemas)
│   ├── index-builder.ts      # Enhanced indexing
│   └── character-creator.ts  # Archetyp-basierte Erstellung
└── tools/dsa5/               # DSA5 Adapter Layer
    ├── character-import.ts   # Foundry Actor → MCP
    ├── character-export.ts   # MCP → Foundry Actor
    └── types.ts              # Type definitions
```

**Vorteile:**
- ✅ Keine Änderungen am Core nötig
- ✅ Merge-konfliktfrei mit Upstream
- ✅ Einfach erweiterbar für weitere Systeme

---

## 🐛 Bekannte Besonderheiten

### LeP (Lebensenergie) Berechnung

**WICHTIG:** Foundry DSA5 speichert LeP anders als erwartet!

```typescript
// ✅ KORREKT
const currentLeP = actor.system.status.wounds.value;  // Direkt aktuelle LeP
const maxLeP = actor.system.status.wounds.max;

// ❌ FALSCH (alte Annahme)
const currentLeP = maxLeP - wounds.value;  // Invertiert!
```

**Hintergrund:** Der Feldname `wounds.value` ist irreführend - er enthält **nicht** die Wunden-Anzahl, sondern die **aktuellen Lebensenergie-Punkte**.

Siehe [FIELD_MAPPINGS.md](FIELD_MAPPINGS.md) für Details.

---

## 🧪 Test-Prompts

Beispiel-Prompts zum Testen der DSA5 Integration:

### Character Summary
```
Zeige mir eine Übersicht meines DSA5 Charakters "Thorald"
```

### Damage/Healing
```
Thorald erleidet 5 Schaden
Heile Thorald um 3 LeP
```

### Attributes
```
Erhöhe Thoralds Mut (MU) auf 15
```

### Character Creation
```
Erstelle einen neuen DSA5 Charakter aus dem Archetyp "Wulfgrimm",
Name "Erik", Alter 28, Krieger aus dem Norden
```

---

## 🗺️ Entwicklungsverlauf

Siehe **[ROADMAP.md](ROADMAP.md)** für den vollständigen Entwicklungsverlauf von Phase 1 bis Phase 10.

**Highlights:**
- **Phase 1-2:** Git-Cleanup, Adapter Layer
- **Phase 3-4:** Character Tools Integration
- **Phase 5-7:** SystemAdapter, Filters, IndexBuilder
- **Phase 8-9:** Character Creator
- **Phase 10:** Merge in Hauptbranch ✅

---

## 📦 Upstream-Kompatibilität

Das DSA5 System ist als **Fork** von `adambdooley/foundry-vtt-mcp` implementiert.

**Strategie:**
- Core-Files bleiben upstream-kompatibel
- DSA5-Logik in separaten Modulen (`systems/dsa5/`, `tools/dsa5/`)
- Merge-Konflikte minimiert

**Upstream:** https://github.com/adambdooley/foundry-vtt-mcp
**Fork:** https://github.com/frankyh75/foundry-vtt-mcp-dsa

---

## 💡 Zukünftige Erweiterungen

Mögliche Features für zukünftige Versionen:

- [ ] **Creature Filtering** - Nutze DSA5 filters für Compendium-Suche
- [ ] **Enhanced Indexing** - DSA5IndexBuilder in Foundry Module integrieren
- [ ] **Talent/Skill Updates** - MCP Tools für Fertigkeiten
- [ ] **Kampf-Integration** - Initiative, AT/PA Tracking
- [ ] **Zauber-Management** - Spruchliste, Zaubern

---

## 🙏 Credits

**DSA5 System für Foundry VTT:**
Ulisses Spiele, Foundry VTT DSA5 System Maintainer

**MCP Integration:**
Basierend auf `foundry-vtt-mcp` von Adam Dooley

**DSA5 MCP Fork:**
frankyh75

---

*Letzte Aktualisierung: 2025-12-02*
*Version: v0.5.6 mit DSA5 v0.6.0 Registry Pattern*
