#!/usr/bin/env node
/**
 * bookstore-mcp-proxy — Lokaler MCP-Proxy für den deployen Spring Modulith Bookstore
 *
 * Macht alle 8 MCP-Tools des deployen Endpoints in Claude Desktop verfügbar.
 * Konfiguration:
 *   BOOKSTORE_URL  URL des deployen Bookstore-MCP-Endpoints
 *                  Standard: https://bookstore-mcp-golden-781137566329.europe-west3.run.app
 */

import { Server }               from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const BASE_URL = (process.env.BOOKSTORE_URL || 'https://bookstore-mcp-golden-781137566329.europe-west3.run.app').replace(/\/$/, '');

// ── MCP JSON-RPC Helper ───────────────────────────────────────────────────────

async function mcpCall(method, params = {}) {
  const res = await fetch(`${BASE_URL}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bookstore MCP ${method}: HTTP ${res.status} — ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(`Bookstore MCP Fehler: ${JSON.stringify(data.error)}`);
  return data.result;
}

async function callTool(name, args = {}) {
  const result = await mcpCall('tools/call', { name, arguments: args });
  return result?.content?.[0]?.text ?? JSON.stringify(result);
}

// ── Tool-Definitionen ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'list_products',
    description: '[Katalog] Listet alle Bücher im Bookstore seitenweise auf. Zeigt Name, Code, Preis und Beschreibung.',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'integer', description: 'Seitennummer (1-basiert)', default: 1 },
      },
    },
  },
  {
    name: 'get_product',
    description: '[Katalog] Gibt vollständige Produktdetails (Name, Preis, Beschreibung, Autor) für einen Produktcode zurück.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Produktcode, z.B. P001' },
      },
      required: ['code'],
    },
  },
  {
    name: 'list_orders',
    description: '[Bestellungen] Listet alle Bestellungen auf. Optionaler Status-Filter: NEW, IN_PROCESS, DELIVERED, CANCELLED.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Status-Filter: NEW | IN_PROCESS | DELIVERED | CANCELLED' },
        page:   { type: 'integer', description: 'Seitennummer', default: 1 },
      },
    },
  },
  {
    name: 'get_order',
    description: '[Bestellungen] Gibt Details einer Bestellung (Produkt, Kunde, Status, Lieferadresse) anhand der Bestellnummer zurück.',
    inputSchema: {
      type: 'object',
      properties: {
        orderNumber: { type: 'string', description: 'Bestellnummer, z.B. order-2024-001' },
      },
      required: ['orderNumber'],
    },
  },
  {
    name: 'create_order',
    description: '[Bestellungen] Legt eine neue Bestellung an. Gibt die neue Bestellnummer zurück.',
    inputSchema: {
      type: 'object',
      properties: {
        productCode:     { type: 'string',  description: 'Produktcode' },
        customerName:    { type: 'string',  description: 'Name des Kunden' },
        customerEmail:   { type: 'string',  description: 'E-Mail des Kunden' },
        deliveryAddress: { type: 'string',  description: 'Lieferadresse' },
        customerPhone:   { type: 'string',  description: 'Telefonnummer' },
        quantity:        { type: 'integer', description: 'Menge', default: 1 },
      },
      required: ['productCode', 'customerName', 'customerEmail', 'deliveryAddress'],
    },
  },
  {
    name: 'update_order_status',
    description: '[Bestellungen] Ändert den Status einer Bestellung. Erlaubte Übergänge: NEW→IN_PROCESS, NEW→CANCELLED, IN_PROCESS→DELIVERED, IN_PROCESS→CANCELLED.',
    inputSchema: {
      type: 'object',
      properties: {
        orderNumber: { type: 'string', description: 'Bestellnummer' },
        status:      { type: 'string', description: 'Neuer Status: IN_PROCESS | DELIVERED | CANCELLED' },
      },
      required: ['orderNumber', 'status'],
    },
  },
  {
    name: 'get_stock_level',
    description: '[Inventar] Gibt den aktuellen Lagerbestand für einen Produktcode zurück.',
    inputSchema: {
      type: 'object',
      properties: {
        productCode: { type: 'string', description: 'Produktcode, z.B. P001' },
      },
      required: ['productCode'],
    },
  },
  {
    name: 'list_low_stock',
    description: '[Inventar] Listet alle Artikel mit Lagerbestand ≤ threshold auf. Nützlich für Lageranalyse.',
    inputSchema: {
      type: 'object',
      properties: {
        threshold: { type: 'integer', description: 'Bestandsschwelle (Standard: 10)', default: 10 },
      },
    },
  },
];

// ── MCP-Server ────────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'bookstore-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  try {
    const text = await callTool(name, args);
    return { content: [{ type: 'text', text }] };
  } catch (err) {
    const friendly = err.message.includes('fetch failed')
      ? `❌ Bookstore nicht erreichbar (${BASE_URL}).\nPrüfe ob BOOKSTORE_URL korrekt gesetzt ist und der Service läuft.`
      : `❌ ${err.message}`;
    return { content: [{ type: 'text', text: friendly }], isError: true };
  }
});

process.stderr.write(`[bookstore-mcp-proxy] Starte, Endpoint: ${BASE_URL}\n`);
const transport = new StdioServerTransport();
await server.connect(transport);
