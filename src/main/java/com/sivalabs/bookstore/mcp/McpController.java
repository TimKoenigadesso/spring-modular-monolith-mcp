// IMPLEMENTIERT DURCH AGSDLC-10 IMPLEMENTIERUNGS-AGENT
// MCP JSON-RPC 2.0 HTTP-Transport — Single-Endpoint Dispatcher
package com.sivalabs.bookstore.mcp;

import com.fasterxml.jackson.annotation.JsonInclude;
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
 * MCP JSON-RPC 2.0 Controller.
 *
 * <p>Implementiert das Model Context Protocol (MCP Spec 2024-11-05) über einen
 * einzelnen HTTP-POST-Endpunkt. Der Dispatcher leitet anhand des {@code method}-Feldes
 * im JSON-RPC-Request an die entsprechenden McpService-Methoden weiter.
 *
 * <p>Unterstützte Methoden:
 * <ul>
 *   <li>{@code initialize} — Protokoll-Handshake, gibt ServerInfo und Capabilities zurück</li>
 *   <li>{@code tools/list} — Listet alle verfügbaren MCP-Tools mit ihren Input-Schemas</li>
 *   <li>{@code tools/call} — Führt ein Tool aus und gibt das Ergebnis als MCP Content zurück</li>
 * </ul>
 *
 * <p>Sicherheit: {@link McpSecurityConfig} mit {@code @Order(1)} stellt sicher, dass
 * {@code /mcp/**} vor der Standard-SecurityFilterChain mit {@code permitAll()} verarbeitet
 * wird. CSRF ist für MCP-Endpoints deaktiviert (REST/JSON-RPC benötigt kein CSRF).
 */
@SuppressWarnings({"NullAway", "NullAway.Init"})
@RestController
@RequestMapping("/mcp")
@CrossOrigin(origins = "*")
public class McpController {

    /** MCP Protokoll-Version gemäß Spezifikation. */
    private static final String MCP_PROTOCOL_VERSION = "2024-11-05";

    /** Server-Identifikation für initialize-Response. */
    private static final String SERVER_NAME = "bookstore-mcp";

    private static final String SERVER_VERSION = "1.0.0";

    private final McpService mcpService;

    /**
     * Jackson ObjectMapper für JSON-Serialisierung der Tool-Ergebnisse.
     * NON_NULL: null-Felder werden im Response ausgelassen.
     */
    private final ObjectMapper mapper = new ObjectMapper().setSerializationInclusion(JsonInclude.Include.NON_NULL);

    public McpController(McpService mcpService) {
        this.mcpService = mcpService;
    }

    /**
     * Zentraler MCP JSON-RPC 2.0 Dispatcher.
     *
     * <p>Verarbeitet alle MCP-Requests über einen einzelnen POST-Endpunkt.
     * JSON-RPC 2.0 Notifications (Requests ohne {@code id}-Feld) werden mit
     * HTTP 204 No Content beantwortet — gemäß MCP-Spezifikation.
     *
     * @param req JSON-RPC 2.0 Request-Body als Map
     * @return JSON-RPC 2.0 Response oder 204 No Content für Notifications
     */
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> handle(@RequestBody Map<String, Object> req) {
        String method = (String) req.get("method");

        // JSON-RPC 2.0: Notifications haben kein 'id'-Feld → keine Antwort senden
        if (!req.containsKey("id")) {
            return ResponseEntity.noContent().build();
        }

        Object id = req.get("id");

        // Method-Dispatch via Switch
        return switch (method != null ? method : "") {

            // ── initialize ────────────────────────────────────────────────────
            // Protokoll-Handshake: Client und Server einigen sich auf Protokollversion
            // und austauschbaren Fähigkeiten (Capabilities)
            case "initialize" ->
                ok(
                        id,
                        Map.of(
                                "protocolVersion",
                                MCP_PROTOCOL_VERSION,
                                "capabilities",
                                Map.of(
                                        "tools", Map.of() // Tools sind verfügbar (keine speziellen Optionen)
                                        ),
                                "serverInfo",
                                Map.of(
                                        "name",
                                        SERVER_NAME,
                                        "version",
                                        SERVER_VERSION,
                                        "description",
                                        "Spring Modulith Bookstore — 8 agentenfähige Modul-APIs"
                                                + " (Katalog · Bestellungen · Inventar)")));

            // ── tools/list ────────────────────────────────────────────────────
            // Gibt alle verfügbaren Tools mit Namen, Beschreibung und Input-Schema zurück
            case "tools/list" -> ok(id, Map.of("tools", mcpService.listTools()));

            // ── tools/call ────────────────────────────────────────────────────
            // Führt ein spezifisches Tool aus; Fehler werden als MCP Error Response
            // mit Code -32000 zurückgegeben (Application Error gemäß JSON-RPC 2.0)
            case "tools/call" -> {
                @SuppressWarnings("unchecked")
                Map<String, Object> params = (Map<String, Object>) req.getOrDefault("params", Map.of());
                String toolName = (String) params.get("name");
                @SuppressWarnings("unchecked")
                Map<String, Object> args = (Map<String, Object>) params.getOrDefault("arguments", Map.of());

                if (toolName == null || toolName.isBlank()) {
                    yield error(id, -32602, "Invalid params: 'name' (tool name) ist erforderlich");
                }

                try {
                    Object result = mcpService.callTool(toolName, args);
                    // MCP Content-Format: Ergebnis als JSON-String im text/content-Block
                    Map<String, Object> contentBlock = new HashMap<>();
                    contentBlock.put("type", "text");
                    contentBlock.put("text", mapper.writeValueAsString(result));
                    yield ok(id, Map.of("content", List.of(contentBlock)));
                } catch (IllegalArgumentException e) {
                    // Ungültige Argumente oder unbekanntes Tool → -32602 Invalid params
                    yield error(id, -32602, e.getMessage());
                } catch (Exception e) {
                    // Alle anderen Fehler → -32000 Application Error
                    String message = e.getMessage() != null
                            ? e.getMessage()
                            : "Interner Fehler beim Ausführen des Tools '" + toolName + "'";
                    yield error(id, -32000, message);
                }
            }

            // ── Method not found ──────────────────────────────────────────────
            // Unbekannte Methode → -32601 gemäß JSON-RPC 2.0
            default -> error(id, -32601, "Method not found: " + method);
        };
    }

    // ── Hilfsmethoden für JSON-RPC 2.0 Response-Format ───────────────────────

    /**
     * Erstellt eine erfolgreiche JSON-RPC 2.0 Response.
     *
     * @param id     Request-ID aus dem eingehenden Request
     * @param result Das Ergebnis-Objekt
     */
    private ResponseEntity<Map<String, Object>> ok(Object id, Object result) {
        return ResponseEntity.ok(Map.of("jsonrpc", "2.0", "id", id, "result", result));
    }

    /**
     * Erstellt eine JSON-RPC 2.0 Error Response.
     *
     * <p>Fehlercodes gemäß JSON-RPC 2.0 + MCP-Erweiterung:
     * <ul>
     *   <li>{@code -32601} Method not found</li>
     *   <li>{@code -32602} Invalid params</li>
     *   <li>{@code -32000} Application error (MCP-spezifisch)</li>
     * </ul>
     *
     * @param id      Request-ID aus dem eingehenden Request
     * @param code    JSON-RPC Fehlercode
     * @param message Menschenlesbare Fehlermeldung
     */
    private ResponseEntity<Map<String, Object>> error(Object id, int code, String message) {
        Map<String, Object> errorBody = new HashMap<>();
        errorBody.put("jsonrpc", "2.0");
        errorBody.put("id", id);
        errorBody.put("error", Map.of("code", code, "message", message != null ? message : "Unknown error"));
        return ResponseEntity.ok(errorBody);
    }
}
