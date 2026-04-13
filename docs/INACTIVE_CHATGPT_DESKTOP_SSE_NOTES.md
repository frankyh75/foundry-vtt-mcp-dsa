# Inactive Feature Notes: ChatGPT Desktop SSE/HTTP Bridge

> Status: derzeit nicht benoetigt (archiviert)

## 2026-01-15: ChatGPT Desktop Integration via HTTP Bridge (Testlauf)

### Problemstellung
ChatGPT Desktop konnte sich nicht erfolgreich mit dem MCP Server via HTTP Bridge verbinden. Verbindung wurde sofort nach `connection_established` wieder geschlossen.

### Ursachenanalyse
Es wurde fälschlicherweise **Pattern 1 (SSE Server-Sent Events)** implementiert:
```typescript
// FALSCH - Pattern 1: SSEServerTransport mit separaten Endpoints
const sseTransport = new SSEServerTransport('/messages', res);
await sseTransport.start();
```

ChatGPT erwartet jedoch **Pattern 2 (Streamable HTTP)** mit einem single endpoint:

### Lösung: Pattern 2 Implementierung
```typescript
// KORREKT - Pattern 2: StreamableHTTPServerTransport mit /sse Alias
const httpTransport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => FIXED_SESSION_ID,
  enableJsonResponse: true
});

// /sse und /mcp nutzen denselben Transport
if (!req.url.startsWith('/mcp') && !req.url.startsWith('/sse')) {
  return 404;
}
await httpTransport.handleRequest(req, res);
```

### Technische Details

**Transport-Patterns:**
- **Pattern 1 (SSE)**: `GET /sse` + `POST /messages` - Legacy, veraltet
- **Pattern 2 (StreamableHTTP)**: `POST /mcp` + optional `GET /mcp` - Moderner Standard

**ChatGPT Anforderungen:**
- Single endpoint URL mit trailing slash: `/sse/`
- StreamableHTTP Transport (nicht SSE!)
- HTTP Bridge mit Cloudflare Tunnel für HTTPS

### Konfiguration

**URL:**
```
https://<cloudflare-tunnel>.trycloudflare.com/sse/
```

**ChatGPT Desktop Settings:**
- Auth: Keine (oder OAuth wenn `MCP_NO_AUTH=false`)
- "Ich vertraue dieser Anwendung": ✅ aktivieren

### Docker Setup

```bash
# HTTP Bridge mit Cloudflare Tunnel starten
docker compose up -d

# Tunnel URL holen
docker compose logs cloudflared | grep trycloudflare.com
```

### Code-Änderungen

**Entfernt:**
- `SSEServerTransport` Import
- SSE Transport Registry
- `/messages` Endpoint
- SSE-spezifische Metriken und Logging

**Hinzugefügt:**
- `/sse` als Alias für `/mcp`
- Dynamischer `endpoint` Event je nach Request-Pfad

### Referenzen

- [GitHub: example-mcp-server-sse](https://github.com/yigitkonur/example-mcp-server-sse) - Referenz-Implementierung mit Pattern 2
- [MCP Specification - Transports](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports) - Offizielle Spezifikation
- [MCP Server and Client with SSE & Streamable HTTP](https://levelup.gitconnected.com/mcp-server-and-client-with-sse-the-new-streamable-http-d860850d9d9d) - Vergleich der Patterns

### Test-Ergebnisse

**Vorher (Pattern 1):**
```
mcp.sse.connection_start {...}
mcp.sse.connection_established {...}
mcp.sse.connection_closed {...}  # Sofort geschlossen!
totalMessages: 0
```

**Nachher (Pattern 2):**
```
mcp.request.incoming {"path":"/sse/","method":"POST"}
mcp.request.completed {"method":"initialize","durationMs":6}  # ✅ Erfolgreich!
mcp.sse.empty_response {"path":"/sse/"}  # GET Requests für SSE
```

### Nächste Schritte

- [ ] Vollständiger ChatGPT Test (tools/list, tools/call)
- [ ] OAuth Flow implementieren (optional, für Prod)
- [ ] Dokumentation in README.md und CLAUDE.md updaten
- [ ] Test-Suite um /sse Tests erweitern
