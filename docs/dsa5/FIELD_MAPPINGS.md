# DSA5 Feld-Mappings

**Mapping zwischen Foundry DSA5 Datenstruktur und MCP**

Diese Dokumentation beschreibt, wie DSA5-Daten in Foundry VTT gespeichert sind und wie sie ins MCP-Format übersetzt werden.

---

## 📊 Übersicht

Foundry VTT nutzt ein `actor.system` Objekt für system-spezifische Daten. Das DSA5-System hat eine eigene Datenstruktur, die **nicht** immer intuitiv ist.

**Besonders wichtig:** Die LeP (Lebensenergie)-Speicherung ist kontraintuitiv - siehe Abschnitt unten! ⚠️

---

## 🎲 Eigenschaften (8 Attribute)

DSA5 hat 8 Haupteigenschaften (statt D&D's 6):

```typescript
// Foundry DSA5 → MCP Mapping
system.characteristics.mu.value  → MU (Mut / Courage)
system.characteristics.kl.value  → KL (Klugheit / Cleverness)
system.characteristics.in.value  → IN (Intuition)
system.characteristics.ch.value  → CH (Charisma)
system.characteristics.ff.value  → FF (Fingerfertigkeit / Dexterity)
system.characteristics.ge.value  → GE (Gewandtheit / Agility)
system.characteristics.ko.value  → KO (Konstitution / Constitution)
system.characteristics.kk.value  → KK (Körperkraft / Strength)
```

### Beispiel (Foundry Actor)

```json
{
  "system": {
    "characteristics": {
      "mu": { "value": 14, "initial": 14 },
      "kl": { "value": 11, "initial": 11 },
      "in": { "value": 12, "initial": 12 },
      "ch": { "value": 13, "initial": 13 },
      "ff": { "value": 10, "initial": 10 },
      "ge": { "value": 12, "initial": 12 },
      "ko": { "value": 13, "initial": 13 },
      "kk": { "value": 14, "initial": 14 }
    }
  }
}
```

### MCP Format

```typescript
{
  attributes: {
    MU: 14,
    KL: 11,
    IN: 12,
    CH: 13,
    FF: 10,
    GE: 12,
    KO: 13,
    KK: 14
  }
}
```

---

## ❤️ Lebenspunkte (LeP) - KRITISCH!

**⚠️ ACHTUNG:** Die Foundry DSA5 Datenstruktur ist hier SEHR kontraintuitiv!

### Das Problem

Der Feldname `system.status.wounds.value` suggeriert "Wunden-Anzahl", aber er enthält tatsächlich die **aktuellen Lebensenergie-Punkte** (LeP)!

### Korrekte Interpretation

```typescript
// ✅ KORREKT
system.status.wounds.value  → CURRENT LeP (Lebensenergie-Punkte)
system.status.wounds.max    → MAXIMUM LeP

// Direkte Zuordnung:
const currentHP = wounds.value;        // NICHT max - value!
const maxHP = wounds.max;

// Wundenzähler (abgeleitet):
const woundCount = maxHP - currentHP;
```

### ❌ Häufiger Fehler (alte Implementierung)

```typescript
// ❌ FALSCH - Invertierte Logik!
const currentHP = wounds.max - wounds.value;  // NEIN!
const woundCount = wounds.value;              // NEIN!
```

### Code-Beispiel (korrekt)

**character-import.ts:**
```typescript
// Foundry Actor → MCP
const woundsData = actor.system.status.wounds;
const currentHP = woundsData.value;  // Direkt die aktuellen LeP
const maxHP = woundsData.max;
const woundCount = maxHP - currentHP; // Berechne Wunden

return {
  health: { current: currentHP, max: maxHP },
  dsa5: { wounds: woundCount }
};
```

**character-export.ts:**
```typescript
// MCP → Foundry Actor
if (update.health?.delta) {
  const currentHP = actor.system.status.wounds.value;
  const newHP = Math.max(0, Math.min(maxHP, currentHP + update.health.delta));

  updateData['system.status.wounds.value'] = newHP;  // Direkt setzen!
}
```

### Beispiel (Foundry Actor)

```json
{
  "system": {
    "status": {
      "wounds": {
        "value": 26,    // <- Aktuelle LeP (nicht Wunden!)
        "max": 31       // <- Maximum LeP
      }
    }
  }
}
```

**Interpretation:**
- Aktuelle LeP: **26**
- Maximum LeP: **31**
- Wunden: **5** (= 31 - 26)

---

## ✨ Ressourcen

DSA5 hat zwei Hauptressourcen neben LeP:

### Astralenergie (AsP)

Für Zauberkundige.

```typescript
system.status.astralenergy.value  → Aktuelle AsP
system.status.astralenergy.max    → Maximum AsP
```

**Beispiel:**
```json
{
  "system": {
    "status": {
      "astralenergy": {
        "value": 22,
        "max": 30
      }
    }
  }
}
```

### Karmaenergie (KaP)

Für Geweihte.

```typescript
system.status.karmaenergy.value  → Aktuelle KaP
system.status.karmaenergy.max    → Maximum KaP
```

**Beispiel:**
```json
{
  "system": {
    "status": {
      "karmaenergy": {
        "value": 10,
        "max": 12
      }
    }
  }
}
```

### MCP Format

```typescript
{
  resources: [
    { name: 'AsP', current: 22, max: 30, type: 'astralenergy' },
    { name: 'KaP', current: 10, max: 12, type: 'karmaenergy' }
  ]
}
```

---

## 👤 Profil

Charakter-Metadaten.

```typescript
system.details.species.value     → Spezies (Mensch, Elf, Zwerg, ...)
system.details.culture.value     → Kultur (Mittelreich, Thorwal, ...)
system.details.career.value      → Profession (Krieger, Magier, ...)
system.details.experience.total  → Abenteuerpunkte (AP) gesamt
```

### Beispiel (Foundry Actor)

```json
{
  "system": {
    "details": {
      "species": { "value": "Mensch" },
      "culture": { "value": "Mittelreich" },
      "career": { "value": "Krieger" },
      "experience": { "total": 1200 }
    }
  }
}
```

### MCP Format

```typescript
{
  profile: {
    species: "Mensch",
    culture: "Mittelreich",
    profession: "Krieger",
    experience: 1200
  }
}
```

### Erfahrungsgrade (Stufen)

DSA5 nutzt AP (Abenteuerpunkte) statt fester "Levels":

| AP-Bereich | Erfahrungsgrad | Ungefähres D&D Level |
|------------|----------------|----------------------|
| 900-999    | Unerfahren (1) | Level 1-2            |
| 1000-1399  | Durchschnittlich (2) | Level 3-4      |
| 1400-1899  | Erfahren (3)   | Level 5-7            |
| 1900-2399  | Kompetent (4)  | Level 8-10           |
| 2400-2899  | Meisterlich (5)| Level 11-13          |
| 2900-3399  | Brilliant (6)  | Level 14-16          |
| 3400+      | Legendär (7)   | Level 17+            |

Siehe `packages/mcp-server/src/systems/dsa5/constants.ts` für die exakte Mapping-Funktion.

---

## 🧍 Physische Eigenschaften

```typescript
system.status.size.value  → Größe in cm (z.B. 180)
```

### Beispiel

```json
{
  "system": {
    "status": {
      "size": { "value": 180 }
    }
  }
}
```

### MCP Format

```typescript
{
  physical: {
    size: 180
  }
}
```

---

## 🎯 Skills / Talente

DSA5 nutzt "Talente" statt "Skills".

```typescript
// Items mit type: "skill" oder "talent"
item.system.talentValue.value       → Talentwert (z.B. 8)
item.system.characteristic          → Probe (z.B. "MU/IN/CH")
```

### Besonderheit: 3-Eigenschaften-Proben

DSA5 nutzt 3 Eigenschaften pro Talent (statt D&D's 1 Attribut):

**Beispiel:** Überreden (Persuasion)
- Probe: **MU / IN / CH**
- Talentwert: **8**

**Würfelprobe:**
- Würfle 3x W20 (einmal pro Eigenschaft)
- Vergleiche mit MU, IN, CH
- Nutze Talentwert für Ausgleich bei Misserfolgen

### Beispiel (Foundry Item)

```json
{
  "type": "skill",
  "name": "Überreden",
  "system": {
    "talentValue": { "value": 8 },
    "characteristic": "MU/IN/CH",
    "category": "society"
  }
}
```

### MCP Format

```typescript
{
  skills: [
    {
      id: "skill-abc123",
      name: "Überreden",
      value: 8,
      metadata: {
        characteristic: "MU/IN/CH",
        category: "society"
      }
    }
  ]
}
```

---

## 🔄 Vollständiges Mapping-Beispiel

### Foundry DSA5 Actor (gekürzt)

```json
{
  "name": "Thorald der Krieger",
  "type": "character",
  "system": {
    "characteristics": {
      "mu": { "value": 14 },
      "kl": { "value": 11 },
      "ko": { "value": 13 },
      "kk": { "value": 14 }
    },
    "status": {
      "wounds": {
        "value": 31,  // Aktuelle LeP!
        "max": 31
      },
      "astralenergy": { "value": 0, "max": 0 },
      "karmaenergy": { "value": 12, "max": 12 },
      "size": { "value": 180 }
    },
    "details": {
      "species": { "value": "Mensch" },
      "culture": { "value": "Mittelreich" },
      "career": { "value": "Krieger" },
      "experience": { "total": 1200 }
    }
  }
}
```

### MCP Character

```typescript
{
  id: "abc123",
  name: "Thorald der Krieger",
  system: "dsa5",
  attributes: {
    MU: 14,
    KL: 11,
    IN: 12,
    CH: 13,
    FF: 10,
    GE: 12,
    KO: 13,
    KK: 14
  },
  health: {
    current: 31,
    max: 31
  },
  resources: [
    { name: "AsP", current: 0, max: 0, type: "astralenergy" },
    { name: "KaP", current: 12, max: 12, type: "karmaenergy" }
  ],
  profile: {
    species: "Mensch",
    culture: "Mittelreich",
    profession: "Krieger",
    experience: 1200
  },
  physical: {
    size: 180
  },
  systemData: {
    dsa5: {
      wounds: 0,  // Berechnet: 31 - 31
      experienceLevel: 2  // Durchschnittlich (1000-1399 AP)
    }
  }
}
```

---

## 🛠️ Implementation Details

Die Mapping-Logik ist implementiert in:

- **`packages/mcp-server/src/tools/dsa5/character-import.ts`**
  - `fromDsa5Actor()` - Foundry → MCP
  - `getDsa5CharacterSummary()` - Formatierte Textausgabe

- **`packages/mcp-server/src/tools/dsa5/character-export.ts`**
  - `applyMcpUpdateToDsa5Actor()` - MCP → Foundry
  - `calculateNewWounds()` - LeP-Berechnungen

- **`packages/mcp-server/src/systems/dsa5/constants.ts`**
  - Field paths
  - Experience level mappings
  - Size conversions

---

## 🐛 Bekannte Edge Cases

### 1. Leere Ressourcen

Nicht-magische Charaktere haben `AsP = 0/0`:

```typescript
// ✅ Korrekt behandeln
if (actor.system.status.astralenergy.max === 0) {
  // Nicht ausgeben oder als "N/A" markieren
}
```

### 2. Negative LeP

Charaktere können "sterben" bei LeP ≤ 0:

```typescript
// ✅ Prüfung einbauen
const newHP = Math.max(0, currentHP + delta);  // Nie < 0
```

### 3. Überheilung

LeP dürfen Maximum nicht überschreiten:

```typescript
// ✅ Clamping
const newHP = Math.min(maxHP, currentHP + delta);  // Nie > max
```

### Kombiniert (korrekt)

```typescript
const newHP = Math.max(0, Math.min(maxHP, currentHP + delta));
```

---

## 📚 Weitere Ressourcen

- **[DSA5 Foundry System Docs](https://github.com/Plushtoast/dsa5-foundryVTT)** - Offizielle Foundry DSA5 Docs
- **[DSA5 Regelwerk](https://ulisses-spiele.de/dsa5-regelwerk/)** - Ulisses Spiele
- **[Technische Implementation](../../packages/mcp-server/src/systems/dsa5/README.md)** - SystemAdapter Details

---

*Letzte Aktualisierung: 2025-12-02*
*⚠️ Besonders beachten: LeP-Mapping (wounds.value = current LeP, NICHT Wunden!)*
