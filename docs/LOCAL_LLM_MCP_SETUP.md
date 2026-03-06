# Local LLM + MCP Client Setup (Ulisses-friendly)

This guide explains how to run Foundry MCP with a **local model** (for example via LM Studio + Qwen), so campaign data stays on your machine.

## Why local-first?

- Sensitive campaign data stays local.
- No external LLM API is required for the setup itself.
- Works well for Ulisses/DSA workflows that prefer local processing.

## Tested baseline

- LM Studio 0.4.6
- Qwen 2.5 7B Instruct (Q5_K_M)
- Foundry MCP server from this repository

---

## 1) Build and start Foundry MCP server

```bash
npm install
npm run build:server
npm -w @foundry-mcp/server run start
```

Keep this process running.

> Foundry VTT must also be running with the Foundry MCP Bridge module enabled.

---

## 2) LM Studio model setup

1. Install LM Studio: <https://lmstudio.ai/>
2. Load model: `qwen2.5 7b instruct` (recommended quant: `Q5_K_M`)
3. Increase context length to **16384** (important for larger tool schemas)

### VRAM quick recommendation

| VRAM | Model | Quant |
|---|---|---|
| 6 GB | Qwen2.5 7B Instruct | Q4_K_M |
| 8 GB | Qwen2.5 7B Instruct | Q5_K_M (recommended) |
| 12 GB+ | Qwen2.5 14B Instruct | Q4_K_M |

---

## 3) Configure MCP in your client

In LM Studio (or another MCP-capable client), configure MCP server entry:

```json
{
  "mcpServers": {
    "foundry-mcp": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/packages/mcp-server/dist/index.js"]
    }
  }
}
```

Then enable the MCP server toggle in the client UI.

### Path examples

- Windows: `C:\\Users\\<you>\\...\\foundry-vtt-mcp-dsa\\packages\\mcp-server\\dist\\index.js`
- macOS/Linux: `/Users/<you>/.../foundry-vtt-mcp-dsa/packages/mcp-server/dist/index.js`

---

## 4) Optional local-first `.env` defaults

For LAN/local operation, disable STUN and optional audit log file output:

```env
FOUNDRY_STUN_SERVERS=
AUDIT_LOG=false
```

---

## 5) Smoke test

From the LLM client, ask for a simple tool call like:

- "List scenes"
- "List characters"

If tools return data, MCP wiring is working.

---

## Troubleshooting

### Tools not showing in client
- Confirm MCP JSON is valid.
- Use absolute path to `dist/index.js`.
- Confirm server process is running.

### Model answers but no tool calls
- Raise model context size.
- Use an instruct/chat model variant.
- Keep first prompt explicit: "Use MCP tools to answer."

### Connection unstable on local network
- Start with local websocket/default settings.
- Keep `FOUNDRY_STUN_SERVERS=` empty for local-first tests.

---

## Notes for maintainers and users

- This is a user-facing setup path for local model workflows.
- It complements (not replaces) Claude Desktop or ChatGPT connector workflows.
- If sharing publicly, include your exact client/version/model combo and known limits.
