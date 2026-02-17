# DSA5 NPC Import Prompt für Cline

Kopiere dieses Prompt in Cline, um DSA5-NPCs korrekt zu erstellen.

---

## 📋 Vollständiger Import-Workflow für DSA5-NPCs

### SCHRITT 1: Verfügbare Professionen analysieren
-----------------------------------------------

Führe nacheinander aus, um alle verfügbaren Archetypen zu finden:

```
list-dsa5-archetypes(filterByProfession: "bauer")
list-dsa5-archetypes(filterByProfession: "krieger")
list-dsa5-archetypes(filterByProfession: "magier")
list-dsa5-archetypes(filterByProfession: "hexe")
list-dsa5-archetypes(filterByProfession: "bürger")
list-dsa5-archetypes(filterByProfession: "kampf")
list-dsa5-archetypes(filterByProfession: "wache")
```

**ODER alle auf einmal auflisten:**
```
list-dsa5-archetypes()
```

**WICHTIGE ANALYSE:**
Für jeden gefundene Archetyp notiere:
- `name` – Name des Archetyps (z.B. "Finwaen", "Celissa")
- `packId` – Compendium-Pack-ID (z.B. "dsa5-core.corecharacters")
- `id` – Archetyp-ID innerhalb des Packs
- `profession` – Welche Profession hat der Archetyp?
- `species` – Welche Spezies (Mensch, Elf, etc.)?

Schreibe eine Zusammenfassung:
- "Für Bauern geeignet: [Archetyp-Name]"
- "Für Krieger geeignet: [Archetyp-Name]"
- "Für Magier geeignet: [Archetyp-Name]"
etc.


### SCHRITT 2: NPCs mit passenden Archetypen erstellen
-------------------------------------------------

Erstelle jetzt jeden NPC mit einem **ANDEREN, passenden Archetyp**!

**1. ELIDAN (Bauer, 32 Jahre, männlich)**
```
create-dsa5-character-from-archetype(
  archetypePackId: "<BAUER Pack ID aus Schritt 1>",
  archetypeId: "<BAUER Archetyp ID>",
  characterName: "Elidan",
  customization: {
    age: 32,
    biography: "Ein bodenständiger, ehrlicher Bauer mit starkem Familiensinn. Sein Hof an der nostrischen Küste ist von einem alten Fluch bedroht, und er kämpft um das Überleben seiner Familie.",
    gender: "male",
    culture: "Nostria"
  }
)
```

**2. ALSILIO (Kind, 8 Jahre, männlich)**
```
create-dsa5-character-from-archetype(
  archetypePackId: "<BÜRGER/Kind Pack ID>",
  archetypeId: "<BÜRGER/Kind Archetyp ID>",
  characterName: "Alsilio",
  customization: {
    age: 8,
    biography: "Der junge Sohn des Bauern Elidan. Abenteuerlustig und etwas ungestüm, träumt er davon, im Watt verborgene Schätze zu finden.",
    gender: "male"
  }
)
```

**3. KARLITHA (Hexe, 45 Jahre, weiblich)**
```
create-dsa5-character-from-archetype(
  archetypePackId: "<MAGIER/HEXE Pack ID>",
  archetypeId: "<MAGIER/HEXE Archetyp ID>",
  characterName: "Karlitha",
  customization: {
    age: 45,
    biography: "Zurückgezogen lebende Hexe mit düsterem Ruf, aber großem Wissen über Flüche und Heilung. Will ein altes Unrecht wiedergutmachen, das Elidans Familie angetan wurde.",
    gender: "female",
    profession: "Hexe"
  }
)
```

**4. THORBOLD VAARNASON (Thorwaler-Krieger, 35 Jahre, männlich)**
```
create-dsa5-character-from-archetype(
  archetypePackId: "<KRIEGER Pack ID>",
  archetypeId: "<KRIEGER Archetyp ID>",
  characterName: "Thorbold Vaarnason",
  customization: {
    age: 35,
    biography: "Ein brutaler und entschlossener Thorwaler-Anführer, der durch Stärke und Furcht führt. Sucht Ruhm und Beute, um seine Stellung im eigenen Clan zu sichern. Hat Zweifel an seiner Mission, zeigt aber keine Schwäche.",
    gender: "male",
    culture: "Thorwal",
    profession: "Krieger"
  }
)
```

