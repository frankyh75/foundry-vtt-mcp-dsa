# A) Repo-Überblick – Foundry VTT MCP Bridge (Ist-Stand)

## Entry Points
- **Monorepo Root**: npm workspaces orchestrieren `packages/mcp-server`, `packages/foundry-module`, `shared`. Root-Skripte delegieren Build/Dev/Test pro Workspace. 
- **MCP Wrapper/CLI Entry**: `packages/mcp-server/src/index.ts` startet als shebang-CLI, initialisiert MCP-Server (stdio) und spawnt den Backend-Prozess (`backend.js`/`backend.bundle.cjs`).
- **MCP Backend Entry**: `packages/mcp-server/src/backend.ts` initialisiert Logger, Foundry-Connector, Tool-Instanzen, System-Adapter (dnd5e/pf2e/dsa5), und TCP-Control-Channel (`127.0.0.1:31414`).
- **Foundry Module Entry**: `packages/foundry-module/src/main.ts` registriert Settings/Queries/Hooks und startet Socket-Brücke innerhalb Foundry.
- **Foundry Query Surface**: `packages/foundry-module/src/queries.ts` registriert die Query-Endpunkte in `CONFIG.queries[...]` (Read/Write, Kampagne, Map, Token, Ownership).

## Hauptmodule und Datenfluss (heutige Architektur)
1. Claude Desktop → MCP stdio → `mcp-server/src/index.ts`
2. Wrapper → lokales TCP JSON-lines (`31414`) → `mcp-server/src/backend.ts`
3. Backend → `FoundryClient`/`FoundryConnector` (WebSocket/WebRTC) → Foundry Module
4. Foundry Module QueryHandlers → Foundry DataAccess/World APIs
5. Optional: Map-Generation via `ComfyUIClient` (lokal, `127.0.0.1:31411`)

## Konfiguration
- Zentral in `packages/mcp-server/src/config.ts` via `dotenv` + `zod`-Schema.
- Konfigurierbar u.a. Log-Level/-Format, Foundry Host/Port/Namespace, Verbindungsmodus (websocket/webrtc/auto), STUN-Server, ComfyUI-Pfad/Host/Port.

## Verwendete SDKs/APIs
- MCP: `@modelcontextprotocol/sdk`
- Runtime/Validation: TypeScript, `zod`
- Transport: `ws`, `werift` (WebRTC)
- Logging: `winston`
- HTTP/Downloads: `axios`, `fetch`
- Datenbank/Indexing: `better-sqlite3`

## Cloud-/Remote-Abhängigkeiten (identifiziert)
- **Primäre AI-Laufzeit** ist aktuell indirekt cloudgebunden über Claude Desktop als Host-LMM (MCP-Consumer), nicht über eigene OpenAI/Anthropic SDK-Aufrufe im Repo.
- WebRTC-Default nutzt öffentliche Google STUN-Server (`stun.l.google.com`, `stun1.l.google.com`) in `config.ts`.
- Mac-Installer lädt ComfyUI und Modelle via externe URLs (`download.comfy.org`, `huggingface.co`).
- Optionales Remote-Betriebsprofil vorhanden (`foundry.remoteMode`, `FOUNDRY_REMOTE_MODE`), plus WebRTC-Signaling/remote connection paths.

## Auffälligkeiten für spätere Local-First-Refactors
- Kein dediziertes Ingest/Segment/Structure/Validate/Export-Pipeline-Modul vorhanden (muss neu eingeführt werden).
- Kein LLM-Provider-Layer mit austauschbaren Backends (Ollama/LM Studio/Cloud) vorhanden.
- Logging enthält teils strukturierte Metadaten/Inputs sowie explizites Debug-File-Append in `backend.ts` (Datenschutz/Compliance-Risiko).
