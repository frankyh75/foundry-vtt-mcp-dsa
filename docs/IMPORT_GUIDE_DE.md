# Bedienungsanleitung: DSA5-Abenteuer (Heldenwerk-PDFs) nach Foundry VTT importieren

> **Zielgruppe:** Anwender mit lokalem Repository-Checkout, Foundry VTT lokal oder auf Forge, und Claude Desktop (MCP).
> **Wichtig:** Dieses Repository ist **kein PDF-Importer**. Es ist eine MCP-Bridge zwischen Foundry VTT und Claude Desktop. Alle Schritte sind am IST-Stand des Repos ausgerichtet.

---

## A. Überblick (Was macht das Repo, was nicht)

**Was das Repo macht:**
- Stellt eine MCP-Server/Foundry-Modul-Brücke bereit, damit Claude Desktop Foundry-Daten lesen/schreiben kann (Journals/Quests, Actors, Compendium-Suche, Scenes, Würfelanfragen etc.).
  - Quellen: `README.md` (Installation/Übersicht), `packages/mcp-server/src/tools/*.ts` (Tool-Definitionen), `packages/foundry-module/src/queries.ts` (Foundry-Query-Endpunkte).
- Unterstützt DSA5 (Adapter + Filter/Indexing im MCP-Server). Quelle: `packages/mcp-server/src/systems/dsa5/README.md`.
- MCP-Server startet per **STDIO-Transport** (Claude Desktop startet den Server und kommuniziert via STDIO). Quelle: `packages/mcp-server/src/index.ts` (StdioServerTransport).

**Was das Repo nicht macht:**
- **Kein PDF-Parsing, keine OCR, kein Bild-Extraktor für Heldenwerk-PDFs.**
  - Erwartete Dateien/Configs: z. B. `src/import/pdf/*`, `docs/pdf-import.md`, oder CLI-Tool in `package.json` (nicht vorhanden).
- **Kein Direkt-Import aus PDF-Bildern.**
  - Die neue Abenteuer-Pipeline arbeitet mit bereits extrahiertem Text.

**Was das Repo inzwischen macht:**
- Es gibt eine strukturierte **Adventure-Import-Pipeline** mit Schema, Text-Normalizer, LLM-Worker, Foundry-Importer und MCP-Tool.
  - Siehe: `docs/ADVENTURE_IMPORT_WORKFLOW.md`.

---

## B. Voraussetzungen

**System/Software**
- **Windows 10/11** (empfohlen laut Installer-Doku) oder manuelle Installation mit **Node.js 18+**. Quellen: `README.md`, `INSTALLATION.md`, `package.json` (engines).
- **Foundry VTT v13** (Modul kompatibel min/verified/max 13). Quelle: `packages/foundry-module/module.json`.
- **Claude Desktop** mit MCP-Support (Repo-Installation setzt Claude Desktop voraus). Quelle: `README.md`, `INSTALLATION.md`.

**DSA5-System**
- DSA5-Unterstützung ist vorhanden (Adapter/Filter). Quelle: `packages/mcp-server/src/systems/dsa5/README.md`.
- **Unklar/Fehlt im Repo:** Konkrete DSA5-System-Version (z. B. Foundry-Systempaket-Version) wird nicht genannt.
  - Erwartete Stelle: DSA5-spezifische Installationsanleitung (z. B. `INSTALL_DSA5.md`) oder Versionsangabe im README.

**Berechtigungen/Foundry**
- MCP-Bridge arbeitet **GM-only** (Schreibzugriffe nur GM). Quelle: `packages/foundry-module/src/queries.ts` (GM-Check).

---

## C. Installation

> Die folgenden Befehle entsprechen den Repository-Skripten und README/INSTALLATION.

1) **Repository klonen**
```bash
git clone https://github.com/adambdooley/foundry-vtt-mcp.git
cd foundry-vtt-mcp
```
Quelle: `README.md`, `INSTALLATION.md`.

