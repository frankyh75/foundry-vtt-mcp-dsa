# DSA5 Challenge Rating System - Design Dokument

**Datum:** 2024-12-20
**Status:** 🚧 ENTWURF - Benötigt Validierung
**Problem:** Kreaturen haben **keine AP-Werte** (Helden-Statistik), benötigen eigenes CR-System

---

## 🎯 Zielsetzung

Entwickle ein Challenge Rating (CR) System für DSA5 Kreaturen, ähnlich D&D 5e CR, basierend auf:
- **EP-Werte** (Erfahrungspunkte fürs Besiegen - NICHT AP!)
- **Kampfstatistiken:** LeP, AT, PA, RS
- **Größenklassen** und **Sonderfertigkeiten**

---

## ❌ Aktuelles Problem

### Fehlerhafter Code (index-builder.ts, Zeile 173-181):

```typescript
// ❌ FALSCH: Extrahiert AP-Werte (Helden-Statistik)
const experiencePoints = system.details?.experience?.total ?? 0;

// ❌ FALSCH: Berechnet Erfahrungsgrad für Kreatur
const experienceLevel = getExperienceLevel(experiencePoints);
const level = experienceLevel.level;
```

**Problem:**
- `system.details.experience.total` = **AP** (Abenteuerpunkte für Helden)
- Kreaturen haben **keine Erfahrungsgrade** (1-7)
- Kreaturen werden nicht durch AP-Werte charakterisiert!

---

## ✅ Korrekte DSA5 Kreaturen-Charakterisierung

### 1. EP-Werte (Erfahrungspunkte)
**Was:** Punkte, die Helden fürs **Besiegen** der Kreatur erhalten
**Wo gespeichert:** `system.details.ep` (?)  **TODO: Field Path verifizieren**

**Beispiele:**
- Goblin: ~15 EP
- Ork-Krieger: ~30 EP
- Feuerdrache: ~300+ EP (?)

---

### 2. Kampfstatistiken

#### LeP (Lebensenergie)
- **Aktuell extrahiert:** ✅ `system.status.wounds.max`
- **Beispiel Mensch (1200 AP):** ~30 LeP
- **Beispiel Feuerdrache:** ~150+ LeP

#### AT (Attacke-Wert)
- **Wo gespeichert:** `system.status.attack` (?)  **TODO: Field Path finden**
- **Beispiel Mensch (1200 AP):** ~12 AT
- **Beispiel Feuerdrache:** ~18+ AT

#### PA (Parade-Wert)
- **Wo gespeichert:** `system.status.parry` oder `system.status.defense` (?)  **TODO: Verifizieren**
- **Aktuell als "meleeDefense":** Zeile 225-228
- **Beispiel Mensch (1200 AP):** ~10 PA
- **Beispiel Feuerdrache:** ~14+ PA

#### RS (Rüstungsschutz)
- **Aktuell extrahiert:** ✅ `system.status.armour.value`
- **Beispiel Mensch (1200 AP):** 0-4 RS
- **Beispiel Feuerdrache:** 8+ RS (Schuppen)

---

### 3. Größenklassen
**Aktuell extrahiert:** ✅ `system.status.size.value`

**Einfluss auf Gefährlichkeit:**
- **Winzig (tiny):** Schwer zu treffen, weniger Schaden
- **Klein (small):** Leicht unterdurchschnittlich
- **Mittel (medium):** Baseline (Mensch)
- **Groß (large):** +Wucht, +LeP
- **Riesig (huge):** ++Kampfkraft
- **Gigantisch (gargantuan):** +++Extrem gefährlich

---

### 4. Sonderfertigkeiten
**Aktuell extrahiert:** Teilweise als "traits"

**Kritische Modifikatoren:**
- **Verbeißen:** Zusätzlicher Schaden über Runden
- **Wuchtschlag:** Hoher Einzelschaden
- **Immunität (Feuer/Gift/etc.):** Macht Kreatur viel stärker
- **Regeneration:** Kampf wird länger/schwieriger
- **Panzerbrechend:** Ignoriert RS teilweise
- **Dämonische Verdopplung:** 2x Schaden gegen Geweihte

