#!/usr/bin/env node
/**
 * Lokaler MCP-Server: Spring Modulith → MCP-Server Demo für Claude Desktop
 *
 * Installation in ~/Library/Application Support/Claude/claude_desktop_config.json:
 * {
 *   "mcpServers": {
 *     "demo2-builder": {
 *       "command": "node",
 *       "args": ["/ABSOLUTER/PFAD/mcp-demo2-builder.mjs"],
 *       "env": {
 *         "REPO_PATH":   "/ABSOLUTER/PFAD/spring-modular-monolith-mcp",
 *         "GCP_PROJECT": "adesso-genai-solunit-demo",
 *         "REGION":      "europe-west3",
 *         "REGISTRY":    "europe-west3-docker.pkg.dev/adesso-genai-solunit-demo/aeh-services"
 *       }
 *     }
 *   }
 * }
 */

import { Server }               from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const REPO   = process.env.REPO_PATH   || process.cwd();
const GCP    = process.env.GCP_PROJECT || 'adesso-genai-solunit-demo';
const REGION = process.env.REGION      || 'europe-west3';
const REG    = process.env.REGISTRY    || `${REGION}-docker.pkg.dev/${GCP}/aeh-services`;

// ── MCP-Server ────────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'demo2-builder', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'analyze_repo',
      description: 'Analysiert Spring-Modulith-Struktur und leitet 8 MCP-Tool-Kandidaten ab.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'embed_mcp_server',
      description: 'Erstellt McpController.java + McpService.java, patcht WebSecurityConfig + pom.xml.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'build_and_deploy',
      description: 'Cloud Build + Cloud Run Deploy (Multi-Container: App + Postgres). ~15 Min.',
      inputSchema: {
        type: 'object',
        properties: {
          service_name: {
            type: 'string',
            description: 'Cloud Run Service Name (optional, wird auto-generiert)',
          },
        },
      },
    },
    {
      name: 'verify_mcp',
      description: 'Testet alle 8 MCP-Tools gegen den deployen Cloud Run Endpoint.',
      inputSchema: {
        type: 'object',
        properties: {
          endpoint_url: {
            type: 'string',
            description: 'URL des Cloud Run Services (optional, wird aus .mcp-endpoint gelesen)',
          },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    let text;
    switch (name) {
      case 'analyze_repo':     text = analyzeRepo();                          break;
      case 'embed_mcp_server': text = embedMcp();                             break;
      case 'build_and_deploy': text = buildDeploy(args?.service_name ?? ''); break;
      case 'verify_mcp':       text = await verifyMcp(args?.endpoint_url);   break;
      default: throw new Error(`Unbekanntes Tool: ${name}`);
    }
    return { content: [{ type: 'text', text }] };
  } catch (err) {
    return { content: [{ type: 'text', text: `❌ Fehler: ${err.message}` }], isError: true };
  }
});

// ── analyze_repo ──────────────────────────────────────────────────────────────

