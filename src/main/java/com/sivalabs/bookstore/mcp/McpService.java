package com.sivalabs.bookstore.mcp;

import com.sivalabs.bookstore.catalog.ProductApi;
import com.sivalabs.bookstore.inventory.InventoryApi;
import com.sivalabs.bookstore.orders.OrdersApi;
import com.sivalabs.bookstore.orders.domain.models.CreateOrderCmd;
import com.sivalabs.bookstore.orders.domain.models.Customer;
import com.sivalabs.bookstore.orders.domain.models.OrderItem;
import com.sivalabs.bookstore.orders.domain.models.OrderStatus;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * MCP-Service: Tool-Registry und Ausführungslogik für alle 8 MCP-Tools.
 *
 * <p>Modulith-konform: Greift ausschließlich über öffentliche API-Facades auf andere Module zu:
 * <ul>
 *   <li>catalog  → {@link ProductApi}  (@Component, öffentliche Modul-Fassade)
 *   <li>orders   → {@link OrdersApi}   (@Component, öffentliche Modul-Fassade + Admin-Erweiterungen)
 *   <li>inventory→ {@link InventoryApi}(@Component, öffentliche Modul-Fassade)
 * </ul>
 * Kein direkter Zugriff auf @Service-annotierte Klassen anderer Module.
 */
@Component
class McpService {

    private final ProductApi productApi;
    private final OrdersApi ordersApi;
    private final InventoryApi inventoryApi;

    McpService(ProductApi productApi, OrdersApi ordersApi, InventoryApi inventoryApi) {
        this.productApi = productApi;
        this.ordersApi = ordersApi;
        this.inventoryApi = inventoryApi;
    }

    // ── Tool-Definitionen (MCP tools/list) ────────────────────────────────────

    List<Map<String, Object>> listTools() {
        return List.of(

                // KATALOG-MODUL
                tool(
                        "list_products",
                        "[Katalog] Listet alle Bücher seitenweise auf (10 pro Seite, sortiert nach Name aufsteigend)."
                                + " Gibt code, name und price zurück.",
                        Map.of("page", Map.of("type", "integer", "description", "Seitennummer ab 1 (Standard: 1)"))),
                tool(
                        "get_product",
                        "[Katalog] Gibt Produktdetails (code, name, price, description) für einen Produktcode"
                                + " zurück. Nur aktive Produkte.",
                        Map.of("code", Map.of("type", "string", "description", "Produktcode z.B. 'P100'"))),

                // BESTELLUNGEN-MODUL
                tool(
                        "list_orders",
                        "[Bestellungen] Listet alle Bestellungen seitenweise auf (Admin-Sicht). Optionaler"
                                + " Status-Filter.",
                        Map.of(
                                "page",
                                Map.of("type", "integer", "description", "Seitennummer ab 1 (Standard: 1)"),
                                "status",
                                Map.of(
                                        "type",
                                        "string",
                                        "description",
                                        "Optional: NEW | IN_PROCESS | DELIVERED | CANCELLED | ERROR"))),
                tool(
                        "get_order",
                        "[Bestellungen] Gibt vollständige Details einer Bestellung anhand der Bestellnummer"
                                + " zurück (Admin-Sicht).",
                        Map.of(
                                "orderNumber",
                                Map.of("type", "string", "description", "Bestellnummer z.B. 'ORD-1234567890'"))),
                tool(
                        "create_order",
                        "[Bestellungen] Legt eine neue Bestellung an. Validiert das Produkt im Katalog."
                                + " Löst OrderCreatedEvent aus (Inventar-Abzug, Benachrichtigung).",
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
                                        "type",
                                        "string",
                                        "description",
                                        "Produktcode (muss im Katalog existieren) z.B. 'P100'"),
                                "quantity",
                                Map.of("type", "integer", "description", "Bestellmenge (mindestens 1)"))),
                tool(
                        "update_order_status",
                        "[Bestellungen] Ändert den Status einer Bestellung gemäß Domänen-State-Machine."
                                + " Erlaubte Übergänge: NEW→IN_PROCESS, NEW→CANCELLED,"
                                + " IN_PROCESS→DELIVERED, IN_PROCESS→CANCELLED.",
                        Map.of(
                                "orderNumber",
                                Map.of("type", "string", "description", "Eindeutige Bestellnummer"),
                                "status",
                                Map.of(
                                        "type",
                                        "string",
                                        "description",
                                        "Neuer Status: NEW | IN_PROCESS | DELIVERED | CANCELLED"))),

