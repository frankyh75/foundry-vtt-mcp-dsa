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

*Erstellt: 2026-08-16*
*Quelle: FoundryVTT MCP Bridge Repository*
