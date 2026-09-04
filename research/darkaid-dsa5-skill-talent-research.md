# Recherche: DSA5 Talent-/Skill-System (3W20) + Mapping Dark Aid ↔ Foundry

Zweck: Beantwortung der offenen Frage, wie Talente/Fertigkeiten/Attribute zusammenhängen, und
Aufbau einer Mapping-Tabelle DSA5-Compendium ↔ Dark Aid `.tdc`-Export, um die Import-Lösung in
`DSA5JsonActorImporter` (Branch `feat/darkaid-converter`) gegenprüfen zu können.

Referenzbeispiel: `Lucius_Gormag.tdc` (Lucius Gormag, Prinzist, KO=12).

## 1. Grundlegende DSA5-Semantik (aus Regelwiki, dsa.ulisses-regelwiki.de)

- **3W20-System**: Probe = Attribut + Fertigkeit (+ Talente/Regeln/AS).
- **Talente** basieren auf einer **Kombination von Attributen** (z. B. Sinnesschärfe = KL/IN/IN,
  Klingenkampf = GE/GE/FF). Diese Kombination wird im DSA5-Compendium im Feld
  `system.rule` (String, z. B. `KL/IN/IN`) gespeichert.
- **Fertigkeiten**: Startwert = Talentstufe (Standard 0). `system.talentValue.value` = Talentstufe.
- **Level im Dark-Aid-Export** = Fertigkeitswert (fw), nicht Talentstufe.
- **LP / EA / KE / ASP** rechnet das DSA5-System aus den Attribut-Werten (KO/KL/MU) selbst
  → `basevalues` im Export darf leer bleiben.
- **focusrules**: optionale Regeln, Spieler-Aktivierung, beim Import irrelevant.

## 2. DSA5-Item-Typen im System (`modules/data/item/`)

| DSA5-Item-Typ                                      | darkaid-Export-Feld | Template                                                 |
| -------------------------------------------------- | ------------------- | -------------------------------------------------------- |
| skill                                              | `skills`            | skill.js (`characteristic1/2/3`, `talentValue`, `group`) |
| specialability (Körpertalente, Vorteile, Sprachen) | `specialabilities`  | specialability.js (`category`, `sub`, `rule`)            |
| liturgy (Liturgien)                                | `chants`            | liturgy.js                                               |
| combatskill (Kampftechniken)                       | `combatTechniques`  | combatskill.js                                           |
| disadvantage (Nachteile)                           | `disadvantages`     | disadvantage.js                                          |

**Wichtig**: Es gibt **kein** `talent.js`. Talente = `specialability`.

## 3. Dark Aid `.tdc`-Export (Lucius Gormag) — Struktur

Top-Level: `attributes` (8), `basevalues` (9, alle leer), `skills` (30), `chants` (23),
`combatTechniques` (1), `disadvantages` (8), `specialabilities` (4). **Kein** `talents`-Feld.

Beispiele:

- Attribute: `{'id':'mut','level':14}`, `{'id':'klugheit','level':14}`, … (in `level`!)
- Skills: `{'id':'klettern','level':2}`, `{'id':'reiten','level':2}`, …
- Chants: `{'id':'bannstrahl','level':7}`, …
- Specialabilities: `{'id':'sprache','level':3,'variant':{...ruleelement...}}`

**Zentrale Erkenntnis**: Die Dark-Aid-`id` (z. B. `klettern`, `bannstrahl`, `goetterkulte`,
`sprache`) ist **der niedergeschriebene DSA5-Compendium-Name** (Kleinbuchstaben, Umlaute
entfernt, Bindestriche zu `_`). Der Importer nutzt bereits `normalizeName()` (Kleinbuchstaben +
Umlaut-Strip), also löst sich dies automatisch über die Name-Auflösung im Compendium auf.

## 4. Mapping-Tabelle DSA5 ↔ Dark Aid (zu verifizieren)

### 4a. Attribute (Characteristics)

| Attribut         | darkaid `id`                 | DSA5-System-Schlüssel |
| ---------------- | ---------------------------- | --------------------- |
| Mut              | `mut`                        | `mu`                  |
| Klugheit         | `klugheit`                   | `kl`                  |
| Intuition        | `intuition`                  | `in`                  |
| Charisma         | `charisma`                   | `ch`                  |
| Fingerfertigkeit | `fingerfertigkeit`           | `ff`                  |
| Gewandheit       | `gewandheit`                 | `ge`                  |
| Konstitution     | `konstitution`               | `ko`                  |
| Körperkraft      | `körperkraft`/`koerperkraft` | `kk`                  |

→ `system.characteristics.{mu,kl,in,ch,ff,ge,ko,kk}.value = level`

### 4b. Fertigkeiten (skill)

- Name = DSA5-Compendium-`name`.
- `system.characteristic1/2/3` = das Attribut, das die Fertigkeit prägt (z. B. Klettern → `ge/ff/ff`).
  **Ohne diese Zuordnung stimmen die Boni nicht!**
- `system.talentValue.value` = Talentstufe (Default 0).
- `system.group` = Fertigkeitsgruppe (body/mental/social).
- `system.StF.value` = Stufentyp (A–H, Default 'A').

### 4c. Talente/Liturgien/etc.

- Name = DSA5-Compendium-`name`.
- specialability: `system.category.value` = SpecCategory, `system.sub` = Kombinations-Nummer,
  `system.rule` = Attribut-Kombination (KL/IN/IN).
- liturgy: `system.circle` = Zauberkreis.

## 5. Offene Punkte für den Entwickler / zu klären

- [ ] Talent-/Fertigkeit→Attribut-Zuordnung: fehlt im Export. Entweder DSA5-Regelwerk-Integration
      (skill→characteristic) oder eine feste Mapping-Tabelle.
- [ ] `level` bei Fertigkeiten = fw (Fertigkeitswert). Talentstufe vs. fw trennen.
- [ ] `id` = DSA5-Compendium-Name (kleingeschrieben). Name-Auflösung reicht aus.
- [ ] basevalues leer → LP/EA/KE/ASP rechnet Foundry. Bestätigt.
- [ ] Focusregeln ignorieren (optional, nicht relevant).

## 6. Empfehlung

Der Importer (`optolith_like`) löst Items bereits über `nameBuckets` → Compendium. Für die
**Attribut-Zuordnung der Fertigkeiten** fehlt aber noch die `characteristic1/2/3`. Ohne diese
Information im `.tdc`-Export ist ein automatisches Mapping nicht möglich → Entweder:
(a) Developer liefert Attribut pro Skill im Export, OR
(b) fester Mapping-Schlüssel basierend auf dem DSA5-Regelwerk.
