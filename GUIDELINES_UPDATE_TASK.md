# Task: Upstream Sync Guidelines einpflegen

**Auftraggeber:** Frank (Nutzer) via Claude Code  
**Datum:** 2026-05-29  
**Priorität:** Hoch — Präventiv-Maßnahme vor dem nächsten Upstream-Sync  
**Ausführender:** Hermes Agent  

---

## Hintergrund: Was ist passiert

Der Hermes-Agent (GLM 5.1, Kanban-Modus) hat in den letzten Wochen Upstream-PRs von
`adambdooley/foundry-vtt-mcp` in unseren Fork synchronisiert. Dabei sind Fehler entstanden,
die die Branch-Historie dauerhaft beschädigt haben.

### Objektiver Branch-Zustand (Stand 2026-05-29)

```
master: 55 eigene Commits, die upstream nicht kennt
upstream/master: 24 Commits, die wir nicht haben
                 (Cosmere RPG, Prettier-Enforcement, diverse Fixes)
```

Der entscheidende Fund ist dieser Commit auf `master`:

```
4ed6ebe TEMP: cherry-pick 9a76613 add actor items tool
```

Ein `TEMP`-Commit hat den Weg auf den `master`-Branch geschafft. Das ist das sichtbarste
Symptom eines strukturellen Problems.

### Was konkret schiefging

**1. Cherry-Picks statt Merge**

Mehrere Commits zeigen das Muster:

```
105a7c2 feat: add folder support to journal and quest creation (cherry-pick d51f153)
6e0b0ed feat: add create-world-items tool (cherry-pick 36ce50a with DSA5 merge fix)
4ed6ebe TEMP: cherry-pick 9a76613 add actor items tool
```

Cherry-Picks brechen die gemeinsame Git-Historie zwischen Fork und Upstream.
Wenn später ein echter `git merge upstream/master` versucht wird, erscheinen
alle cherry-gepickten Commits als Konflikte, weil Git die SHA-Hashes nicht
erkennt. Das macht einen sauberen Merge nahezu unmöglich.

**2. DSA5-spezifische Logik in `data-access.ts`**

`packages/foundry-module/src/data-access.ts` ist laut Architektur-Prinzip eine
upstream-kompatible Datei ohne System-Spezifika. Upstream hat dort inzwischen
Cosmere RPG Support (`CosmereRpgCreatureIndex`) hinzugefügt. Unsere Version enthält
DSA5-Anpassungen (`preserveItemTypes` als hardcoded Liste). Beide Seiten haben
dieselbe Datei in unvereinbare Richtungen entwickelt.

**3. Formatierungs-Konflikte (Prettier)**

Upstream-PR #39 hat Prettier-Enforcement durchgesetzt und dabei tausende Zeilen
umformatiert. Unsere Version dieser Dateien ist noch nicht im Prettier-Format.
Ein Merge produziert daher riesige, schwer auflösbare Konflikte, obwohl die Logik
identisch sein könnte.

**4. Fehlende Agent-Scope-Grenzen in AGENTS.md**

Das ist die Wurzel des Problems: AGENTS.md enthält die richtige Regel
("Do not modify `data-access.ts`...") aber sagt nicht:

- **Wie** Upstream-Sync auszuführen ist (Merge vs. Cherry-Pick)
- **Wer** das darf (welcher Agent-Typ)
- **Was** vor einem Merge geprüft werden muss
- **Wann** ein Agent eskalieren muss statt selbst zu handeln

Ein schwächeres Modell (GLM 5.1) hat cherry-gepickt, weil einzelne Commits
importieren einfacher aussah als ein echter Merge — und es gab keine harte
Schranke dagegen.

---

## Deine Aufgaben

Du führst **drei präzise Änderungen** durch. Kein Scope-Creep, keine weiteren
Anpassungen. Nach jeder Änderung: Commit mit Conventional Commits.

---

### Aufgabe 1: Neuer Abschnitt in `AGENTS.md`

Füge **am Ende** der Datei `AGENTS.md` (nach dem letzten bestehenden Abschnitt
"Configuration & Security") die folgenden zwei Abschnitte ein.

Füge sie **exakt so** ein, ohne inhaltliche Änderungen:

```markdown
## Upstream Sync Protocol

### Merge, never cherry-pick
Upstream changes are synced exclusively via `git merge upstream/master`.
Cherry-picking individual upstream commits is **forbidden** — it breaks shared
history and causes deduplication conflicts when the real merge happens later.

Sole exception: a self-contained bugfix that (a) is already in upstream/master,
(b) touches no file we have modified, and (c) is explicitly approved by Claude.

### Merge upstream BEFORE touching any shared file
Before modifying any file outside `packages/mcp-server/src/systems/dsa5/`,
run:
```
git log upstream/master..HEAD -- <file>
```
If upstream has commits on that file that we don't have, run
`git merge upstream/master` first. If the merge would be non-trivial, stop
and escalate to Claude.

### Pre-merge gate (must all pass before `git merge upstream/master`)
1. `git log --oneline master | grep -i TEMP` → must return empty
2. `git diff HEAD upstream/master -- packages/foundry-module/src/data-access.ts`
   → must show only Prettier/whitespace diffs, no DSA5-specific logic
3. `npm run typecheck` on current branch → 0 errors

If any gate fails, stop and escalate to Claude before proceeding.

### Prettier / formatting runs
Never run `npm run format` on files that upstream has also reformatted in a
pending merge. Only run after a successful `git merge upstream/master`.

### TEMP commits are forbidden on master
TEMP commits belong in feature branches only. A TEMP commit on master is an
incident — squash or drop before merging to master.

---

## Agent Task Scope and Escalation

### What any agent may do autonomously
- Implement DSA5 features entirely within `packages/mcp-server/src/systems/dsa5/`
- Write or extend tests (`*.test.ts`)
- Update `ROADMAP.md`, `SESSION.md`, `AGENTS.md`
- Read any file, run `npm run typecheck`, `npm run test`
- Commit and push feature branches

### What requires Claude (senior agent) review before execution
- Any `git merge upstream/master`
- Any change to `packages/foundry-module/src/data-access.ts`
- Any change to `packages/mcp-server/src/backend.ts` routing table
- Any change to `shared/` types that adds a new system

### Hard stop — agent must halt and write a blocking card
If a Kanban task requires any of the "senior review" operations above, the
agent must:
1. Stop immediately (do not attempt the operation)
2. Write a blocking note in the task/card describing exactly what upstream
   state is needed and which file would be affected
3. Mark the task blocked and wait for Claude to plan the merge sequence

### Smell test for scope violations
If you see any of the following in recent commit history, treat it as a
scope violation and flag before pushing further:
- Commits containing "cherry-pick" in the message
- Commits starting with "TEMP:"
- Commit messages containing "DSA5 merge fix" on a cherry-picked upstream commit
```

**Commit-Message für Aufgabe 1:**
```
docs(agents): add upstream sync protocol and agent scope rules
```

---

### Aufgabe 2: Neue Regel in `ROADMAP.md`

Öffne `ROADMAP.md`. Finde den Abschnitt `## Non-Negotiable Product Rules`.
Dieser Abschnitt enthält aktuell drei nummerierte Regeln. Füge als **vierte Regel**
direkt nach Regel 3 ein:

```markdown
4. Upstream sync operations (`git merge upstream/master`, conflict resolution) are
   Claude-only. Kanban workers must not execute `git merge` or `git cherry-pick`
   against upstream.
```

**Commit-Message für Aufgabe 2:**
```
docs(roadmap): add upstream sync ownership rule to non-negotiables
```

---

### Aufgabe 3: Neues Dokument `SYNC_PLAN.md` erstellen

Erstelle die Datei `SYNC_PLAN.md` im Repo-Root mit folgendem Inhalt.
Ändere nichts am Inhalt — das ist eine dokumentierte Zustandsaufnahme,
keine Anleitung zur sofortigen Ausführung. Den Reset-Plan führt **Claude** aus,
nicht du.

