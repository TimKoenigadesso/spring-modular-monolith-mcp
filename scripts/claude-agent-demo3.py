#!/usr/bin/env python3
"""
Claude Agent für Demo 3 — MCP-Enablement Pipeline
Basiert auf claude-agent.py aus Demo 1, erweitert um Demo-3-spezifische Modi.

Modi (--mode):
  analyse        Analysiert Spring Modulith Struktur → analyse-report.json
  architektur    Leitet 8 MCP-Tools ab → tool-spec.json + architecture-adr.md
  security       Security-Review der Tools → security-matrix.json
  implementierung  Implementiert MCP-Layer (McpController, McpService, Patches)

Verwendung in GitHub Actions:
  python3 scripts/claude-agent-demo3.py --mode analyse --ticket AGSDLC-42
  python3 scripts/claude-agent-demo3.py --mode architektur --ticket AGSDLC-42
  python3 scripts/claude-agent-demo3.py --mode security --ticket AGSDLC-42
  python3 scripts/claude-agent-demo3.py --mode implementierung --ticket AGSDLC-42
"""
import os
import sys
import json
import subprocess
import argparse
import glob as globmod
from pathlib import Path

# ── Vertex AI Client ──────────────────────────────────────────────────────────

def get_client():
    from anthropic import AnthropicVertex
    return AnthropicVertex(
        project_id=os.environ["ANTHROPIC_VERTEX_PROJECT_ID"],
        region=os.environ.get("CLOUD_ML_REGION", "europe-west1"),
    )

MODEL      = os.environ.get("CLAUDE_AGENT_MODEL", "claude-sonnet-4-6")
MAX_TOKENS = int(os.environ.get("CLAUDE_AGENT_MAX_TOKENS", "8192"))

# ── Tool-Implementierungen (identisch zu claude-agent.py) ─────────────────────

def tool_read(path, offset=0, limit=500):
    try:
        lines = Path(path).read_text(errors="replace").splitlines()
        selected = lines[offset:offset+limit]
        return "\n".join(f"{i+offset+1}: {l}" for i, l in enumerate(selected))
    except Exception as e:
        return f"Error reading {path}: {e}"

def tool_write(path, content):
    try:
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content)
        return f"Written: {path} ({len(content)} bytes)"
    except Exception as e:
        return f"Error writing {path}: {e}"

def tool_edit(path, old_string, new_string):
    try:
        text = Path(path).read_text()
        if old_string not in text:
            return f"Error: old_string not found in {path}"
        Path(path).write_text(text.replace(old_string, new_string, 1))
        return f"Edited: {path}"
    except Exception as e:
        return f"Error editing {path}: {e}"

def tool_bash(command, timeout=300):
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=timeout)
        out = result.stdout[-8000:] if len(result.stdout) > 8000 else result.stdout
        err = result.stderr[-2000:] if len(result.stderr) > 2000 else result.stderr
        combined = out + (f"\nSTDERR:\n{err}" if err.strip() else "")
        if result.returncode != 0:
            combined += f"\n[exit code: {result.returncode}]"
        return combined.strip() or "(no output)"
    except subprocess.TimeoutExpired:
        return f"Error: command timed out after {timeout}s"
    except Exception as e:
        return f"Error: {e}"

def tool_glob(pattern):
    try:
        return "\n".join(sorted(globmod.glob(pattern, recursive=True))) or "(no matches)"
    except Exception as e:
        return f"Error: {e}"

def tool_grep(pattern, path=".", include=""):
    try:
        cmd = ["grep", "-rn", "--include", include if include else "*", pattern, path]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return result.stdout[:6000].strip() or "(no matches)"
    except Exception as e:
        return f"Error: {e}"

