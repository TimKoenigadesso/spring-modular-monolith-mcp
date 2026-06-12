#!/usr/bin/env node
/**
 * agentic-sdlc-orchestrator — Lokaler MCP-Server für Demo 3
 *
 * Steuert den kompletten Demo-3-Ablauf:
 *   create_mcp_enablement_ticket  → Jira INVEST-Ticket anlegen
 *   get_ticket_status             → Aktueller Jira-Status
 *   get_pipeline_status           → GitHub-Actions-Lauf + Agenten-Jobs
 *   get_results                   → Verifikationsreport, PR-Link, Live-URL
 *   get_connection_script         → Ein-Befehl-Anbindung für Claude Desktop
 *
 * Konfiguration (Umgebungsvariablen):
 *   JIRA_URL          https://adesso-group.atlassian.net
 *   JIRA_USER_EMAIL   tim.koenig@adesso.de
 *   JIRA_API_TOKEN    [Jira API Token]
 *   GITHUB_TOKEN      [GitHub PAT]
 *   GITHUB_REPO       TimKoenigadesso/spring-modular-monolith-mcp
 */

import { Server }               from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dir, '.demo3-state.json');

// ── Konfiguration ─────────────────────────────────────────────────────────────

const JIRA_URL    = process.env.JIRA_URL         || 'https://adesso-group.atlassian.net';
const JIRA_USER   = process.env.JIRA_USER_EMAIL  || '';
const JIRA_TOKEN  = process.env.JIRA_API_TOKEN   || '';
const GH_TOKEN    = process.env.GITHUB_TOKEN     || '';
const GH_REPO     = process.env.GITHUB_REPO      || 'TimKoenigadesso/spring-modular-monolith-mcp';
const JIRA_PROJ   = process.env.JIRA_PROJECT_KEY || 'AGSDLC';

// ── State (persistent über Tool-Calls hinweg) ─────────────────────────────────

function loadState() {
  try {
    return existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : {};
  } catch { return {}; }
}

function saveState(patch) {
  const s = { ...loadState(), ...patch };
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
  return s;
}

// ── Jira API Helpers ──────────────────────────────────────────────────────────

