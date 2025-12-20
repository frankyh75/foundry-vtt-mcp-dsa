# DSA5 Challenge Rating System v2.0

**Datum:** 2024-12-20
**Basis:** Echter Feuerdrachen aus Regelwiki
**Status:** 🚧 In Entwicklung

---

## 🎯 Grundprinzip

DSA5 Kreaturen haben **weder AP noch EP-Werte**!

**CR basiert ausschließlich auf:**
1. **LeP** (Lebensenergie) - Primärfaktor
2. **AT-Werte** (Attacke) - Durchschnitt aller Angriffe
3. **RS** (Rüstungsschutz)
4. **GS** (Geschwindigkeit)
5. **Größenkategorie**
6. **Sonderfertigkeiten** (Anzahl + Typ)
7. **Spezialfähigkeiten** (Aura, Immunität, etc.)
8. **Aktionen pro Runde**

---

## 📊 Baseline: Mensch (1200 AP Kompetent)

| Stat | Wert | CR-Äquivalent |
|------|------|---------------|
| LeP | 30 | Baseline |
| AT | 12 | Baseline |
| RS | 2-4 | Baseline |
| GS | 8 | Baseline |
| Größe | Mittel | Baseline |
| Aktionen | 1 | Baseline |

**CR-Wert:** **1/4** (wie D&D Goblin)

---

## 🔥 Referenz: Feuerdrache (Legendär)

### Basisdaten

| Attribut | Wert | Vergleich zu Mensch |
|----------|------|---------------------|
| **LeP** | 800 | **27x höher** |
| **AT (Durchschnitt)** | 15 | 1.25x höher |
| **VW (Verteidigung)** | 8 | Ausweichen |
| **RS** | 6 | 2x höher |
| **GS** | 13/18 | 2x höher |
| **Größe** | Riesig | +++ |
| **Aktionen** | 2 | 2x |

**WICHTIG:**
- **VW = Verteidigungswert** (Ausweichen ohne Waffe)
- **PA = Parade** (nur mit Waffe)
- Feuerdrache hat **VW 8** weil er natürliche Waffen nutzt (Biss, Klauen)
- VW 8 = Mit W20 eine 8 oder niedriger würfeln zum erfolgreichen Ausweichen

### Kampfwerte

**Nahkampf:**
- Biss: AT 15, TP 2W6+8
- Pranke: AT 16, TP 2W6+7
- Schwanz: AT 14, TP 2W6+8
- Trampeln: AT 10, TP 2W6+8

**Fernkampf:**
- Feuerstrahl: FK 16, TP 2W6+6 + Brennend (10x/Tag, 3 Ziele)

**Durchschnitts-AT:** (15+16+14+10)/4 = **13.75**

### Sonderfertigkeiten (10 total)

- Finte I+II
- Flugangriff
- Hammerschlag
- Kampfreflexe I+II
- Mächtiger Schlag
- Schildspalter
- Schwanzschwung
- Trampeln
- Wuchtschlag I-III

### Spezialfähigkeiten

1. **Feueraura** (5 Schritt Radius)
   - 1 Schritt: 2W6+15 TP/KR
   - 2 Schritt: 2W6+12 TP/KR
   - 3 Schritt: 2W6+9 TP/KR
   - 4 Schritt: 2W6+6 TP/KR
   - 5 Schritt: 2W6+2 TP/KR

2. **Immunität Feuermagie**

3. **Zauber** (4 bekannt, FW 10-18)
   - Ignisphaero (FW 18)
   - Adlerauge (FW 11)
   - Ignifaxius (FW 10)
   - Flammenwand (FW 10)

4. **Empfindliche Stellen** (taktische Komplexität)

### Geschätzter CR: **15-18**

---

## 📐 CR-Berechnungsformel v2.0

