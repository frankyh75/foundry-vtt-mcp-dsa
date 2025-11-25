# DSA5 Foundry VTT - Reverse Engineering

**Quelle:** https://github.com/Plushtoast/dsa5-foundryVTT/blob/master/template.json
**Datum:** 2024
**Zweck:** Exakte Datenstrukturen für v0.6.1 MCP Integration

---

## 🎯 Executive Summary

**Wichtigste Erkenntnisse:**
1. ❌ **KEIN "level" Feld** - Nur `experience.total` und `experience.spent`
2. ✅ **Eigenschaften** haben 5 Felder: `initial`, `species`, `modifier`, `advances`, **+ berechnetes `value`**
3. ⚠️ **wounds** hat `current` Feld (zusätzlich zu `value`)
4. ✅ **size** ist einfacher String: `"average"`, nicht Object
5. ✅ **career** ist korrekter Feld-Name (nicht "profession")
6. ✅ **characteristic1/2/3** bei Skills (nicht Array!)

---

## 📊 Character Actor - Komplette Struktur

### Template Hierarchy
```
character
├── templates: ["characteristics", "status", "details", "magic"]
├── config
├── details (override)
├── freeLanguagePoints
└── sheetLocked
```

---

## 🧬 1. Characteristics (Eigenschaften)

### Template-Struktur:
```json
{
  "mu": {
    "label": "CHAR.MU",
    "abrev": "CHARAbbrev.MU",
    "initial": 8,
    "species": 0,
    "modifier": 0,
    "advances": 0
  }
}
```

### Berechneter Wert:
```javascript
// Das "value" Feld wird DYNAMISCH berechnet:
value = initial + species + modifier + advances
```

**ALLE 8 Eigenschaften:**
- `mu` - Mut (Courage)
- `kl` - Klugheit (Cleverness)
- `in` - Intuition
- `ch` - Charisma
- `ff` - Fingerfertigkeit (Dexterity)
- `ge` - Gewandtheit (Agility)
- `ko` - Konstitution (Constitution)
- `kk` - Körperkraft (Strength)

### Field Paths:
```typescript
'system.characteristics.mu.initial'    // 8 (Startwert)
'system.characteristics.mu.species'    // 0 (Spezies-Modifikator, z.B. +1 für Elfen)
'system.characteristics.mu.modifier'   // 0 (Temporäre Modifikatoren)
'system.characteristics.mu.advances'   // 0 (AP-Steigerungen)
'system.characteristics.mu.value'      // BERECHNET: 8+0+0+0 = 8
```

**Beispiel (Elf mit MU-Steigerung):**
```json
{
  "mu": {
    "initial": 8,
    "species": 1,     // Elfen haben +1 MU
    "advances": 2,    // 2x gesteigert
    "modifier": 0,
    "value": 11       // 8 + 1 + 2 + 0 = 11
  }
}
```

---

## 💚 2. Status Werte

### Wounds (LeP - Lebensenergie):
```json
{
  "wounds": {
    "initial": 0,
    "value": 0,       // NICHT current wounds! Basis-Steigerungen
    "advances": 0,
    "modifier": 0,
    "current": 8      // ACTUAL current LeP! (wird berechnet)
  }
}
```

**KRITISCH - Wound-Logik:**
```javascript
// BERECHNUNG:
max = ((KO + KO + KK) / 2) + initial + advances + modifier
current = max  // Volle LeP

// SCHADEN:
// Wenn Charakter 5 Schaden nimmt:
current = max - 5  // current SINKT!

// DSA5 speichert aktuelle HP in "current", NICHT "value"!
// "value" ist NUR für permanente Steigerungen!
```

**Field Paths:**
```typescript
'system.status.wounds.initial'   // Rassen-Bonus
'system.status.wounds.value'     // AP-Steigerungen
'system.status.wounds.advances'  // ???
'system.status.wounds.modifier'  // Temporäre Boni
'system.status.wounds.current'   // AKTUELLE LeP! ⚠️
```

### Astralenergie (AsP):
```json
{
  "astralenergy": {
    "initial": 0,
    "value": 0,
    "advances": 0,
    "modifier": 0,
    "current": 0
  }
}
```