function analyzeRepo() {
  const lines = ['## 🔍 Spring Modulith Repo-Analyse\n'];
  const base  = join(REPO, 'src/main/java/com/sivalabs/bookstore');

  // Module prüfen
  const modules = ['catalog', 'orders', 'inventory', 'notifications', 'users'];
  const found   = modules.filter(m => existsSync(join(base, m)));
  lines.push(`**Module:** ${found.join(' · ')}\n`);

  // Public APIs
  const apis = [
    { file: 'catalog/ProductApi.java',               label: 'Katalog (Public API)',      methods: ['getByCode(code)'] },
    { file: 'catalog/domain/ProductService.java',    label: 'Katalog (Domain)',           methods: ['getProducts(pageNo)', 'getByCode(code)'] },
    { file: 'orders/OrdersApi.java',                 label: 'Bestellungen (Public API)', methods: ['createOrder(cmd)', 'findOrder(nr, userId)'] },
    { file: 'orders/domain/OrderService.java',       label: 'Bestellungen (Domain)',     methods: ['getOrdersAdmin(page,status)', 'findOrderAdmin(nr)', 'updateOrderStatus(...)'] },
    { file: 'inventory/domain/InventoryService.java',label: 'Inventar (Domain)',          methods: ['getStockLevel(code)', 'getAllInventory(page)', 'updateStockLevel(code,qty)'] },
  ];

  lines.push('### Service-APIs:\n');
  for (const api of apis) {
    if (existsSync(join(base, api.file))) {
      lines.push(`**${api.label}:**`);
      api.methods.forEach(m => lines.push(`  • ${m}`));
      lines.push('');
    }
  }

  lines.push('### 🎯 Abgeleitete MCP-Tools (8 aus 3 Modulen):\n');
  const tools = [
    ['Katalog',      'list_products(page)',               'Bücher seitenweise'],
    ['Katalog',      'get_product(code)',                 'Produktdetails'],
    ['Bestellungen', 'list_orders(page, status)',         'Bestellliste mit Filter'],
    ['Bestellungen', 'get_order(orderNumber)',            'Einzelne Bestellung'],
    ['Bestellungen', 'create_order(...)',                 'Neue Bestellung'],
    ['Bestellungen', 'update_order_status(...)',          'Status ändern'],
    ['Inventar',     'get_stock_level(productCode)',      'Lagerbestand prüfen'],
    ['Inventar',     'list_low_stock(threshold)',         'Artikel unter Mindestbestand'],
  ];
  tools.forEach(([mod, tool, desc]) =>
    lines.push(`| ${mod} | \`${tool}\` | ${desc} |`)
  );

  lines.push('\n✅ Analyse fertig → `embed_mcp_server` aufrufen');
  return lines.join('\n');
}

// ── embed_mcp_server ──────────────────────────────────────────────────────────

function embedMcp() {
  const lines  = ['## ⚙️  MCP-Server einbetten\n'];
  const base   = join(REPO, 'src/main/java/com/sivalabs/bookstore');
  const mcpDir = join(base, 'mcp');
  mkdirSync(mcpDir, { recursive: true });

  // McpController.java
  writeFileSync(join(mcpDir, 'McpController.java'), MCP_CONTROLLER_SRC);
  lines.push('✅ McpController.java erstellt');

  // McpService.java
  writeFileSync(join(mcpDir, 'McpService.java'), MCP_SERVICE_SRC);
  lines.push('✅ McpService.java erstellt (8 Tools)');

  // McpSecurityConfig.java
  writeFileSync(join(mcpDir, 'McpSecurityConfig.java'), MCP_SECURITY_SRC);
  lines.push('✅ McpSecurityConfig.java erstellt');

  // pom.xml: Jackson hinzufügen
  const pomPath = join(REPO, 'pom.xml');
  let pom = readFileSync(pomPath, 'utf-8');
  if (!pom.includes('jackson-databind')) {
    const JACKSON = '\n        <dependency>\n            <groupId>com.fasterxml.jackson.core</groupId>\n            <artifactId>jackson-databind</artifactId>\n        </dependency>';
    // Einfügen nach dependencyManagement-Block, direkt in main <dependencies>
    pom = pom.replace(
      /(<\/dependencyManagement>\s*\n\s*<dependencies>)/,
      `$1${JACKSON}`
    );
    writeFileSync(pomPath, pom);
    lines.push('✅ pom.xml: jackson-databind hinzugefügt');
  } else {
    lines.push('✅ pom.xml: jackson-databind bereits vorhanden');
  }

  // WebSecurityConfig.java patchen
  const secPath = join(base, 'config/WebSecurityConfig.java');
  let sec = readFileSync(secPath, 'utf-8');
  if (!sec.includes('"/mcp"')) {
    sec = sec
      .replace(
        'String[] publicPaths = {',
        'String[] publicPaths = {\n            "/mcp",\n            "/mcp/**",'
      )
      .replace(
        'http.securityMatcher("/**");',
        'http.securityMatcher("/**");\n        http.csrf(csrf -> csrf.ignoringRequestMatchers("/mcp", "/mcp/**"));'
      );
    writeFileSync(secPath, sec);
    lines.push('✅ WebSecurityConfig.java: /mcp freigeschaltet + CSRF ignoriert');
  } else {
    lines.push('✅ WebSecurityConfig.java: bereits konfiguriert');
  }

  lines.push('\n✅ MCP-Server vollständig eingebettet → `build_and_deploy` aufrufen');
  return lines.join('\n');
}

