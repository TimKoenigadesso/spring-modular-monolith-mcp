# Jira Automation — Demo 3 Setup

Diese Anleitung konfiguriert die Jira-Automation, die beim Statusübergang auf
„Req definiert" (mit Label `demo3`) automatisch die GitHub-Actions-Pipeline startet.

## Voraussetzungen

- Jira-Admin-Rechte im Projekt AGSDLC
- GitHub PAT mit `workflow` und `repo` Scope (ist als Secret `GH_PAT` in
  `TimKoenigadesso/spring-modular-monolith-mcp` hinterlegt)

---

## Schritt-für-Schritt-Anleitung

### 1. Jira-Automation öffnen

1. Öffne `https://adesso-group.atlassian.net/jira/software/projects/AGSDLC/boards`
2. Klicke oben rechts auf **Projekteinstellungen** (Zahnrad)
3. Wähle **Automatisierung** im linken Menü
4. Klicke **Regel erstellen**

### 2. Trigger konfigurieren

- **Trigger:** `Issue-Status geändert`
- **Von:** (beliebig)
- **Zu:** `Req definiert`

### 3. Bedingung hinzufügen

Klicke **Bedingung hinzufügen** → **Issue-Felder-Bedingung**:
- **Feld:** `Labels`
- **Bedingung:** `enthält`
- **Wert:** `demo3`

> Diese Bedingung trennt Demo-3-Tickets von normalen AGSDLC-Tickets (Demo 1).

### 4. Aktion: Web-Request senden

Klicke **Aktion hinzufügen** → **Web-Request senden**

| Einstellung | Wert |
|-------------|------|
| **URL** | `https://api.github.com/repos/TimKoenigadesso/spring-modular-monolith-mcp/dispatches` |
| **Methode** | POST |
| **Authentifizierung** | Keine (Token im Header) |

**Headers:**
```
Authorization: Bearer [GH_PAT aus Secret Manager oder direkt eingeben]
Accept: application/vnd.github+json
Content-Type: application/json
X-GitHub-Api-Version: 2022-11-28
```

**Body (JSON):**
```json
{
  "event_type": "mcp-enablement-approved",
  "client_payload": {
    "ticket_key": "{{issue.key}}"
  }
}
```

> `{{issue.key}}` ist ein Jira-Smart-Value und wird automatisch durch den Ticket-Key ersetzt (z.B. `AGSDLC-42`).

### 5. Automation benennen und aktivieren

- **Name:** `Demo 3 — MCP-Enablement Pipeline starten`
- **Aktiv:** Ja
- **Klicke Speichern**

---

## Test der Automation

```bash
# Manueller Test: Ticket AGSDLC-TEST auf "Req definiert" setzen
curl -X POST \
  -u "tim.koenig@adesso.de:$JIRA_API_TOKEN" \
  "https://adesso-group.atlassian.net/rest/api/3/issue/AGSDLC-TEST/transitions" \
  -H "Content-Type: application/json" \
  -d '{"transition":{"id":"31473"}}'
```

Danach in GitHub Actions prüfen:
`https://github.com/TimKoenigadesso/spring-modular-monolith-mcp/actions`

---

## Fallback: Manueller Pipeline-Start

Falls die Jira-Automation nicht greifbar ist (z.B. Netzwerk-Einschränkungen
im Jira-Tenant), kann die Pipeline manuell gestartet werden:

### Via GitHub Web-UI:

1. Öffne `https://github.com/TimKoenigadesso/spring-modular-monolith-mcp/actions`
2. Wähle **Demo 3 - MCP-Enablement (10-Agenten-Pipeline)**
3. Klicke **Run workflow**
4. Gib die Jira Ticket-ID ein (z.B. `AGSDLC-42`)
5. Klicke **Run workflow**

### Via curl/API:

```bash
# GH_TOKEN und TICKET_ID als Umgebungsvariablen setzen
curl -X POST \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/TimKoenigadesso/spring-modular-monolith-mcp/actions/workflows/demo3-mcp-enablement.yml/dispatches" \
  -d "{\"ref\":\"main\",\"inputs\":{\"jira_ticket_id\":\"$TICKET_ID\"}}"
```

---

## Jira-Transition-IDs für AGSDLC

| Status | ID |
|--------|----|
| Idee | 31472 |
| Req definiert | 31473 |
| Abgenommen | 31474 |
| In Implementierung | 31475 |
| Fertig zur Abnahme | 31476 |