---

## 🎲 Challenge Rating Mapping - Vorschlag

### Baseline: Mensch mit 1200 AP (Erfahrungsgrad 2 "Durchschnittlich")
- **Stats:** ~30 LeP, ~12 AT, ~10 PA, 2-4 RS
- **CR-Äquivalent:** CR 1/4 (wie D&D Goblin)

### Formel (Vorschlag - TODO: Validieren):

```typescript
function calculateCR(creature: DSA5Creature): number {
  let crScore = 0;

  // 1. EP-basierte Grundeinstufung
  const ep = creature.experiencePoints;
  if (ep < 10) crScore = 0;        // CR 0 (Ratte)
  else if (ep < 20) crScore = 0.125;  // CR 1/8 (Schwache Kreatur)
  else if (ep < 40) crScore = 0.25;   // CR 1/4 (Goblin-Äquivalent)
  else if (ep < 80) crScore = 0.5;    // CR 1/2 (Ork)
  else if (ep < 120) crScore = 1;     // CR 1
  else crScore = Math.floor(ep / 100); // Näherungsweise Skalierung

  // 2. Kampfstatistik-Modifikatoren
  const combatPower = (
    (creature.lifePoints / 30) +      // LeP vs. Mensch (30 LeP baseline)
    (creature.attack / 12) +          // AT vs. Mensch (12 AT baseline)
    (creature.parry / 10) +           // PA vs. Mensch (10 PA baseline)
    (creature.armor / 3)              // RS (jeder Punkt wertvoll)
  ) / 4;  // Durchschnitt

  crScore *= combatPower;

  // 3. Größen-Modifikator
  const sizeModifier = {
    'tiny': 0.5,
    'small': 0.8,
    'medium': 1.0,
    'large': 1.5,
    'huge': 2.0,
    'gargantuan': 3.0
  }[creature.size] || 1.0;

  crScore *= sizeModifier;

  // 4. Sonderfertigkeiten-Modifikator
  const specialAbilities = creature.traits || [];
  if (specialAbilities.includes('Verbeißen')) crScore *= 1.2;
  if (specialAbilities.includes('Wuchtschlag')) crScore *= 1.3;
  if (specialAbilities.includes('Immunität')) crScore *= 1.5;
  if (specialAbilities.includes('Regeneration')) crScore *= 1.4;
  if (specialAbilities.includes('Dämonisch')) crScore *= 2.0;

  // 5. Runde auf D&D CR-Werte
  return roundToCR(crScore);
}

function roundToCR(score: number): number {
  const crValues = [0, 0.125, 0.25, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
                    11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30];

  // Finde nächstgelegenen CR-Wert
  return crValues.reduce((prev, curr) =>
    Math.abs(curr - score) < Math.abs(prev - score) ? curr : prev
  );
}
```

---

## 📊 Beispiel-Kreaturen (TODO: Validieren)

### CR 0 - Triviale Bedrohung
- **Ratte:** 3 EP, 5 LeP, 8 AT, 8 PA, 0 RS → CR 0

### CR 1/8 - Sehr schwach
- **Goblin (schwach):** 10 EP, 15 LeP, 10 AT, 8 PA, 1 RS → CR 1/8

### CR 1/4 - Schwach (wie Mensch 1200 AP)
- **Goblin (normal):** 20 EP, 20 LeP, 11 AT, 9 PA, 2 RS → CR 1/4

### CR 1/2 - Mittel
- **Ork-Krieger:** 40 EP, 35 LeP, 13 AT, 10 PA, 4 RS → CR 1/2

### CR 1 - Herausfordernd
- **Ork-Veteran:** 80 EP, 45 LeP, 14 AT, 11 PA, 5 RS → CR 1

