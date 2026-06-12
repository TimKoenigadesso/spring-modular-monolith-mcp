package com.sivalabs.bookstore.mcp;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * MCP JSON-RPC 2.0 Dispatcher.
 *
 * <p>Einzelner Endpunkt POST /mcp der folgende JSON-RPC 2.0 Methoden unterstützt:
 *
 * <ul>
 *   <li>{@code initialize} — Handshake: gibt Protokollversion und Server-Info zurück
 *   <li>{@code tools/list} — Tool-Manifest: alle verfügbaren MCP-Tools
 *   <li>{@code tools/call} — Tool-Aufruf: delegiert an {@link McpService}
 * </ul>
 *
 * <p>Antwortformat: {@code {"jsonrpc":"2.0","id":N,"result":{...}}}
 *
 * <p>Fehlerformat: {@code {"jsonrpc":"2.0","id":N,"error":{"code":-32000,"message":"..."}}}
 */
@SuppressWarnings("NullAway")
@RestController
@RequestMapping("/mcp")
@CrossOrigin(origins = "*")
class McpController {

    private static final String JSONRPC_VERSION = "2.0";

    private final McpService mcpService;

    /**
     * Spring's auto-konfigurierter ObjectMapper mit JavaTimeModule, NonNull-Config etc.
     * Injiziert statt manuell erstellt, um Spring-Konfiguration zu respektieren.
     */
    private final ObjectMapper objectMapper;

    McpController(McpService mcpService, ObjectMapper objectMapper) {
        this.mcpService = mcpService;
        this.objectMapper = objectMapper;
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> handle(@RequestBody Map<String, Object> req) {

        // JSON-RPC 2.0 Notifications haben keine 'id' → HTTP 204 No Content (keine Antwort)
        if (!req.containsKey("id")) {
            return ResponseEntity.noContent().build();
        }

        Object id = req.get("id");
        String method = req.containsKey("method") ? (String) req.get("method") : "";

        return switch (method != null ? method : "") {

            // ── initialize: MCP-Handshake ──────────────────────────────────────────
            case "initialize" ->
                ok(
                        id,
                        Map.of(
                                "protocolVersion",
                                "2024-11-05",
                                "capabilities",
                                Map.of("tools", Map.of()),
                                "serverInfo",
                                Map.of(
                                        "name",
                                        "bookstore-mcp",
                                        "version",
                                        "1.0.0",
                                        "description",
                                        "Spring Modulith Bookstore — MCP-Layer für KI-Agenten")));

            // ── tools/list: verfügbare Tools zurückgeben ───────────────────────────
            case "tools/list" -> ok(id, Map.of("tools", mcpService.listTools()));

            // ── tools/call: Tool ausführen ─────────────────────────────────────────
            case "tools/call" -> {
                @SuppressWarnings("unchecked")
                Map<String, Object> params =
                        req.containsKey("params") ? (Map<String, Object>) req.get("params") : Map.of();

                String toolName = params.containsKey("name") ? (String) params.get("name") : null;

                if (toolName == null || toolName.isBlank()) {
                    yield error(id, -32602, "Ungültige Parameter: 'name' fehlt in params");
                }

                @SuppressWarnings("unchecked")
                Map<String, Object> args =
                        params.containsKey("arguments") ? (Map<String, Object>) params.get("arguments") : Map.of();

                try {
                    Object result = mcpService.callTool(toolName, args);
                    // MCP-Konvention: content ist eine Liste von {type, text} Objekten
                    String jsonText = objectMapper.writeValueAsString(result);
                    Map<String, Object> content = new HashMap<>();
                    content.put("type", "text");
                    content.put("text", jsonText);
                    yield ok(id, Map.of("content", List.of(content)));
                } catch (IllegalArgumentException e) {
                    yield error(id, -32000, e.getMessage());
                } catch (Exception e) {
                    yield error(id, -32000, "Interner Fehler: " + e.getMessage());
                }
            }

            // ── Unbekannte Methode ─────────────────────────────────────────────────
            default -> error(id, -32601, "Methode nicht gefunden: " + method);
        };
    }

    // ── Hilfsmethoden ─────────────────────────────────────────────────────────

    private ResponseEntity<Map<String, Object>> ok(Object id, Object result) {
        return ResponseEntity.ok(Map.of("jsonrpc", JSONRPC_VERSION, "id", id, "result", result));
    }

    private ResponseEntity<Map<String, Object>> error(Object id, int code, String message) {
        Map<String, Object> errorBody = new HashMap<>();
        errorBody.put("jsonrpc", JSONRPC_VERSION);
        errorBody.put("id", id);
        errorBody.put("error", Map.of("code", code, "message", message != null ? message : "Unbekannter Fehler"));
        return ResponseEntity.ok(errorBody);
    }
}
