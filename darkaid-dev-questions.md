# Fragen an den Dark Aid-Entwickler

Zweck: Integration des Dark Aid Export-Formats `.tdc` (JSON) in `DSA5JsonActorImporter`
(Foundry VTT DSA5-Modul, Branch `feat/darkaid-converter`). Es geht um ein realistisches
Test-Export (`Lucius20Gormag.tdc`): Attribute in `level`, `skills`/`chants`/`combatTechniques`
jeweils mit `id` + `level`, `basevalues` (LP/EA/KE/...) komplett leer.

Offene Punkte, die wir vom Entwickler klären müssen, damit der Converter flexibel und
korrekt mappen kann:

## 1. Attribut pro Fertigkeit (skill short code / characteristic1)

Skills im `.tdc` haben aktuell nur `{ name, id, level }` — **kein Feld, das das zugehörige
Attribut** (MU/KL/IN/CH/FF/GE/KO/KK) codiert. Das DSA5-System benötigt für jede Fertigkeit
`system.characteristic1` (Wahl aus `mu/kl/in/ch/ff/ge/ko/kk`) und `system.talentValue.value`,
sonst stimmen die Boni im Character Sheet nicht.

- Existiert pro Fertigkeit ein Kürzel-Code (z. B. `ge-kt` = Klettern, `kl-mg` = Magiekunde)?
- Gibt es ein Feld wie `characteristic`, `attribute` oder `short` im Skill-Eintrag?
- Falls nein: Könnt ihr das im Export ergänzen (oder exportiert ihr eine Skills-Konstanten-
  Datei mit der canonical Attribut-Zuordnung)?

## 2. `level` bei Fertigkeiten vs. Talenten

Talente haben in `.tdc` ebenfalls ein `level`-Feld. Ist damit die **Talentstufe** gemeint
(DSA5: 0–5, wird nach `system.talentValue.value` gemappt), oder ist es ein fertigkeitartiger
Level-Wert?

- Liturgien (`chants`) haben ebenfalls `level` — ist das die Liturgie-/Zauberstufe?

## 3. `id` vs. `name` für die Compendium-Auflösung

Fertigkeiten, Talente, Liturgien und Kampftechniken werden im Converter über den **Namen**
im DSA5-Compendium aufgelöst (via `nameBuckets` → `resolveItemNames`). Ist `id` ein
**Compendium-Key/UUID**, den man direkt als `id`/`uuid` im Item setzen kann, oder nur ein
interner Index? Wie lautet der kanonische Compendium-Key, den wir für eine direkte Auflösung
brauchen?

## 4. `basevalues` sind leer

`lebensenergie`, `astralenergie`, `karmaenergie`, `schicksalspunkte`, SE, Zähigkeit,
Ausweichen, Initiative, Geschwindigkeit sind im Export leer. Wir rechnen LP und Abwertstufe
laut DSA5-Regeln (Basisabwert KO + Abwertstufe) — das macht das System selbst, also ist das
leerer Export hier tolerierbar. Wir brauchen dennoch eine Antwort:

- Sind SE (Schicksalserlebnisse), Initiative, Ausweichen etc. im Export **bewusst** leer
  und werden aus dem Compendium/Charakter-Typ abgeleitet, oder fehlt da ein Feld, das wir
  im Export hinzufügen könnten?
- Rechnet das System die Lebensenergie-Ausgangswert aus KO + Abwertstufen, dann ist die
  Leere-LP korrekt — bitte um Bestätigung.

## 5. Flexibilität verschiedener Dark Aid-Exporte

Frank möchte, dass der Converter verschiedene Dark Aid-Exporte flexibel verarbeitet.

- Gibt es optionale Felder/Varianten (z. B. Attribute unter anderem Schlüssel, `values`-
  statt `level`-Felder), die wir kennen und handhaben sollten?
- Gibt es eine dokumentierte Schema-Spezifikation der `.tdc`-Datei, die wir uns ansehen
  können?

## Offene Annahmen des aktuellen Implementierungsstands

- `LP = KO-Basisabwert + Abwertstufe` (Foundry rechnet das); LP/EA/KE/AEP/ASP werden **nicht**
  hart gesetzt, nur `characteristics` + `wounds.advances`.
- Skills ohne Attribut-Kürzel bleiben aktuell Boni-leer (offen, siehe Punkt 1).