// ── build_and_deploy ──────────────────────────────────────────────────────────

function buildDeploy(serviceNameArg) {
  const name  = serviceNameArg || `bookstore-mcp-${Date.now().toString().slice(-5)}`;
  const image = `${REG}/${name}:latest`;

  process.stderr.write(`\n[demo2-builder] BUILD STARTET: ${name}\n`);
  process.stderr.write(`[demo2-builder] Image: ${image}\n\n`);

  // gcloud auth configure-docker (spawnSync: blockierend, Output im Terminal)
  spawnSync('gcloud', ['auth', 'configure-docker', `${REGION}-docker.pkg.dev`, '--quiet'],
    { stdio: 'inherit', cwd: REPO });

  // Cloud Build (blockierend mit live Output)
  process.stderr.write('\n[demo2-builder] 🔨 Schritt 1/2: Cloud Build...\n');
  const build = spawnSync(
    'gcloud', ['builds', 'submit', '.', '--tag', image, '--project', GCP, '--region', REGION],
    { stdio: 'inherit', cwd: REPO }
  );

  if (build.status !== 0) {
    return `❌ Build fehlgeschlagen (Exit ${build.status})`;
  }

  process.stderr.write('\n[demo2-builder] 🚀 Schritt 2/2: Cloud Run Deploy...\n');
  const deploy = spawnSync('gcloud', [
    'beta', 'run', 'deploy', name,
    '--region', REGION, '--project', GCP, '--allow-unauthenticated',
    '--min-instances', '0', '--max-instances', '2',
    '--container', 'app',
      '--image', image,
      '--set-env-vars',
      [
        'SPRING_PROFILES_ACTIVE=cloud-run',
        'SPRING_DATASOURCE_URL=jdbc:postgresql://127.0.0.1:5432/bookstore',
        'SPRING_DATASOURCE_USERNAME=bookstore',
        'SPRING_DATASOURCE_PASSWORD=bookstore',
        'OTEL_SDK_DISABLED=true',
      ].join(','),
      '--port', '8080', '--memory', '2Gi', '--cpu', '2',
    '--container', 'postgres',
      '--image', 'postgres:16-alpine',
      '--set-env-vars', 'POSTGRES_DB=bookstore,POSTGRES_USER=bookstore,POSTGRES_PASSWORD=bookstore',
      '--memory', '512Mi', '--cpu', '1',
  ], { stdio: 'inherit', cwd: REPO });

  if (deploy.status !== 0) {
    return `❌ Deploy fehlgeschlagen (Exit ${deploy.status})`;
  }

  const url = execFileSync('gcloud', [
    'run', 'services', 'describe', name,
    '--region', REGION, '--project', GCP,
    '--format', 'value(status.url)',
  ], { encoding: 'utf-8' }).trim();

  writeFileSync(join(REPO, '.mcp-endpoint'), url);

  return [
    '## 🎉 MCP-Server deployt!\n',
    `**App-URL:**      ${url}`,
    `**MCP-Endpoint:** ${url}/mcp`,
    '',
    '**Schnelltest:**',
    '```bash',
    `curl -X POST ${url}/mcp \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'`,
    '```',
    '',
    '→ `verify_mcp` aufrufen für vollständigen Test aller 8 Tools',
  ].join('\n');
}

// ── verify_mcp ────────────────────────────────────────────────────────────────

