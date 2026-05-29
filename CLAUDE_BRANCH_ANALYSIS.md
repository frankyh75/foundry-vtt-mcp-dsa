# Branch-Status-Analyse: foundry-vtt-mcp-dsa

**Erstellt:** 2026-05-29
**Zweck:** Zweitmeinung von Claude Code zu Divergenz-Management und Upstream-Sync-Strategie

---

## 1. Problem: Unsere Divergenz von Upstream

**Upstream:** `adambdooley/foundry-vtt-mcp` @ `eb36890`  
**Unser Fork:** `frankyh75/foundry-vtt-mcp` → lokaler `master`

Unser `master` ist **~14 Commits voraus** und **nicht mehr mergbar** mit `upstream/master` (`eb36890`). Die Divergenz entstand durch ursprüngliche Cherry-Picks von Adams Upstream + anschließende DSA5-Entwicklung auf unserem eigenen `master`.

### Warum kein normaler Merge möglich ist:
- Unser `master` hat Adams Commits als eigene Commits (unterschiedliche SHAs)
- `git merge upstream/master` erzeugt hunderte Konflikte
- Ein erzwungener Merge würde unsere DSA5-Arbeit riskieren

---

## 2. Inventar der divergierten Commits (auf unserem `master`)

### A. Upstream-übernommene Features (wir haben sie als eigene Commits)
| Commit | Beschreibung | Source |
|--------|-------------|--------|
| `eb36890` | Merge PR48 from sazap10/master | ** upstream** |
| `8625349` | Refactor: consolidate world/actor item tools | ** upstream** |
| `8c30bee` | Fix: remove duplicate addActorItems | ** upstream** |
| `9d8f7a2` | Fix: resolve merge conflicts in data-access | ** upstream** |
| ... | *(weitere ~8 Commits)* | ** upstream** |

### B. DSA5-eigene Commits (unsere Arbeit)
| Commit | Beschreibung | Portiert auf Rebuild? |
|--------|-------------|----------------------|
| `683c2ae` | DSA5 JSON Actor Importer | ** JA ** |
| `d332f48` | Actor-from-Description Tool | ** JA ** |
| `4251b8c` | Adventure Import Tool | ** JA ** |
| `4ed6ebe` | queries.ts: handleAddActorItems | ** ENTFERNT ** (upstream hat addActorItems) |
| `6e0b0ed` | queries.ts: generic additions | ** TEILWEISE ** (nur getPackIndex/createActorFromData/createScenePlaceholder) |
| `105a7c2` | data-access.ts: preserveItemTypes | ** NICHT ** (nur in `createActorFromData`, keine separate Funktion) |
| `7b08c61` | Foundry Pack Index Tool | ** TEILWEISE ** (getPackIndex in data-access, kein Tool) |
| `d9f6527` | Scene Placeholder Tool | ** TEILWEISE ** (createScenePlaceholder in data-access, kein Tool) |
| `b63f452` | Token Position Calculation | ** NICHT ** (in generischem createActorFromData mitenthalten) |
| `9881e7a` | Import Folder Handling | ** JA ** (in generic createActorFromData) |
| `f10a3ae` | Data Model Cleanup | ** JA ** (in generic createActorFromData) |

### C. Dokumentation-Commits (außerhalb der 11)
| Commit | Beschreibung |
|--------|-------------|
| `f10a3ae~n` | recovery-backup, INVENTAR.md |
| ... | AGENTS.md, ROADMAP.md, SYNC_PLAN.md |

---

## 3. Rebuild-Branch Status

**Branch:** `sync/rebuild-from-upstream` (basis: `eb36890`)

### Bereits portiert (3 Commits):
```
7ba5c93 chore: add recovery backup patches
a43d44e fix(data-access): add generic createActorFromData, createScenePlaceholder, getPackIndex
ad81e3e feat(dsa5): port DSA5 module, adventure import, actor-from-description
```

### Was funktioniert:
- `npm run typecheck` im `@foundry-mcp/server` und `@foundry-mcp/shared`: **✅ SAUBER**
- `npm run typecheck` im `@foundry-mcp/module`: **⚠️ PRE-EXISTING ERRORS** (Foundry-Globals: `game`, `Actor`, `CONFIG` — diese Fehler existieren bereits im upstream und sind ein bekanntes TypeScript-Konfigurationsproblem)

### Was noch fehlt (Nicht-Portiert):
1. **Pack-Index Tool** (`getPackIndex`) — nur in `data-access.ts`, kein MCP-Tool
2. **Scene-Placeholder Tool** (`createScenePlaceholder`) — nur in `data-access.ts`, kein MCP-Tool
3. **Token-Positionierung** — nur generisch in `createActorFromData`, keine eigene Funktion
4. **preserveItemTypes** Logik — nur in generischem `createActorFromData`

---

## 4. Offene Entscheidungen

### Entscheidung A: Master reset oder nicht?

**Option A1: Hard reset master → rebuild-branch**
- `git checkout master`
- `git reset --hard sync/rebuild-from-upstream`
- `git push --force-with-lease origin master`
- **Vorteil:** Sauberer History, upstream-kompatibel, zukünftige Pulls einfach
- **Risiko:** Force-push auf origin/master zerstört alte History (wenn andere Branches darauf basieren)

**Option A2: Merge statt reset**
- `git checkout master`
- `git merge --squash sync/rebuild-from-upstream`
- `git commit`
- **Nachteil:** History bleibt chaotisch, Merge-Conflicts wahrscheinlich

**Empfohlung:** Option A1 (Hard Reset)

### Entscheidung B: Fehlende Tools nachbauen?

Die Tools `getPackIndex` und `createScenePlaceholder` gibt es als `data-access.ts`-Methoden, aber keine MCP-Tools (keine Einträge in `backend.ts`). Bei Bedarf können diese nachgebaut werden — die Logik ist bereits vorhanden.

---

## 5. Guidelines für zukünftiges Upstream-Management

Damit dies nicht wieder passiert:

### Regel 1: Nie direkt auf `master` entwickeln
- `master` bleibt immer fast-forward-mergbar mit `upstream/master`
- Feature-Arbeit auf `feature/`-Branches
- DSA5-Arbeit auf `feature/dsa5-*`-Branches

### Regel 2: Upstream-Sync als expliziter Schritt
```bash
git fetch upstream
git checkout master
git merge upstream/master  # oder rebase, falls sauber
```

### Regel 3: Keine Cherry-Picks von Upstream-Commits
- Cherry-picks erzeugen divergierende SHAs
- Stattdessen: `merge` oder `rebase` verwenden

### Regel 4: Pro Feature: Branch → PR → Merge
- Selbst bei Solo-Entwicklung: Feature-Branche → Review → Merge auf master
- Ermöglicht sanftes Zurücksetzen bei Fehlentscheidungen

### Regel 5: Vor jedem Release: Upstream-Check
```bash
git log --oneline upstream/master..master  # Zeigt unsere zusätzlichen Commits
```

---

## 6. Dateien im recovery-backup/

| Datei | Zweck |
|-------|-------|
| `INVENTAR.md` | Vollständige Commit-Liste mit Kategorien |
| `add_createActorFromData.patch` | Generische `createActorFromData` aus master |
| `add_createScenePlaceholder.patch` | Generische `createScenePlaceholder` aus master |
| `func_*.txt` | Einzelfunktions-Backups |

---

*Analyse erstellt von Jarvis für Claude-Code-Zweitmeinung.*
