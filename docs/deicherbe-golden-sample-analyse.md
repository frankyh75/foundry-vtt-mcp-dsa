# Deicherbe — Golden Sample Analyse (Jarvis)

**Datum:** 2026-05-09
**Quellen:** `Deicherbe1.pdf` (25MB, 7 Seiten) + `Deicherbe-2.pdf` (76MB, ~16 Seiten) → `Deicherbe-complete.pdf` (102MB, 23 Seiten)
**Methodik:** Marker-IR-Analyse, Playwright-Screenshots, pdftotext-Extraktion, Projekt-Wissen

---

## Zusammenfassung

Das Abenteuer "Deicherbe" (Heldenwerk-Archiv) ist ein **Kurzabenteuer** für DSA5. Es folgt dem klassischen Ulisses-Layout.

**Kritische Erkenntnis:** Die Marker-Pipeline erkennt **generische Layout-Strukturen** (heading, paragraph, illustration), aber **NICHT** die semantischen DSA5-Entitäten. Das ist der genaue Grund, warum die Review-Oberfläche existiert — der Benutzer muss die semantische Klassifikation korrigieren.

---

## Marker-IR-Befunde (DeicherbeComplete, 23 Seiten, 102MB)

| Metrik | Wert |
|--------|------|
| Dokument-ID | `doc:35477852c1ff8662` |
| Seiten | 23 |
| Blöcke | 411 |
| Block-Typen | paragraph: ~250, heading: ~120, unknown: ~30, illustration: ~10 |
| Entity Candidates | 310 (NPC: 185, Location: ~80, Scene: ~45) |
| Entity Stubs | 256 |

**Kritischer Bug:** Alle 310 Entity Candidates haben `name=""` und `page=None`. Die `extractLabel()`-Funktion in `heuristics_classification.ts` scheitert bei der Namensextraktion. Die OCR-Texte sind verstümmelt oder enthalten Sonderzeichen, die den Regex `extractProperName()` blockieren.

### Block-Verteilung pro Seite

| Seite | Blöcke | Inhalt |
|-------|--------|--------|
| 1 | 5 | Cover/Titel |
| 2 | 28 | Inhaltsverzeichnis, Abenteuer-Liste |
| 3 | 29 | Legende, Symbole, Spielhinweise |
| 4 | 11 | **"Heldenwerke in Aventurien 5"** — Aufbau-Übersicht |
| 5 | 12 | Autorennotizen zu Deicherbe |
| 6 | 21 | Hintergrund: Nostria, Freibauer Frengesfold |
| 7 | 15 | Abenteuerstart, Hooks |
| 8 | 19 | **Elidans Bitte** — NSC-Intro |
| 9 | 16 | **Elidans Kinder** — Perlmin, Ovine, Sapertyn, Tommelothtje, Alsilio |
| 10 | 23 | Der Hof, Keller, Falltür |
| 11 | 9 | Leiche im Keller |
| 12 | 19 | **Deichbauern-Statblock** — MU 12, KL 11, IN 12, CH 11, FF 14... |
| 13 | 23 | Der Fluch der Gabel |
| 14 | 17 | Küstenstraße, Segel |
| 15 | 24 | Praiostempel, Karlitta, Thorwaler |
| 16 | 36 | **Krakenmolch-Statblock** — MU 15, LeP 350, Fangarm: AT 13, TP 1W6+8 |
| 17 | 18 | **Orknase + Thorwalerschild** — AT 13, PA 4, TP 1W6+5 |
| 18 | 16 | **Elidans Heilung** |
| 19 | 11 | Epilog |
| 20 | 17 | Ausblick, Nachbarschaft |
| 21 | 14 | Follow-up: Roderyn + Ovine, Melcherbald |
| 22 | 5 | Deich-Schaden, Materialprobleme |
| 23 | 23 | Abenteuer-Ende, Credits |

### Auffälligkeiten in der IR

- **Seite 1 (nur 5 Blöcke):** Vermutlich Titelbild/Cover mit Illustration. Der paragraph-Block enthält OCR-Müll (`, rn hl . : | IR wnt Fi SE AN ER SS Si <= Cf « fF we Jas An`), was darauf hindeutet, dass die Titel-Illustration als Textblock missklassifiziert wurde.
- **heading-Überfluss:** ~120 headings auf 23 Seiten ist extrem viel. Viele "headings" sind vermutlich **Subtitel, Box-Überschriften, oder NSC-Namen**, nicht echte Kapitelüberschriften.
- **DSA5-Statblocks ERKANNT (aber als `heading`/`paragraph` klassifiziert):**
  - **Seite 12:** Deichbauern — MU 12, KL 11, IN 12, CH 11, FF 14, GE 13, KO 13, KK 13, LeP 31, INI 13+1W6, SK 1, ZK 2, AW 7, GS 8, Deichgabel: AT 10, PA 4, TP 1W6+2
  - **Seite 16:** Krakenmolch — MU 15, KL 6, IN 13, CH 8, FF 13, GE 12, KO 35, KK 36, LeP 350, INI 14+1W6, VW 6, SK 1, ZK 7, GS 2/9 (Land/Wasser), Fangarm: AT 13, TP 1W6+8, RW lang, Biss: AT 10, TP 3W6+6, RW kurz
  - **Seite 17:** Orknase — AT 13, PA 4, TP 1W6+5, RW mittel; Thorwalerschild: AT 9, PA 12, TP 1W6+1, RW kurz
