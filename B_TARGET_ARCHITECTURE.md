# B) Zielarchitektur fuer Local-First-Betrieb

## 1. Kontext / Problemstellung
Das zentrale Risiko ist urheberrechtlich und compliance-seitig: Wenn ein Cloud-AI-Client (z. B. Claude Desktop oder ChatGPT) als MCP-Consumer genutzt wird, koennen DSA5-Kompendiumsdaten im Rahmen von Prompts/Tool-Responses an externe Anbieter-Server uebertragen werden. Fuer Ulisses-relevante Inhalte ist das ein kritischer Punkt. Ein Local-First-Setup mit lokalem MCP-Client und lokalem LLM (z. B. LM Studio + Ollama) reduziert dieses Risiko grundsaetzlich, weil Verarbeitung und Speicherung auf der Maschine des End-Users bleiben.

## 2. Ist- vs. Soll-Zustand (ASCII-Diagramm)

```text
IST (heute)                                           SOLL (Local-First)

[Foundry VTT]                                         [Foundry VTT]
      |                                                     |
      v                                                     v
[MCP Server lokal]                                     [MCP Server lokal]
      |                                                     |
      v                                                     v
[Claude Desktop MCP-Client]                            [LM Studio MCP-Client]
      |                                                     |
      v                                                     v
[Anthropic API (Cloud)]                                [Ollama Runtime (lokal)]
                                                        (alternativ lokal in LM Studio)
```

Wichtige Einordnung: Der MCP-Server selbst laeuft bereits lokal. Es braucht keinen strukturellen Refactor der Server-Architektur, sondern nur gezielte Betriebs-/Konfigurationsanpassungen fuer Local-First-Defaults.

## 3. Empfohlene lokale MCP-Clients fuer End-User

| Client | MCP-Support | Chat-UI geeignet | Ollama-kompatibel | Einrichtungsaufwand |
|---|---|---|---|---|
| LM Studio >= 0.3 (primaer empfohlen) | Ja (MCP-Client-Funktion vorhanden) | Ja | Ja | Niedrig bis mittel |
| Jan.ai | Ja (je nach Version/Plugin-Stand) | Ja | Ja | Mittel |
| Open WebUI | Ja (via MCP-/Tooling-Integration im Stack) | Ja | Ja | Mittel bis hoeher |

## 4. Minimale Code-Aenderungen (nur diese drei)

### 4a. STUN-Server konfigurierbar machen
- Betroffene Datei(en): `packages/mcp-server/src/config.ts`
- Aktueller Zustand: WebRTC-Defaults enthalten Google-STUN (`stun.l.google.com`, `stun1.l.google.com`), auch wenn keine explizite lokale ICE-Konfiguration gesetzt ist.
- Soll-Zustand: Neue `ICE_SERVERS`-Env-Variable; Default ist leer (`[]`). Im LAN funktioniert WebRTC damit ohne externen STUN-Zwang.
- Interface-Skizze:

```ts
// config.ts (Skizze)
const iceServers = parseIceServers(process.env.ICE_SERVERS ?? '');

foundry: {
  webrtc: {
    iceServers,
  }
}
```

```env
# Beispiel
ICE_SERVERS=
# oder explizit:
# ICE_SERVERS=stun:stun.example.org:3478,turn:turn.example.org:3478?transport=udp
```

### 4b. Debug-Log opt-in
- Betroffene Datei(en): `packages/mcp-server/src/backend.ts`
- Aktueller Zustand: Debug-Append fuer Map-/Handler-Flows laeuft standardmaessig permanent.
- Soll-Zustand: Debug-Dateilog nur bei explizitem Opt-in (`AUDIT_LOG=true`), Default bleibt `false`.
- Interface-Skizze:

```ts
// backend.ts (Skizze)
if (process.env.AUDIT_LOG === 'true') {
  appendFileSync(logPath, line);
}
```

```env
# Default (empfohlen)
AUDIT_LOG=false

# Nur bei gezielter Analyse
AUDIT_LOG=true
```

### 4c. README-Abschnitt "Local LLM Setup"
- Betroffene Datei(en): `README.md` (oder bestehende End-User-Doku)
- Aktueller Zustand: Fokus liegt auf bestehendem MCP-Betrieb; Local-LLM-Onboarding ist nicht als klarer Standardpfad beschrieben.
- Soll-Zustand: Dokumentations-Stub fuer Local-First-Setup ohne Codeaenderung.
- Config-/Doku-Skizze:

```json
{
  "mcpServers": {
    "foundry-mcp": {
      "command": "node",
      "args": ["packages/mcp-server/dist/index.js"]
    }
  }
}
```

Inhalt des README-Abschnitts (Stub):
- LM Studio herunterladen und starten.
- MCP-Server identisch zur Claude-Desktop-`config.json` eintragen.
- Modell ueber Ollama oder lokalen LM-Studio-Model-Runner auswaehlen.

## 5. Explizit NOT in Scope
- ComfyUI/HuggingFace-Downloads: Bleibt optionales Feature, kein Pflicht-Touchpoint fuer Local-First-MCP-Betrieb.
- Neuer `LOCAL_MODE`-Flag: Nicht noetig; erzeugt zusaetzliche Komplexitaet ohne klaren Mehrwert gegenueber gezielten Defaults.
- MCP-Server-Protokollumbau: Bleibt `stdio`; keine Aenderung am Protokoll/Transportmodell erforderlich.
- Upstream-Kompatibilitaet: `packages/foundry-module/src/data-access.ts` bleibt unberuehrt (keine systemspezifische Abzweigung).

## 6. Compliance-Tabelle

| Szenario | Ulisses-konform? | DSA5-Kompendiumsdaten verlassen Maschine? | Empfehlung |
|---|---|---|---|
| Cloud (Claude Desktop + Cloud-API) | Risikohaft / nur mit strikter Inhaltsdisziplin | Potenziell ja | Fuer DSA5-Kompendiumsdaten nicht empfohlen |
| Lokal (LM Studio + Ollama) | Deutlich besser kontrollierbar | Nein (bei korrekter lokaler Konfiguration) | Primaerer Zielbetrieb |
| Hybrid (eigene Inhalte in Cloud, DSA5 lokal) | Moeglich bei klarer Trennung | Teilweise (nur nicht-kritische Inhalte) | Nur mit klarer Data-Governance und Prozessregeln |