```typescript
function calculateCR(creature: DSA5Creature): number {
  // 1. LeP-Faktor (Hauptgewichtung)
  const lepFactor = creature.lep / 30; // 30 = Mensch baseline

  // 2. AT-Faktor (Durchschnitt aller Angriffe)
  const avgAT = creature.attacks.reduce((sum, atk) => sum + atk.at, 0) / creature.attacks.length;
  const atFactor = avgAT / 12; // 12 = Mensch baseline

  // 3. RS-Faktor
  const rsFactor = (creature.rs + 3) / 6; // 3 = Mensch baseline

  // 4. GS-Faktor
  const gsFactor = Math.max(creature.gs) / 8; // 8 = Mensch baseline

  // 5. Größen-Multiplikator
  const sizeMultiplier = {
    'tiny': 0.5,
    'small': 0.75,
    'medium': 1.0,
    'large': 1.5,
    'huge': 2.5,      // "Riesig"
    'gargantuan': 4.0
  }[creature.size] || 1.0;

  // 6. Sonderfertigkeiten-Bonus
  const sfCount = creature.specialAbilities?.length || 0;
  const sfBonus = Math.min(sfCount * 0.1, 2.0); // Max +2.0 CR

  // 7. Spezialfähigkeiten-Multiplikator
  let specialMultiplier = 1.0;

  if (creature.hasAura) specialMultiplier *= 1.5;
  if (creature.hasImmunity) specialMultiplier *= 1.3;
  if (creature.hasMagic) specialMultiplier *= 1.2;
  if (creature.actions > 1) specialMultiplier *= (1 + (creature.actions - 1) * 0.3);

  // 8. Gesamt-CR berechnen
  const baseCR = (
    (lepFactor * 0.5) +    // LeP hat 50% Gewichtung
    (atFactor * 0.2) +     // AT hat 20% Gewichtung
    (rsFactor * 0.15) +    // RS hat 15% Gewichtung
    (gsFactor * 0.15)      // GS hat 15% Gewichtung
  );

  let finalCR = baseCR * sizeMultiplier * specialMultiplier;
  finalCR += sfBonus;

  // 9. CR-Baseline (1/4 = 0.25 für Menschen mit 1200 AP)
  finalCR = finalCR * 0.25;

  // 10. Runde auf D&D CR-Werte
  return roundToCR(finalCR);
}

function roundToCR(score: number): number {
  const crValues = [
    0, 0.125, 0.25, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30
  ];

  return crValues.reduce((prev, curr) =>
    Math.abs(curr - score) < Math.abs(prev - score) ? curr : prev
  );
}
```

---

## 🧪 Test: Feuerdrache

```typescript
const feuerdrache = {
  name: "Drache des Feuers",
  lep: 800,
  attacks: [
    { name: "Biss", at: 15, tp: "2W6+8" },
    { name: "Pranke", at: 16, tp: "2W6+7" },
    { name: "Schwanz", at: 14, tp: "2W6+8" },
    { name: "Trampeln", at: 10, tp: "2W6+8" }
  ],
  rs: 6,
  gs: [13, 18], // Boden/Luft
  size: 'huge',
  specialAbilities: [
    'Finte I', 'Finte II', 'Flugangriff', 'Hammerschlag',
    'Kampfreflexe I', 'Kampfreflexe II', 'Mächtiger Schlag',
    'Schildspalter', 'Schwanzschwung', 'Trampeln',
    'Wuchtschlag I', 'Wuchtschlag II', 'Wuchtschlag III'
  ],
  hasAura: true,      // Feueraura
  hasImmunity: true,  // Feuerimmunität
  hasMagic: true,     // 4 Zauber
  actions: 2
};

// Berechnung:
const lepFactor = 800 / 30 = 26.67;
const avgAT = (15+16+14+10) / 4 = 13.75;
const atFactor = 13.75 / 12 = 1.146;
const rsFactor = (6 + 3) / 6 = 1.5;
const gsFactor = 18 / 8 = 2.25;

const baseCR = (26.67 * 0.5) + (1.146 * 0.2) + (1.5 * 0.15) + (2.25 * 0.15)
             = 13.335 + 0.229 + 0.225 + 0.338
             = 14.127

const sizeMultiplier = 2.5; // huge
const sfBonus = Math.min(13 * 0.1, 2.0) = 1.3;
const specialMultiplier = 1.5 * 1.3 * 1.2 * 1.3 = 3.042;

let finalCR = 14.127 * 2.5 * 3.042 = 107.4;
finalCR += 1.3 = 108.7;
finalCR *= 0.25 = 27.175;

roundToCR(27.175) = CR 25 oder 30
```

**Ergebnis:** CR ~25-30 (!!!)

**D&D Vergleich:**
- Ancient Red Dragon (D&D 5e): CR 24
- Tarrasque (D&D 5e): CR 30

➡️ **Das passt!** DSA5 Feuerdrache ist ein Endgame-Boss!

---

## 📋 Beispiel-Kreaturen (Geschätzt)

### CR 0 - Trivial
- **Ratte:** LeP 3, AT 8, RS 0, Größe tiny
- **Kaninchen:** LeP 2, AT 6, RS 0, Größe tiny

### CR 1/8 - Sehr schwach
- **Goblin (schwach):** LeP 12, AT 10, RS 1, Größe small
- **Wildkatze:** LeP 8, AT 11, RS 0, Größe small

### CR 1/4 - Schwach (Mensch 1200 AP)
- **Mensch (Kompetent):** LeP 30, AT 12, RS 3, Größe medium
- **Goblin (normal):** LeP 18, AT 11, RS 2, Größe small
- **Wolf:** LeP 20, AT 12, RS 0, Größe medium

### CR 1/2 - Mittel
- **Ork-Krieger:** LeP 40, AT 13, RS 4, Größe medium
- **Bär:** LeP 50, AT 12, RS 1, Größe large

### CR 1 - Herausfordernd
- **Ork-Veteran:** LeP 55, AT 14, RS 5, Größe medium
- **Troll (jung):** LeP 80, AT 13, RS 3, Größe large