- **NSC-Profile als Text (nicht als stat_block):**
  - **Seite 8:** "A Elidan, ehemaliger Waldbauer und angehender Deichbauer" — heading mit NSC-Markierung (A / 2 / £ / &)
  - **Seite 9:** "Elidans Kinder:" + Perlmin, Ovine, Sapertyn, Tommelothtje, Alsilio — jeweils als heading/paragraph, **NICHT** als semantische NSC-Box
- **Keine Würfelproben als eigene Blöcke:** Proben sind inline im Text (z.B. "Holzbearbeitung 8 (14/12/12)")
- **Keine NSC-Boxen als semantische Einheit:** NSCs sind zerstückelt in multiple heading/paragraph Blöcke
- **2-Spalten-Layout bestätigt:** Seiten 8-9 zeigen linke und rechte Spalte mit unterschiedlichen x-Koordinaten (bbox.x ~100 vs ~850 für die zweite Spalte)

---

## Deicherbe — DSA5-Statblock-Beispiele (aus der IR extrahiert)

### Deichbauern (Seite 12)
```
MU 12 KL 11 IN 12 CH 11
FF 14 GE 13 KO 13 KK 13
LeP 31 AsP - KaP - INI 13+1W6
SK 1 ZK 2 AW 7 GS 8
Deichgabel: AT 10 PA 4 TP 1W6+2 RW mittel
Stakaxt: AT 11 PA 4 TP 1W6+4 RW mittel
```
**Marker-Klassifikation:** `heading` (MU 12...) + `paragraph` (FF 14...)
**Review-Aufgabe:** Merge → `stat_block`, mark as `npc_stub`

### Krakenmolch (Seite 16)
```
MU 15 KL 6 (t) IN 13 CH 8
FF 13 GE 12 KO 35 KK 36
LeP 350 AsP - KaP - INI 14+1W6
VW 6 SK 1 ZK 7 GS 2/9 (an Land / im Wasser)
Fangarm: AT 13 TP 1W6+8 RW lang
Biss: AT 10 TP 3W6+6 RW kurz
```
**Marker-Klassifikation:** `heading` (MU 15...) + `heading` (FF 13...) + `heading` (LeP 350...) + `paragraph` (VW 6...)
**Review-Aufgabe:** Merge → `stat_block`, mark as `creature`

### Orknase + Thorwalerschild (Seite 17)
```
SK 1 ZK 2 AW 6 GS 7
Orknase: AT 13 PA 4 TP 1W6+5 RW mittel
Thorwalerschild: AT 9 PA 12 TP 1W6+1 RW kurz
orknase und Thorwalerschild (passiv): AT 13 PA 10 TP 1W6+1 RW mittel
```
**Marker-Klassifikation:** `paragraph`
**Review-Aufgabe:** Relabel → `stat_block`

### Elidan (Seite 8) — NSC-Profil
```
A Elidan, ehemaliger Waldbauer und angehender Deichbauer
Erscheinung: Ende 30, 1,85 Schritt, breitschultrig, dunkelblondes Haar und Vollbart, graublaue Augen
Profession: kompetenter Landwirt, erfahrener Soldat, unerfahrener Deichbauer
Motivation: sucht einen Neuanfang; will eine sichere Zukunft für seine Familie
Funktion: zunächst hilfsbedürftiger Familienvater, später Opfer einer mysteriösen Verwandlung
Wichtige Werte: Holzbearbeitung 7 (13/14/14), Willenskraft 6 (14/13/12), SK 1
```
**Marker-Klassifikation:** `heading` (A Elidan...) + `heading` (Erscheinung:) + `paragraph` (Erscheinungstext) + `heading` (Profession:) + `heading` (Motivation:) + `paragraph` (Funktion:) + `heading` (Wichtige Werte:)
**Review-Aufgabe:** Merge alle 7 Blöcke → ein `stat_block`, mark as `npc_stub`

