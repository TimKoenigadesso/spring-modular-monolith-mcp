// IMPLEMENTIERT DURCH AGSDLC-10 IMPLEMENTIERUNGS-AGENT
// Modul-Grenzen als agentenfähige Fähigkeiten: Katalog · Bestellungen · Inventar
package com.sivalabs.bookstore.mcp;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sivalabs.bookstore.catalog.ProductApi;
import com.sivalabs.bookstore.catalog.domain.ProductService;
import com.sivalabs.bookstore.inventory.domain.InventoryService;
import com.sivalabs.bookstore.orders.OrdersApi;
import com.sivalabs.bookstore.orders.domain.OrderService;
import com.sivalabs.bookstore.orders.domain.models.CreateOrderCmd;
import com.sivalabs.bookstore.orders.domain.models.Customer;
import com.sivalabs.bookstore.orders.domain.models.OrderItem;
import com.sivalabs.bookstore.orders.domain.models.OrderStatus;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@SuppressWarnings({"NullAway", "NullAway.Init"})
@Service
public class McpService {

    private final ProductApi productApi;
    private final ProductService productService;
    private final OrdersApi ordersApi;
    private final OrderService orderService;
    private final InventoryService inventoryService;
    // ObjectMapper wird für JSON-Serialisierung in McpController genutzt;
    // hier als Bean für potenzielle Hilfsmethoden bereitgehalten
    @SuppressWarnings("unused")
    private final ObjectMapper mapper = new ObjectMapper();

    public McpService(
            ProductApi productApi,
            ProductService productService,
            OrdersApi ordersApi,
            OrderService orderService,
            InventoryService inventoryService) {
        this.productApi = productApi;
        this.productService = productService;
        this.ordersApi = ordersApi;
        this.orderService = orderService;
        this.inventoryService = inventoryService;
    }

    // ── Tool-Definitionen (MCP tools/list) ────────────────────────────────────

