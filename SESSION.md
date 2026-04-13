---
# Session Notes

## 2026-04-13: Local LLM Stack + Adventure Import Pipeline

### Ergebnis

Lokale LLM-Pipeline vollständig validiert:
- LM Studio + Qwen 2.5 7B als MCP-Client (konversationell)
- foundry-mcp-dsa als MCP-Server (34 Tools)
- Forge VTT (eu.forge-vtt.com) als Foundry-Ziel
- `import-dsa5-adventure-from-text` end-to-end getestet

### Hintergrund: Warum lokales LLM?

Ulisses Medien hat bestätigt: "lokale LLM wäre unproblematisch." Cloud-KI (Claude/ChatGPT) sendet Abenteuer-Inhalte an externe Server -> Urheberrechtsrisiko. Lokal = bleibt auf der Maschine.

### LM Studio Setup (Windows, RTX 2060 Super 8 GB)

- Modell: `lmstudio-community/Qwen2.5-7B-Instruct-1M-GGUF`
- Context Length: **32k** (92k überläuft VRAM: Modell 4.7 GB + KV-Cache zu groß)
- MCP-Konfiguration: `%USERPROFILE%\.lmstudio\mcp.json`

```json
{
  "mcpServers": {
    "foundry-mcp": {
      "command": "node",
      "args": ["C:\\Users\\Frank\\Documents\\foundry-vtt-mcp-dsa\\packages\\mcp-server\\dist\\index.js"]
    }
  }
}
```

.env für interne LLM-Calls:

```env
ADVENTURE_IMPORT_LLM_BASE_URL=http://localhost:1234/v1
ADVENTURE_IMPORT_LLM_MODEL=lmstudio-community/Qwen2.5-7B-Instruct-1M-GGUF
ADVENTURE_IMPORT_LLM_API_KEY=local
```

### Zwei LLM-Ebenen

| Ebene | Wer | Wozu |
| --- | --- | --- |
| LM Studio Chat (Qwen) | GM | MCP-Client, konversationell |
| llm-worker.ts intern | Pipeline | Strukturierte JSON-Extraktion aus Abenteuer-Text |

### Tools gebaut (diese Session)

| Tool | Commit | Beschreibung |
| --- | --- | --- |
| create-scene-placeholder | a154698 | Leere Szene ohne ComfyUI |
| create-journal-entry | 67c3fd2 | Journal für Orte, Lore, Kapitel |
| import-dsa5-adventure-from-text | 0166176 | Lokale Adventure-Pipeline mit llm-worker |

### Architektur: OpenClaw / Mac Mini (geplant)

Mac Mini (`Jarvis@Macmini.fritz.box`) als lokaler Hub:

- OpenClaw (lokaler KI-Agent, Peter Steinberger) mit Ollama
- WhatsApp/Telegram Bridge -> MCP Bridge -> Forge VTT
- OpenClaw ist optionaler Interface-Adapter, nicht Kernprodukt

### Nächste Schritte

- Review-First Write Gate - alle write-Tools brauchen preview + explizites apply
- create-actor-from-description - Freitext-NSC -> DSA5-Aktor via llm-worker (Prompt 4)
- Adventure Rewrite MVP - Varianten generieren + GM-selektiertes Apply
