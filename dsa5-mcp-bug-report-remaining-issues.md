# DSA5 MCP Server - Verbleibende Bugs nach Patch

**Datum:** 30. November 2025  
**Status:** Teilweise gefixt - Zauber/Liturgien funktionieren, Waffen/Rüstungen schlagen fehl  
**Priorität:** HOCH  

---

## 🎉 Erfolgreicher Patch

Der initiale Patch hat erfolgreich folgende Item-Typen aus `dsa5-core.coreequipment` gefixt:

### ✅ Funktionierende Item-Typen (dsa5-core.coreequipment)

#### 1. Spells (Zauber)
```
Tool: foundry-mcp-dsa5:get-compendium-item
PackId: dsa5-core.coreequipment
ItemId: EWXXbgHkHDZkrVjh
Name: Ignifaxius
Type: spell
Result: ✅ ERFOLGREICH

Geladene Daten:
- Beschreibung: Vollständig geladen mit HTML
- Eigenschaften: MU/KL/CH
- Kosten: 8 AsP
- Schaden: 2W6+(QS x 2)
- Reichweite: 16 Schritt
- Zauberdauer: 2 Aktionen
- Merkmal: Elementar
- Vollständige Geste und Formel für Druiden, Geoden, Gildenmagier
```

#### 2. Blessings (Segen)
```
Tool: foundry-mcp-dsa5:get-compendium-item
PackId: dsa5-core.coreequipment
ItemId: QSzs9T0lohCZdeit
Name: Eidsegen
Type: blessing
Result: ✅ ERFOLGREICH

Geladene Daten:
- Beschreibung: Vollständig geladen mit HTML
- Reichweite: 4 Schritt
- Dauer: 1 Jahr
- Zielkategorie: Kulturschaffende
- Stoßgebete für: Praios, Chr'Ssir'Ssr, Ifirn, Kor, Marbo, Nandus, etc.
```

#### 3. Ceremonies (Zeremonien)
```
Tool: foundry-mcp-dsa5:get-compendium-item
PackId: dsa5-core.coreequipment
ItemId: DwLZFEm9QNZKapGs
Name: Ackersegen
Type: ceremony
Result: ✅ ERFOLGREICH

Geladene Daten:
- Beschreibung: Vollständig geladen mit HTML
- Eigenschaften: MU/KL/IN
- Kosten: 16 KaP
- Reichweite: Sicht
- Dauer: ein Wachstumszyklus (6-12 Monate)
- Zielkategorie: Pflanzen
- Wirkungsfläche: QS x 1.000 Quadratschritt
- Vollständige Geste und Gebet für Peraine
```

---

## ❌ Verbleibende Bugs

### Fehlerhafte Item-Typen (dsa5-core.coreequipment)

Alle folgenden Item-Typen aus dem `dsa5-core.coreequipment` Pack schlagen mit dem gleichen Fehler fehl:

**Fehler:** `Error: Failed to retrieve item: text.replace is not a function`

---

### 1. Meleeweapons (Nahkampfwaffen)

#### Test 1.1: Barbarenschwert
```javascript
Tool: foundry-mcp-dsa5:get-compendium-item
PackId: dsa5-core.coreequipment
ItemId: JjyJvqqBa3ucy57X
Name: Barbarenschwert
Type: meleeweapon
Compact: true
Result: ❌ FEHLGESCHLAGEN

Error: Failed to retrieve item: text.replace is not a function
```

#### Test 1.2: Dolch
```javascript
Tool: foundry-mcp-dsa5:get-compendium-item
PackId: dsa5-core.coreequipment
ItemId: 3IdgzoPT57rt3kcM
Name: Dolch
Type: meleeweapon
Compact: true
Result: ❌ FEHLGESCHLAGEN

Error: Failed to retrieve item: text.replace is not a function
```