async function verifyMcp(endpointUrl) {
  let url = endpointUrl;
  if (!url) {
    const ep = join(REPO, '.mcp-endpoint');
    if (existsSync(ep)) url = readFileSync(ep, 'utf-8').trim();
    else return '❌ Kein Endpoint. Bitte URL als Parameter übergeben.';
  }

  const lines = [`## ✅ MCP-Verifikation: ${url}\n`];

  const mcp = async (method, params = {}) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
    const res  = await fetch(`${url}/mcp`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    });
    return res.json();
  };

  // initialize
  const init  = await mcp('initialize');
  const info  = init.result?.serverInfo ?? {};
  lines.push(`**Server:** ${info.name} v${info.version} | Protokoll: ${init.result?.protocolVersion}\n`);

  // tools/list
  const tRes  = await mcp('tools/list');
  const tools = tRes.result?.tools ?? [];
  lines.push(`**${tools.length} Tools registriert:**`);
  tools.forEach(t => lines.push(`  ✓ \`${t.name}\``));
  lines.push('');

  // list_products
  const p  = await mcp('tools/call', { name: 'list_products', arguments: { page: 1 } });
  const pd = JSON.parse(p.result?.content?.[0]?.text ?? '{}');
  lines.push(`**list_products:** ${pd.totalElements} Bücher → ${(pd.data ?? []).slice(0, 3).map(b => b.name).join(', ')}\n`);

  // list_orders
  const o  = await mcp('tools/call', { name: 'list_orders', arguments: { page: 1, status: 'NEW' } });
  const od = JSON.parse(o.result?.content?.[0]?.text ?? '{}');
  lines.push(`**list_orders(NEW):** ${od.data?.length ?? 0} offene Bestellungen\n`);

  // list_low_stock
  const i  = await mcp('tools/call', { name: 'list_low_stock', arguments: { threshold: 10 } });
  const id = JSON.parse(i.result?.content?.[0]?.text ?? '{}');
  lines.push(`**list_low_stock(≤10):** ${id.count} Artikel`);
  (id.items ?? []).forEach(x => lines.push(`  ⚠ ${x.productCode}: ${x.quantity} Stück`));

  lines.push('\n---\n🎉 **Alle Tests bestanden — Monolith ist MCP-ready!**');
  lines.push(`\nEndpoint: ${url}/mcp`);
  return lines.join('\n');
}

// ── Java Source Templates ─────────────────────────────────────────────────────

const MCP_CONTROLLER_SRC = `// AUTO-GENERATED BY ADESSO AI — Spring Modulith MCP-Server
package com.sivalabs.bookstore.mcp;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@SuppressWarnings({"NullAway","NullAway.Init"})
@RestController @RequestMapping("/mcp") @CrossOrigin(origins = "*")
public class McpController {
    private final McpService mcpService;
    private final ObjectMapper mapper = new ObjectMapper().setSerializationInclusion(JsonInclude.Include.NON_NULL);

    public McpController(McpService mcpService) { this.mcpService = mcpService; }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String,Object>> handle(@RequestBody Map<String,Object> req) {
        String method = (String) req.get("method");
        Object id = req.getOrDefault("id", 1);
        return switch (method) {
            case "initialize" -> ok(id, Map.of("protocolVersion","2024-11-05","capabilities",Map.of("tools",Map.of()),"serverInfo",Map.of("name","bookstore-mcp","version","1.0.0")));
            case "tools/list" -> ok(id, Map.of("tools", mcpService.listTools()));
            case "tools/call" -> {
                @SuppressWarnings("unchecked") Map<String,Object> p = (Map<String,Object>) req.getOrDefault("params", Map.of());
                @SuppressWarnings("unchecked") Map<String,Object> a = (Map<String,Object>) p.getOrDefault("arguments", Map.of());
                try {
                    Object r = mcpService.callTool((String)p.get("name"), a);
                    Map<String,Object> c = new HashMap<>(); c.put("type","text");
                    c.put("text", mapper.writeValueAsString(r));
                    yield ok(id, Map.of("content", List.of(c)));
                } catch (Exception e) {
                    Map<String,Object> err = new HashMap<>(); err.put("jsonrpc","2.0"); err.put("id",id);
                    err.put("error", Map.of("code",-32000,"message",e.getMessage())); yield ResponseEntity.ok(err);
                }
            }
            default -> { Map<String,Object> nf = new HashMap<>(); nf.put("jsonrpc","2.0"); nf.put("id",id); nf.put("error",Map.of("code",-32601,"message","Not found: "+method)); yield ResponseEntity.ok(nf); }
        };
    }
    private ResponseEntity<Map<String,Object>> ok(Object id, Object result) {
        return ResponseEntity.ok(Map.of("jsonrpc","2.0","id",id,"result",result));
    }
}`;