**Berechnung:**
```javascript
max = ((CH + CH + IN) / 2) + initial + advances + modifier
current = max  // Wenn voll
```

### Karmaenergie (KaP):
```json
{
  "karmaenergy": {
    "initial": 0,
    "value": 0,
    "advances": 0,
    "modifier": 0,
    "current": 0
  }
}
```

**Berechnung:**
```javascript
max = ((MU + IN + CH) / 2) + initial + advances + modifier
current = max  // Wenn voll
```

### Weitere Status-Werte:
```json
{
  "soulpower": {      // Seelenkraft (SK)
    "initial": 0,
    "value": 0,
    "modifier": 0
  },
  "toughness": {      // Zähigkeit (ZK)
    "initial": 0,
    "value": 0,
    "modifier": 0
  },
  "dodge": {          // Ausweichen (AW)
    "value": 0,
    "modifier": 0
  },
  "fatePoints": {     // Schicksalspunkte
    "value": 3,
    "modifier": 0,
    "current": 3
  },
  "speed": {          // Geschwindigkeit (GS)
    "initial": 0,
    "modifier": 0,
    "value": 0
  },
  "initiative": {     // Initiative (INI)
    "value": 0,
    "modifier": 0,
    "current": 0,
    "die": "1d6",
    "diemodifier": ""
  },
  "size": {
    "value": "average"  // String! Nicht Object!
  }
}
```

**Field Paths:**
```typescript
'system.status.wounds.current'        // Aktuelle LeP ⚠️
'system.status.astralenergy.current'  // Aktuelle AsP
'system.status.karmaenergy.current'   // Aktuelle KaP
'system.status.soulpower.value'       // Seelenkraft
'system.status.toughness.value'       // Zähigkeit
'system.status.dodge.value'           // Ausweichen
'system.status.speed.value'           // Geschwindigkeit
'system.status.initiative.current'    // Initiative (aktuell)
'system.status.size.value'            // "average", "small", "large"
```

---

## 👤 3. Details

```json
{
  "details": {
    "experience": {
      "total": 0,     // Gesamt-AP (z.B. 2400)
      "spent": 0      // Ausgegebene AP (z.B. 2100)
    },
    "species": { "value": "" },         // Spezies
    "gender": { "value": "" },
    "culture": { "value": "" },         // Kultur
    "career": { "value": "" },          // NICHT "profession"!
    "socialstate": { "value": "" },
    "home": { "value": "" },
    "family": { "value": "" },
    "age": { "value": "" },
    "haircolor": { "value": "" },
    "eyecolor": { "value": "" },
    "height": { "value": "" },
    "weight": { "value": "" },
    "distinguishingmark": { "value": "" },
    "biography": { "value": "" },
    "notes": {
      "value": "",
      "gmdescription": ""
    }
  }
}
```

**Field Paths:**
```typescript
'system.details.experience.total'   // Gesamt-AP (für Level-Berechnung!)
'system.details.experience.spent'   // Ausgegebene AP
'system.details.species.value'      // "Mensch", "Elf", "Zwerg"
'system.details.culture.value'      // "Mittelländisch", "Thorwal"
'system.details.career.value'       // "Krieger", "Magier" (NICHT profession!)
'system.details.biography.value'    // Biografie-Text
```

---

## 🔮 4. Magic (Tradition)

```json
{
  "magic": {
    "guidevalue": {
      "magical": "-",     // Leiteigenschaft für Magie (z.B. "kl")
      "clerical": "-"     // Leiteigenschaft für Klerus (z.B. "ch")
    },
    "energyfactor": {
      "magical": 1,
      "clerical": 1
    },
    "tradition": {
      "magical": "",      // "Gildenmagier", "Hexe"
      "clerical": ""      // "Boron-Geweihter"
    },
    "feature": {
      "magical": "",      // Zauberermerkmale
      "clerical": ""      // Kleriker-Merkmale
    },
    "happyTalents": {
      "value": ""
    }
  }
}
```

**Field Paths:**
```typescript
'system.magic.tradition.magical'    // "Gildenmagier"
'system.magic.tradition.clerical'   // "Boron-Geweihter"
'system.magic.guidevalue.magical'   // "kl" (Leiteigenschaft)
```

---

## 📜 5. Items - Skills (Talente)