2) **Dependencies installieren und bauen**
```bash
npm install
npm run build
```
Quelle: `README.md`, `INSTALLATION.md`, `package.json` (scripts).

3) **Foundry-Modul installieren**
- Foundry → Add-ons → Modul installieren → Manifest-URL:
  `https://github.com/adambdooley/foundry-vtt-mcp/blob/master/packages/foundry-module/module.json`
- Modul aktivieren: **Foundry MCP Bridge**.
Quelle: `README.md`, `INSTALLATION.md`, `packages/foundry-module/module.json`.

4) **MCP-Server via Claude Desktop starten (STDIO)**
- In `claude_desktop_config.json` einen MCP-Server-Eintrag hinzufügen (Beispiel):
```json
{
  "mcpServers": {
    "foundry-mcp": {
      "command": "node",
      "args": ["path/to/foundry-vtt-mcp/packages/mcp-server/dist/index.js"],
      "env": {
        "FOUNDRY_HOST": "localhost",
        "FOUNDRY_PORT": "31415"
      }
    }
  }
}
```
Quelle: `README.md`, `INSTALLATION.md`; STDIO-Start: `packages/mcp-server/src/index.ts`.

---

## D. Konfiguration

### D.1 MCP-Server (ENV)
**Ort:** Umgebungsvariablen für den MCP-Server (z. B. in Claude Desktop `env`-Block oder `.env`).

**Wichtige Keys (Auszug):**
- `FOUNDRY_HOST`, `FOUNDRY_PORT`, `FOUNDRY_NAMESPACE`, `FOUNDRY_CONNECTION_TYPE`, `FOUNDRY_REMOTE_MODE`, `FOUNDRY_DATA_PATH`, `FOUNDRY_REJECT_UNAUTHORIZED`, `FOUNDRY_STUN_SERVERS`.
- `COMFYUI_PORT`, `COMFYUI_INSTALL_PATH`, `COMFYUI_HOST`, `COMFYUI_PYTHON_COMMAND` (nur Map-Generation).
Quelle: `packages/mcp-server/src/config.ts`.

**Beispiel (lokal):**
```env
FOUNDRY_HOST=localhost
FOUNDRY_PORT=31415
FOUNDRY_CONNECTION_TYPE=auto
FOUNDRY_NAMESPACE=/foundry-mcp
```

**Unklar/Fehlt im Repo:**
- Welche Werte für **Forge/Remote** wirklich notwendig sind (z. B. `FOUNDRY_REMOTE_MODE`, `FOUNDRY_DATA_PATH`) werden nicht dokumentiert.
  - Erwartete Stelle: Doku zu Remote/Forge-Betrieb (z. B. `docs/forge.md`).

### D.2 Foundry-Modul-Einstellungen
**Ort:** Foundry → Einstellungen → Moduleinstellungen → **Foundry MCP Bridge**.

**Wichtige Einstellungen (aus README):**
- Connection Type (Auto/WebRTC/Websocket)
- Websocket Server Host
- Allow Write Operations
- Auto-Reconnect
Quelle: `README.md` (Settings-Sektion).

---

## E. Import-Workflow (Schritt-für-Schritt)

> **Kurzfassung:** Dieses Repo importiert **keine PDFs automatisch**. Du musst den Inhalt (Text/Bilder) extern vorbereiten und dann über Claude Desktop + MCP-Tools in Foundry anlegen.

### E.1 PDF vorbereiten (Text/Bilder)
**Unklar/Fehlt im Repo:**
- Es gibt **keine** Funktionen für PDF-Parsing/OCR/Bild-Extraktion.
  - Erwartete Dateien/Tools: z. B. `scripts/pdf-import.js`, `docs/pdf-import.md`.

**Praktische Konsequenz:**
- Text aus dem Heldenwerk-PDF manuell oder mit externen Tools extrahieren.
- Bilder (Handouts, Karten) separat exportieren und in Foundry selbst hochladen (Foundry-UI, nicht Teil dieses Repos).