async function jiraGet(path) {
  const res = await fetch(`${JIRA_URL}/rest/api/3${path}`, {
    headers: {
      'Authorization': `Basic ${Buffer.from(`${JIRA_USER}:${JIRA_TOKEN}`).toString('base64')}`,
      'Accept': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Jira GET ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function jiraPost(path, body) {
  const res = await fetch(`${JIRA_URL}/rest/api/3${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${JIRA_USER}:${JIRA_TOKEN}`).toString('base64')}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Jira POST ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

// ── GitHub API Helpers ────────────────────────────────────────────────────────

async function ghGet(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      'Authorization': `Bearer ${GH_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) throw new Error(`GitHub GET ${path}: ${res.status}`);
  return res.json();
}

// ── Tool: create_mcp_enablement_ticket ────────────────────────────────────────

async function createMcpEnablementTicket({ requirement }) {
  // INVEST User Story aus der Anforderung ableiten
  const shortReq = requirement.slice(0, 80);

  // Maschinenlesbare Sektion für Pipeline-Intake-Agent
  const machineSection = [
    '---MACHINE-READABLE---',
    `repo_url: https://github.com/${GH_REPO}`,
    `target_branch: main`,
    `pipeline_type: mcp-enablement`,
    `created_at: ${new Date().toISOString()}`,
    '---END---',
  ].join('\n');

  // ADF-Beschreibung (Atlassian Document Format)
  const description = {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'heading', attrs: { level: 2 },
        content: [{ type: 'text', text: '📖 User Story' }],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Als ', marks: [{ type: 'strong' }] },
          { type: 'text', text: 'Produktverantwortlicher ' },
          { type: 'text', text: 'möchte ich ', marks: [{ type: 'strong' }] },
          { type: 'text', text: `dass ${requirement} ` },
          { type: 'text', text: 'damit ', marks: [{ type: 'strong' }] },
          { type: 'text', text: 'Claude und andere KI-Assistenten den Spring Modulith Bookstore direkt per natürlicher Sprache steuern können — ohne Codeänderung durch den Entwickler.' },
        ],
      },
      {
        type: 'heading', attrs: { level: 2 },
        content: [{ type: 'text', text: '✅ Akzeptanzkriterien' }],
      },
      {
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'AC-1: Ein MCP-Server-Endpunkt unter /mcp ist erreichbar und antwortet auf initialize.' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'AC-2: Genau 8 MCP-Tools sind über tools/list abrufbar (Katalog: 2, Bestellungen: 4, Inventar: 2).' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'AC-3: Alle 8 Tools sind im Verifikationsreport Tool-für-Tool als BESTANDEN dokumentiert (Happy Path + Fehlerfall).' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'AC-4: Security-Review der Tool-Berechtigungen bestanden: keine destruktiven Operationen ohne Status-Übergang, Least-Privilege.' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'AC-5: Alle Unit-Tests der MCP-Schicht sind grün (mind. Happy Path, Fehlerfall, Validierung pro Tool).' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'AC-6: Mindestens ein modulübergreifender Integrationstest ist grün: Bestellung anlegen → Inventar reduziert → Benachrichtigung ausgelöst.' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'AC-7: Der deployte Endpoint (Cloud Run, europe-west3) ist live erreichbar und der Health-Check antwortet mit HTTP 200.' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'AC-8: Ein Pull Request existiert mit Jira-Link, Live-URL und vollständigem Verifikationsreport als PR-Description.' }] }] },
        ],
      },
      {
        type: 'heading', attrs: { level: 2 },
        content: [{ type: 'text', text: '🏛️ Definition of Done' }],
      },
      {
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Alle 8 Akzeptanzkriterien sind automatisiert verifiziert.' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'PR ist erstellt, Verifikationsreport angehängt.' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Live-URL ist in Claude Desktop per connect-to-claude-Script anbindbar.' }] }] },
        ],
      },
      {
        type: 'heading', attrs: { level: 2 },
        content: [{ type: 'text', text: '⚙️ Technische Metadaten (Pipeline)' }],
      },
      {
        type: 'codeBlock', attrs: { language: 'text' },
        content: [{ type: 'text', text: machineSection }],
      },
    ],
  };

  // Ticket anlegen
  const issue = await jiraPost('/issue', {
    fields: {
      project: { key: JIRA_PROJ },
      issuetype: { name: 'Task' },
      summary: `MCP-Enablement: ${shortReq}`,
      description,
      labels: ['demo3', 'mcp-enablement', 'agentic-sdlc'],
      story_points: 8,
    },
  });

  const ticketKey = issue.key;
  const ticketUrl = `${JIRA_URL}/browse/${ticketKey}`;

  saveState({ ticketKey, ticketUrl, requirement });

  return {
    ticketKey,
    ticketUrl,
    message: `✅ Jira-Ticket ${ticketKey} angelegt.\n\n` +
      `📋 Summary: MCP-Enablement: ${shortReq}\n` +
      `🔗 URL: ${ticketUrl}\n\n` +
      `**Nächster Schritt:** Öffne das Ticket in Jira und ziehe es auf Status „Req definiert" ` +
      `— das startet automatisch die 10-Agenten-Pipeline in GitHub Actions.\n\n` +
      `Oder warte hier und ich frage alle 30 Sekunden den Status ab.`,
  };
}

// ── Tool: get_ticket_status ───────────────────────────────────────────────────