```json
{
  "type": "skill",
  "system": {
    "group": { "value": "" },           // Talentgruppe (körper, gesellschaft, etc.)
    "talentValue": { "value": 0 },      // FW (Fertigkeitswert) 0-20+
    "characteristic1": { "value": "mu" }, // Erste Probe-Eigenschaft
    "characteristic2": { "value": "mu" }, // Zweite Probe-Eigenschaft
    "characteristic3": { "value": "mu" }, // Dritte Probe-Eigenschaft
    "RPr": { "value": "no" },           // Routineprobe möglich?
    "burden": { "value": "no" },        // Belastung durch Rüstung?
    "StF": { "value": "A" }             // Steigerungsfaktor (A-D)
  }
}
```

**WICHTIG:** `characteristic1/2/3` sind **separate Felder**, KEIN Array!

**Field Paths:**
```typescript
'system.talentValue.value'        // FW (z.B. 8 für Klettern)
'system.characteristic1.value'    // "mu"
'system.characteristic2.value'    // "ge"
'system.characteristic3.value'    // "kk"
'system.group.value'              // "körper", "gesellschaft", "natur"
'system.StF.value'                // "A", "B", "C", "D"
'system.burden.value'             // "yes", "no"
```

**Beispiel - Klettern:**
```json
{
  "name": "Klettern",
  "type": "skill",
  "system": {
    "talentValue": { "value": 8 },
    "characteristic1": { "value": "mu" },
    "characteristic2": { "value": "ge" },
    "characteristic3": { "value": "kk" },
    "group": { "value": "körper" },
    "StF": { "value": "B" },
    "burden": { "value": "yes" }
  }
}
```

---

## ⚔️ 6. Items - Combat Skills (Kampftechniken)

```json
{
  "type": "combatskill",
  "system": {
    "guidevalue": { "value": "ff" },    // Leiteigenschaft (ff, ge, kk)
    "parry": { "value": 0 },            // PA (Parade)
    "attack": { "value": 0 },           // AT (Attacke)
    "talentValue": { "value": 6 },      // Basis-Wert (normalerweise 6)
    "weapontype": { "value": "melee" }, // "melee" oder "ranged"
    "StF": { "value": "A" }             // Steigerungsfaktor
  }
}
```

**Field Paths:**
```typescript
'system.attack.value'     // AT (z.B. 12)
'system.parry.value'      // PA (z.B. 10)
'system.talentValue.value' // Basis (6)
'system.guidevalue.value' // "ff", "ge", "kk"
'system.weapontype.value' // "melee", "ranged"
```

**Beispiel - Schwerter:**
```json
{
  "name": "Schwerter",
  "type": "combatskill",
  "system": {
    "attack": { "value": 14 },
    "parry": { "value": 12 },
    "guidevalue": { "value": "ge" },
    "weapontype": { "value": "melee" }
  }
}
```

---

## 🔮 7. Items - Spells & Liturgies

### Spell (Zauber):
```json
{
  "type": "spell",
  "system": {
    "talentValue": { "value": 0 },        // ZfW (Zauberfertigkeit)
    "feature": "",                        // Merkmal (e.g., "Antimagie")
    "characteristic1": { "value": "mu" },
    "characteristic2": { "value": "kl" },
    "characteristic3": { "value": "in" },
    "effect": { "value": "" },
    "castingTime": { "value": "1" },      // Zauberzeit (1 Aktion, 2 Aktionen, etc.)
    "AsPCost": { "value": 0 },            // AsP-Kosten (numerisch)
    "AsPCostDetail": { "value": "0" },    // AsP-Kosten (Text, z.B. "8 AsP")
    "maintainCost": { "value": "" },      // Aufrechterhaltung
    "distribution": { "value": "" },      // Verbreitung
    "StF": { "value": "A" },
    "resistanceModifier": { "value": "-" },
    "canChangeCastingTime": { "value": "true" },
    "canChangeCost": { "value": "true" },
    "canChangeRange": { "value": "true" },
    "variableBaseCost": "false",
    "effectFormula": { "value": "" },
    "range": { "value": "" },             // Reichweite (z.B. "8 Schritt")
    "duration": { "value": "" },          // Wirkungsdauer
    "targetCategory": { "value": "" },
    "description": { "value": "" },
    "gmdescription": { "value": "" }
  }
}
```

