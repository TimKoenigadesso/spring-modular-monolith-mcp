# Demo 3 — Runbook & Drehbuch

**„AI IS THE NEW CORE — Live"**
Agentic SDLC × Legacy-to-MCP | adesso SE GenAI Solution Unit

---

## Gesamtübersicht

| Phase | Dauer (live) | Dauer (safe) | Kamera |
|-------|-------------|--------------|--------|
| 0 — Vorbereitung | 5 Min. | 0 Min. | - |
| 1 — Prompt in Claude Desktop | 1 Min. | 1 Min. | Claude Desktop |
| 2 — Jira-Ticket | 2 Min. | 2 Min. | Jira |
| 3 — Freigabe (manuell) | 1 Min. | 1 Min. | Jira |
| 4 — Pipeline läuft | 15–20 Min. | (überbrücken) | GitHub Actions |
| 5 — Ergebnis & Anbindung | 3 Min. | 3 Min. | Claude Desktop + Terminal |
| 6 — Live-Steuerung | 3 Min. | 3 Min. | Claude Desktop |
| **Gesamt** | **~30 Min.** | **~15 Min.** | |

---

## Phase 0 — Vorbereitung (vor der Demo, nicht gefilmt)

### Checkliste (15 Minuten vor der Demo)

```bash
# 1. Claude Desktop läuft mit agentic-sdlc-orchestrator
# Prüfen: Claude Desktop öffnen, in Tools-Liste "agentic-sdlc-orchestrator" sehen

# 2. Jira-Automation aktiv prüfen
open "https://adesso-group.atlassian.net/jira/software/projects/AGSDLC/settings/automate"

# 3. Goldene Instanz Health-Check
curl -X POST "https://bookstore-mcp-golden-781137566329.europe-west3.run.app/mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
  | python3 -c "import json,sys; print('OK:', json.load(sys.stdin)['result']['serverInfo']['name'])"

# 4. GitHub Actions Pipeline-URL bereithalten
open "https://github.com/TimKoenigadesso/spring-modular-monolith-mcp/actions"

# 5. Jira-Board bereithalten
open "https://adesso-group.atlassian.net/jira/software/projects/AGSDLC/boards"

# 6. Browser-Tabs öffnen:
#    Tab 1: Claude Desktop (Fokus)
#    Tab 2: Jira AGSDLC-Board
#    Tab 3: GitHub Actions
```

### Bildschirm-Layout empfohlen

```
┌─────────────────────┬─────────────────────┐
│   Claude Desktop    │   Jira AGSDLC-Board  │
│   (linke Hälfte)    │   (rechte Hälfte)    │
└─────────────────────┴─────────────────────┘
     ↓ nach Freigabe
┌─────────────────────────────────────────────┐
│        GitHub Actions (Vollbild)            │
│        10-Agenten-DAG                       │
└─────────────────────────────────────────────┘
```

---

## Phase 1 — Prompt in Claude Desktop (1 Minute)

### Kamera: Claude Desktop, Vollbild

**Präsentator-Script:**
> "Ich habe hier einen Spring Modulith Bookstore — ein Java-Legacy-System.
> Ich sage Claude einfach auf Deutsch was ich möchte."

**Exakter Prompt (tippen oder sprechen — Claude Desktop):**

```
Ich habe einen Spring Modulith Bookstore (Java, Spring Boot 4.1).
Mach ihn MCP-ready, damit ich ihn direkt per natürlicher Sprache in
Claude Desktop steuern kann. Erstelle das Jira-Ticket.
```

**Erwartetes Ergebnis:**
- `create_mcp_enablement_ticket` wird aufgerufen
- Claude antwortet mit Ticket-Key (z.B. `AGSDLC-47`) und URL
- Ticket ist auf Status „Idee"

**Kamera-Hinweis:** Zoom auf die Tool-Calls von Claude (erkennbar als farbige Blöcke in Claude Desktop).

---

## Phase 2 — Jira-Ticket anschauen (2 Minuten)

### Kamera: Jira AGSDLC-Board

**Präsentator-Script:**
> "Sehen wir uns an was Claude angelegt hat."

