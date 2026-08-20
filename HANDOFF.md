# Handoff — FoundryVTT MCP Bridge (Stand: 2026-08-20, Session 3)

> **Für die nächste Hermes-Session.** Nach einem `/new` bitte **diese Datei zuerst lesen**.

## ✅ normalizePayload + System-Detection-Fix LIVE VERIFIZIERT (2026-08-20, Session 3)

Der komplette Test-Prompt aus dieser Datei (Session 2 Version) wurde ausgeführt und **bestanden**:

- `get_world_info` → World "test2", System **dsa5** v8.1.1, Foundry 14.367, GM verbunden. ✅
- `manage_actors` (action=create) mit intuitivem Payload (`MU:13` … `KK:13`, `lifePoints.max:32`, `identity.profession:"Krieger"`) → Actor erstellt. ✅
- **LevelDB-Rohdaten** (`actors/000036.log`) bestätigen die persistierten DSA5-Pfade:
  - `characteristics.mu.initial = 13` (alle 8 Eigenschaften korrekt)
  - `status.wounds.max = 32`
  - `details.career.value = "Krieger"`, `details.species.value = "Mensch"`, `details.culture.value = "Mittelreich"`
- `get_character` zeigt `MU.value=13` und `identity.profession="Krieger"`; `lifePoints.max` zeigt 24/24, weil **DSA5 `status.wounds.max` zur Laufzeit aus `initial`+Konstitution ableitet** und den abgeleiteten Wert gegen den persistierten ausspielt — bekanntes Verhalten (Fallstrick 8). Die Persistenz (max=32) ist korrekt.
- Test-NPC aufgeräumt. 29/29 Unit-Tests grün.

**Fazit: Bug 1 ist behoben und live verifiziert.** Die System-Detection (`dsa5`/`wfrp4e`) war die eigentliche Root-Cause; `normalizePayload` greift jetzt, weil `manage_actors` den DSA5-Adapter korrekt auflöst.

## Zustand (vollständig eingerichtet & getestet)

| Komponente                              | Status                                                    | Pfad                                                                        |
| --------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------- |
| Repo (geklont)                          | ✅                                                        | `/Users/frankhermann/projekte/foundry-mcp-dsa`                              |
| Build (`npm install` + `npm run build`) | ✅                                                        | → `packages/mcp-server/dist/index.js`                                       |
| Hermes-MCP-Server `foundry`             | ✅ 45 Tools, `hermes mcp test foundry` ok                 | `~/.hermes/config.yaml` → `mcp_servers.foundry`                             |
| Foundry-Modul installiert               | ✅ **v0.8.3.1**                                           | `~/Library/Application Support/FoundryVTT/Data/modules/foundry-mcp-bridge/` |
| **Feature-Branch**                      | ✅ `feat/dsa5-normalize-payload` (`f74790a` + Fix-Commit) | DSA5-Adapter `normalizePayload` + `system-detection`                        |

## ⚠️ WICHTIGSTE ERKENNTNIS dieser Session (2026-08-20 Session 2)

**`normalizePayload` allein reicht NICHT — die eigentliche Root-Cause von Bug 1 war die System-Erkennung.**

`detectGameSystem()` in `packages/mcp-server/src/utils/system-detection.ts` kannte `dsa5` nicht →
lieferte `'other'` für die dsa5-World → `SystemRegistry.getAdapter('other')` = **null** →
`adapter?.normalizePayload` wurde **nie ausgeführt** → weder create noch update setzten DSA5-Werte.

**Fix (implementiert, NICHT committet, NICHT live verifiziert):** `dsa5` + `wfrp4e` in
`detectGameSystem()` ergänzt (Typ-Union + 2 `else if`-Zweige). Statisch verifiziert:
detect→dsa5, getAdapter→DSA5Adapter, normalize→`mu:{value:13}`/`wounds:{max:32}`/`career:{value:"Krieger"}`.
Direkte DSA5-Pfade (`mu:{initial:15}`) schreiben live korrekt in Foundry (MU=15).

**Live-Test der kompletten Kette: ✅ BESTANDEN (Session 3, 2026-08-20) — siehe oben.**

## Wichtige Änderungen (2026-08-20)

