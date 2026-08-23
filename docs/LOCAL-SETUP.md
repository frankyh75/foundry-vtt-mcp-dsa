# Local Setup Guide — FoundryVTT MCP Bridge

Dieser Guide beschreibt die Installation und Konfiguration der FoundryVTT MCP Bridge für die lokale Arbeit mit FoundryVTT und einem lokalen Hermes Agent.

## Komponenten

Die FoundryVTT MCP Bridge besteht aus zwei Komponenten:

1. **MCP-Server** — Node.js-Server, der WebSocket-Verbindungen empfängt
2. **FoundryVTT-Modul** — Browser-seitiges Modul, das die Verbindung aufbaut

```
FoundryVTT-Modul (Browser) ←→ WebSocket (ws://localhost:31415) ←→ MCP-Server (Port 31415)
```

## Voraussetzungen

- **FoundryVTT v13 oder v14**
- **Node.js 18+** (oder npm)
- **Hermes Agent** (für MCP-Tool-Nutzung)

## Installation

### 1. MCP-Server installieren

```bash
cd ~/.hermes/foundry-vtt-mcp-dsa
npm install
npm run build
```

### 2. FoundryVTT-Modul installieren

Kopiere die Module-Dateien in das FoundryVTT-Modul-Verzeichnis:

```bash
cp -r ~/.hermes/foundry-vtt-mcp-dsa/packages/foundry-module/dist/* \
  ~/Library/Application\ Support/FoundryVTT/Data/modules/foundry-mcp-bridge/dist/
```

### 3. FoundryVTT-Modul aktivieren

Öffne FoundryVTT und aktiviere das Modul:

1. Gehe zu **Settings → Modules**
2. Finde **"Foundry MCP Bridge"**
3. Aktiviere es per Toggle
4. Klicke auf **"Enable"** im Modul-Setup

### 4. MCP-Server starten

```bash
cd ~/.hermes/foundry-vtt-mcp-dsa
npm start
```

Oder im Hintergrund starten:

```bash
nohup npm start > mcp-server.log 2>&1 &
```

## Konfiguration

### FoundryVTT-Modul

Die Module-Konfiguration erfolgt im FoundryVTT-Interface:

1. **Settings → Modules → Foundry MCP Bridge**
2. **Server Host**: `localhost`
3. **Server Port**: `31415`
4. **Connection Type**: `auto` (wählt automatisch WebSocket oder WebRTC)

### Hermes Agent

Füge den MCP-Server zu deiner Hermes-Konfiguration hinzu:

```yaml
mcp_servers:
  foundry:
    command: /opt/homebrew/bin/node
    args:
    - /Users/agent/.hermes/foundry-vtt-mcp-dsa/packages/mcp-server/dist/index.js
    env:
      FOUNDRY_HOST: localhost
      FOUNDRY_PORT: '31415'
      FOUNDRY_PROTOCOL: ws
    connect_timeout: 60.0
```

## Starten und Stoppen

### MCP-Server starten

```bash
cd ~/.hermes/foundry-vtt-mcp-dsa
npm start
```

### MCP-Server stoppen

```bash
# Finde die PID
lsof -i :31415 -P -t

# Stoppe den Prozess
kill <PID>
```

### FoundryVTT-Modul starten

FoundryVTT startet das Modul automatisch, sobald es aktiviert ist.

### FoundryVTT stoppen

```bash
# Finde die FoundryVTT-Process-PID
ps aux | grep "Foundry Virtual Tabletop" | grep -v grep

# Stoppe den Prozess
kill <PID>
```

## Verbindung testen

### WebSocket-Verbindung testen

```bash
nc -zv localhost 31415
```

### Aktive Verbindungen prüfen

```bash
lsof -i :31415 -P -n
```

### FoundryVTT-Modul prüfen

```bash
ls ~/Library/Application\ Support/FoundryVTT/Data/modules/foundry-mcp-bridge/
```

## Reconnect-Mechanismus

### Client-seitiger Reconnect

Der FoundryVTT-Modul baut die Verbindung selbständig wieder auf:

- **Max Attempts**: 5
- **Backoff**: Exponentiell (1s → 2s → 4s → 8s → 16s → ~30s)
- **Total Time**: ~63 Sekunden