**Field Paths:**
```typescript
'system.talentValue.value'      // ZfW (Zauberfertigkeit)
'system.AsPCost.value'          // AsP-Kosten (Zahl)
'system.castingTime.value'      // "1", "2", "4"
'system.range.value'            // "8 Schritt", "Berührung"
'system.duration.value'         // "sofort", "aufrechterhalten"
'system.feature'                // "Antimagie", "Heilung"
```

### Liturgy (Liturgie):
```json
// Fast identisch mit Spell, aber:
// - Verwendet KaP statt AsP
// - Keine "feature" (Merkmal)
// - Andere distribution (Gottheiten statt Traditionen)
```

---

## 🎁 8. Items - Advantages/Disadvantages/Special Abilities

### Advantage (Vorteil):
```json
{
  "type": "advantage",
  "system": {
    "APValue": { "value": "0" },      // AP-Kosten (String!)
    "step": { "value": 1 },           // Steigerungsstufe
    "effect": { "value": "" },
    "max": { "value": 0 },            // Maximale Stufe
    "requirements": { "value": "" },
    "description": { "value": "" },
    "gmdescription": { "value": "" }
  }
}
```

### Disadvantage (Nachteil):
```json
// Identisch mit Advantage
// APValue ist NEGATIV (gibt AP zurück)
```

### Special Ability (Sonderfertigkeit):
```json
{
  "type": "specialability",
  "system": {
    "rule": { "value": "" },
    "maxRank": { "value": 0 },
    "step": { "value": 1 },
    "category": { "value": "general" },  // general, combat, magical, clerical
    "list": { "value": "" },
    "effect": { "value": "" },
    "APValue": { "value": "0" },
    "requirements": { "value": "" },
    "description": { "value": "" },
    "gmdescription": { "value": "" }
  }
}
```

**Field Paths:**
```typescript
'system.APValue.value'    // AP-Kosten (STRING!)
'system.category.value'   // "general", "combat", "magical", "clerical"
'system.maxRank.value'    // Maximale Stufe
```

---

## 🔧 Korrigierte Field Paths für constants.ts

```typescript
export const FIELD_PATHS = {
  // Characteristics (Eigenschaften)
  CHARACTERISTICS: 'system.characteristics',
  MU: 'system.characteristics.mu.value',        // BERECHNET!
  KL: 'system.characteristics.kl.value',
  IN: 'system.characteristics.in.value',
  CH: 'system.characteristics.ch.value',
  FF: 'system.characteristics.ff.value',
  GE: 'system.characteristics.ge.value',
  KO: 'system.characteristics.ko.value',
  KK: 'system.characteristics.kk.value',

  // Status Values ⚠️ WICHTIG: .current für aktuelle Werte!
  STATUS_WOUNDS: 'system.status.wounds',
  STATUS_WOUNDS_CURRENT: 'system.status.wounds.current',    // Aktuelle LeP!
  STATUS_ASTRAL: 'system.status.astralenergy',
  STATUS_ASTRAL_CURRENT: 'system.status.astralenergy.current',
  STATUS_KARMA: 'system.status.karmaenergy',
  STATUS_KARMA_CURRENT: 'system.status.karmaenergy.current',
  STATUS_SPEED: 'system.status.speed.value',
  STATUS_INITIATIVE: 'system.status.initiative.current',
  STATUS_DODGE: 'system.status.dodge.value',
  STATUS_SOULPOWER: 'system.status.soulpower.value',
  STATUS_TOUGHNESS: 'system.status.toughness.value',

  // Details
  DETAILS_EXPERIENCE_TOTAL: 'system.details.experience.total',   // Für Level!
  DETAILS_EXPERIENCE_SPENT: 'system.details.experience.spent',
  DETAILS_SPECIES: 'system.details.species.value',
  DETAILS_CULTURE: 'system.details.culture.value',
  DETAILS_CAREER: 'system.details.career.value',      // NICHT profession!
  DETAILS_BIOGRAPHY: 'system.details.biography.value',

  // Size (String!)
  STATUS_SIZE: 'system.status.size.value',  // "average", "small", "large"

  // Tradition
  TRADITION_MAGICAL: 'system.magic.tradition.magical',
  TRADITION_CLERICAL: 'system.magic.tradition.clerical',
} as const;
```