TOOLS = [
    {"name": "Read",  "description": "Read file contents with line numbers.",
     "input_schema": {"type": "object", "properties": {"path": {"type": "string"}, "offset": {"type": "integer"}, "limit": {"type": "integer"}}, "required": ["path"]}},
    {"name": "Write", "description": "Write content to a file.",
     "input_schema": {"type": "object", "properties": {"path": {"type": "string"}, "content": {"type": "string"}}, "required": ["path", "content"]}},
    {"name": "Edit",  "description": "Replace first occurrence of old_string with new_string.",
     "input_schema": {"type": "object", "properties": {"path": {"type": "string"}, "old_string": {"type": "string"}, "new_string": {"type": "string"}}, "required": ["path", "old_string", "new_string"]}},
    {"name": "Bash",  "description": "Execute a bash command.",
     "input_schema": {"type": "object", "properties": {"command": {"type": "string"}, "timeout": {"type": "integer"}}, "required": ["command"]}},
    {"name": "Glob",  "description": "Find files by glob pattern.",
     "input_schema": {"type": "object", "properties": {"pattern": {"type": "string"}}, "required": ["pattern"]}},
    {"name": "Grep",  "description": "Search file contents.",
     "input_schema": {"type": "object", "properties": {"pattern": {"type": "string"}, "path": {"type": "string"}, "include": {"type": "string"}}, "required": ["pattern"]}},
]

def execute_tool(name, inputs):
    if name == "Read":  return tool_read(inputs["path"], inputs.get("offset", 0), inputs.get("limit", 500))
    if name == "Write": return tool_write(inputs["path"], inputs["content"])
    if name == "Edit":  return tool_edit(inputs["path"], inputs["old_string"], inputs["new_string"])
    if name == "Bash":  return tool_bash(inputs["command"], inputs.get("timeout", 300))
    if name == "Glob":  return tool_glob(inputs["pattern"])
    if name == "Grep":  return tool_grep(inputs["pattern"], inputs.get("path", "."), inputs.get("include", ""))
    return f"Unknown tool: {name}"

# ── Prompts je Modus ──────────────────────────────────────────────────────────

