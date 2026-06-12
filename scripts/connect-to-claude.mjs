#!/usr/bin/env node
/**
 * connect-to-claude.mjs — Ein-Befehl-Anbindung des Bookstore MCP-Servers an Claude Desktop
 *
 * Verwendung:
 *   node scripts/connect-to-claude.mjs [BOOKSTORE_URL]
 *
 * Was das Script tut:
 *   1. Findet claude_desktop_config.json auf macOS und Windows
 *   2. Legt ein Backup an (config.json.backup-YYYY-MM-DD)
 *   3. Fügt den bookstore-mcp Eintrag idempotent hinzu oder aktualisiert ihn
 *   4. Berührt nichts anderes in der Config
 *   5. Zeigt klar was geändert wurde
 */

import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir, platform } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));

// ── Konfiguration ─────────────────────────────────────────────────────────────

const BOOKSTORE_URL = (process.argv[2] || process.env.BOOKSTORE_URL || '').replace(/\/$/, '');
const PROXY_PATH    = join(__dir, '../bookstore-mcp-proxy/index.mjs');

// ── Pfade je Plattform ────────────────────────────────────────────────────────

function findClaudeConfig() {
  const os = platform();
  const home = homedir();

  const candidates = os === 'win32'
    ? [
        join(home, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json'),
        join(home, 'AppData', 'Local', 'AnthropicClaude', 'claude_desktop_config.json'),
      ]
    : [
        join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
        join(home, '.config', 'claude', 'claude_desktop_config.json'),
      ];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return candidates[0]; // Wird neu erstellt falls nicht vorhanden
}

// ── Hauptlogik ────────────────────────────────────────────────────────────────

function banner(text) {
  const line = '─'.repeat(Math.min(text.length + 4, 70));
  console.log(`\n${line}`);
  console.log(`  ${text}`);
  console.log(line);
}

function step(num, text) {
  console.log(`\n  [${num}] ${text}`);
}

async function main() {
  banner('🔗  Bookstore MCP-Server → Claude Desktop');

  if (!BOOKSTORE_URL) {
    console.log(`
  ℹ  Kein Bookstore-URL angegeben. Nutze goldene Demo-Instanz als Fallback.

  Verwendung:
    node scripts/connect-to-claude.mjs <BOOKSTORE_URL>

  Beispiel:
    node scripts/connect-to-claude.mjs https://bookstore-mcp-55050-781137566329.europe-west3.run.app
`);
  }

  const effectiveUrl = BOOKSTORE_URL || 'https://bookstore-mcp-golden-781137566329.europe-west3.run.app';

  console.log(`\n  Bookstore-URL:  ${effectiveUrl}`);
  console.log(`  Proxy-Script:   ${PROXY_PATH}`);

  // ── Schritt 1: Config-Datei finden ────────────────────────────────────────
  step(1, 'Claude-Desktop-Config suchen...');
  const configPath = findClaudeConfig();
  console.log(`     Pfad: ${configPath}`);

  // ── Schritt 2: Config lesen (oder neu erstellen) ──────────────────────────
  step(2, 'Config laden...');
  let config = {};
  let existed = false;

  if (existsSync(configPath)) {
    existed = true;
    try {
      config = JSON.parse(readFileSync(configPath, 'utf8'));
      console.log(`     Bestehende Config geladen (${Object.keys(config.mcpServers || {}).length} Server konfiguriert).`);
    } catch (e) {
      console.error(`     ⚠ Config-Datei defekt (${e.message}), erstelle neue.`);
      config = {};
    }
  } else {
    console.log(`     Config nicht gefunden — wird neu erstellt.`);
  }

  // ── Schritt 3: Backup anlegen ─────────────────────────────────────────────
  if (existed) {
    step(3, 'Backup anlegen...');
    const date = new Date().toISOString().slice(0, 10);
    const backupPath = `${configPath}.backup-${date}`;
    copyFileSync(configPath, backupPath);
    console.log(`     Backup: ${backupPath}`);
  } else {
    step(3, 'Kein Backup nötig (Config wird neu erstellt).');
  }

  // ── Schritt 4: bookstore-mcp idempotent einfügen ──────────────────────────
  step(4, 'bookstore-mcp einfügen / aktualisieren...');

  if (!config.mcpServers) config.mcpServers = {};

  const wasPresent = !!config.mcpServers['bookstore-mcp'];
  const oldUrl = config.mcpServers['bookstore-mcp']?.env?.BOOKSTORE_URL;

  config.mcpServers['bookstore-mcp'] = {
    command: 'node',
    args: [PROXY_PATH],
    env: {
      BOOKSTORE_URL: effectiveUrl,
    },
  };

  if (wasPresent && oldUrl !== effectiveUrl) {
    console.log(`     ✏  Aktualisiert: ${oldUrl} → ${effectiveUrl}`);
  } else if (wasPresent) {
    console.log(`     ✓  Bereits vorhanden, URL unverändert: ${effectiveUrl}`);
  } else {
    console.log(`     ✓  Neu hinzugefügt: bookstore-mcp`);
  }

  // ── Schritt 5: Config schreiben ───────────────────────────────────────────
  step(5, 'Config speichern...');
  const dirPath = configPath.split('/').slice(0, -1).join('/');
  if (!existsSync(dirPath)) {
    const { mkdirSync } = await import('node:fs');
    mkdirSync(dirPath, { recursive: true });
    console.log(`     Verzeichnis erstellt: ${dirPath}`);
  }
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log(`     Gespeichert: ${configPath}`);

  // ── Zusammenfassung ───────────────────────────────────────────────────────
  console.log(`
${'═'.repeat(70)}
  ✅  Fertig! Bookstore MCP-Server ist jetzt in Claude Desktop konfiguriert.

  Server-Name:    bookstore-mcp
  Bookstore-URL:  ${effectiveUrl}
  Config-Datei:   ${configPath}

  ⚠️   WICHTIG: Claude Desktop neu starten!

  Danach kannst du mit dem Bookstore sprechen:
    "Welche Bücher haben niedrigen Lagerbestand?"
    "Lege eine Testbestellung für The Hunger Games an."
    "Zeige mir alle offenen Bestellungen."
${'═'.repeat(70)}
`);
}

main().catch(err => {
  console.error(`\n❌ Fehler: ${err.message}`);
  process.exit(1);
});