---

## ⚠️ Kritische Unterschiede zu bisherigen Annahmen

### 1. LeP (wounds) - NICHT INVERTIERT!
```typescript
// FALSCH (meine bisherige Annahme):
currentLeP = wounds.max - wounds.value  // ❌

// RICHTIG (template.json):
currentLeP = wounds.current  // ✅
maxLeP = berechnet aus (KO+KO+KK)/2 + wounds.value + wounds.initial

// Es gibt KEIN wounds.max in template.json!
// wounds.value ist NUR für AP-Steigerungen!
```

### 2. Eigenschaften - value ist BERECHNET
```typescript
// FALSCH:
mu = system.characteristics.mu.value  // ❌ Nicht direkt setzen!

// RICHTIG:
mu.initial = 8
mu.species = 1
mu.advances = 2
// value wird automatisch berechnet: 8+1+2 = 11
```

### 3. Skills - characteristic als 3 Felder
```typescript
// FALSCH:
skill.characteristic = ["mu", "ge", "kk"]  // ❌ Kein Array!

// RICHTIG:
skill.characteristic1.value = "mu"  // ✅
skill.characteristic2.value = "ge"
skill.characteristic3.value = "kk"
```

### 4. Career statt Profession
```typescript
// FALSCH:
profession = system.details.profession.value  // ❌ Existiert nicht!

// RICHTIG:
profession = system.details.career.value  // ✅
```

### 5. Size ist String
```typescript
// FALSCH:
size = system.status.size.value.german  // ❌ Kein Object!

// RICHTIG:
size = system.status.size.value  // ✅ "average" (String)
```

---

## 📝 TODO: Code-Anpassungen

### character-import.ts - Korrekturen:
```typescript
// ALT (falsch):
const currentLeP = (wounds.max ?? 0) - wounds.value;

// NEU (korrekt):
const currentLeP = wounds.current ?? 0;
const maxLeP = calculateMaxLeP(actor);  // Berechnung aus KO/KK

function calculateMaxLeP(actor: any): number {
  const system = actor.system;
  const ko = system.characteristics?.ko?.value ?? 8;
  const kk = system.characteristics?.kk?.value ?? 8;
  const initial = system.status?.wounds?.initial ?? 0;
  const value = system.status?.wounds?.value ?? 0;
  const modifier = system.status?.wounds?.modifier ?? 0;

  return Math.floor((ko + ko + kk) / 2) + initial + value + modifier;
}
```

### Skills Extraction - Korrekturen:
```typescript
// ALT (falsch):
eigenschaften: system.characteristic || []

// NEU (korrekt):
eigenschaften: [
  system.characteristic1?.value ?? '',
  system.characteristic2?.value ?? '',
  system.characteristic3?.value ?? ''
].filter(c => c !== '')
```

---

## 🎯 Zusammenfassung für Migration

**Was RICHTIG war:**
- ✅ 8 Eigenschaften (MU-KK)
- ✅ experience.total für AP
- ✅ career (nicht profession)
- ✅ AsP/KaP Struktur
- ✅ Item-Types (skill, combatskill, spell, etc.)

**Was KORRIGIERT werden muss:**
- ⚠️ **wounds.current** für aktuelle LeP (nicht max - value!)
- ⚠️ **maxLeP berechnen** aus (KO+KO+KK)/2 + wounds.value
- ⚠️ **characteristic1/2/3** statt Array
- ⚠️ **size.value** ist String, nicht Object
- ⚠️ **APValue ist STRING** bei advantages/disadvantages

---

## 🔗 Referenzen

- **Quelle:** https://github.com/Plushtoast/dsa5-foundryVTT/blob/master/template.json
- **DSA5 Regelwiki:** https://dsa.ulisses-regelwiki.de/
- **Foundry VTT Docs:** https://foundryvtt.com/api/

**Nächste Schritte:**
1. character-import.ts korrigieren (wounds.current!)
2. FIELD_PATHS in constants.ts aktualisieren
3. Skills Extraction anpassen (characteristic1/2/3)
4. Tests aktualisieren