def build_prompt(mode, ticket_id, mission_briefing=""):
    base = f"""Du bist ein spezialisierter KI-Agent in einer automatisierten CI/CD-Pipeline.
Jira-Ticket: {ticket_id}
Aktuelles Verzeichnis: {os.getcwd()}
"""

    if mode == "analyse":
        return base + """
## Auftrag: Code-Analyse-Agent 🔍

Analysiere den Spring Modulith Bookstore vollständig. Erstelle einen strukturierten Analyse-Report.

### Schritte:
1. Lies alle Java-Dateien in src/main/java/com/sivalabs/bookstore/ (Glob + Read)
2. Kartiere alle Module: Catalog, Orders, Inventory, Notifications
3. Identifiziere die öffentlichen APIs jedes Moduls (Controller, Service, DTO)
4. Analysiere das Datenmodell (Entities, Repositories)
5. Identifiziere die besten Kandidaten für MCP-Tools (öffentliche Operationen, die für KI-Assistenten nützlich sind)

### Ausgabe:
Schreibe EXAKT diese Datei: /tmp/analyse-report.json

```json
{
  "module_structure": {
    "catalog": {"classes": [], "public_apis": [], "entities": []},
    "orders": {"classes": [], "public_apis": [], "entities": []},
    "inventory": {"classes": [], "public_apis": [], "entities": []},
    "notifications": {"classes": [], "public_apis": [], "entities": []}
  },
  "tool_candidates": [
    {"name": "tool_name", "module": "catalog|orders|inventory", "operation": "beschreibung", "params": [], "return": "beschreibung"}
  ],
  "base_package": "com.sivalabs.bookstore",
  "spring_boot_version": "x.x.x",
  "existing_security_config": "Dateiname der WebSecurityConfig"
}
```

Identifiziere genau 8 Tool-Kandidaten: 2 aus Catalog, 4 aus Orders, 2 aus Inventory.
Schreibe abschließend eine kurze Zusammenfassung auf stdout.
"""

    elif mode == "architektur":
        return base + """
## Auftrag: Architektur-Agent 🏛️

Lies /tmp/analyse-report.json und leite die endgültige MCP-Tool-Architektur ab.

### Schritte:
1. Lade /tmp/analyse-report.json
2. Wähle die 8 besten MCP-Tools (2 Katalog, 4 Bestellungen, 2 Inventar)
3. Definiere pro Tool: Name, Zweck, HTTP-Methode, Parameter, Rückgabe, betroffenes Modul
4. Entwirf die McpController.java Grundstruktur (welche Endpoints, welche Parameter)
5. Entwirf die McpService.java Grundstruktur (welche Methodenaufrufe zu vorhandenen Services)
6. Dokumentiere welche WebSecurityConfig-Änderungen nötig sind (/mcp freigeben)
7. Schreibe ein Architecture Decision Record

### Ausgabe:
Schreibe /tmp/tool-spec.json:
```json
{
  "tools": [
    {
      "name": "list_products",
      "module": "catalog",
      "description": "Listet alle Bücher seitenweise auf",
      "http_method": "GET",
      "endpoint": "/mcp/catalog/products",
      "params": [{"name": "page", "type": "integer", "required": false, "default": 1}],
      "returns": {"type": "object", "description": "Seitenobjekt mit Bücherliste"},
      "service_call": "productService.getProducts(pageable)",
      "security": "PUBLIC_READ"
    }
  ],
  "mcp_base_path": "/mcp",
  "new_files": ["McpController.java", "McpService.java"],
  "modified_files": ["WebSecurityConfig.java", "pom.xml"]
}
```

Schreibe /tmp/architecture-adr.md mit:
- Kontext & Entscheidung
- Tool-Liste mit Begründung
- Sicherheitsüberlegungen
- Implementierungsplan
"""

    elif mode == "security":
        return base + """
## Auftrag: Security & Governance-Agent 🛡️

Lies /tmp/tool-spec.json und erstelle die Security-Freigabe-Matrix.

### Prüfkriterien pro Tool:
- Lese-Operation: grundsätzlich freigeben (PUBLIC_READ)
- Schreib-Operation: freigeben wenn kein destruktiver Effekt ohne Bestätigung
- Admin-Operation: ablehnen (nicht in MCP exponieren)
- Daten-Exposition: sicherstellen dass keine sensiblen Daten (Passwörter, interne IDs) zurückgegeben werden

### Ausgabe:
Schreibe /tmp/security-matrix.json:
```json
{
  "review_date": "ISO-Datum",
  "reviewer": "Security & Governance Agent",
  "verdict": "APPROVED|REJECTED",
  "tools": [
    {
      "name": "list_products",
      "verdict": "APPROVED",
      "security_level": "PUBLIC_READ",
      "rationale": "Nur Leseoperation, keine sensiblen Daten",
      "restrictions": [],
      "required_config": "permitAll() für GET /mcp/catalog/**"
    }
  ],
  "websecurity_changes": [
    "GET /mcp/** → permitAll()",
    "POST /mcp/orders/** → permitAll() (Demo: keine Auth erforderlich)",
    "POST /mcp/orders/*/status → permitAll() (Status-Änderung ist kontrolliert)"
  ],
  "rejected_tools": [],
  "overall_risk": "LOW|MEDIUM|HIGH"
}
```

Sei realistisch und genehmige alle 8 Tools für die Demo — justifiziere es mit dem Demo-Kontext.
"""

    elif mode == "implementierung":
        return base + """
## Auftrag: Implementierungs-Agent ⚙️

Implementiere den MCP-Layer in den Spring Modulith Bookstore.
Lies /tmp/tool-spec.json und /tmp/security-matrix.json.

### Schritte:

1. **McpService.java** erstellen:
   - Package: com.sivalabs.bookstore.mcp
   - @Service annotiert
   - Injiziert: ProductService (catalog), OrderService (orders), InventoryService (inventory) über ihre öffentlichen APIs
   - Pro Tool eine Methode die den korrekten Service-Aufruf macht
   - Jackson ObjectMapper für JSON-Serialisierung

2. **McpController.java** erstellen:
   - Package: com.sivalabs.bookstore.mcp
   - @RestController, @RequestMapping("/mcp")
   - Implementiert den MCP JSON-RPC 2.0 Protokoll-Handler:
     - POST /mcp: handelt initialize, tools/list, tools/call
   - Antwortformat: {"jsonrpc":"2.0","id":N,"result":{...}}
   - Tool-Dispatching zu McpService-Methoden

3. **WebSecurityConfig.java** patchen:
   - /mcp/** in die permitAll()-Liste aufnehmen
   - Nur minimale Änderung, nichts anderes anfassen

4. **pom.xml** prüfen:
   - Jackson ist durch Spring Boot automatisch dabei — keine Ergänzung nötig
   - Spring Web ist dabei — keine Ergänzung nötig

### Kritische Anforderungen:
- Keine Spring Modulith Modulgrenzen verletzen — nur öffentliche APIs der Module nutzen
- ProductService/OrderService/InventoryService über ihre @ApplicationModuleListener-kompatiblen Interfaces nutzen
- Fehler sauber als MCP Error Response zurückgeben: {"jsonrpc":"2.0","id":N,"error":{"code":-32000,"message":"..."}}
- Alle Methoden müssen echte Daten liefern (keine Stubs)

### Ausgabe:
- Erstelle: src/main/java/com/sivalabs/bookstore/mcp/McpService.java
- Erstelle: src/main/java/com/sivalabs/bookstore/mcp/McpController.java
- Patche: src/main/java/com/sivalabs/bookstore/config/WebSecurityConfig.java
- Schreibe: /tmp/implementation-summary.json mit {"files_created": [...], "files_modified": [...], "tools_implemented": [...]}

Lese zuerst die existierenden Service-Klassen um die richtigen Methoden-Signaturen zu kennen!
"""

    else:
        return base + f"\nModus '{mode}' unbekannt. Verfügbare Modi: analyse, architektur, security, implementierung"