    public List<Map<String, Object>> listTools() {
        return List.of(

                // ── KATALOG-MODUL ────────────────────────────────────────────
                tool(
                        "list_products",
                        "[Katalog] Listet alle aktiven Bücher seitenweise auf."
                                + " Delegiert an ProductService.getProducts().",
                        Map.of(
                                "page",
                                Map.of(
                                        "type", "integer",
                                        "description", "Seitennummer, 1-basiert (Standard: 1)"))),
                tool(
                        "get_product",
                        "[Katalog] Gibt Produktdetails (Code, Name, Preis, Beschreibung)"
                                + " für einen Produktcode zurück. Delegiert an ProductApi.getByCode().",
                        Map.of(
                                "code",
                                Map.of(
                                        "type", "string",
                                        "description", "Produktcode, z.B. 'P100'"))),

                // ── BESTELLUNGEN-MODUL ───────────────────────────────────────
                tool(
                        "list_orders",
                        "[Bestellungen] Listet alle Bestellungen paginiert auf."
                                + " Optionaler Status-Filter: NEW | IN_PROCESS | DELIVERED | CANCELLED."
                                + " Delegiert an OrderService.getOrdersAdmin().",
                        Map.of(
                                "page",
                                Map.of(
                                        "type", "integer",
                                        "description", "Seitennummer, 1-basiert (Standard: 1)"),
                                "status",
                                Map.of(
                                        "type",
                                        "string",
                                        "description",
                                        "Optional: NEW | IN_PROCESS | DELIVERED | CANCELLED"))),
                tool(
                        "get_order",
                        "[Bestellungen] Gibt vollständige Details einer Bestellung"
                                + " anhand der Bestellnummer zurück."
                                + " Delegiert an OrderService.findOrderAdmin().",
                        Map.of(
                                "orderNumber",
                                Map.of(
                                        "type", "string",
                                        "description", "Eindeutige Bestellnummer, z.B. 'ORD-12345678'"))),
                tool(
                        "create_order",
                        "[Bestellungen] Legt eine neue Bestellung an und publiziert"
                                + " automatisch ein OrderCreatedEvent"
                                + " (→ Inventory dekrementiert, Notifications versendet)."
                                + " Delegiert an OrdersApi.createOrder().",
                        Map.of(
                                "customerName",
                                Map.of("type", "string", "description", "Vollständiger Name des Kunden"),
                                "customerEmail",
                                Map.of("type", "string", "description", "E-Mail-Adresse des Kunden"),
                                "customerPhone",
                                Map.of("type", "string", "description", "Telefonnummer des Kunden"),
                                "deliveryAddress",
                                Map.of("type", "string", "description", "Vollständige Lieferadresse"),
                                "productCode",
                                Map.of(
                                        "type", "string",
                                        "description", "Produktcode, z.B. 'P100'"),
                                "quantity",
                                Map.of(
                                        "type", "integer",
                                        "description", "Bestellmenge, mindestens 1"))),
                tool(
                        "update_order_status",
                        "[Bestellungen] Ändert den Status einer Bestellung gemäß erlaubter"
                                + " Zustandsmaschine."
                                + " Erlaubte Übergänge: NEW→IN_PROCESS, NEW→CANCELLED,"
                                + " IN_PROCESS→DELIVERED, IN_PROCESS→CANCELLED."
                                + " Delegiert an OrderService.updateOrderStatus().",
                        Map.of(
                                "orderNumber",
                                Map.of("type", "string", "description", "Bestellnummer"),
                                "status",
                                Map.of(
                                        "type",
                                        "string",
                                        "description",
                                        "Zielstatus: NEW | IN_PROCESS | DELIVERED | CANCELLED"))),

                // ── INVENTAR-MODUL ───────────────────────────────────────────
                tool(
                        "get_stock_level",
                        "[Inventar] Gibt den aktuellen Lagerbestand für einen Produktcode zurück."
                                + " Delegiert an InventoryService.getStockLevel().",
                        Map.of(
                                "productCode",
                                Map.of(
                                        "type", "string",
                                        "description", "Produktcode, z.B. 'P100'"))),
                tool(
                        "list_low_stock",
                        "[Inventar] Listet alle Produkte auf, deren Lagerbestand ≤ threshold ist."
                                + " Delegiert an InventoryService.getAllInventory().",
                        Map.of(
                                "threshold",
                                Map.of(
                                        "type", "integer",
                                        "description", "Schwellwert für niedrigen Bestand (Standard: 10)"))));
    }

    // ── Tool-Ausführung (MCP tools/call) ──────────────────────────────────────