### Server-seitig

Der MCP-Server wartet nicht auf Verbindungen. Er empfängt nur eingehende Queries.

### Wichtige Regeln

1. **Reconnect ist client-initiiert** — Nur das FoundryVTT-Modul baut die Verbindung neu auf
2. **Clean Disconnect** — Kein Reconnect (z.B. manuelles Deaktivieren)
3. **Unclean Disconnect** — Reconnect mit exponentiellem Backoff
4. **Max 5 Attempts** — Danach aufgeben (~63 Sekunden total)

## Fehlerbehebung

### Problem 1: "Foundry VTT module not connected"

**Ursache**: WebSocket-Verbindung fehlt

**Lösung**:
1. FoundryVTT neu starten → Modul initialisiert SocketBridge neu
2. Reconnect abwarten (bis 63 Sekunden)
3. FoundryVTT-Modul in Settings aktivieren

### Problem 2: MCP-Server crasht

**Ursache**: FoundryVTT-Modul verliert Verbindung

**Lösung**:
1. MCP-Server neu starten
2. FoundryVTT-Modul wartet auf Reconnect (1s → 30s Backoff)
3. Wenn max 5 Attempts erreicht, Fehler melden

### Problem 3: FoundryVTT-Modul lädt nicht

**Ursache**: `module.json` defekt oder Module disabled

**Lösung**:
1. `module.json` prüfen
2. FoundryVTT-Modul in Settings aktivieren
3. FoundryVTT neu starten

### Problem 4: Netzwerk-Problem

**Ursache**: Firewall blockiert WebSocket

**Lösung**:
1. Port 31415 in Firewall erlauben
2. localhost-Verbindung testen (`nc -zv localhost 31415`)
3. FoundryVTT-Modul restarten

## Quick Fixes

### Reconnect erzwingen

```bash
# MCP-Server neustarten
kill $(lsof -i :31415 -P -t) && cd ~/.hermes/foundry-vtt-mcp-dsa && npm start

# FoundryVTT-Interface öffnet sich automatisch
# Oder: FoundryVTT neu starten
```

### Module deaktivieren/aktivieren

1. FoundryVTT → Settings → Modules
2. "Foundry MCP Bridge" finden
3. Toggle aktivieren/deaktivieren
4. FoundryVTT neu starten

## Debugging

### Manuelle Tests

```bash
# 1. MCP-Server Status
lsof -i :31415 -P

# 2. FoundryVTT-Modul prüfen
ls ~/Library/Application\ Support/FoundryVTT/Data/modules/foundry-mcp-bridge/

# 3. Logs prüfen
tail -100 ~/Library/Application\ Support/FoundryVTT/Logs/latest.log

# 4. WebSocket-Verbindung testen
nc -zv localhost 31415
```

### FoundryVTT-Interface

1. FoundryVTT öffnen
2. Module-Settings → "Foundry MCP Bridge" → "Enable"
3. Connection-Status prüfen (grün = verbunden, rot = getrennt)

## Zusammenfassung

| Aspekt | Client | Server |
|--------|--------|--------|
| **Verbindungsaufbau** | Ja (SocketBridge.connect()) | Nein (wartet nur) |
| **Reconnect** | Ja (exponentielles Backoff) | Nein |
| **Max Attempts** | 5 | N/A |
| **Total Time** | ~63 Sekunden | N/A |
| **Clean Disconnect** | Kein Reconnect | Kein Reconnect |
| **Unclean Disconnect** | Reconnect mit Backoff | Kein Reconnect |

**Wichtig:** Client (FoundryVTT-Modul) ist für Reconnect zuständig. Server (MCP-Server) wartet nicht auf Verbindungen.

---

## Adventure-Import & Actor-aus-Beschreibung: optionales LLM (DSGVO-lokal)

> **Dieser Abschnitt betrifft die Fork-Funktionen `import-dsa5-adventure-from-text` und `create-actor-from-description` (DSA5).** Sie sind **optional** — für die reine Nutzung der Foundry-Datenbrücke (Scenes, Actors, Journals, Dice-Rolls) wird **kein LLM** gebraucht. Nur wer Adventure-Text oder Actor-Beschreibungen per LLM importieren will, muss die Base-URL setzen.

