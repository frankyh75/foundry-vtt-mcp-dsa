# DSA5 MCP Server Test Report

**Datum:** 30. November 2025  
**Tester:** Frank  
**MCP Server:** foundry-mcp-dsa5  
**Foundry VTT System:** DSA5 v7.0.0  

---

## 📊 Zusammenfassung

Der MCP Server funktioniert grundsätzlich gut für DSA5, zeigt aber einen kritischen Bug beim Laden von Items aus bestimmten Compendium-Packs.

### Status
- ✅ Character-Daten laden: **Funktioniert**
- ✅ Compendium-Suche: **Funktioniert**
- ✅ Liturgien laden: **Funktioniert**
- ⚠️ Items laden: **Teilweise fehlerhaft**

---

## ✅ Erfolgreiche Tests

### 1. Compendium-Packs auflisten
```
Tool: foundry-mcp-dsa5:list-compendium-packs
Result: 77 Packs gefunden
- dsa5-core.coreequipment
- dsa5-compendium.compendiumequipment
- dsa5-magic-1.magic1equipment
- dsa5-godsofaventuria2.gods2equipment
- ... und viele mehr
```

### 2. Character "Ragnarr" laden
```
Tool: foundry-mcp-dsa5:get-character
Identifier: Ragnarr
Result: ✅ Erfolgreich

Character-Details:
- ID: 7qFD3E8YLMuavvqW
- Typ: Schamane
- Items: 19 Items geladen
  - Liturgien: Bannzone, Magiesicht, Eisbärenruf, Befehl des Schamanen, Hauch des Elements
  - Zeremonien: Rat der Ahnen, Diener der Kälte, Diener der Flammen, Diener des Erzes, Geistersprache
  - Nachteile: Unfähig (Verkleiden), Prinzipientreue (Stammesregeln), Verpflichtungen (Stamm)
  - Geld: Kreuzer, Heller, Silber, Dukaten
```

### 3. Liturgie "Bannzone" laden (Detail)
```
Tool: foundry-mcp-dsa5:get-compendium-item
PackId: dsa5-godsofaventuria2.gods2equipment
ItemId: UMWk6P4TADkrLM9E
Result: ✅ Erfolgreich

Details:
- Typ: liturgy
- Eigenschaften: MU/IN/CH
- Kosten: 4 KaP + 2 KaP pro 5 KR (aufrechterhaltend)
- Reichweite: 4 Schritt Radius
- Wirkung: Schutz vor unheiligen Wesen (Untote, Geister)
- Zauberdauer: 4 Aktionen
- Vollständige Beschreibung mit Geste und Gebet vorhanden
```

### 4. Waffen-Suche
```
Tool: foundry-mcp-dsa5:search-compendium
Query: Schwert
Result: ✅ 45 Treffer gefunden
Beispiele:
- Barbarenschwert (dsa5-core.coreequipment)
- Bannschwert groß/mittel/klein (dsa5-magic-1.magic1equipment)
```

### 5. Bannschwert groß laden (2H)
```
Tool: foundry-mcp-dsa5:get-compendium-item
PackId: dsa5-magic-1.magic1equipment
ItemId: 527N0sEU2mKHyIzp
Result: ✅ Erfolgreich

Details:
- Typ: meleeweapon
- Schaden: 2W6+4
- AT-Mod: 0, PA-Mod: -3
- Reichweite: medium
- Kampftechnik: Zweihandschwerter
- Preis: 360 Silber
- Gewicht: 2,5 Stein
- Struktur: 4/4
```

### 6. Krummdolch laden
```
Tool: foundry-mcp-dsa5:get-compendium-item
PackId: dsa5-godsofaventuria2.gods2equipment
ItemId: OMET1YERK9HvR8PX
Result: ✅ Erfolgreich

Details:
- Typ: meleeweapon
- Schaden: 1W6+2
- AT-Mod: 0, PA-Mod: -2
- Reichweite: short
- Kampftechnik: Dolche
- Leiteigenschaft: GE
- Spezial: Alternative Attacke "Stich" (1d6+4, AT-1, PA-4)
- Effects: RS-Reduktion bei leichten Rüstungen
```

### 7. Elfendolch laden
```
Tool: foundry-mcp-dsa5:get-compendium-item
PackId: dsa5-compendium2.compendium2equipment
ItemId: LP88elu4gF1s1nlA
Result: ✅ Erfolgreich (compact mode)

Details:
- Typ: meleeweapon
- Beschreibung: "Dolch aus elfischer Schmiedekunst"
- Preis: 100 Silber
- Gewicht: 0,5 Stein
```

---

## ❌ Bug: `text.replace is not a function`

### Fehlerhafte Packs

Alle Items aus folgenden Packs schlagen beim Laden fehl:

#### dsa5-core.coreequipment
```
❌ Barbarenschwert (JjyJvqqBa3ucy57X)
❌ Dolch (3IdgzoPT57rt3kcM)
❌ Schwerer Dolch (xJwyMxPmKJU2xADI)
❌ Dolchscheide (8c0rP5uHOfi55p5p) - equipment
❌ Lederrüstung (6Jr8n55DpCEpgoKc) - armor

Error: Failed to retrieve item: text.replace is not a function
```

#### dsa5.skills
```
❌ Dolche (s2Zd7MyrIcmPeaPX) - combatskill

Error: Failed to retrieve item: text.replace is not a function
```

### Funktionierende Packs

Diese Packs funktionieren einwandfrei:

```
✅ dsa5-magic-1.magic1equipment
✅ dsa5-compendium2.compendium2equipment
✅ dsa5-godsofaventuria.godsequipment
✅ dsa5-godsofaventuria2.gods2equipment
```

---

## 🔍 Bug-Analyse

### Fehler-Pattern
- **Fehler tritt NUR bei bestimmten Packs auf** (hauptsächlich Core-Packs)
- **Alle Item-Typen betroffen** in fehlerhaften Packs (meleeweapon, armor, equipment, combatskill)
- **Sowohl compact als auch full mode** schlagen fehl

### Wahrscheinliche Ursache

Der Fehler `text.replace is not a function` deutet darauf hin, dass der Code versucht, `.replace()` auf einem Wert aufzurufen, der kein String ist.

**Hypothese:** Die Core-Packs haben eine andere Datenstruktur für das `description`-Feld:

```typescript
// Funktionierende Packs (magic-1, compendium2, gods):
item.system.description.value = "<p>HTML String</p>"

// Fehlerhafte Packs (core, skills):
item.system.description = null
// oder
item.system.description = undefined
// oder
item.system.description = { value: null }
// oder ein anderes Format
```

### Vermuteter Code-Location

Im MCP Server, wahrscheinlich in der Funktion `get-compendium-item`, gibt es Code wie:

```typescript
// Aktuell (fehlerhaft):
let description = item.system.description;
description = description.replace(/<[^>]*>/g, ''); // ❌ Schlägt fehl wenn description kein String

// Sollte sein:
let description = item.system?.description?.value || item.system?.description || '';
if (typeof description === 'string') {
    description = description.replace(/<[^>]*>/g, '');
}
```

---

## 💡 Empfohlener Fix

### Option 1: Defensive String-Konvertierung
```typescript
function sanitizeDescription(item: any): string {
    const desc = item.system?.description?.value 
                || item.system?.description 
                || '';
    
    if (typeof desc === 'string') {
        return desc.replace(/<[^>]*>/g, '').trim();
    }
    
    return '';
}
```

### Option 2: Type Guard
```typescript
function isString(value: any): value is string {
    return typeof value === 'string';
}

let description = item.system?.description?.value || item.system?.description;
if (isString(description)) {
    description = description.replace(/<[^>]*>/g, '');
} else {
    description = '';
}
```

### Option 3: Try-Catch (Fallback)
```typescript
try {
    description = description.replace(/<[^>]*>/g, '');
} catch (error) {
    console.warn(`Failed to sanitize description for ${item.name}:`, error);
    description = '';
}
```

---

## 🧪 Weitere Tests empfohlen

1. **Untersuche die rohen Daten** eines Items aus `dsa5-core.coreequipment`:
   ```typescript
   const pack = game.packs.get('dsa5-core.coreequipment');
   const item = await pack.getDocument('JjyJvqqBa3ucy57X');
   console.log('Description type:', typeof item.system.description);
   console.log('Description value:', item.system.description);
   ```

2. **Vergleiche mit funktionierenden Packs**:
   ```typescript
   const workingPack = game.packs.get('dsa5-magic-1.magic1equipment');
   const workingItem = await workingPack.getDocument('527N0sEU2mKHyIzp');
   console.log('Working description:', workingItem.system.description);
   ```

3. **Teste andere Core-Pack Items**:
   - Spell aus `dsa5-core`
   - Journal Entry aus `dsa5-core`

---

## 📋 Test-Kommandos für Reproduktion

```javascript
// In Foundry VTT Console:

// ❌ Fehlschlag:
game.packs.get('dsa5-core.coreequipment').getDocument('JjyJvqqBa3ucy57X')
  .then(i => console.log(typeof i.system.description));

// ✅ Erfolg:
game.packs.get('dsa5-magic-1.magic1equipment').getDocument('527N0sEU2mKHyIzp')
  .then(i => console.log(typeof i.system.description));
```

---

## 🎯 Priorität

**HOCH** - Der Bug verhindert das Laden von Standard-Equipment aus dem Core-Regelwerk, was ein essentieller Bestandteil des Systems ist.

---

## 📝 Notizen

- DSA5 System Version: 7.0.0
- Foundry VTT Version: 13.346
- Alle Tests durchgeführt am 30.11.2025
- Character-Daten und Liturgien aus Addon-Packs funktionieren einwandfrei
- Bug scheint auf Item-Beschreibungs-Verarbeitung begrenzt zu sein