    public Object callTool(String name, Map<String, Object> args) {
        return switch (name) {

            // ── KATALOG ──────────────────────────────────────────────────────

            case "list_products" -> {
                int page = args.containsKey("page") ? ((Number) args.get("page")).intValue() : 1;
                var result = productService.getProducts(page);
                yield Map.of(
                        "totalElements",
                        result.totalElements(),
                        "totalPages",
                        result.totalPages(),
                        "pageNumber",
                        result.pageNumber(),
                        "data",
                        result.data().stream()
                                .map(p -> Map.of(
                                        "code", p.code(),
                                        "name", p.name(),
                                        "price", p.price()))
                                .toList());
            }

            case "get_product" -> {
                String code = (String) args.get("code");
                if (code == null || code.isBlank()) {
                    throw new IllegalArgumentException("Parameter 'code' ist erforderlich");
                }
                yield productApi
                        .getByCode(code)
                        .map(p -> {
                            Map<String, Object> m = new HashMap<>();
                            m.put("code", p.code());
                            m.put("name", p.name());
                            m.put("price", p.price());
                            // description kann null sein → leerer String als Fallback
                            m.put("description", p.description() != null ? p.description() : "");
                            return (Object) m;
                        })
                        .orElseThrow(() -> new IllegalArgumentException("Produkt nicht gefunden: " + code));
            }

            // ── BESTELLUNGEN ─────────────────────────────────────────────────

            case "list_orders" -> {
                int page = args.containsKey("page") ? ((Number) args.get("page")).intValue() : 1;
                // Optionaler Status-Filter — ungültige Werte werden ignoriert (null = alle)
                OrderStatus status = null;
                if (args.containsKey("status") && args.get("status") != null) {
                    String rawStatus = (String) args.get("status");
                    if (!rawStatus.isBlank()) {
                        try {
                            status = OrderStatus.valueOf(rawStatus.toUpperCase());
                        } catch (IllegalArgumentException ignored) {
                            // Ungültiger Status → kein Filter
                        }
                    }
                }
                var result = orderService.getOrdersAdmin(page, status);
                yield Map.of(
                        "totalElements",
                        result.totalElements(),
                        "totalPages",
                        result.totalPages(),
                        "pageNumber",
                        result.pageNumber(),
                        "data",
                        result.data().stream()
                                .map(o -> {
                                    Map<String, Object> m = new HashMap<>();
                                    m.put("orderNumber", o.orderNumber());
                                    m.put("status", o.status().name());
                                    m.put("customer", o.customerName());
                                    m.put("createdAt", o.createdAt().toString());
                                    return m;
                                })
                                .toList());
            }

            case "get_order" -> {
                String orderNumber = (String) args.get("orderNumber");
                if (orderNumber == null || orderNumber.isBlank()) {
                    throw new IllegalArgumentException("Parameter 'orderNumber' ist erforderlich");
                }
                yield orderService
                        .findOrderAdmin(orderNumber)
                        .map(o -> {
                            Map<String, Object> m = new HashMap<>();
                            m.put("orderNumber", o.orderNumber());
                            m.put("status", o.status().name());
                            m.put("customerName", o.customer().name());
                            m.put("customerEmail", o.customer().email());
                            m.put("customerPhone", o.customer().phone());
                            m.put("deliveryAddress", o.deliveryAddress());
                            m.put("productCode", o.item().code());
                            m.put("productName", o.item().name());
                            m.put("quantity", o.item().quantity());
                            // price im OrderItem ist der Einzelpreis × Menge (Gesamtpreis)
                            m.put("price", o.item().price());
                            m.put("createdAt", o.createdAt().toString());
                            return (Object) m;
                        })
                        .orElseThrow(() -> new IllegalArgumentException("Bestellung nicht gefunden: " + orderNumber));
            }

            case "create_order" -> {
                // Pflicht-Parameter validieren
                String productCode = (String) args.get("productCode");
                String customerName = (String) args.get("customerName");
                String customerEmail = (String) args.get("customerEmail");
                String customerPhone = (String) args.get("customerPhone");
                String deliveryAddress = (String) args.get("deliveryAddress");

                if (productCode == null || productCode.isBlank()) {
                    throw new IllegalArgumentException("Parameter 'productCode' ist erforderlich");
                }
                if (customerName == null || customerName.isBlank()) {
                    throw new IllegalArgumentException("Parameter 'customerName' ist erforderlich");
                }
                if (customerEmail == null || customerEmail.isBlank()) {
                    throw new IllegalArgumentException("Parameter 'customerEmail' ist erforderlich");
                }
                if (customerPhone == null || customerPhone.isBlank()) {
                    throw new IllegalArgumentException("Parameter 'customerPhone' ist erforderlich");
                }
                if (deliveryAddress == null || deliveryAddress.isBlank()) {
                    throw new IllegalArgumentException("Parameter 'deliveryAddress' ist erforderlich");
                }
                if (!args.containsKey("quantity") || args.get("quantity") == null) {
                    throw new IllegalArgumentException("Parameter 'quantity' ist erforderlich");
                }
                int quantity = ((Number) args.get("quantity")).intValue();
                if (quantity < 1) {
                    throw new IllegalArgumentException("'quantity' muss mindestens 1 sein");
                }

                // Produktdetails via ProductApi (modul-grenz-konform) laden
                var product = productApi
                        .getByCode(productCode)
                        .orElseThrow(() -> new IllegalArgumentException("Produkt nicht gefunden: " + productCode));

                // Customer-Record erstellen
                var customer = new Customer(customerName, customerEmail, customerPhone);

                // OrderItem: price = Einzelpreis (OrderService berechnet intern den Gesamtpreis)
                var item = new OrderItem(
                        productCode,
                        product.name(),
                        product.price(), // Einzelpreis — OrderService multipliziert mit quantity
                        quantity);

                // Bestellung via OrdersApi erstellen (modul-grenz-konform, publiziert Events)
                var cmd = new CreateOrderCmd(null, customer, deliveryAddress, item);
                var result = ordersApi.createOrder(cmd);
                yield Map.of("orderNumber", result.orderNumber(), "status", "NEW");
            }

            case "update_order_status" -> {
                String orderNumber = (String) args.get("orderNumber");
                String statusStr = (String) args.get("status");
                if (orderNumber == null || orderNumber.isBlank()) {
                    throw new IllegalArgumentException("Parameter 'orderNumber' ist erforderlich");
                }
                if (statusStr == null || statusStr.isBlank()) {
                    throw new IllegalArgumentException("Parameter 'status' ist erforderlich");
                }
                OrderStatus newStatus;
                try {
                    newStatus = OrderStatus.valueOf(statusStr.toUpperCase());
                } catch (IllegalArgumentException e) {
                    throw new IllegalArgumentException("Ungültiger Status '" + statusStr
                            + "'. Erlaubte Werte: NEW, IN_PROCESS, DELIVERED, CANCELLED");
                }
                // Zustandsmaschine wird serverseitig durch OrderService erzwungen
                orderService.updateOrderStatus(orderNumber, newStatus);
                yield Map.of("orderNumber", orderNumber, "newStatus", newStatus.name(), "updated", true);
            }

            // ── INVENTAR ─────────────────────────────────────────────────────

            case "get_stock_level" -> {
                String productCode = (String) args.get("productCode");
                if (productCode == null || productCode.isBlank()) {
                    throw new IllegalArgumentException("Parameter 'productCode' ist erforderlich");
                }
                // getStockLevel gibt 0L zurück wenn Produkt nicht im Inventar registriert
                Long quantity = inventoryService.getStockLevel(productCode);
                yield Map.of("productCode", productCode, "quantity", quantity != null ? quantity : 0L);
            }

            case "list_low_stock" -> {
                int threshold = args.containsKey("threshold") && args.get("threshold") != null
                        ? ((Number) args.get("threshold")).intValue()
                        : 10;
                // Schwellwert-Validierung (DoS-Schutz)
                if (threshold < 0) threshold = 0;
                if (threshold > 100_000) threshold = 100_000;

                // Alle Inventar-Seiten abrufen und filtern
                var firstPage = inventoryService.getAllInventory(1);
                var allItems = new java.util.ArrayList<>(firstPage.data());

                // Weitere Seiten laden falls vorhanden (Phase-2: DB-Query-Optimierung empfohlen)
                int totalPages = firstPage.totalPages();
                for (int p = 2; p <= totalPages; p++) {
                    allItems.addAll(inventoryService.getAllInventory(p).data());
                }

                final int effectiveThreshold = threshold;
                var lowItems = allItems.stream()
                        .filter(i -> i.quantity() <= effectiveThreshold)
                        .map(i -> Map.of(
                                "productCode", (Object) i.productCode(),
                                "quantity", (Object) i.quantity()))
                        .toList();

                yield Map.of(
                        "threshold", effectiveThreshold,
                        "count", lowItems.size(),
                        "items", lowItems);
            }

            default -> throw new IllegalArgumentException("Unbekanntes MCP-Tool: '" + name + "'");
        };
    }

    // ── Hilfsmethoden ─────────────────────────────────────────────────────────

    /**
     * Erstellt eine MCP-Tool-Definition mit vollständigem inputSchema.
     *
     * @param name  Tool-Name (eindeutiger Identifier)
     * @param desc  Menschenlesbare Beschreibung für KI-Agents
     * @param props Properties-Map für das JSON Schema (inputSchema.properties)
     */
    private Map<String, Object> tool(String name, String desc, Map<String, Object> props) {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");
        schema.put("properties", props);
        return Map.of("name", name, "description", desc, "inputSchema", schema);
    }
}