# ── Agentic Loop ──────────────────────────────────────────────────────────────

def run_agent(prompt, max_turns=80):
    import time as _time
    client = get_client()
    messages = [{"role": "user", "content": prompt}]
    print(f"[agent] Starte Modus mit Modell {MODEL}, max_turns={max_turns}", flush=True)

    for turn in range(max_turns):
        response = None
        for attempt in range(5):
            try:
                response = client.messages.create(
                    model=MODEL, max_tokens=MAX_TOKENS, tools=TOOLS, messages=messages)
                break
            except Exception as e:
                if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                    wait = 30 * (2 ** attempt)
                    print(f"[agent] Rate limit, warte {wait}s...", flush=True)
                    _time.sleep(wait)
                else:
                    raise
        if response is None:
            print("[agent] Rate limit erschöpft.", flush=True)
            return 1

        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason == "end_turn":
            for block in response.content:
                if hasattr(block, "text"):
                    print(block.text, flush=True)
            print(f"\n[agent] Fertig nach {turn+1} Turn(s).", flush=True)
            return 0

        if response.stop_reason != "tool_use":
            print(f"[agent] Unerwarteter stop_reason: {response.stop_reason}", flush=True)
            return 1

        tool_results = []
        for block in response.content:
            if block.type != "tool_use":
                continue
            print(f"[tool] {block.name}({json.dumps(block.input)[:120]})", flush=True)
            result = execute_tool(block.name, block.input)
            print(f"       → {result[:200].replace(chr(10), ' ')}{'...' if len(result) > 200 else ''}", flush=True)
            tool_results.append({"type": "tool_result", "tool_use_id": block.id, "content": result})

        messages.append({"role": "user", "content": tool_results})

    print(f"[agent] Maximale Turns ({max_turns}) erreicht.", flush=True)
    return 1


# ── Entry Point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Demo 3 Claude Agent")
    parser.add_argument("--mode", required=True,
                        choices=["analyse", "architektur", "security", "implementierung"])
    parser.add_argument("--ticket", default="AGSDLC-0", help="Jira Ticket-Key")
    parser.add_argument("--max-turns", type=int, default=80)
    args = parser.parse_args()

    # Mission Briefing laden falls vorhanden
    briefing = ""
    if Path("/tmp/mission-briefing.json").exists():
        briefing = Path("/tmp/mission-briefing.json").read_text()

    prompt = build_prompt(args.mode, args.ticket, briefing)
    print(f"\n{'='*60}\nAgent-Modus: {args.mode} | Ticket: {args.ticket}\n{'='*60}\n", flush=True)
    sys.exit(run_agent(prompt, args.max_turns))