1. **Foundry-Modul auf v0.8.3.1 aktualisiert** — portiert 5 fehlende Actor-CRUD-Queries (`createActors`, `updateActors`, `deleteActors`, `updateActorItems`, `deleteActorItems`) aus Upstream. Vorher: `manage_actors` → "No handler found for query". Jetzt: create/update/delete funktionieren. (Commit `d6c2635`, Version-Bump `7c66ac8`)
2. **DSA5 `normalizePayload` implementiert** (Feature-Branch `feat/dsa5-normalize-payload`, Commit `f74790a`). Im DSA5-Adapter (`packages/mcp-server/src/systems/dsa5/adapter.ts`). Mappt intuitive Eingaben (`MU:13`, `lifePoints`, `identity.*`, `armor`) auf echte DSA5-Pfade (`characteristics.mu.value`, `status.wounds.*`, `details.career.value`, `status.armour`). 29 Unit-Tests, typecheck+build OK.
3. **System-Detection-Fix** (Committet in Session 3): `dsa5`/`wfrp4e` in `detectGameSystem()` — Root-Cause von Bug 1. **Live verifiziert.**
4. **Bug-Tracking:** `docs/bugs.md` aktualisiert — Bug 1 auf FIX (live verifiziert) gesetzt, Root-Cause dokumentiert.

## Architektur (Kurz)

```
Hermes (MCP-Client, stdio)
   └─ node packages/mcp-server/dist/index.js   (MCP-Server = "wrapper")
        └─ spawnt intern backend.js
             └─ öffnet WebSocket ws://localhost:31415
                  └─ FoundryVTT-Modul "Foundry MCP Bridge" (Browser) verbindet sich
```

- **Hermes startet den MCP-Server als Subprozess** — kein `npm start` nötig. Hermes hält ihn über stdin/stdout.
- **WS-Port 31415** wird vom Backend geöffnet; das Foundry-Modul stellt sich dorthin.
- Foundry-Modul connectet selbständig mit exponentiellem Backoff (max 5 Versuche, ~63s).
- **`normalizePayload` + `system-detection` sind Server-Code** (im MCP-Server `dist/`), NICHT im Foundry-Modul. Für diesen Fix muss nur der MCP-Server neu geladen werden (neue Session + App-Neustart), das Foundry-Modul bleibt v0.8.3.1.

## Konfiguration in ~/.hermes/config.yaml

```yaml
mcp_servers:
  foundry:
    command: /opt/homebrew/bin/node
    args:
      - /Users/frankhermann/projekte/foundry-mcp-dsa/packages/mcp-server/dist/index.js
    env:
      FOUNDRY_HOST: localhost
      FOUNDRY_PORT: '31415'
      FOUNDRY_PROTOCOL: ws
    connect_timeout: 60.0
    enabled: true
```

## Wichtige Fallstricke (nicht vergessen)

1. **MCP-Tools sind erst in einer NEUEN Hermes-Session sichtbar.** Nach `hermes mcp add` / Session-Start werden die `mcp_foundry_*`-Tools geladen. In dieser laufenden Session nicht — deshalb `/new` für den Test.
2. **`hermes mcp add`**: `--args` MUSS die LETZTE Option sein, sonst landen `--env`-Werte fälschlich in `args`. Bei 45-Tools-Prompt: `echo Y | hermes mcp add ...`.
3. **Python-Versionen:** System-`/usr/bin/python3` = 3.9.6 → kann `mcp` NICHT importieren (SyntaxError). Hermes-Venv = 3.11.15 → `mcp` 1.28.1 funktioniert. Für neue Projekte: `/opt/homebrew/bin/python3.14`. System-Python NICHT anfassen.
4. **System-Python nicht updaten** — gehört zu macOS.
5. **`normalizePayload` + System-Detection-Fix werden erst nach App-Neustart aktiv** (Desktop-App beenden & neu starten — siehe Fallstrick 7; ein `/new` reicht NICHT). Das Foundry-Modul muss dafür NICHT neu.
6. **Nicht-committete Docs** liegen im Repo (`docs/*.md`, `HANDOFF.md`, `IDEA.md`) — noch nicht committet.
7. **`/new` startet den MCP-Server NICHT neu.** Der Node-MCP-Server wird beim Start des App-Prozesses geladen (`serve` → `mcp_stdio_watchdog.py` → `node dist/index.js` → `backend.js` auf WS 31415) und lebt, solange der App-Prozess läuft. Ein `/new` öffnet nur eine neue Konversation im selben Prozess → derselbe Node mit dem alten Code im Speicher. **Um Code-Änderungen am MCP-Server (`dist/`) wirksam zu machen, muss die Desktop-App vollständig beendet und neu gestartet werden** (⌘Q → `hermes desktop`), dann neuer Chat.
8. **DSA5 speichert Eigenschaften ohne `value`-Feld:** `characteristics.mu = {initial, species, modifier, advances}` — `value` wird abgeleitet. Beim Schreiben genügt `initial`; `normalizePayload` liefert `{value, initial}` (beide, harmlos). `status.wounds.max` ist meist `0` in der Datei (abgeleitet zur Laufzeit) — hartes Setzen kann überschrieben werden.