### CR 5+ - Sehr gefährlich
- **Oger:** 150 EP, 80 LeP, 16 AT, 12 PA, 6 RS, Größe: large → CR 5

### CR 10+ - Legendär
- **Feuerdrache:** 300+ EP, 150 LeP, 18 AT, 14 PA, 8 RS, Größe: huge, Immunität Feuer → CR 12-15

---

## 🔧 Benötigte Field Paths (TODO: Verifizieren)

### Zu finden/hinzufügen in constants.ts:

```typescript
export const FIELD_PATHS = {
  // ... existing paths ...

  // EP (Erfahrungspunkte fürs Besiegen - NICHT AP!)
  DETAILS_EP: 'system.details.ep',           // TODO: Verifizieren!
  DETAILS_EXPERIENCE_REWARD: 'system.ep',    // Alternative?

  // Kampfwerte
  STATUS_ATTACK: 'system.status.attack.value',   // AT - TODO: Finden!
  STATUS_PARRY: 'system.status.parry.value',     // PA - TODO: Verifizieren!
  STATUS_DEFENSE: 'system.status.defense.value', // Alternative?

  // Bereits vorhanden:
  STATUS_WOUNDS_MAX: 'system.status.wounds.max',  // LeP ✅
  STATUS_ARMOR: 'system.status.armour.value',     // RS ✅
  STATUS_SIZE: 'system.status.size.value',        // Größe ✅
};
```

---

## 🚧 Offene Fragen

1. **EP Field Path:** Wo genau sind EP-Werte gespeichert?
   - `system.details.ep`?
   - `system.ep`?
   - `system.experienceReward`?
   - **Bitte verifizieren mit echtem DSA5 Foundry Actor!**

2. **AT Field Path:** Wo ist der Attacke-Wert?
   - `system.status.attack.value`?
   - `system.combat.attack`?
   - In Items (Waffen)?

3. **PA Field Path:** Parade-Wert Location?
   - `system.status.parry.value`?
   - `system.status.defense.value` (aktuell als meleeDefense)?

4. **Sonderfertigkeiten:** Wie sind diese strukturiert?
   - Als Items?
   - Als Array in `system.abilities`?
   - Als Flags?

5. **CR-Formel:** Ist die vorgeschlagene Formel sinnvoll?
   - Baseline korrekt (Mensch 1200 AP = CR 1/4)?
   - Gewichtung von LeP/AT/PA/RS korrekt?

---

## 🎯 Nächste Schritte

### Phase 1: Validierung (JETZT)
1. ✅ User-Feedback zu Field Paths einholen
2. ⏳ Feuerdrache-Beispiel analysieren (User-Link)
3. ⏳ CR-Formel mit User validieren
4. ⏳ Baseline (Mensch 1200 AP) bestätigen

### Phase 2: Implementation
1. ⏳ Field Paths in constants.ts hinzufügen
2. ⏳ CR-Berechnungsfunktion erstellen
3. ⏳ index-builder.ts korrigieren (EP statt AP)
4. ⏳ adapter.ts: getPowerLevel() auf CR umstellen

### Phase 3: Testing
1. ⏳ Mit Beispiel-Kreaturen testen
2. ⏳ CR-Werte mit echten Foundry-Daten validieren
3. ⏳ Filter-System auf CR umstellen

---

## 📚 Referenzen

- **User-Hinweis:** "LeP + AT + PA + RS im Vergleich zum Menschen mit AP Level 1200"
- **Feuerdrache:** https://dsa.ulisses-regelwiki.de/Best_Drache-Feuer.html
- **DSA5 Regelwiki:** https://dsa.ulisses-regelwiki.de/Heldenerschaffung.html
- **DSA5 Foundry System:** https://github.com/Plushtoast/dsa5-foundryVTT

---

**WICHTIG:** Dieses Design muss mit echten Foundry DSA5 Daten validiert werden!
**TODO:** User um Feedback zu Field Paths und CR-Formel bitten.