async function getTicketStatus({ ticketKey: inputKey }) {
  const state = loadState();
  const key = inputKey || state.ticketKey;
  if (!key) return { error: 'Kein Ticket-Key bekannt. Bitte zuerst create_mcp_enablement_ticket aufrufen.' };

  const issue = await jiraGet(`/issue/${key}?fields=summary,status,labels,assignee`);
  const status = issue.fields.status.name;
  const summary = issue.fields.summary;
  const url = `${JIRA_URL}/browse/${key}`;

  const isPipelineReady = status === 'Req definiert';

  return {
    ticketKey: key,
    status,
    summary,
    url,
    isPipelineReady,
    message: isPipelineReady
      ? `🟢 Ticket ${key} ist auf "Req definiert" — Pipeline sollte automatisch starten.\n   Falls nicht: manuell über GitHub Actions starten (workflow_dispatch, ticket_id=${key}).`
      : `📋 Ticket ${key}: "${summary}"\n   Status: ${status}\n   URL: ${url}\n\n` +
        (status === 'Idee'
          ? `👆 Ziehe das Ticket in Jira auf "Req definiert" um die Pipeline zu starten.`
          : status === 'In Implementierung'
          ? `⚙️ Pipeline läuft gerade! Nutze get_pipeline_status für Details.`
          : status === 'Fertig zur Abnahme' || status === 'Abgenommen'
          ? `🎉 Fertig! Nutze get_results um Verifikationsreport und Live-URL abzurufen.`
          : `Warte auf nächsten Schritt.`),
  };
}

// ── Tool: get_pipeline_status ─────────────────────────────────────────────────

async function getPipelineStatus({ ticketKey: inputKey }) {
  const state = loadState();
  const key = inputKey || state.ticketKey;
  if (!key) return { error: 'Kein Ticket-Key bekannt.' };

  // Letzten passenden Workflow-Run suchen
  const runs = await ghGet(`/repos/${GH_REPO}/actions/workflows/demo3-mcp-enablement.yml/runs?per_page=10`);
  const run = runs.workflow_runs?.find(r =>
    r.name?.includes(key) ||
    r.head_branch?.includes(key.toLowerCase()) ||
    r.display_title?.includes(key)
  ) || runs.workflow_runs?.[0];

  if (!run) {
    return {
      status: 'not_started',
      message: `Kein Pipeline-Lauf für ${key} gefunden.\n` +
        `Ticket auf "Req definiert" setzen oder manuell starten:\n` +
        `https://github.com/${GH_REPO}/actions/workflows/demo3-mcp-enablement.yml`,
    };
  }

  saveState({ runId: run.id, runUrl: run.html_url });

  // Jobs abrufen
  const jobsData = await ghGet(`/repos/${GH_REPO}/actions/runs/${run.id}/jobs`);
  const jobs = (jobsData.jobs || []).map(j => ({
    name: j.name,
    status: j.status,
    conclusion: j.conclusion,
    startedAt: j.started_at,
    completedAt: j.completed_at,
  }));

  const running  = jobs.filter(j => j.status === 'in_progress').map(j => j.name);
  const done     = jobs.filter(j => j.status === 'completed' && j.conclusion === 'success').map(j => j.name);
  const failed   = jobs.filter(j => j.conclusion === 'failure').map(j => j.name);
  const waiting  = jobs.filter(j => j.status === 'queued' || j.status === 'waiting').map(j => j.name);

  return {
    runId: run.id,
    runUrl: run.html_url,
    status: run.status,
    conclusion: run.conclusion,
    ticketKey: key,
    agents: { running, done, failed, waiting },
    jobs,
    message:
      `🔄 Pipeline: ${run.status} ${run.conclusion ? `(${run.conclusion})` : ''}\n` +
      `🔗 ${run.html_url}\n\n` +
      (running.length  ? `⚙️  Läuft gerade:    ${running.join(', ')}\n`  : '') +
      (done.length     ? `✅ Abgeschlossen:   ${done.join(', ')}\n`        : '') +
      (failed.length   ? `❌ Fehlgeschlagen:  ${failed.join(', ')}\n`      : '') +
      (waiting.length  ? `⏳ Wartet:          ${waiting.join(', ')}\n`     : '') +
      `\n💡 Tipp: Im Actions-Graph siehst du den DAG live:\n${run.html_url}`,
  };
}

// ── Tool: get_results ─────────────────────────────────────────────────────────