### Warum der Backend-Start ohne diese URL fehlschlägt

Der Backend-Prozess (`backend.js`) instanziiert beim Start den `AdventureImportTools`-Wrapper, dessen Constructor sofort einen `AdventureImportWorker` erzeugt. Dieser wirft beim Boot eine Exception, wenn **keine** dieser Env-Variablen gesetzt ist:

```
Failed to start backend: Adventure import LLM base URL is missing.
Set ADVENTURE_IMPORT_LLM_BASE_URL, OPENAI_BASE_URL or ANTHROPIC_BASE_URL.
```

Konsequenz: Der MCP-Server (`index.js`) spawnet das Backend, das sofort mit Exit-Code 1 stirbt → alle `foundry_mcp`-Tools antworten mit **Timeout** statt `module not connected`. Das ist ein Boot-Blocker, kein Verbindungsproblem.

> **Hinweis (Roadmap):** Der sauberere Fix wäre, den Worker lazy (erst beim Tool-Aufruf) zu instanziieren, damit das Backend auch ohne LLM-URL startet. Bis dahin muss die Base-URL gesetzt sein, wenn der Backend-Prozess läuft.

### Welche Env-Variable (Priorität)

Der Worker liest die erste vorhandene (in dieser Reihenfolge):

1. `ADVENTURE_IMPORT_LLM_BASE_URL` (speziell)
2. `OPENAI_BASE_URL` (generisch — auch von anderen Tools genutzt)
3. `ANTHROPIC_BASE_URL`

Modell (analog): `ADVENTURE_IMPORT_LLM_MODEL` → `OPENAI_MODEL` → Default `gemma-4`.
API-Key: `ADVENTURE_IMPORT_LLM_API_KEY` → `OPENAI_API_KEY` → `ANTHROPIC_API_KEY` → Default `local`.

### Empfohlene Konfiguration — lokaler llama.cpp / Ollama-Server

Für eine DSGVO-sichere, kostenlose Einrichtung auf demselben Rechner (z.B. lokaler llama.cpp-Router auf Port 8081, Modell `ornith-1.5:35B`):

```bash
# In der Shell, die den MCP-Server startet (npm start) ODER in der Hermes-MCP-Config:
export OPENAI_BASE_URL="http://127.0.0.1:8081/v1"
export OPENAI_MODEL="ornith-1.5:35B"
```

### In Hermes (empfohlener Weg)

Ergänze die `env:`-Sektion der foundry-MCP-Server-Konfiguration:

```yaml
mcp_servers:
  foundry:
    command: /opt/homebrew/bin/node
    args:
    - /Users/<user>/.hermes/foundry-vtt-mcp-dsa/packages/mcp-server/dist/index.js
    env:
      FOUNDRY_HOST: localhost
      FOUNDRY_PORT: '31415'
      FOUNDRY_PROTOCOL: ws
      OPENAI_BASE_URL: http://127.0.0.1:8081/v1
      OPENAI_MODEL: ornith-1.5:35B
    connect_timeout: 60.0
```

Nach der Änderung den MCP-Server neu starten (bzw. Hermes-Gateway), damit das Backend mit der URL bootet.

### Cloud-Alternative (falls kein lokales LLM)

```yaml
env:
  OPENAI_BASE_URL: https://ollama.com/v1
  OPENAI_MODEL: deepseek-v4-flash:0731-cloud
```

Kostet Tokens, läuft aber ohne lokale GPU/Server.

### Fehlerbehebung

| Symptom | Ursache | Fix |
|---------|---------|-----|
| `foundry_mcp`-Tools → **Timeout (30s)** | Backend bootet nicht (fehlende LLM-URL) | `OPENAI_BASE_URL` (oder `ADVENTURE_IMPORT_LLM_BASE_URL`) setzen, MCP neu starten |
| Backend-Log: `Adventure import LLM base URL is missing` | Keine der 3 Env-Vars gesetzt | Eine der drei setzen |
| `Foundry VTT module not connected` (sofort) | WebSocket fehlt (nicht LLM) | Foundry neu starten, Modul aktivieren (siehe Problem 1 oben) |

---

*Erstellt: 2026-08-16*
*Quelle: FoundryVTT MCP Bridge Repository*