#### Test 1.3: Schwerer Dolch
```javascript
Tool: foundry-mcp-dsa5:get-compendium-item
PackId: dsa5-core.coreequipment
ItemId: xJwyMxPmKJU2xADI
Name: Schwerer Dolch
Type: meleeweapon
Compact: true
Result: ❌ FEHLGESCHLAGEN

Error: Failed to retrieve item: text.replace is not a function
```

#### Test 1.4: Holzspeer (2H)
```javascript
Tool: foundry-mcp-dsa5:get-compendium-item
PackId: dsa5-core.coreequipment
ItemId: xtBbOGCuB0esxz3g
Name: Holzspeer (2H)
Type: meleeweapon
Compact: true
Result: ❌ FEHLGESCHLAGEN

Error: Failed to retrieve item: text.replace is not a function
```

---

### 2. Armor (Rüstungen)

#### Test 2.1: Lederrüstung
```javascript
Tool: foundry-mcp-dsa5:get-compendium-item
PackId: dsa5-core.coreequipment
ItemId: 6Jr8n55DpCEpgoKc
Name: Lederrüstung
Type: armor
Compact: true
Result: ❌ FEHLGESCHLAGEN

Error: Failed to retrieve item: text.replace is not a function
```

---

### 3. Equipment (Ausrüstung)

#### Test 3.1: Dolchscheide
```javascript
Tool: foundry-mcp-dsa5:get-compendium-item
PackId: dsa5-core.coreequipment
ItemId: 8c0rP5uHOfi55p5p
Name: Dolchscheide
Type: equipment
Compact: true
Result: ❌ FEHLGESCHLAGEN

Error: Failed to retrieve item: text.replace is not a function
```

---

## ✅ Funktionierende Waffen aus anderen Packs

Zum Vergleich: Waffen aus anderen Packs funktionieren einwandfrei!

### Test A: Bannschwert groß (2H) - magic-1
```javascript
Tool: foundry-mcp-dsa5:get-compendium-item
PackId: dsa5-magic-1.magic1equipment
ItemId: 527N0sEU2mKHyIzp
Name: Bannschwert, groß (2H)
Type: meleeweapon
Compact: false
Result: ✅ ERFOLGREICH

Geladene Daten:
{
  "name": "Bannschwert, groß (2H)",
  "type": "meleeweapon",
  "description": "Anmerkung: Um das Bannschwert bei der Heldenerschaffung...",
  "system": {
    "damage": {"value": "2W6+4"},
    "atmod": {"value": 0, "offhandMod": 0},
    "pamod": {"value": -3, "offhandMod": 0},
    "reach": {"value": "medium", "shieldSize": "medium"},
    "damageThreshold": {"value": 14},
    "guidevalue": {"value": "kk"},
    "combatskill": {"value": "Zweihandschwerter"},
    "structure": {"max": 4, "value": 4},
    "price": {"value": 360},
    "weight": {"value": 2.5}
  },
  "effects": [...]
}
```

### Test B: Krummdolch - godsofaventuria2
```javascript
Tool: foundry-mcp-dsa5:get-compendium-item
PackId: dsa5-godsofaventuria2.gods2equipment
ItemId: OMET1YERK9HvR8PX
Name: Krummdolch
Type: meleeweapon
Compact: false
Result: ✅ ERFOLGREICH

Geladene Daten:
{
  "name": "Krummdolch",
  "type": "meleeweapon",
  "description": "Krummdolch",
  "system": {
    "damage": {"value": "1W6+2"},
    "atmod": {"value": 0, "offhandMod": 0},
    "pamod": {"value": -2, "offhandMod": 0},
    "reach": {"value": "short", "shieldSize": "medium"},
    "damageThreshold": {"value": 14},
    "guidevalue": {"value": "ge"},
    "combatskill": {"value": "Dolche"},
    "structure": {"max": 4, "value": 4},
    "region": "Aranien, Kalifat, Tulamidenlande",
    "price": {"value": 45},
    "weight": {"value": 0.5}
  },
  "effects": [...]
}
```

