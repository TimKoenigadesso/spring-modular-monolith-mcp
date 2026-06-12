# Spring Modulith Bookstore — Claude Code MCP-Demo

## Deine Aufgabe: Diese App MCP-ready machen

Wenn der Nutzer sagt "Mach diese App MCP-ready" oder ähnliches — führe exakt diese Schritte durch:

---

## Schritt 1: Modul-Analyse

Lese diese Dateien und verstehe die Domänen-Struktur:

```
src/main/java/com/sivalabs/bookstore/
  catalog/ProductApi.java                          ← öffentliche Modul-API
  catalog/domain/ProductService.java               ← Service-Methoden
  orders/OrdersApi.java                            ← öffentliche Modul-API
  orders/domain/OrderService.java                  ← Service-Methoden
  orders/domain/models/CreateOrderCmd.java         ← Bestellungs-Modell
  inventory/domain/InventoryService.java           ← Service-Methoden
  config/WebSecurityConfig.java                    ← Security-Konfiguration
  pom.xml                                          ← Abhängigkeiten
```

**Berichte dann:** Welche Module gibt es? Welche öffentlichen APIs gibt es pro Modul? Welche Tools würden sich eignen?

---

## Schritt 2: MCP-Tool-Liste ableiten

Leite aus den Service-APIs eine Liste von MCP-Tools ab. Gruppiere nach Modul:

- **Katalog-Modul** → Tools für Produktsuche und Produktdetails
- **Bestellungen-Modul** → Tools für Bestellverwaltung
- **Inventar-Modul** → Tools für Lagerbestand

Stelle die Tool-Liste kurz vor bevor du implementierst.

---

## Schritt 3: MCP-Server einbetten

Erstelle diese Dateien:

### 3a: McpController.java
Pfad: `src/main/java/com/sivalabs/bookstore/mcp/McpController.java`

Implementiere einen Spring MVC `@RestController` auf `/mcp` der das **MCP JSON-RPC 2.0 Protokoll** implementiert:
- `initialize` → Server-Capabilities zurückgeben
- `tools/list` → Tool-Liste aus McpService
- `tools/call` → Tool ausführen via McpService

### 3b: McpService.java
Pfad: `src/main/java/com/sivalabs/bookstore/mcp/McpService.java`

Implementiere `listTools()` und `callTool()` mit diesen Tools:

**Katalog:**
- `list_products(page)` → `productService.getProducts(pageNo)`
- `get_product(code)` → `productApi.getByCode(code)`

**Bestellungen:**
- `list_orders(page, status)` → `orderService.getOrdersAdmin(pageNo, status)`
- `get_order(orderNumber)` → `orderService.findOrderAdmin(orderNumber)`
- `create_order(...)` → `ordersApi.createOrder(cmd)`
- `update_order_status(orderNumber, status)` → `orderService.updateOrderStatus(...)`

**Inventar:**
- `get_stock_level(productCode)` → `inventoryService.getStockLevel(code)`
- `list_low_stock(threshold)` → `inventoryService.getAllInventory(1)` + Filter

**Wichtig für Java 25 + NullAway:**
- Klassen mit `@SuppressWarnings({"NullAway", "NullAway.Init"})` annotieren
- Keine direkten `Map.of()` mit gemischten Typen — stattdessen `new HashMap<>()` nutzen

### 3c: McpSecurityConfig.java
Pfad: `src/main/java/com/sivalabs/bookstore/mcp/McpSecurityConfig.java`

```java
@Configuration
@Order(1)
public class McpSecurityConfig {
    @Bean
    public SecurityFilterChain mcpFilterChain(HttpSecurity http) throws Exception {
        http
            .securityMatcher("/mcp/**", "/mcp")
            .csrf(AbstractHttpConfigurer::disable)
            .authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
        return http.build();
    }
}
```

### 3d: WebSecurityConfig.java patchen
In `src/main/java/com/sivalabs/bookstore/config/WebSecurityConfig.java`:

1. `/mcp` und `/mcp/**` zu `publicPaths[]` hinzufügen
2. Nach `http.securityMatcher("/**")` einfügen: `http.csrf(csrf -> csrf.ignoringRequestMatchers("/mcp", "/mcp/**"));`

### 3e: pom.xml patchen
Füge zu `<dependencies>` (NICHT zu `<dependencyManagement>`) hinzu:
```xml
<dependency>
  <groupId>com.fasterxml.jackson.core</groupId>
  <artifactId>jackson-databind</artifactId>
</dependency>
```

---

## Schritt 4: Build & Deploy

Führe das Build-Script aus:

```bash
python3 scripts/build-deploy.py
```

Das Script:
1. Baut das Docker-Image via Cloud Build (Streaming-Output)
2. Deployt als Multi-Container Cloud Run (App + Postgres-Sidecar)
3. Gibt die finale URL + MCP-Endpoint zurück

**Warte auf die Ausgabe** — der Build dauert ~15-20 Minuten. Du siehst jeden Schritt.

---

## Schritt 5: Verifizierung

Nach erfolgreichem Deploy führe aus:

```bash
python3 scripts/verify-mcp.py <ENDPOINT_URL>
```

Das testet alle 8 MCP-Tools und zeigt echte Ergebnisse aus dem Monolith.

---

## Wichtige Hinweise

- **Spring Boot 4.1 / Java 25**: Spotless-Checks mit `-Dspotless.check.skip=true` überspringen
- **NullAway**: `@SuppressWarnings` auf alle neuen Klassen
- **Postgres**: Als Cloud Run Sidecar (nicht Cloud SQL)
- **DSGVO**: Vertex AI europe-west1 — keine externen Services