### E.2 Datenformat/Intermediate
**Unklar/Fehlt im Repo:**
- Kein vorgegebenes Import-JSON oder Schema für Abenteuer/Handouts.
  - Erwartete Dateien: `schemas/adventure.json`, `examples/adventure/*`.

### E.3 Inhalte in Foundry anlegen (über MCP-Tools)
**Verfügbare MCP-Tools, die für einen Import helfen:**
- **Journals/Quests:** `create-quest-journal`, `update-quest-journal`, `list-journals`, `search-journals`.
  - Quelle: `packages/mcp-server/src/tools/quest-creation.ts`.
- **Actors aus Compendium:** `search-compendium`, `get-compendium-item`, `create-actor-from-compendium`.
  - Quelle: `packages/mcp-server/src/tools/compendium.ts`, `packages/mcp-server/src/tools/actor-creation.ts`.
- **Scenes (anzeigen/wechseln):** `list-scenes`, `switch-scene`, `get-current-scene`.
  - Quelle: `packages/mcp-server/src/tools/map-generation.ts`, `packages/mcp-server/src/tools/scene.ts`.

**Ablauf (empfohlen):**
1) **Foundry starten** und DSA5-Welt laden. (Foundry muss laufen, sonst keine Verbindung.)
2) **Claude Desktop starten** (startet MCP-Server per STDIO).
3) **In Claude Desktop** Inhalte in sinnvolle Blöcke aufteilen (z. B. Prolog, Kapitel, NPCs, Orte).
4) **Für jeden Block** ein Journal anlegen:
   - Tool: `create-quest-journal` (Titel + Beschreibung).
5) **NPC/Creature** aus DSA5-Compendium suchen und ggf. als Actor anlegen:
   - Tools: `search-compendium` → `create-actor-from-compendium`.
6) **Journals aktualisieren** (z. B. mit Auszügen oder strukturierten Abschnitten):
   - Tool: `update-quest-journal`.
7) **Ergebnis in Foundry prüfen**: Journal-Inhalte, Actor-Details, Scenes.

---

## F. Quests-Import (separat)

### F.1 Wie Quests/Quest-Steps angelegt werden
**Verfügbar:**
- `create-quest-journal` erzeugt ein Journal mit quest-typischem HTML-Layout.
- `update-quest-journal` erweitert Journal-Inhalte (Quest-Fortschritt usw.).
- `link-quest-to-npc` verbindet Quest-Journal mit NPCs (per Name). 
Quellen: `packages/mcp-server/src/tools/quest-creation.ts`.

**Unklar/Fehlt im Repo:**
- Kein eigenes Quest-„Step“-System oder JSON-Format.
  - Erwartete Dateien: `schemas/quest.json`, `tools/quest-steps.ts`.

### F.2 Minimalfelder (zwingend)
- `create-quest-journal`: **questTitle** + **questDescription** (Pflichtfelder).
- `update-quest-journal`: **journalId**, **newContent**, **updateType**.
- `link-quest-to-npc`: **journalId**, **npcName**, **relationship**.
Quelle: `packages/mcp-server/src/tools/quest-creation.ts`.

### F.3 Verlinkungen (Journal/Scene/Actor)
- **Im Repo vorhanden:** Verlinkung von Quest-Journal zu NPC via `link-quest-to-npc` (NPC-Name). 
- **Unklar/Fehlt im Repo:** Kein allgemeiner „UUID-Linker“ für Scenes/Actors/Journals.
  - Erwartete Stelle: Tool wie `link-journal-to-scene` oder explizite UUID-Referenzen in einer Import-Pipeline.

---

## G. Troubleshooting

### G.1 Häufige Fehler & Fixes
1) **MCP-Server verbindet nicht mit Foundry**
   - Prüfe `FOUNDRY_HOST`/`FOUNDRY_PORT` (Standard 31415). Quelle: `packages/mcp-server/src/config.ts`.
   - Foundry-Modul aktiv und GM eingeloggt? (GM-only). Quelle: `packages/foundry-module/src/queries.ts`.