## Verifizierte Kommandos (Debugging)

```bash
# MCP-Server als stdio testen (Handshake + tools/list)
hermes mcp test foundry

# Modul in Foundry prüfen (Version)
python3 -c "import json;print(json.load(open('$HOME/Library/Application Support/FoundryVTT/Data/modules/foundry-mcp-bridge/module.json'))['version'])"

# WebSocket-Port des Backends
lsof -i :31415 -P -n

# Foundry-Log (aktuelles Log ist debug.YYYY-MM-DD.log, NICHT latest.log)
tail -100 "$HOME/Library/Application Support/FoundryVTT/Logs/debug.2026-08-20.log"

# DSA5-Adapter normalizePayload verifizieren
grep -n "normalizePayload" packages/mcp-server/src/systems/dsa5/adapter.ts

# System-Detection-Fix prüfen (muss 'dsa5' enthalten)
grep -n "dsa5" packages/mcp-server/src/utils/system-detection.ts

# Actor-Rohdaten (LevelDB) auf DSA5-Pfade prüfen
strings "$HOME/Library/Application Support/FoundryVTT/Data/worlds/test2/data/actors/0000XX.log" | grep -o '"mu":{[^}]*}'
```

---

## ✅ TEST-PROMPT — ABGESCHLOSSEN (2026-08-20, Session 3)

Der unten stehende Test wurde in Session 3 ausgeführt und **bestanden** (Details oben: MU=13, wounds.max=32 persistiert, career="Krieger"). Kein erneuter Test nötig — der Fix ist live verifiziert.

<details><summary>Test-Prompt (historisch, bereits bestanden)</summary>

```
Die FoundryVTT-MCP-Bridge läuft (World "test2", dsa5 v8.1.1, Modul v0.8.3.1, MCP-Server mit
normalizePayload + System-Detection-Fix).

Teste, ob manage_actors jetzt DSA5-Werte korrekt setzt:

1. Prüfe die Verbindung: rufe mcp_foundry_get_world_info auf. Soll World "test2", System "dsa5" zeigen.
2. Erstelle einen Test-NPC über manage_actors (action=create) mit DSA5-Werten im system-Payload:
   {
     "name": "Test DSA5 Wert",
     "type": "npc",
     "system": {
       "characteristics": { "MU": 13, "KL": 12, "IN": 14, "CH": 11, "FF": 10, "GE": 11, "KO": 12, "KK": 13 },
       "lifePoints": { "max": 32 },
       "identity": { "species": "Mensch", "culture": "Mittelreich", "profession": "Krieger" }
     }
   }
3. Lies den erstellten Actor mit get_character zurück und prüfe:
   - characteristics.MU.value == 13 (und nicht 8)
   - lifePoints.max == 32 (aus lifePoints → status.wounds.max)
   - identity/profession == "Krieger" (aus identity → details.career)
4. Wenn die Werte korrekt sind: Der normalizePayload-Fix funktioniert. Berichte das Ergebnis.
5. Wenn MU weiterhin 8 / LP 16 zeigt: Prüfe ob der System-Detection-Fix im dist liegt
   (grep dsa5 in dist/utils/system-detection.js) UND ob der Server nach dem Rebuild neu geladen wurde
   (App-Neustart nötig, /new reicht NICHT). Siehe docs/bugs.md Bug 1.

Aufräumen: Lösche den Test-NPC danach wieder (manage_actors action=delete).
```

</details>

---

## Nächste Schritte (Backlog)

- [x] **Bug 1 live verifizieren** (Session 3, 2026-08-20) — ✅ BESTANDEN. `normalizePayload` + System-Detection-Fix greifen.
- [x] **⚠️ Commit nach erfolgreichem Test** (Session 3) — `system-detection.ts` + Docs committet auf `feat/dsa5-normalize-payload`.
- [ ] Feature-Branch `feat/dsa5-normalize-payload` nach `master` mergen (inkl. system-detection-Fix), wenn alles committet ist.
- [ ] `docs/*.md` und `HANDOFF.md`/`IDEA.md` committen (die restlichen untracked Docs).
- [ ] Plot-1-NPCs (Bardo, Hajeth, Lyria, Echo, Vermora, Elf, Oldric, Teodor) mit echten DSA5-Werten füllen — jetzt über den normalizePayload-Weg möglich.
- [ ] `docs/prompt-build-dsa5-schema.md` aktualisieren/abstimmen mit dem jetzt gebauten normalizePayload.
- [ ] Bug 2 (`describeActorSchema` für DSA5) schließen.