### CR 5 - Sehr gefährlich
- **Oger:** LeP 120, AT 14, RS 6, Größe large
- **Chimäre:** LeP 150, AT 13, RS 4, Größe large, mehrere Angriffe

### CR 10 - Episch
- **Lindwurm:** LeP 300, AT 15, RS 7, Größe huge
- **Junger Drache:** LeP 350, AT 14, RS 6, Größe huge

### CR 15-18 - Legendär
- **Drache des Feuers:** LeP 800, AT 15, RS 6, Größe huge, 2 Aktionen, Feueraura

### CR 20+ - Mythisch
- **Uralter Drache:** LeP 1000+, AT 17+, RS 8+, Größe gargantuan
- **Dämonenfürst:** LeP 800+, AT 16+, viele Spezialfähigkeiten

---

## 🔧 Foundry Field Paths (TODO: Verifizieren)

Basierend auf Feuerdrachen-Struktur:

```typescript
export const DSA5_CREATURE_PATHS = {
  // Basisdaten
  LEP_MAX: 'system.status.wounds.max',
  LEP_CURRENT: 'system.status.wounds.current',

  // Kampfwerte
  ATTACKS: 'items', // Filter type === 'weapon' oder 'combattechnique'
  // AT ist wahrscheinlich in weapon.system.attack.value

  // Verteidigung
  VW: 'system.status.defense.value',    // Verteidigungswert (Ausweichen ohne Waffe)
  PA: 'system.status.parry.value',      // Parade (nur mit Waffe)
  // Hinweis: VW für natürliche Waffen, PA für gehaltene Waffen

  // Schutz
  RS: 'system.status.armour.value',

  // Bewegung
  GS: 'system.status.speed.value', // Oder array?

  // Größe
  SIZE: 'system.status.size.value',

  // Sonderfertigkeiten
  SPECIAL_ABILITIES: 'items', // Filter type === 'specialability'

  // Zauber
  SPELLS: 'items', // Filter type === 'spell'

  // Aktionen
  ACTIONS: 'system.status.actions', // TODO: Finden!

  // Attribute
  ATTRIBUTES: 'system.characteristics',
  MU: 'system.characteristics.mu.value',
  KL: 'system.characteristics.kl.value',
  IN: 'system.characteristics.in.value',
  CH: 'system.characteristics.ch.value',
  FF: 'system.characteristics.ff.value',
  GE: 'system.characteristics.ge.value',
  KO: 'system.characteristics.ko.value',
  KK: 'system.characteristics.kk.value',
};
```

---

## 🎯 Nächste Schritte

### Phase 1: Validierung (JETZT)
1. ✅ Echte Kreatur-Daten analysiert (Feuerdrache)
2. ⏳ CR-Formel mit User validieren
3. ⏳ Field Paths in Foundry verifizieren
4. ⏳ Weitere Beispiel-Kreaturen sammeln (Goblin, Ork, Oger)

### Phase 2: Implementation
1. ⏳ CR-Berechnung in `dsa5/adapter.ts` implementieren
2. ⏳ `getPowerLevel()` gibt CR zurück (nicht Level!)
3. ⏳ `extractCreatureData()` in index-builder.ts korrigieren
4. ⏳ Filter-System: CR-basiert statt Level-basiert

### Phase 3: Testing
1. ⏳ Mit echten Foundry-Kreaturen testen
2. ⏳ CR-Werte validieren
3. ⏳ list-creatures-by-criteria mit CR-Filter

---

## ❓ Offene Fragen

1. **✅ VW vs. PA geklärt!**
   - **VW** (Verteidigungswert) = Ausweichen ohne Waffe (W20 ≤ VW)
   - **PA** (Parade) = Verteidigung mit Waffe
   - Feuerdrache: VW 8 (natürliche Waffen)
   - Field Path: `system.status.defense.value` (VW) oder `system.status.parry.value` (PA)

2. **Wie sind AT-Werte in Foundry gespeichert?**
   - In weapon items?
   - Zentraler AT-Wert?
   - Pro Waffe unterschiedlich?
   - **Bedarf Foundry-Test!**

3. **Wie viele Aktionen hat eine Kreatur?**
   - Feuerdrache hat 2 Aktionen
   - Wo gespeichert? `system.status.actions`?
   - Standard = 1?
   - **Bedarf Foundry-Test!**

4. **Wie erkenne ich Spezialfähigkeiten?**
   - Aura: In special abilities?
   - Immunität: Flags?
   - Zauber: Items mit type='spell'? ✅
   - **Bedarf Foundry-Test!**

5. **GS-Array oder einzelner Wert?**
   - Feuerdrache hat 13/18 (Boden/Luft)
   - Wie in Foundry strukturiert?
   - **Bedarf Foundry-Test!**

---

**Status:** Wartet auf User-Feedback zu CR-Formel und Field Paths
**Erstellt:** 2024-12-20
**Basis:** Drache des Feuers (Aventurisches Elementarium S. 71)