2) **Schreibzugriffe funktionieren nicht**
   - Foundry-Modul-Einstellung „Allow Write Operations“ aktivieren. Quelle: `README.md` (Settings).

3) **Verbindungsprobleme lokal/remote**
   - Connection Type (Auto/WebRTC/Websocket) prüfen. Quelle: `README.md`.
   - Für Remote/Forge sind spezielle Werte unklar (siehe D.1 „Unklar/Fehlt“).

4) **DSA5-Filter oder DSA5-Daten fehlen**
   - DSA5-Adapter/Filter existieren, aber erfordern DSA5-Systemdaten in der aktiven Welt. Quelle: `packages/mcp-server/src/systems/dsa5/README.md`.

### G.2 Diagnose-Schritte
- Claude Desktop → MCP-Verbindungen prüfen (Server gelistet?). Quelle: `INSTALLATION.md`.
- Foundry-Konsole (F12) auf `[foundry-mcp-bridge]`-Logs prüfen. Quelle: `packages/foundry-module/src/socket-bridge.ts`.

---

## H. Beispiele

### H.1 Minimalbeispiel: „Hello Adventure“ (Beispiel *neu*)
> **Hinweis:** Dieses Beispiel ist **nicht im Repo vorhanden**. Es zeigt nur, wie man die bestehenden MCP-Tools nutzen könnte.

**Ziel:** 1 Journal, 1 Scene (nur Auswahl), 1 Actor aus Compendium, 1 Quest mit 2 Updates.

1) **Journal/Quest anlegen**
   - Tool: `create-quest-journal`
   - Eingaben (Beispiel):
     - questTitle: `Hello Adventure`
     - questDescription: `Die Helden treffen sich in der Taverne und erhalten ihren Auftrag.`

2) **Quest-Fortschritt hinzufügen**
   - Tool: `update-quest-journal`
   - Eingaben (Beispiel):
     - journalId: `<ID aus Schritt 1>`
     - newContent: `Die Helden sprechen mit dem Wirt und erhalten Hinweise.`
     - updateType: `progress`

3) **NPC/Actor aus Compendium erzeugen**
   - Tools: `search-compendium` → `create-actor-from-compendium`
   - Eingaben (Beispiel):
     - query: `Wirt` (suche im DSA5-Compendium)
     - packName + entryId aus dem Suchergebnis

4) **Quest mit NPC verlinken**
   - Tool: `link-quest-to-npc`
   - Eingaben (Beispiel):
     - journalId: `<ID aus Schritt 1>`
     - npcName: `Wirt`
     - relationship: `quest_giver`

5) **Scene prüfen/wechseln**
   - Tools: `list-scenes` → `switch-scene` (falls vorhanden)

**Quelle der Tools:** `packages/mcp-server/src/tools/quest-creation.ts`, `packages/mcp-server/src/tools/compendium.ts`, `packages/mcp-server/src/tools/actor-creation.ts`, `packages/mcp-server/src/tools/map-generation.ts`, `packages/mcp-server/src/tools/scene.ts`.

---

## Anhang: Tool-Endpunkte (Foundry-Queries)

Die MCP-Tools rufen Foundry-Queries mit dem Prefix `foundry-mcp-bridge.*` auf, z. B.:
- `foundry-mcp-bridge.createJournalEntry`
- `foundry-mcp-bridge.createActorFromCompendium`
- `foundry-mcp-bridge.listJournals`
Quelle: `packages/foundry-module/src/queries.ts`.

---

**Kurzfazit:** Dieses Repo ist eine MCP-Brücke für Claude Desktop und Foundry VTT mit DSA5-Support. Es unterstützt **keine** automatische PDF-Import-Pipeline. Ein Import aus Heldenwerk-PDFs ist nur über manuelle Vorarbeit (Text/Bilder extrahieren) und anschließendes Anlegen/Updaten von Journals/Actors via MCP-Tools möglich.