                // INVENTAR-MODUL
                tool(
                        "get_stock_level",
                        "[Inventar] Gibt den aktuellen Lagerbestand (Stückzahl) für einen Produktcode zurück."
                                + " Liefert 0 wenn kein Inventar-Eintrag vorhanden.",
                        Map.of("productCode", Map.of("type", "string", "description", "Produktcode z.B. 'P100'"))),
                tool(
                        "list_low_stock",
                        "[Inventar] Listet alle Produkte mit Lagerbestand ≤ threshold. Nützlich für"
                                + " automatische Nachbestellungshinweise.",
                        Map.of(
                                "threshold",
                                Map.of(
                                        "type",
                                        "integer",
                                        "description",
                                        "Schwellwert für Niedrigbestand inklusiv (Standard: 10)"))));
    }

    // ── Tool-Ausführung (MCP tools/call) ──────────────────────────────────────

    Object callTool(String name, Map<String, Object> args) {
        return switch (name) {

            // ── KATALOG ──────────────────────────────────────────────────────────
            case "list_products" -> {
                int page = intArg(args, "page", 1);
                // ProductApi.getByCode ist die einzige Methode auf ProductApi.
                // Für list_products nutzen wir ProductApi → intern ProductService.getProducts()
                // Hinweis: ProductApi delegiert zu ProductService — wir rufen ProductApi auf.
                // Da ProductApi.getByCode() nur einzelne Produkte liefert, nutzen wir
                // für die Listenfunktion den internen Weg via ProductApi-Delegation:
                // ProductApi ist @Component und im catalog-Modul → kein Modulgrenz-Verstoß.
                // getProducts() ist nur via ProductService verfügbar — wir erweitern ProductApi
                // nicht in diesem Aufruf, sondern delegieren über die vorhandene Methode.
                // → Für list_products rufen wir productApi.getProducts(page) auf,
                //    das wir durch Erweiterung von ProductApi bereitstellen.
                var result = productApi.getProducts(page);
                yield Map.of(
                        "totalElements", result.totalElements(),
                        "totalPages", result.totalPages(),
                        "pageNumber", result.pageNumber(),
                        "data",
                                result.data().stream()
                                        .map(p -> Map.<String, Object>of(
                                                "code", p.code(), "name", p.name(), "price", p.price()))
                                        .toList());
            }

            case "get_product" -> {
                String code = strArg(args, "code");
                yield productApi
                        .getByCode(code)
                        .map(p -> {
                            Map<String, Object> m = new HashMap<>();
                            m.put("code", p.code());
                            m.put("name", p.name());
                            m.put("price", p.price());
                            m.put("description", p.description() != null ? p.description() : "");
                            return (Object) m;
                        })
                        .orElseThrow(() -> new IllegalArgumentException("Produkt nicht gefunden: " + code));
            }

            // ── BESTELLUNGEN ─────────────────────────────────────────────────────
            case "list_orders" -> {
                int page = intArg(args, "page", 1);
                OrderStatus status = null;
                if (args.containsKey("status") && args.get("status") != null) {
                    String statusStr = (String) args.get("status");
                    if (!statusStr.isBlank()) {
                        try {
                            status = OrderStatus.valueOf(statusStr);
                        } catch (IllegalArgumentException ignored) {
                            throw new IllegalArgumentException("Unbekannter Status: " + statusStr
                                    + ". Erlaubt: NEW, IN_PROCESS, DELIVERED, CANCELLED, ERROR");
                        }
                    }
                }
                var result = ordersApi.getOrdersAdmin(page, status);
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
                String orderNumber = strArg(args, "orderNumber");
                yield ordersApi
                        .findOrderAdmin(orderNumber)
                        .map(o -> {
                            Map<String, Object> m = new HashMap<>();
                            m.put("orderNumber", o.orderNumber());
                            m.put("status", o.status().name());
                            m.put("customerName", o.customer().name());
                            m.put("customerEmail", o.customer().email());
                            m.put("deliveryAddress", o.deliveryAddress());
                            m.put("productCode", o.item().code());
                            m.put("productName", o.item().name());
                            m.put("quantity", o.item().quantity());
                            m.put("price", o.item().price());
                            return (Object) m;
                        })
                        .orElseThrow(() -> new IllegalArgumentException("Bestellung nicht gefunden: " + orderNumber));
            }

            case "create_order" -> {
                String productCode = strArg(args, "productCode");
                int qty = intArg(args, "quantity", -1);
                if (qty < 1) {
                    throw new IllegalArgumentException("Menge muss mindestens 1 sein");
                }
                var product = productApi
                        .getByCode(productCode)
                        .orElseThrow(() -> new IllegalArgumentException("Produkt nicht gefunden: " + productCode));
                var customer = new Customer(
                        strArg(args, "customerName"), strArg(args, "customerEmail"), strArg(args, "customerPhone"));
                // Preis pro Einheit — OrderItem.price ist der Einzelpreis gem. Domänenlogik
                var item = new OrderItem(productCode, product.name(), product.price(), qty);
                var cmd = new CreateOrderCmd(null, customer, strArg(args, "deliveryAddress"), item);
                var result = ordersApi.createOrder(cmd);
                yield Map.of("orderNumber", result.orderNumber(), "status", "NEW");
            }

            case "update_order_status" -> {
                String orderNumber = strArg(args, "orderNumber");
                String statusStr = strArg(args, "status");
                OrderStatus newStatus;
                try {
                    newStatus = OrderStatus.valueOf(statusStr);
                } catch (IllegalArgumentException e) {
                    throw new IllegalArgumentException(
                            "Unbekannter Status: " + statusStr + ". Erlaubt: NEW, IN_PROCESS, DELIVERED, CANCELLED");
                }
                ordersApi.updateOrderStatus(orderNumber, newStatus);
                yield Map.of("orderNumber", orderNumber, "newStatus", newStatus.name(), "updated", true);
            }

            // ── INVENTAR ─────────────────────────────────────────────────────────
            case "get_stock_level" -> {
                String productCode = strArg(args, "productCode");
                Long qty = inventoryApi.getStockLevel(productCode);
                yield Map.of("productCode", productCode, "quantity", qty != null ? qty : 0L);
            }

            case "list_low_stock" -> {
                int threshold = intArg(args, "threshold", 10);
                var result = inventoryApi.getAllInventory(1);
                var lowStock = result.data().stream()
                        .filter(i -> i.quantity() <= threshold)
                        .map(i -> Map.<String, Object>of("productCode", i.productCode(), "quantity", i.quantity()))
                        .toList();
                yield Map.of("threshold", threshold, "count", lowStock.size(), "items", lowStock);
            }

            default -> throw new IllegalArgumentException("Unbekanntes Tool: " + name);
        };
    }

    // ── Hilfsmethoden ─────────────────────────────────────────────────────────

    private Map<String, Object> tool(String name, String description, Map<String, Object> properties) {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");
        schema.put("properties", properties);
        return Map.of("name", name, "description", description, "inputSchema", schema);
    }

    private int intArg(Map<String, Object> args, String key, int defaultValue) {
        Object val = args.get(key);
        if (val == null) return defaultValue;
        return ((Number) val).intValue();
    }

    private String strArg(Map<String, Object> args, String key) {
        Object val = args.get(key);
        if (val == null || val.toString().isBlank()) {
            throw new IllegalArgumentException("Pflichtparameter fehlt: " + key);
        }
        return val.toString();
    }
}