```markdown
# Upstream Sync Recovery Plan

**Status:** Pending — wartet auf Freigabe durch Frank  
**Erstellt:** 2026-05-29  
**Ausführender:** Claude (nicht Kanban-Worker)

---

## Ausgangslage

master ist gegenüber `upstream/master` (eb36890) in einem nicht-merge-fähigen
Zustand:

- 55 eigene Commits, davon mehrere cherry-picks aus upstream
- 24 upstream-Commits fehlen (Cosmere RPG, Prettier, Fixes)
- `packages/foundry-module/src/data-access.ts` hat DSA5-Logik und fehlendes Cosmere RPG
- TEMP-Commit `4ed6ebe` auf master

Ein direktes `git merge upstream/master` würde hunderte Konflikte erzeugen und
ist aktuell nicht sicher durchführbar.

---

## Empfohlener Recover-Weg: Szenario A (sauberer Neuaufbau)

**Konzept:** Neuer Branch von `upstream/master`, DSA5-Features atomar neu aufbauen.

### Schritt 1 — Inventar der DSA5-eigenen Commits

```bash
git log --oneline upstream/master..HEAD -- packages/mcp-server/src/systems/dsa5/
git log --oneline upstream/master..HEAD -- packages/mcp-server/src/tools/
git log --oneline upstream/master..HEAD -- packages/foundry-module/src/queries.ts
```

Diese Commits sind unsere echten Eigenleistungen — sie kommen nach dem Reset
als saubere Commits auf den neuen Branch.

### Schritt 2 — Branch von upstream erstellen

```bash
git checkout -b sync/rebuild-from-upstream eb36890
```

### Schritt 3 — DSA5-Änderungen selektiv portieren

Für jede Datei in `packages/mcp-server/src/systems/dsa5/` und neue DSA5-Tools:

```bash
git checkout master -- packages/mcp-server/src/systems/dsa5/
git checkout master -- packages/foundry-module/src/queries.ts
# etc.
```

Anschließend: `npm run typecheck` und `npm run test` müssen 0 Fehler liefern.

### Schritt 4 — `data-access.ts` neu abgleichen

Die generischen Ergänzungen (z.B. `preserveItemTypes?: string[]` als Parameter,
ohne hardcoded DSA5-Listen) werden neu auf Basis der upstream-Version geschrieben.
Upstream-Cosmere-Additions bleiben unverändert.

### Schritt 5 — master ersetzen

Nach Freigabe durch Frank:
```bash
git checkout master
git reset --hard sync/rebuild-from-upstream
git push --force-with-lease origin master
```

---

## Dateien mit bekannten Divergenzen

| Datei | Unsere Änderung | Upstream-Änderung | Aktion beim Rebuild |
|-------|-----------------|-------------------|---------------------|
| `packages/foundry-module/src/data-access.ts` | DSA5 preserveItemTypes, Duplikat-Fixes | Cosmere RPG Types, Prettier | Upstream-Basis, generische DSA5-Parameter re-add |
| `packages/mcp-server/src/tools/character.ts` | DSA5-Extract-Logik | Cosmere async-Adapter-Muster, Prettier | Upstream-Basis, DSA5-Adapter portieren |
| `packages/mcp-server/src/backend.ts` | Keine bewusste Änderung | Prettier, Cosmere-Registrierung | Upstream-Basis übernehmen |
| `packages/mcp-server/src/systems/types.ts` | DSA5-spezifische Typen | Cosmere RPG Union-Typen | Beide Erweiterungen kombinieren |
| `packages/mcp-server/src/tools/quest-creation.ts` | Folder-Support cherry-pick | Upstream Folder-Support | Upstream-Version übernehmen (identische Funktion) |

---

## Was NICHT ausgeführt wird, bis Frank freigibt

- Kein `git reset --hard` auf master
- Kein `git push --force`
- Kein `git merge upstream/master` direkt auf aktuellem master

Dieser Plan ist ein Dokument, keine Queue. Änderungen erst nach expliziter
Freigabe.
```

**Commit-Message für Aufgabe 3:**
```
docs: add upstream sync recovery plan (pending Frank approval)
```

---

## Constraints für deine Ausführung

- **Nur Aufgaben 1, 2, 3 ausführen** — kein weiterer Scope
- **Kein `git merge upstream/master`** — das ist explizit ausgeschlossen
- **Kein `git reset`** — SYNC_PLAN.md dokumentiert nur, wartet auf Freigabe
- Nach jedem Commit: `npm run typecheck` laufen lassen (Erwartung: 0 Fehler, da nur `.md`-Dateien)
- Drei separate Commits, je einer pro Aufgabe

## Erfolgskriterien

- [ ] `AGENTS.md` enthält die zwei neuen Abschnitte am Ende
- [ ] `ROADMAP.md` hat Regel 4 unter "Non-Negotiable Product Rules"
- [ ] `SYNC_PLAN.md` existiert im Repo-Root mit vollständigem Inhalt
- [ ] `git log --oneline -3` zeigt drei neue Commits mit den angegebenen Messages
- [ ] `npm run typecheck` liefert 0 Fehler