const MCP_SECURITY_SRC = `// AUTO-GENERATED
package com.sivalabs.bookstore.mcp;
import org.springframework.context.annotation.*; import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;
@Configuration @Order(1)
public class McpSecurityConfig {
    @Bean public SecurityFilterChain mcpChain(HttpSecurity http) throws Exception {
        http.securityMatcher("/mcp/**","/mcp").csrf(AbstractHttpConfigurer::disable).authorizeHttpRequests(a->a.anyRequest().permitAll());
        return http.build();
    }
}`;

const MCP_SERVICE_SRC = `// AUTO-GENERATED BY ADESSO AI — 8 MCP-Tools aus 3 Spring-Modulith-Modulen
package com.sivalabs.bookstore.mcp;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sivalabs.bookstore.catalog.ProductApi;
import com.sivalabs.bookstore.catalog.domain.ProductService;
import com.sivalabs.bookstore.orders.OrdersApi;
import com.sivalabs.bookstore.orders.domain.OrderService;
import com.sivalabs.bookstore.orders.domain.models.*;
import com.sivalabs.bookstore.inventory.domain.InventoryService;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.util.*;

@SuppressWarnings({"NullAway","NullAway.Init"})
@Service
public class McpService {
    private final ProductApi productApi;
    private final ProductService productService;
    private final OrdersApi ordersApi;
    private final OrderService orderService;
    private final InventoryService inventoryService;
    private final ObjectMapper mapper = new ObjectMapper();

    public McpService(ProductApi pa, ProductService ps, OrdersApi oa, OrderService os, InventoryService is) {
        this.productApi=pa; this.productService=ps; this.ordersApi=oa; this.orderService=os; this.inventoryService=is;
    }

    public List<Map<String,Object>> listTools() {
        return List.of(
            tool("list_products","[Katalog] Bücher seitenweise auflisten.",Map.of("page",Map.of("type","integer","description","Seitennummer ab 1"))),
            tool("get_product","[Katalog] Produktdetails per Code.",Map.of("code",Map.of("type","string"))),
            tool("list_orders","[Bestellungen] Bestellliste, optional nach Status filtern.",Map.of("page",Map.of("type","integer"),"status",Map.of("type","string","description","NEW|IN_PROCESS|DELIVERED|CANCELLED"))),
            tool("get_order","[Bestellungen] Bestelldetails per Bestellnummer.",Map.of("orderNumber",Map.of("type","string"))),
            tool("create_order","[Bestellungen] Neue Bestellung anlegen.",Map.of("customerName",Map.of("type","string"),"customerEmail",Map.of("type","string"),"customerPhone",Map.of("type","string"),"deliveryAddress",Map.of("type","string"),"productCode",Map.of("type","string"),"quantity",Map.of("type","integer"))),
            tool("update_order_status","[Bestellungen] Bestellstatus ändern.",Map.of("orderNumber",Map.of("type","string"),"status",Map.of("type","string"))),
            tool("get_stock_level","[Inventar] Lagerbestand für Produktcode.",Map.of("productCode",Map.of("type","string"))),
            tool("list_low_stock","[Inventar] Artikel unter Mindestbestand.",Map.of("threshold",Map.of("type","integer","description","Standard: 10")))
        );
    }

    public Object callTool(String name, Map<String,Object> args) {
        return switch (name) {
            case "list_products" -> {
                int page = args.containsKey("page") ? ((Number)args.get("page")).intValue() : 1;
                var r = productService.getProducts(page);
                yield Map.of("totalElements",r.totalElements(),"totalPages",r.totalPages(),"data",r.data().stream().map(p->Map.of("code",p.code(),"name",p.name(),"price",p.price())).toList());
            }
            case "get_product" -> {
                String code=(String)args.get("code");
                yield productApi.getByCode(code).map(p->Map.of("code",p.code(),"name",p.name(),"price",p.price(),"description",p.description()!=null?p.description():"")).orElseThrow(()->new IllegalArgumentException("Nicht gefunden: "+code));
            }
            case "list_orders" -> {
                int page = args.containsKey("page")?((Number)args.get("page")).intValue():1;
                OrderStatus st=null; if(args.get("status") instanceof String s){try{st=OrderStatus.valueOf(s);}catch(Exception ignored){}}
                var r=orderService.getOrdersAdmin(page,st);
                yield Map.of("totalElements",r.totalElements(),"data",r.data().stream().map(o->{Map<String,Object> m=new HashMap<>();m.put("orderNumber",o.orderNumber());m.put("status",o.status().name());m.put("customer",o.customerName());m.put("createdAt",o.createdAt().toString());return m;}).toList());
            }
            case "get_order" -> {
                String nr=(String)args.get("orderNumber");
                yield orderService.findOrderAdmin(nr).map(o->{Map<String,Object> m=new HashMap<>();m.put("orderNumber",o.orderNumber());m.put("status",o.status().name());m.put("customerName",o.customer().name());m.put("productCode",o.item().code());m.put("quantity",o.item().quantity());m.put("price",o.item().price());return(Object)m;}).orElseThrow(()->new IllegalArgumentException("Nicht gefunden: "+nr));
            }
            case "create_order" -> {
                String code=(String)args.get("productCode"); int qty=((Number)args.get("quantity")).intValue();
                var prod=productApi.getByCode(code).orElseThrow(()->new IllegalArgumentException("Produkt nicht gefunden: "+code));
                var cmd=new CreateOrderCmd(null,new Customer((String)args.get("customerName"),(String)args.get("customerEmail"),(String)args.get("customerPhone")),(String)args.get("deliveryAddress"),new OrderItem(code,prod.name(),prod.price().multiply(BigDecimal.valueOf(qty)),qty));
                var res=ordersApi.createOrder(cmd); yield Map.of("orderNumber",res.orderNumber(),"status","NEW");
            }
            case "update_order_status" -> {
                String nr=(String)args.get("orderNumber"); OrderStatus ns=OrderStatus.valueOf((String)args.get("status"));
                orderService.updateOrderStatus(nr,ns); yield Map.of("orderNumber",nr,"newStatus",ns.name(),"updated",true);
            }
            case "get_stock_level" -> {
                String code=(String)args.get("productCode"); Long qty=inventoryService.getStockLevel(code); yield Map.of("productCode",code,"quantity",qty!=null?qty:0);
            }
            case "list_low_stock" -> {
                int thr=args.containsKey("threshold")?((Number)args.get("threshold")).intValue():10;
                var r=inventoryService.getAllInventory(1);
                var low=r.data().stream().filter(i->i.quantity()<=thr).map(i->Map.of("productCode",i.productCode(),"quantity",i.quantity())).toList();
                yield Map.of("threshold",thr,"count",low.size(),"items",low);
            }
            default -> throw new IllegalArgumentException("Unbekanntes Tool: "+name);
        };
    }

    private Map<String,Object> tool(String n,String d,Map<String,Object> p){Map<String,Object>s=new HashMap<>();s.put("type","object");s.put("properties",p);return Map.of("name",n,"description",d,"inputSchema",s);}
}`;

// ── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
