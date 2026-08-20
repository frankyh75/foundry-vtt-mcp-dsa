# Foundry MCP Bridge — Bug-Tracking

> Stand: 2026-08-20 · Repo: `/Users/frankhermann/projekte/foundry-mcp-dsa` · World: test2 (dsa5 v8.1.1)
> Zweck: dokumentierte Bugs aus dem Testen, damit wir sie gezielt fixen.

---

## 🐛 Bug 1 — `manage_actors` schreibt DSA5-Systemdaten nicht

**Status: FIX (im Code, nicht verifiziert) · Fix: normalizePayload + system-detection**

- **Symptom:** `manage_actors` (create + update) meldet Erfolg, aber DSA5-Werte wie `characteristics.MU`, `lifePoints` werden NICHT gesetzt. Test: Bardo (PL55IoQ6cfwiZ98N) → MU blieb 8, LP blieb 16 trotz Update.
- **Ursachen (zwei Ebenen):**
  1. **Feld-Pfade:** DSA5 nutzt andere Feld-Pfade als naiv angenommen:
     - LeP: `system.status.wounds.current/max` (NICHT `lifePoints`)
     - Eigenschaften: `system.characteristics.<mu|kl|in|ch|ff|ge|ko|kk>.value` (klein)
     - Profession: `system.details.career.value` (nicht `profession`)
     - AsP/KaP: `system.status.astralenergy/karmaenergy.value/.max`
  2. **Adapter-Auflösung (eigentliche Root-Cause, erst beim E2E-Test gefunden):** `detectGameSystem()` in `packages/mcp-server/src/utils/system-detection.ts` kannte `dsa5` NICHT → lieferte `'other'` für die dsa5-World → `SystemRegistry.getAdapter('other')` fand keinen Adapter (DSA5Adapter.canHandle('other')=false) → **null** → `adapter?.normalizePayload` wurde NIE ausgeführt. Deshalb griff der Fix weder bei create noch update.
- **Fix (implementiert):**
  - `normalizePayload()` + `describeActorSchema()` im DSA5-Adapter (`packages/mcp-server/src/systems/dsa5/adapter.ts`) — Commit `f74790a`.
  - `detectGameSystem()` um `dsa5` (+`wfrp4e`) erweitert in `system-detection.ts` (neue Änderung, noch nicht committet). Damit löst der Registry-Lookup den DSA5-Adapter korrekt auf.
- **Verifikation:** statisch bestätigt (detect→dsa5, getAdapter→DSA5Adapter, normalize→`mu:{value:13}`/`wounds:{max:32}`/`career:{value:"Krieger"}`). Direkte DSA5-Pfade (`mu:{initial:15}`) schreiben live korrekt in Foundry (MU=15). **Live-Test des vollständigen Wegs offen:** braucht Server-Neustart (Desktop-App beenden + neu, `/new` reicht NICHT).
- **Hinweis `status.wounds.max`:** DSA5 speichert `wounds.max` meist als `0` in der Datei; das Maximum wird zur Laufzeit aus `initial`+KO×2+Steigerungen abgeleitet. Ein hart geschriebenes `wounds.max` könnte beim nächsten `prepareData` überschrieben werden → beim Live-Test prüfen.

## 2 — Kein DSA5-Schema für `describe`

**Status: OPEN (verknüpft mit Bug 1)**

- `manage_actors` action=describe liefert "No system-specific actor schema notes available" (kein DSA5-Schema). DSA5-Adapter fehlt `describeActorSchema()`.

## 3 — Versions-Mismatch: `manage_actors`-Queries fehlten im Modul

**Status: FIXED (Commit d6c2635, Version 0.8.3.1)**

- Modul kannte `createActors/updateActors/deleteActors/updateActorItems/deleteActorItems` nicht (nur `createActorFromCompendium`, `createActorFromData`) → "No handler found for query". Aus Upstream portiert.

---

## ToDo / Beobachtungen aus dem Test

- **Profession ohne Archetyp:** Wunsch: alle DSA5-Professionen anlegen zu können, auch ohne Archetypen. Lösung über Bug-1-Fix (Schema) oder freie Actor-Erstellung.
- **Test-Archetypen-Reste:** "Test Archetyp", "Allacaya (Test)", "Orestas (Test)" wurden erstellt und gelöscht (Verifikation delete).
- **Live-Test nach Server-Neustart:** Bug-1-End-to-End bestätigen (siehe `HANDOFF.md` Test-Prompt) — inkl. `wounds.max`-Verhalten prüfen.

## Siehe auch

- `docs/guide-foundry-abenteueraufbau.md` — Tool-Matrix was automatisch/manuell
- `docs/prompt-repair-manage-actors.md` — Fix für Bug 3 (erledigt)
- `docs/prompt-build-dsa5-schema.md` — Fix für Bug 1
- `HANDOFF.md` — Gesamtstand + Test-Prompt