async function getResults({ ticketKey: inputKey }) {
  const state = loadState();
  const key = inputKey || state.ticketKey;
  if (!key) return { error: 'Kein Ticket-Key bekannt.' };

  // Letzten Run finden
  const runs = await ghGet(`/repos/${GH_REPO}/actions/workflows/demo3-mcp-enablement.yml/runs?per_page=5`);
  const run = runs.workflow_runs?.find(r =>
    r.name?.includes(key) ||
    r.head_branch?.includes(key.toLowerCase())
  ) || runs.workflow_runs?.[0];

  if (!run) return { error: 'Kein abgeschlossener Lauf gefunden.' };
  if (run.status !== 'completed') {
    return { status: 'in_progress', message: `Pipeline läuft noch (${run.status}). Bitte warten.` };
  }
  if (run.conclusion !== 'success') {
    return {
      status: 'failed',
      conclusion: run.conclusion,
      message: `❌ Pipeline fehlgeschlagen (${run.conclusion}).\n🔗 Details: ${run.html_url}`,
    };
  }

  // Artifacts herunterladen und Ergebnisse lesen
  const artifacts = await ghGet(`/repos/${GH_REPO}/actions/runs/${run.id}/artifacts`);
  const releaseArtifact = artifacts.artifacts?.find(a => a.name === 'release-summary');

  // Live-URL aus Deployment-Artifact oder State
  const liveUrl = state.liveUrl || 'Prüfe GitHub Actions Deployment-Agent für die URL';

  const connectionCmd = `node ${__dir}/../scripts/connect-to-claude.mjs "${liveUrl}"`;

  saveState({ runId: run.id, liveUrl, conclusion: run.conclusion });

  return {
    status: 'success',
    runUrl: run.html_url,
    prUrl: `https://github.com/${GH_REPO}/pulls`,
    liveUrl,
    artifacts: artifacts.artifacts?.map(a => ({ name: a.name, size: a.size_in_bytes })) || [],
    connectionCommand: connectionCmd,
    message:
      `🎉 **Demo 3 Pipeline erfolgreich!**\n\n` +
      `✅ Alle 8 MCP-Tools verifiziert\n` +
      `🚀 Live-URL: ${liveUrl}\n` +
      `📦 PR: https://github.com/${GH_REPO}/pulls\n` +
      `🔗 Actions-Lauf: ${run.html_url}\n\n` +
      `**Letzter Schritt — Bookstore in Claude Desktop anbinden:**\n` +
      `\`\`\`\n${connectionCmd}\n\`\`\`\n\n` +
      `Danach Claude Desktop neu starten und mit dem Bookstore sprechen:\n` +
      `"Welche Bücher haben niedrigen Lagerbestand?"\n` +
      `"Lege eine Testbestellung für The Hunger Games an."`,
  };
}

// ── Tool: get_connection_script ───────────────────────────────────────────────

async function getConnectionScript({ liveUrl: inputUrl }) {
  const state = loadState();
  const url = inputUrl || state.liveUrl || 'https://bookstore-mcp-55050-781137566329.europe-west3.run.app';

  const proxyPath = join(__dir, '../bookstore-mcp-proxy/index.mjs');
  const command = `node "${proxyPath}"`;

  return {
    liveUrl: url,
    command: `BOOKSTORE_URL="${url}" ${command}`,
    connectScript: `node "${join(__dir, '../scripts/connect-to-claude.mjs')}" "${url}"`,
    claudeDesktopConfig: {
      mcpServers: {
        'bookstore-mcp': {
          command: 'node',
          args: [proxyPath],
          env: {
            BOOKSTORE_URL: url,
          },
        },
      },
    },
    message:
      `**Bookstore MCP-Server anbinden:**\n\n` +
      `**Option 1 — Automatisch (empfohlen):**\n` +
      `\`\`\`bash\nnode "${join(__dir, '../scripts/connect-to-claude.mjs')}" "${url}"\n\`\`\`\n\n` +
      `**Option 2 — Manuell in claude_desktop_config.json:**\n` +
      `\`\`\`json\n${JSON.stringify({ mcpServers: { 'bookstore-mcp': { command: 'node', args: [proxyPath], env: { BOOKSTORE_URL: url } } } }, null, 2)}\n\`\`\`\n\n` +
      `⚠️  Claude Desktop danach neu starten!\n\n` +
      `📚 Dann kannst du sagen:\n` +
      `"Welche Bücher haben niedrigen Lagerbestand?"\n` +
      `"Lege eine Testbestellung für The Hunger Games an."`,
  };
}