1. Jira-Board öffnen → neues Ticket in Spalte „Idee" sichtbar
2. Ticket öffnen → zeigen:
   - User Story (INVEST-Format)
   - 8 Akzeptanzkriterien
   - Labels: `demo3`, `mcp-enablement`
   - Maschinenlesbare Sektion am Ende (Pipeline liest das aus)

**Kamera-Hinweis:** Langsam durch die Beschreibung scrollen — das Publikum soll die Qualität sehen.

---

## Phase 3 — Freigabe (1 Minute — einziger manueller Schritt)

### Kamera: Jira AGSDLC-Board

**Präsentator-Script:**
> "Das ist meine einzige manuelle Aktion in der ganzen Demo.
> Ich prüfe das Ticket kurz — sieht gut aus — und gebe es frei."

**Aktion:** Ticket von „Idee" in die Spalte „Req definiert" ziehen (Drag & Drop)

**Erwartetes Ergebnis (nach 5–30 Sekunden):**
- Jira-Automation feuert
- GitHub Actions Pipeline startet
- Ticket-Kommentar erscheint: „Pipeline gestartet, 9 Agenten übernehmen"
- Ticket springt auf „In Implementierung"

**Kamera-Hinweis:** Browser-Tab zu GitHub Actions wechseln.

---

## Phase 4 — Pipeline läuft (15–20 Minuten)

### Kamera: GitHub Actions — DAG-Graph

**Präsentator-Script (beim Wechsel):**
> "Hier sehen wir jetzt das Agenten-Team bei der Arbeit.
> 10 spezialisierte Agenten — jeder mit eigenem Auftrag."

**Was zu zeigen ist:**

1. **Erste Welle (1–2 Min.):** Ticket-Intake-Agent läuft, grüner Haken erscheint
2. **Zweite Welle (5 Min.):** Code-Analyse-Agent läuft
3. **Dritte Welle — DER FILMMOMENT (3 Min.):**
   - Architektur-Agent **und** Security-Agent starten **gleichzeitig**
   - Zwei grüne Spinner parallel im DAG
   - **„Das ist KI-Teamarbeit — der Architekt und der Security-Reviewer arbeiten gleichzeitig"**
4. **Vierte Welle (8 Min.):** Implementierungs-Agent — Claude schreibt Java-Code
5. **Fünfte Welle — zweiter Filmmoment (3 Min.):**
   - Unit-Test-Agent **und** Integrationstest-Agent parallel
6. Deployment → Verifikation → Release

**Während die Pipeline läuft (Überbrückung ~15 Min.):**
- Job-Summaries zeigen (auf einzelne Jobs klicken)
- Erklären was jeder Agent tut
- Auf Jira zeigen: Ticket hat jetzt mehrere Kommentare von den Agenten

**Fallback wenn Pipeline zu lang:** Auf Safe-Mode wechseln (siehe unten).

---

## Phase 5 — Ergebnis in Claude Desktop (3 Minuten)

### Kamera: Claude Desktop

**Präsentator-Script:**
> "Die Pipeline ist durch. Schauen wir was uns Claude jetzt sagt."

**Prompt:**
```
Zeig mir die Ergebnisse.
```

Claude ruft `get_results` auf. Erwartete Antwort:
- ✅ Alle 8 MCP-Tools verifiziert
- 🚀 Live-URL: `https://bookstore-mcp-AGSDLC-XX-YY-...run.app`
- 📦 PR-Link
- Anbindungsbefehl

**Dann:**
```
Binde den Bookstore in Claude Desktop ein.
```

Claude ruft `get_connection_script` auf und zeigt den Befehl.

**Im Terminal ausführen:**
```bash
node scripts/connect-to-claude.mjs "https://bookstore-mcp-..."
```

**Kamera-Hinweis:** Terminal-Ausgabe zeigen — sauber, klar, „Fertig! Claude Desktop neu starten."

**Claude Desktop neu starten.**

---

## Phase 6 — Live-Steuerung (3 Minuten)

### Kamera: Claude Desktop (neues Gespräch)

**Präsentator-Script:**
> "Und jetzt das eigentliche Payoff:
> Ich spreche direkt mit dem Monolithen — ohne Code, ohne API-Docs."

**Demo-Prompts (in dieser Reihenfolge):**

```
1. Welche Bücher haben niedrigen Lagerbestand?
```

*Claude nutzt `list_low_stock` → echte Daten vom Live-System*

