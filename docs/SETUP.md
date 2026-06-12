# Demo 3 — Setup-Anleitung

Vollständige Einrichtung aller Komponenten für Demo 3.

## Voraussetzungen

| Tool | Version | Prüfen |
|------|---------|--------|
| Node.js | >= 18 | `node --version` |
| gcloud CLI | aktuell | `gcloud version` |
| gh CLI | aktuell | `gh --version` |
| Git | >= 2.40 | `git --version` |

## GCP-Voraussetzungen

Bereits konfiguriert:
- Projekt: `adesso-genai-solunit-demo`
- Region: `europe-west3`
- Artifact Registry: `aeh-services`
- Service Account: `gitlab-deployer@adesso-genai-solunit-demo.iam.gserviceaccount.com`

## GitHub Secrets (spring-modular-monolith-mcp)

Bereits gesetzt (von `connect-demo3-setup.sh` oder manuell):

| Secret | Wert |
|--------|------|
| `JIRA_API_TOKEN` | Jira API Token |
| `JIRA_USER_EMAIL` | `tim.koenig@adesso.de` |
| `JIRA_BASE_URL` | `https://adesso-group.atlassian.net` |
| `JIRA_PROJECT_KEY` | `AGSDLC` |
| `GCP_SERVICE_ACCOUNT_KEY` | Base64-kodierter SA-Key |
| `GCP_PROJECT_ID` | `adesso-genai-solunit-demo` |
| `GH_PAT` | GitHub PAT mit `repo` + `workflow` Scope |
| `CLOUD_ML_REGION` | `europe-west1` |

Secrets prüfen:
```bash
gh secret list --repo TimKoenigadesso/spring-modular-monolith-mcp
```

## Lokale MCP-Server installieren

```bash
cd ~/spring-modular-monolith-mcp

# Orchestrator
cd agentic-sdlc-orchestrator
npm install
cd ..

# Proxy
cd bookstore-mcp-proxy
npm install
cd ..
```

## Claude Desktop konfigurieren

Füge Folgendes zu `~/Library/Application Support/Claude/claude_desktop_config.json` hinzu:

```json
{
  "mcpServers": {
    "agentic-sdlc-orchestrator": {
      "command": "node",
      "args": ["/Users/DEIN_NAME/spring-modular-monolith-mcp/agentic-sdlc-orchestrator/index.mjs"],
      "env": {
        "JIRA_URL":          "https://adesso-group.atlassian.net",
        "JIRA_USER_EMAIL":   "tim.koenig@adesso.de",
        "JIRA_API_TOKEN":    "[JIRA API TOKEN]",
        "GITHUB_TOKEN":      "[GITHUB PAT]",
        "GITHUB_REPO":       "TimKoenigadesso/spring-modular-monolith-mcp",
        "JIRA_PROJECT_KEY":  "AGSDLC"
      }
    }
  }
}
```

> Oder automatisch via: `node scripts/connect-to-claude.mjs [BOOKSTORE_URL]`

## Jira-Automation einrichten

Siehe `docs/JIRA-AUTOMATION.md` für die vollständige Schritt-für-Schritt-Anleitung.

## Schnelltest — Orchestrator

```bash
# Test: Orchestrator lokal starten (erwartet Umgebungsvariablen)
JIRA_URL="https://adesso-group.atlassian.net" \
JIRA_USER_EMAIL="tim.koenig@adesso.de" \
JIRA_API_TOKEN="[TOKEN]" \
GITHUB_TOKEN="[TOKEN]" \
GITHUB_REPO="TimKoenigadesso/spring-modular-monolith-mcp" \
node agentic-sdlc-orchestrator/index.mjs
```

## Schnelltest — Bookstore-Proxy

```bash
# Golden-Instanz als Standard
node bookstore-mcp-proxy/index.mjs

# Custom URL
BOOKSTORE_URL="https://bookstore-mcp-55050-781137566329.europe-west3.run.app" \
node bookstore-mcp-proxy/index.mjs
```

## Schnelltest — Pipeline

```bash
# Pipeline manuell starten
GH_TOKEN="[TOKEN]" gh workflow run demo3-mcp-enablement.yml \
  --repo TimKoenigadesso/spring-modular-monolith-mcp \
  --field jira_ticket_id=AGSDLC-TEST
```

## Safe-Mode — Goldene Instanzen

Zwei goldene, vorab deployede Instanzen als Fallback:

| Instanz | URL | Zweck |
|---------|-----|-------|
| `bookstore-mcp-golden` | `https://bookstore-mcp-golden-781137566329.europe-west3.run.app` | Primärer Fallback |
| `bookstore-mcp-55050` | `https://bookstore-mcp-55050-781137566329.europe-west3.run.app` | Sekundärer Fallback |

Für Safe-Mode (goldene Instanz direkt anbinden):
```bash
node scripts/connect-to-claude.mjs \
  "https://bookstore-mcp-golden-781137566329.europe-west3.run.app"
```