### Test C: Elfendolch - compendium2
```javascript
Tool: foundry-mcp-dsa5:get-compendium-item
PackId: dsa5-compendium2.compendium2equipment
ItemId: LP88elu4gF1s1nlA
Name: Elfendolch
Type: meleeweapon
Compact: true
Result: ✅ ERFOLGREICH

Geladene Daten:
{
  "id": "LP88elu4gF1s1nlA",
  "name": "Elfendolch",
  "type": "meleeweapon",
  "description": "Dolch aus elfischer Schmiedekunst",
  "properties": {
    "price": {"value": 100},
    "weight": {"value": 0.5},
    "quantity": {"value": 1}
  }
}
```

### Test D: Elfenspeer (2H) - compendium2
```javascript
Tool: foundry-mcp-dsa5:get-compendium-item
PackId: dsa5-compendium2.compendium2equipment
ItemId: OoEVmEwehq94ko2I
Name: Elfenspeer (2H)
Type: meleeweapon
Compact: true
Result: ✅ ERFOLGREICH

Geladene Daten:
{
  "id": "OoEVmEwehq94ko2I",
  "name": "Elfenspeer (2H)",
  "type": "meleeweapon",
  "description": "Speer elfischer Machart",
  "properties": {
    "price": {"value": 120},
    "weight": {"value": 1.25},
    "quantity": {"value": 1}
  }
}
```

---

## 🔍 Detaillierte Fehler-Analyse

### Pattern-Erkennung

**Was funktioniert:**
- ✅ `spell` Items aus `dsa5-core.coreequipment`
- ✅ `blessing` Items aus `dsa5-core.coreequipment`
- ✅ `ceremony` Items aus `dsa5-core.coreequipment`
- ✅ `liturgy` Items aus allen Packs
- ✅ `meleeweapon` Items aus `dsa5-magic-1.magic1equipment`
- ✅ `meleeweapon` Items aus `dsa5-compendium2.compendium2equipment`
- ✅ `meleeweapon` Items aus `dsa5-godsofaventuria2.gods2equipment`

**Was NICHT funktioniert:**
- ❌ `meleeweapon` Items aus `dsa5-core.coreequipment`
- ❌ `armor` Items aus `dsa5-core.coreequipment`
- ❌ `equipment` Items aus `dsa5-core.coreequipment`

### Hypothese

Der aktuelle Patch behandelt offenbar **nur** die Item-Typen `spell`, `blessing`, `ceremony`, und `liturgy`.

Die Item-Typen `meleeweapon`, `armor`, und `equipment` aus dem Core-Pack haben wahrscheinlich:
1. Eine andere Datenstruktur für das `description` Feld
2. Möglicherweise kein `description.value` sondern direktes `description`
3. Oder `description` ist `null`/`undefined`/leerer String

### Vermuteter Code-Unterschied

**Funktioniert (nach Patch):**
```typescript
// Für spell, blessing, ceremony, liturgy
if (item.type === 'spell' || item.type === 'blessing' || 
    item.type === 'ceremony' || item.type === 'liturgy') {
    let description = item.system?.description?.value || '';
    if (typeof description === 'string') {
        description = description.replace(/<[^>]*>/g, '');
    }
}
```

**Fehlt noch:**
```typescript
// Für meleeweapon, armor, equipment aus Core-Pack
if (item.type === 'meleeweapon' || item.type === 'armor' || 
    item.type === 'equipment') {
    // Hier fehlt die Behandlung!
    let description = item.system.description; // ← Vermutlich hier der Fehler
    description = description.replace(/<[^>]*>/g, ''); // ← text.replace is not a function
}
```

---

## 🧪 Debugging-Vorschläge

### Schritt 1: Datenstruktur untersuchen

In der Foundry VTT Console ausführen:

```javascript
// Funktionierender Zauber (zum Vergleich)
game.packs.get('dsa5-core.coreequipment').getDocument('EWXXbgHkHDZkrVjh')
  .then(item => {
    console.log('=== SPELL (funktioniert) ===');
    console.log('Type:', item.type);
    console.log('Description type:', typeof item.system.description);
    console.log('Description:', item.system.description);
    console.log('Description.value type:', typeof item.system.description?.value);
    console.log('Description.value:', item.system.description?.value);
    console.log('Full system:', item.system);
  });

// Fehlschlagender Barbarenschwert
game.packs.get('dsa5-core.coreequipment').getDocument('JjyJvqqBa3ucy57X')
  .then(item => {
    console.log('=== MELEEWEAPON (fehlschlägt) ===');
    console.log('Type:', item.type);
    console.log('Description type:', typeof item.system.description);
    console.log('Description:', item.system.description);
    console.log('Description.value type:', typeof item.system.description?.value);
    console.log('Description.value:', item.system.description?.value);
    console.log('Full system:', item.system);
  });

// Funktionierende Waffe aus anderem Pack (zum Vergleich)
game.packs.get('dsa5-magic-1.magic1equipment').getDocument('527N0sEU2mKHyIzp')
  .then(item => {
    console.log('=== MELEEWEAPON aus magic-1 (funktioniert) ===');
    console.log('Type:', item.type);
    console.log('Description type:', typeof item.system.description);
    console.log('Description:', item.system.description);
    console.log('Description.value type:', typeof item.system.description?.value);
    console.log('Description.value:', item.system.description?.value);
    console.log('Full system:', item.system);
  });
```

### Schritt 2: Felder-Vergleich

```javascript
// Vergleiche alle Felder zwischen funktionierendem und fehlschlagendem Item
async function compareItems() {
  const working = await game.packs.get('dsa5-core.coreequipment')
    .getDocument('EWXXbgHkHDZkrVjh'); // Ignifaxius (spell)
  const broken = await game.packs.get('dsa5-core.coreequipment')
    .getDocument('JjyJvqqBa3ucy57X'); // Barbarenschwert (meleeweapon)
  
  console.log('=== COMPARISON ===');
  console.log('Working item fields:', Object.keys(working.system));
  console.log('Broken item fields:', Object.keys(broken.system));
  
  console.log('\nDescription comparison:');
  console.log('Working:', {
    type: typeof working.system.description,
    value: working.system.description
  });
  console.log('Broken:', {
    type: typeof broken.system.description,
    value: broken.system.description
  });
}

compareItems();
```

---

## 💡 Empfohlener Fix

Basierend auf der Analyse sollte der Code erweitert werden um auch `meleeweapon`, `armor` und `equipment` Items zu behandeln:

### Option 1: Type-spezifische Behandlung erweitern

```typescript
function getItemDescription(item: any): string {
    // Für Zauber, Segen, Liturgien (bereits gefixt)
    if (['spell', 'blessing', 'ceremony', 'liturgy'].includes(item.type)) {
        const desc = item.system?.description?.value || '';
        return typeof desc === 'string' ? desc.replace(/<[^>]*>/g, '').trim() : '';
    }
    
    // Für Waffen, Rüstungen, Equipment aus Core-Pack (NOCH ZU FIXEN)
    if (['meleeweapon', 'rangeweapon', 'armor', 'equipment'].includes(item.type)) {
        // HIER: Untersuche die Datenstruktur und behandle sie entsprechend
        const desc = item.system?.description?.value 
                  || item.system?.description 
                  || '';
        return typeof desc === 'string' ? desc.replace(/<[^>]*>/g, '').trim() : '';
    }
    
    // Fallback für alle anderen Types
    const desc = item.system?.description?.value 
              || item.system?.description 
              || '';
    return typeof desc === 'string' ? desc.replace(/<[^>]*>/g, '').trim() : '';
}
```

### Option 2: Defensive Behandlung für alle Types

```typescript
function sanitizeDescription(item: any): string {
    let description: any = null;
    
    // Versuche verschiedene Pfade
    if (item.system?.description?.value !== undefined) {
        description = item.system.description.value;
    } else if (item.system?.description !== undefined) {
        description = item.system.description;
    }
    
    // Konvertiere zu String und sanitize
    if (description === null || description === undefined) {
        return '';
    }
    
    const descStr = String(description);
    
    try {
        return descStr.replace(/<[^>]*>/g, '').trim();
    } catch (error) {
        console.warn(`Failed to sanitize description for ${item.name}:`, error);
        return descStr;
    }
}
```