```
2. Zeig mir alle offenen Bestellungen.
```

*Claude nutzt `list_orders` mit Status NEW*

```
3. Lege eine Testbestellung für The Hunger Games an.
   Kundenname: Demo Gast
   E-Mail: demo@adesso.de
   Lieferadresse: Adessoplatz 1, 44269 Dortmund
```

*Claude nutzt `create_order` → echte Bestellung wird angelegt*

```
4. Prüfe den Lagerbestand für The Hunger Games nach der Bestellung.
```

*Claude nutzt `get_stock_level` → Bestand ist um 1 reduziert*

**Kamera-Hinweis:** Langsam tippen, Claude-Antworten ausreden lassen.

**Abschluss-Statement:**
> "Vom unberührbaren Legacy-System zur AI-nativen Plattform.
> Eine Anforderung in natürlicher Sprache.
> Eine Freigabe per Klick.
> Ein Team aus 10 KI-Agenten.
> Kein manueller Code."

---

## Safe-Mode

### Wann aktivieren?

- Pipeline läuft länger als 25 Minuten
- Build-Fehler (Cloud Build scheitert)
- Demo-Umgebung nicht erreichbar

### Safe-Mode-Ablauf

1. **Pipeline überspringen** — direkt zur goldenen Instanz wechseln

2. **Im Terminal:**
```bash
node ~/spring-modular-monolith-mcp/scripts/connect-to-claude.mjs \
  "https://bookstore-mcp-golden-781137566329.europe-west3.run.app"
```

3. **Claude Desktop neu starten**

4. **Phase 6 normal durchführen** (goldene Instanz hat alle 8 Tools)

5. **Erzähle es ehrlich:**
> "In der Live-Demo lassen wir die Pipeline vorlaufen.
> Das Ergebnis — die Live-Steuerung — zeige ich euch jetzt direkt."

### Goldene Instanz vorab einfrieren

Vor der Generalprobe goldene Instanz deployen und einfrieren:

```bash
# Golden instance deployen (nach erfolgreicher Pipeline)
gcloud run services update-traffic bookstore-mcp-golden \
  --to-latest \
  --region europe-west3 \
  --project adesso-genai-solunit-demo

# Verifikation
python3 ~/spring-modular-monolith-mcp/scripts/verify-mcp.py \
  "https://bookstore-mcp-golden-781137566329.europe-west3.run.app"
```

---

## Häufige Probleme

### Jira-Automation feuert nicht

```bash
# Manuell triggern
GH_TOKEN="..." \
TICKET_ID="AGSDLC-XX" \
curl -X POST \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/TimKoenigadesso/spring-modular-monolith-mcp/actions/workflows/demo3-mcp-enablement.yml/dispatches" \
  -d "{\"ref\":\"main\",\"inputs\":{\"jira_ticket_id\":\"$TICKET_ID\"}}"
```

### Claude Desktop zeigt keinen Orchestrator

1. `~/Library/Application Support/Claude/claude_desktop_config.json` prüfen
2. `JIRA_API_TOKEN` und `GITHUB_TOKEN` korrekt gesetzt?
3. Node.js-Pfad korrekt? (`which node`)
4. Claude Desktop neu starten

### Bookstore-Tools nicht in Claude Desktop

```bash
# Proxy testen
BOOKSTORE_URL="https://bookstore-mcp-golden-..." node bookstore-mcp-proxy/index.mjs
# → Sollte keine Fehler zeigen und auf stdin warten
```

---

## Pipeline erneut ausführen (Demo-Probenfähigkeit)

Die Pipeline ist idempotent:
- Branch-Name enthält Run-Number → kein Konflikt
- Service-Name enthält Ticket-Key + Run-Number → kein Konflikt
- Altes Feature-Branch wird mit `--force-with-lease` überschrieben

```bash
# Probe-Lauf mit neuem Ticket
GH_TOKEN="..." gh workflow run demo3-mcp-enablement.yml \
  --repo TimKoenigadesso/spring-modular-monolith-mcp \
  --field jira_ticket_id=AGSDLC-TEST
```

---

*Demo 3 — AI IS THE NEW CORE | adesso SE GenAI Solution Unit*
*Erstellt von der Demo-3-Pipeline — automatisiert und für Generalprobe validiert.*