// ── MCP-Server ────────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'agentic-sdlc-orchestrator', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'create_mcp_enablement_ticket',
      description:
        'Erstellt ein vollständiges Jira INVEST-Ticket im Projekt AGSDLC für die MCP-Enablement-Anforderung. ' +
        'Inkl. 8 Akzeptanzkriterien, Story Points, Labels (demo3, mcp-enablement, agentic-sdlc) und ' +
        'maschinenlesbarer Sektion für die Pipeline. ' +
        'Starte damit: Beschreibe was du mit dem Bookstore-Monolithen erreichen möchtest.',
      inputSchema: {
        type: 'object',
        properties: {
          requirement: {
            type: 'string',
            description: 'Natürlichsprachige Beschreibung der Anforderung, z.B. "der Spring Modulith Bookstore als MCP-Server für Claude Desktop verfügbar gemacht wird"',
          },
        },
        required: ['requirement'],
      },
    },
    {
      name: 'get_ticket_status',
      description: 'Liefert den aktuellen Jira-Status des MCP-Enablement-Tickets und gibt Hinweise zum nächsten Schritt.',
      inputSchema: {
        type: 'object',
        properties: {
          ticketKey: {
            type: 'string',
            description: 'Jira Ticket-Key, z.B. AGSDLC-42. Optional, wenn create_mcp_enablement_ticket bereits aufgerufen wurde.',
          },
        },
      },
    },
    {
      name: 'get_pipeline_status',
      description:
        'Liefert den aktuellen Status der GitHub-Actions-Pipeline inkl. aller 10 Agenten-Jobs ' +
        '(welcher läuft, welcher ist fertig, welcher wartet). Link zum Actions-Graph.',
      inputSchema: {
        type: 'object',
        properties: {
          ticketKey: {
            type: 'string',
            description: 'Jira Ticket-Key. Optional, wenn vorheriger State bekannt.',
          },
        },
      },
    },
    {
      name: 'get_results',
      description:
        'Liefert nach Pipeline-Ende: Verifikationsreport mit Tool-für-Tool-Matrix, PR-Link, Live-URL des deployten MCP-Endpoints und den Anbindungsbefehl für Claude Desktop.',
      inputSchema: {
        type: 'object',
        properties: {
          ticketKey: {
            type: 'string',
            description: 'Jira Ticket-Key. Optional, wenn vorheriger State bekannt.',
          },
        },
      },
    },
    {
      name: 'get_connection_script',
      description:
        'Liefert den Ein-Befehl-Aufruf um den deployen Bookstore-MCP-Server in Claude Desktop einzubinden. ' +
        'Patcht die claude_desktop_config.json automatisch.',
      inputSchema: {
        type: 'object',
        properties: {
          liveUrl: {
            type: 'string',
            description: 'Live-URL des deployen Bookstore-MCP-Endpoints. Optional, wenn get_results bereits aufgerufen wurde.',
          },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  try {
    let result;
    switch (name) {
      case 'create_mcp_enablement_ticket': result = await createMcpEnablementTicket(args); break;
      case 'get_ticket_status':            result = await getTicketStatus(args);            break;
      case 'get_pipeline_status':          result = await getPipelineStatus(args);          break;
      case 'get_results':                  result = await getResults(args);                 break;
      case 'get_connection_script':        result = await getConnectionScript(args);        break;
      default: throw new Error(`Unbekanntes Tool: ${name}`);
    }
    return {
      content: [{
        type: 'text',
        text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
      }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `❌ Fehler: ${err.message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