### Elidans Kinder (Seite 9) — NSC-Profil
```
Elidans Kinder:
Zusammen mit Elidan sind seine fünf Kinder auf den Hof gekommen:

2 Perlmin (16 Jahre, dunkelblond, sieht seinem Vater sehr ähnlich;
Holzbearbeitung 8 (14/12/12), Willenskraft 3 (12/12/12), SK 1)

A Ovine (15 Jahre, dunkelblond, hübsch;
Willenskraft 4 (11/13/13), SK 1)

£ Sapertyn (13 Jahre, dunkelblond, düsterer Gesichtsausdruck;
Willenskraft 6 (13/10/10), SK 0)

& Tommelothtje (11 Jahre, rotblond, fröhlich;
Willenskraft 0 (10/10/14), SK 0)

Alsilio (8 Jahre, hellblond, kindliche Züge, fröhlich;
Willenskraft 1 (10/10/12), SK 0)
```
**Marker-Klassifikation:** `heading` (Elidans Kinder:) + `paragraph` (Zusammen...) + `heading` (2 Perlmin...) + `paragraph` (A Ovine...) + `paragraph` (£ Sapertyn...) + `heading` (Geschwistern...) + `paragraph` (& Tommelothtje...) + `paragraph` (Alsilio...)
**Review-Aufgabe:** 
- Split: Elidans Kinder-Überschrift → separate
- Merge: Perlmin heading + paragraph → ein `stat_block`
- Merge: Ovine paragraph → `stat_block` (nur paragraph, kein heading — OCR-Fehler!)
- Merge: Sapertyn paragraph → `stat_block`
- Merge: Tommelothtje + Alsilio → jeweils `stat_block`

**Kritisch:** Die NSC-Symbole (ⓐ / 2 / £ / & / A) sind **Teil des Heading-Texts**, nicht separate Blöcke. Die Marker-Pipeline erkennt sie als Text, nicht als semantische Icons.

---

## DSA5-Layout-Muster (Ulisses-Standard)

### 1. Titelseite / Cover
- Doppelseite oder Einzelseite
- Titel in großer Schrift, oft mit Runen- oder Fantasy-Schriftzug
- Untertitel: "Ein Abenteuer für X Helden der Stufe Y-Z"
- Autorenname, Illustrator, Verlagslogo
- Illustration: oft Landschaft oder dramatische Szene
- **Marker erkennt:** illustration, heading (Titel), paragraph (Untertitel)

### 2. Einleitung / Vorwort
- Fließtext, oft 1-2 Spalten
- **"Für den Spielleiter"** (SL-Info) vs. **"Für die Spieler"** (Spieler-Info)
- Unterschiedliche visuelle Hervorhebung: SL-Info oft in grau hinterlegten Boxen oder mit Icon
- **Marker erkennt:** paragraph, heading (Kapitel)

### 3. Handlungsstränge / Szenen
- Jede Szene hat eine **Überschrift** (heading)
- **Vorlesetexte:** Kursiv oder anderer Schriftschnitt, oft mit Anführungszeichen
- **Meisterinformationen:** Boxen mit Rahmen, oft grau oder farbig hinterlegt
- **Proben:** Inline im Text oder als eigene Boxen:
  - "Einschüchtern (Mut) +4" — Probe mit Erschwernis
  - "Überreden (Charisma) −2" — Probe mit Erleichterung
- **Marker erkennt:** paragraph, heading — aber **NICHT** die Unterscheidung zwischen Vorlesetext, SL-Info, und Probe

### 4. NSC-Boxen / Charakterprofile
- Visuell abgegrenzt: oft Rahmen, farbiger Hintergrund, oder Icon
- **NSC-Name** als heading
- **Kurzbeschreibung** als paragraph
- **Statblock** (falls vorhanden):
  ```
  MU 12, KL 11, IN 12, CH 11, FF 14, GE 13, KO 13, KK 13
  LeP 31, AsP -, KaP -, INI 13+1W6
  SK 1, ZK 2, AW 7, GS 8
  Deichgabel: AT 10, PA 4, TP 1W6+2, RW mittel
  ```
- **Marker erkennt:** heading (NSC-Name) + paragraph (Beschreibung) + paragraph (Statblock) — aber **NICHT** als semantische Einheit "NSC"

### 5. Gegner / Monster
- Ähnlich wie NSC, aber oft mit **Kampfwerten**
- **Kampfregeln** als eigene Box
- **Spezialfähigkeiten** als Liste
- **Marker erkennt:** heading + paragraph — ohne semantische Einheit

### 6. Battlemaps / Ortskarten
- Große Illustration
- Mit **Nummern** markierte Bereiche (1, 2, 3...)
- Legende daneben: "1 = Eingang, 2 = Halle, 3 = Schatzkammer"
- **Marker erkennt:** illustration + paragraph — aber **NICHT** die Zuordnung Nummer → Bereich