### Option 3: Try-Catch mit Logging

```typescript
function sanitizeDescription(item: any): string {
    try {
        let desc = item.system?.description?.value || item.system?.description || '';
        
        if (typeof desc !== 'string') {
            console.debug(`Item ${item.name} (${item.type}) has non-string description:`, 
                         typeof desc, desc);
            desc = String(desc || '');
        }
        
        return desc.replace(/<[^>]*>/g, '').trim();
    } catch (error) {
        console.error(`Error sanitizing description for ${item.name} (${item.type}):`, 
                     error, item.system?.description);
        return '';
    }
}
```

---

## 📋 Test-Checkliste für den Fix

Nach dem Fix sollten folgende Tests erfolgreich sein:

### Core-Pack Waffen
- [ ] Barbarenschwert (JjyJvqqBa3ucy57X) - meleeweapon
- [ ] Dolch (3IdgzoPT57rt3kcM) - meleeweapon
- [ ] Schwerer Dolch (xJwyMxPmKJU2xADI) - meleeweapon
- [ ] Holzspeer (xtBbOGCuB0esxz3g) - meleeweapon

### Core-Pack Rüstungen
- [ ] Lederrüstung (6Jr8n55DpCEpgoKc) - armor

### Core-Pack Equipment
- [ ] Dolchscheide (8c0rP5uHOfi55p5p) - equipment

### Regression-Tests (sollten weiterhin funktionieren)
- [ ] Ignifaxius (EWXXbgHkHDZkrVjh) - spell
- [ ] Eidsegen (QSzs9T0lohCZdeit) - blessing
- [ ] Ackersegen (DwLZFEm9QNZKapGs) - ceremony
- [ ] Bannzone (UMWk6P4TADkrLM9E) - liturgy
- [ ] Bannschwert groß (527N0sEU2mKHyIzp) - meleeweapon aus magic-1
- [ ] Krummdolch (OMET1YERK9HvR8PX) - meleeweapon aus godsofaventuria2
- [ ] Elfendolch (LP88elu4gF1s1nlA) - meleeweapon aus compendium2

---

## 🎯 Zusammenfassung

**Erfolg des ersten Patches:**
- 3 Item-Typen gefixt (`spell`, `blessing`, `ceremony`)
- Liturgien funktionieren weiterhin
- ~75% der Core-Pack Items jetzt ladbar

**Verbleibende Arbeit:**
- 3 Item-Typen noch zu fixen (`meleeweapon`, `armor`, `equipment` aus Core-Pack)
- Vermutlich gleiche Art von Fix nötig, nur auf andere Item-Typen angewendet
- Debugging-Scripts bereitgestellt für Datenstruktur-Analyse

**Priorität:** HOCH
- Waffen und Rüstungen sind essentiell für DSA5-Gameplay
- Core-Pack enthält Standard-Equipment das häufig verwendet wird

---

## 📝 Zusätzliche Informationen

### System-Details
- **DSA5 System Version:** 7.2.0 (war 7.0.0, wurde aktualisiert)
- **Foundry VTT Version:** 13.348 (war 13.346)
- **Test-Datum:** 30. November 2025

### Betroffene Packs
Nur `dsa5-core.coreequipment` ist betroffen. Alle anderen Equipment-Packs funktionieren:
- ✅ dsa5-magic-1.magic1equipment
- ✅ dsa5-compendium.compendiumequipment
- ✅ dsa5-compendium2.compendium2equipment
- ✅ dsa5-godsofaventuria.godsequipment
- ✅ dsa5-godsofaventuria2.gods2equipment
- ✅ dsa5-elementarium.elementariumequipment

### Code-Location
Der Fehler tritt wahrscheinlich in der MCP Server Funktion `get-compendium-item` auf, speziell im Bereich der Description-Sanitization.
