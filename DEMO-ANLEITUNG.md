# Demo-Anleitung: Spring Modulith → MCP-Server mit Claude Desktop

Diese Anleitung zeigt, wie du die Demo **„Legacy-Monolith wird per KI agentenfähig"** bei dir lokal aufnehmen kannst.

**Was am Ende entsteht:**
Ein Video, in dem Claude Desktop einen Spring-Java-Monolithen analysiert, selbstständig einen MCP-Server einbettet, das Image in der Cloud baut und den fertigen Service zurückgibt — alles über natürlichsprachige Prompts.

---

## Voraussetzungen

Folgendes muss auf deinem Rechner installiert sein:

| Tool | Version | Prüfen mit |
|------|---------|------------|
| Node.js | ≥ 20 | `node --version` |
| gcloud CLI | aktuell | `gcloud --version` |
| Claude Desktop | aktuell | [claude.ai/download](https://claude.ai/download) |
| Git | beliebig | `git --version` |

Außerdem brauchst du:
- **GCP-Zugang** mit Rechten für Cloud Build + Cloud Run + Artifact Registry
- **Claude Desktop** mit einem aktiven Anthropic-Account

---

## Schritt 1 — Repo klonen

```bash
git clone https://github.com/TimKoenigadesso/spring-modular-monolith-mcp.git
cd spring-modular-monolith-mcp
```

---

## Schritt 2 — MCP-Server-Abhängigkeiten installieren

```bash
npm install
```

Das installiert das `@modelcontextprotocol/sdk` das der lokale Demo-Server braucht.

---

## Schritt 3 — GCP einrichten

### 3a. Projekt setzen

```bash
gcloud config set project adesso-genai-solunit-demo
gcloud config set run/region europe-west3
```

> Wenn du ein anderes GCP-Projekt nutzt, ersetze `adesso-genai-solunit-demo` überall durch deine Projekt-ID.

### 3b. APIs aktivieren (einmalig)

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com
```

### 3c. Artifact Registry Repo anlegen (einmalig, falls noch nicht vorhanden)

```bash
gcloud artifacts repositories create aeh-services \
  --repository-format=docker \
  --location=europe-west3 \
  --description="Demo-Images"
```

### 3d. Docker-Auth konfigurieren

```bash
gcloud auth configure-docker europe-west3-docker.pkg.dev
```

### 3e. Application Default Credentials setzen

```bash
gcloud auth application-default login
```

---

## Schritt 4 — Claude Desktop konfigurieren

Die Konfigurationsdatei liegt hier:

| Betriebssystem | Pfad |
|----------------|------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

Öffne die Datei und füge den folgenden Block ein. Ersetze `/ABSOLUTER/PFAD` durch den tatsächlichen Pfad zu deinem geklonten Repo:

```json
{
  "mcpServers": {
    "demo2-builder": {
      "command": "node",
      "args": ["/ABSOLUTER/PFAD/spring-modular-monolith-mcp/mcp-demo2-builder.mjs"],
      "env": {
        "REPO_PATH":   "/ABSOLUTER/PFAD/spring-modular-monolith-mcp",
        "GCP_PROJECT": "adesso-genai-solunit-demo",
        "REGION":      "europe-west3",
        "REGISTRY":    "europe-west3-docker.pkg.dev/adesso-genai-solunit-demo/aeh-services"
      }
    }
  }
}
```

**Eigenes GCP-Projekt?** Passe `GCP_PROJECT` und `REGISTRY` entsprechend an:

```json
"GCP_PROJECT": "DEIN-PROJEKT-ID",
"REGISTRY":    "europe-west3-docker.pkg.dev/DEIN-PROJEKT-ID/aeh-services"
```

Speichern, dann **Claude Desktop komplett beenden und neu starten.**

---

## Schritt 5 — MCP-Server prüfen

Nach dem Neustart von Claude Desktop:

1. Neues Gespräch öffnen
2. Auf das **Werkzeug-Symbol** (🔧) klicken
3. Du solltest `demo2-builder` mit 4 Tools sehen:
   - `analyze_repo`
   - `embed_mcp_server`
   - `build_and_deploy`
   - `verify_mcp`

Wenn die Tools nicht erscheinen → [Troubleshooting](#troubleshooting) weiter unten.

---

## Schritt 6 — Demo aufnehmen

### Bildschirmaufnahme starten

- **macOS:** `Cmd + Shift + 5` → Bildschirmbereich auswählen
- Oder: OBS Studio für mehr Kontrolle (Szenen-Wechsel bei langem Build möglich)

**Empfohlenes Setup für das Video:**
- Claude Desktop Fenster groß im Vordergrund
- Terminal daneben (zeigt Cloud Build Output wenn Build läuft)

### Prompt eingeben

Tippe diesen Prompt in Claude Desktop:

```
Analysiere den Spring-Modulith-Bookstore in diesem Repo und mach ihn MCP-ready.
```

Claude Desktop arbeitet dann automatisch in dieser Reihenfolge:

| Schritt | Tool | Dauer | Video-Tipp |
|---------|------|-------|------------|
| 1. Repo analysieren | `analyze_repo` | ~5 Sek | Normal aufnehmen |
| 2. MCP einbetten | `embed_mcp_server` | ~5 Sek | Normal aufnehmen |
| 3. Build + Deploy | `build_and_deploy` | ~15 Min | **10–15x beschleunigen** |
| 4. Verifizieren | `verify_mcp` | ~10 Sek | Normal aufnehmen |

### Für den langen Build-Schritt

Der Maven-Build dauert ~10–15 Minuten. Im Terminal siehst du den Fortschritt live.

**Option A — Zeitraffer im Videoschnitt:**
Alles aufnehmen, den Build-Teil in der Nachbearbeitung auf 10x beschleunigen. Mit iMovie, DaVinci Resolve oder CapCut: Clip markieren → Geschwindigkeit → 1000%.

**Option B — Pre-built für Schnitt:**
Build vorher einmal laufen lassen (deployt die goldene Instanz). Für das Video dann nur die anderen Schritte aufnehmen und den Build als beschleunigten Ausschnitt dazwischen schneiden.

---

## Was du im Video siehst

**Schritt 1 — Analyse:**
```
## 🔍 Spring Modulith Repo-Analyse

Module: catalog · orders · inventory · notifications · users

Abgeleitete MCP-Tools (8 aus 3 Modulen):
| Katalog      | list_products(page)       | Bücher seitenweise    |
| Katalog      | get_product(code)         | Produktdetails        |
| Bestellungen | list_orders(page, status) | Bestellliste          |
| Bestellungen | get_order(orderNumber)    | Einzelne Bestellung   |
| Bestellungen | create_order(...)         | Neue Bestellung       |
| Bestellungen | update_order_status(...)  | Status ändern         |
| Inventar     | get_stock_level(code)     | Lagerbestand          |
| Inventar     | list_low_stock(threshold) | Niedrige Bestände     |
```

**Schritt 2 — Einbetten:**
```
✅ McpController.java erstellt
✅ McpService.java erstellt (8 Tools)
✅ McpSecurityConfig.java erstellt
✅ pom.xml: jackson-databind hinzugefügt
✅ WebSecurityConfig.java: /mcp freigeschaltet
```

**Schritt 3 — Build (Terminal):**
```
$ gcloud builds submit . --tag europe-west3-docker.pkg.dev/...
...
Step 1/8 : FROM eclipse-temurin:25-jdk
...
Successfully built ...
PUSH
DONE ✓
```

**Schritt 4 — Ergebnis:**
```
🎉 MCP-Server deployt!

App-URL:      https://bookstore-mcp-XXXXX-ew.a.run.app
MCP-Endpoint: https://bookstore-mcp-XXXXX-ew.a.run.app/mcp

✅ 8 Tools registriert
✅ list_products: 15 Bücher → The Hunger Games, To Kill a Mockingbird...
✅ list_orders(NEW): 5 offene Bestellungen
✅ list_low_stock(≤10): 3 Artikel ⚠ P104: 3 Stück, P109: 5 Stück
```

---

## Bonus — Payoff-Demo nach dem Build

Nachdem der Build fertig ist, kannst du im gleichen Gespräch weiterfragen:

```
Zeige alle Bücher mit niedrigem Lagerbestand.
```

```
Welche Bestellungen sind noch offen?
```

```
Leg eine neue Bestellung für "The Hunger Games" an:
Max Mustermann, max@example.de, Hauptstraße 1, München, 2 Stück.
```

Claude Desktop nutzt jetzt den deployen MCP-Server als Tool-Quelle und gibt echte Antworten aus dem Java-Monolithen zurück. Die Tool-Calls (welches Tool, welche Parameter, welches Ergebnis) sind direkt in der Oberfläche sichtbar.

---

## Troubleshooting

### Tools erscheinen nicht in Claude Desktop

1. Claude Desktop vollständig beenden (nicht nur schließen)
2. Prüfen ob die Pfade in `claude_desktop_config.json` absolut sind (kein `~`)
3. Terminal-Test: `node /PFAD/mcp-demo2-builder.mjs` — gibt es Fehler?
4. `npm install` nochmal ausführen

### `npm install` schlägt fehl

```bash
# Node.js Version prüfen (muss ≥ 20 sein)
node --version

# Falls zu alt: aktualisieren via
brew install node  # macOS
```

### Build schlägt fehl: "Permission denied" bei Cloud Build

```bash
# Service Account Rechte prüfen
gcloud projects get-iam-policy DEIN-PROJEKT \
  --flatten="bindings[].members" \
  --format="csv(bindings.role,bindings.members)" \
  | grep "$(gcloud config get-value account)"
```

Der Account braucht: `roles/cloudbuild.builds.editor`, `roles/run.developer`, `roles/artifactregistry.writer`

### Build schlägt fehl: Compilation Error (NullAway / Spotless)

Der Java-Build überspringt bereits Format-Checks (`-Dspotless.check.skip=true`). Falls noch Fehler auftreten:

```bash
# Dockerfile zeigen (für Debugging)
cat Dockerfile | grep "mvnw package"
```

Alle `-Dspotless.*`, `-Dnullaway.*`, `-Dcheckstyle.skip` Flags sollten gesetzt sein.

### `verify_mcp` gibt 403 zurück

Der Service braucht ~30 Sekunden zum Hochfahren nach dem Deploy. Kurz warten und erneut aufrufen:

```
verify_mcp mit URL https://bookstore-mcp-XXXXX-ew.a.run.app
```

### Kosten

Ein kompletter Demo-Durchlauf kostet ca. **0,05–0,15 €** (Cloud Build ~15 Min + Cloud Run bis zum nächsten Reset). Der Service skaliert auf 0 Instanzen wenn er nicht genutzt wird.

---

## Ressourcen

| Was | Link |
|-----|------|
| Repo (Bookstore + MCP) | [github.com/TimKoenigadesso/spring-modular-monolith-mcp](https://github.com/TimKoenigadesso/spring-modular-monolith-mcp) |
| AEH Demo-Seite | [agentic-enterprise-hub-781137566329.europe-west3.run.app/demo/legacy-to-mcp](https://agentic-enterprise-hub-781137566329.europe-west3.run.app/demo/legacy-to-mcp) |
| Goldene Instanz (immer live) | [bookstore-mcp-golden-781137566329.europe-west3.run.app](https://bookstore-mcp-golden-781137566329.europe-west3.run.app) |
| MCP-Endpoint (golden) | [bookstore-mcp-golden-781137566329.europe-west3.run.app/mcp](https://bookstore-mcp-golden-781137566329.europe-west3.run.app/mcp) |
| Spring Modulith Docs | [docs.spring.io/spring-modulith](https://docs.spring.io/spring-modulith/reference/) |
| MCP Protokoll Spec | [modelcontextprotocol.io](https://modelcontextprotocol.io/docs) |

---

*Erstellt von adesso SE — GenAI Solution Unit*