### 7. Handouts / Spielerinformationen
- Oft auf separater Seite oder als ausdruckbar markiert
- Visuell abgegrenzt: Rahmen, "Ausschneiden"-Linie
- Briefe, Karten, Zeichnungen
- **Marker erkennt:** illustration oder paragraph — ohne semantische Einheit "Handout"

### 8. Appendix / Anhang
- **NSC-Übersicht** als Tabelle
- **Loot-Liste**
- **Erfahrungspunkte**
- **Würfeltabellen** (z.B. "Zufällige Begegnungen")
- **Marker erkennt:** paragraph, heading — Tabellen evtl. als table_like (falls implementiert)

---

## Spaltenspezifische Herausforderungen

### Spaltenumbrüche
DSA5-Abenteuer nutzen oft **2-Spalten-Layout**. Marker erkennt Blöcke in Lesereihenfolge, aber:
- **Problem:** Ein Block kann über Spalten hinweg fließen (z.B. eine Überschrift über beide Spalten)
- **Problem:** Reading-Order kann falsch sein: links→rechts vs. oben→unten bei komplexen Layouts
- **Problem:** Boxen (NSC, Proben) können mitten in einem Spaltentext stehen

**Bestätigt in Deicherbe:** Seiten 8-9 zeigen linke Spalte (bbox.x ~100) und rechte Spalte (bbox.x ~850). Die NSC-Profile (Elidan, Kinder) sind über beide Spalten verteilt.

### Seitenumbrüche
- **Problem:** Ein Satz bricht über Seiten — Marker erzeugt zwei separate Blöcke
- **Problem:** Battlemaps können über Doppelseiten gehen
- **Problem:** Handouts sind oft als Einlage konzipiert, aber im PDF als normale Seite

---

## Semantische Klassifikation: Was Marker NICHT erkennt

| DSA5-Entität | Visuelle Merkmale | Marker-Output | Review-Aufgabe |
|--------------|-------------------|---------------|----------------|
| **NSC** | Rahmen, Portrait, Name fett, Symbol (A/2/£/&) | heading + paragraph | Benutzer: Merge → `stat_block`, mark as `npc_stub` |
| **Gegner** | Kampfwerte, Monster-Icon | heading + paragraph | Benutzer: Merge → `stat_block`, mark as `creature` |
| **Würfelprobe** | Inline oder Box: "Probe (Eigenschaft) ±X" | paragraph | Benutzer: "Das ist eine Probe" → relabel: `read_aloud` (?) |
| **Vorlesetext** | Kursiv, Anführungszeichen | paragraph | Benutzer: "Vorlesetext" → relabel: `read_aloud` |
| **SL-Info** | Grau hinterlegt, kleiner Text, Symbol | paragraph | Benutzer: "Meisterinfo" → relabel: `sidebar` |
| **Statblock** | Tabellen-ähnlich, Keywords (MU, LeP, AT, TP) | heading/paragraph | Benutzer: Merge → `stat_block` |
| **Battlemap** | Karte mit Nummern, Legende | illustration + paragraph | Benutzer: Zuordnung Nummer→Bereich |
| **Handout** | Rahmen, "Ausschneiden" | paragraph/illustration | Benutzer: "Handout" → relabel: `handout` |

---

## Fazit für das Review-System

Das System muss **NICHT** perfekt automatisch klassifizieren. Das System muss dem Benutzer erlauben, die Klassifikation schnell zu korrigieren.

**Kritische UI-Anforderungen:**
1. **Block-Typ schnell ändern:** Dropdown oder Chips (aktuell implementiert)
2. **Mehrere Blöcke zusammenführen:** NSC-Box hat oft Name + Beschreibung + Statblock als 3-7 separate Blöcke → merge
3. **Blöcke splitten:** Ein paragraph mit Vorlesetext + SL-Info → split
4. **Bild-Zuordnung:** Illustrationen/Maps müssen mit Textblöcken verlinkt werden
5. **Reading-Order fixen:** NSC-Box steht mitten im Fließtext, sollte aber an den Anfang der Szene

---

## Nächste Schritte

1. **Entity-Namensextraktion fixen** — `extractLabel()` in `heuristics_classification.ts` muss mit verstümmelter OCR umgehen
2. **Statblock-Erkennung verbessern** — Heuristik auf Block-Text: MU/LeP/AT/TP-Patterns → auto-label als `stat_block`
3. **NSC-Marker-Symbole erkennen** — Regex für ⓐ / A / 2 / £ / & am Anfang von Headings
4. **2-Spalten-Layout visuell darstellen** — bbox.x-Spaltenzuordnung in der GUI anzeigen
5. **Playwright-E2E mit DeicherbeComplete** — Regressionstest mit 23 Seiten, nicht nur 7

---

*Dokument aktualisiert von Jarvis. Golden-Sample-Status: Vollständige IR-Analyse abgeschlossen.*