**5-8. VIER THORWALER-KRIEGER (Standard-Kämpfer)**
```
create-dsa5-character-from-archetype(
  archetypePackId: "<KRIEGER Pack ID>",
  archetypeId: "<KRIEGER Archetyp ID>",
  characterName: "Thorwaler Krieger 1",
  customization: {
    biography: "Ein Thorwaler-Krieger unter Thorbold Vaarnasons Kommando.",
    culture: "Thorwal"
  }
)
```

Wiederhole für "Thorwaler Krieger 2", "Thorwaler Krieger 3", "Thorwaler Krieger 4"

**9. VERFLUCHTER DEICHBAUER (Mutierter Bauer)**
```
create-dsa5-character-from-archetype(
  archetypePackId: "<BAUER Pack ID>",
  archetypeId: "<BAUER Archetyp ID>",
  characterName: "Verfluchter Deichbauer",
  customization: {
    biography: "Ein ehemaliger Bauer und Nachbar Elidans, der von einem alten Fluch in eine monsterhafte Kreatur verwandelt wurde. Nun greift er nachts den Hof an."
  }
)
```


### KRITISCHE REGELN – NICHT IGNOREN!
-----------------------------

✅ **JEDER NPC-Typ bekommt einen ANDEREN Archetyp!**
   - Bauer ≠ Krieger ≠ Magier
   - Thorwaler brauchen KRIEGER-Archetyp, KEINEN Bauer!

✅ **Suche nach PROFESSION, nicht nach Namen!**
   - `filterByProfession: "bauer"` findet alle Bauern-Archetypen
   - `filterByProfession: "krieger"` findet alle Krieger-Archetypen
   - Das Tool nutzt TEILSTRING-MATCHING! (findet "Bauer", "Hofbauer", "Landwirt/Bauer")

✅ **Wenn kein passender Archetyp existiert:**
   - Sag mir welche verfügbar sind
   - Nutze den ähnlichsten (z.B. "Bürger" für "Bauer")
   - Erkläre warum du diesen gewählt hast

✅ **Analysiere erst, dann erstelle!**
   - Schritt 1: Auflisten und analysieren
   - Schritt 2: Mit den gefundenen IDs erstellen
   - Nicht überspringen!


### SCHRITT 3: Ergebnis prüfen
----------------------------

Zeige alle erstellten NPCs:
```
list-characters()
```

Überprüfe:
- ✅ Jeder NPC hat einen EINDEUTIGEN Namen
- ✅ Thorwaler haben KRIEGER-Archetyp
- ✅ Elidan hat BAUER-Archetyp
- ✅ Karlitha hat MAGIER/HEXEN-Archetyp


### DSA5-BESONDERHEITEN
-----------------------

**Professionen statt Klassen:**
- DSA5 hat keine Klassen (wie D&D5e)
- Stattdessen: Professionen (Bauer, Krieger, Magier, etc.)
- Das Tool sucht in `system.details.career.value`

**Teilstring-Matching:**
- `filterByProfession: "bauer"` findet:
  - ✅ "Bauer"
  - ✅ "Hofbauer"
  - ✅ "Landwirt/Bauer"
  - ✅ "Bauer, Teilzeit"

**Erfahrungsgrade statt Levels:**
- DSA5 hat Erfahrungsgrade 1-7 (Unerfahren bis Legendär)
- Werden aus Abenteuerpunkten (AP) berechnet
- Level 1 = 0-900 AP, Level 2 = 901-1800 AP, etc.

**Eigenschaften statt Attribute:**
- DSA5 hat 8 Eigenschaften: MU, KL, IN, CH, FF, GE, KO, KK
- Nicht STR, DEX, CON, INT, WIS, CHA wie D&D5e

**LeP/AsP/KaP statt HP/MP:**
- LeP (Lebensenergie) statt HP
- AsP (Astralenergie) für Magier
- KaP (Karmaenergie) für Geweihte
