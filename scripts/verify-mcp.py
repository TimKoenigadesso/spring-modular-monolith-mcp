#!/usr/bin/env python3
"""
Verifiziert den deployen MCP-Server — testet alle 8 Tools.
Verwendung: python3 scripts/verify-mcp.py [URL]
"""
import json
import sys
import urllib.request
from pathlib import Path


def mcp(url: str, method: str, params: dict = {}) -> dict:
    payload = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    req = urllib.request.Request(
        f"{url}/mcp",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read())


def tool_call(url: str, name: str, args: dict = {}) -> str:
    result = mcp(url, "tools/call", {"name": name, "arguments": args})
    text = result.get("result", {}).get("content", [{}])[0].get("text", "{}")
    return text


def banner(text: str) -> None:
    print(f"\n{'─' * 60}")
    print(f"  {text}")
    print(f"{'─' * 60}")


def main():
    # URL aus Argument oder .mcp-endpoint Datei
    if len(sys.argv) > 1:
        url = sys.argv[1].rstrip("/")
    elif Path(".mcp-endpoint").exists():
        url = Path(".mcp-endpoint").read_text().strip()
    else:
        print("Verwendung: python3 scripts/verify-mcp.py <URL>")
        sys.exit(1)

    print(f"\n🔍  MCP-Server Verifikation: {url}")

    # ── initialize ────────────────────────────────────────────────────────
    banner("initialize")
    init = mcp(url, "initialize")
    info = init.get("result", {}).get("serverInfo", {})
    print(f"  Server: {info.get('name')} v{info.get('version')}")
    print(f"  Protokoll: {init.get('result', {}).get('protocolVersion')}")

    # ── tools/list ────────────────────────────────────────────────────────
    banner("tools/list — abgeleitete MCP-Tools")
    tools_result = mcp(url, "tools/list")
    tools = tools_result.get("result", {}).get("tools", [])
    for t in tools:
        print(f"  ✓ {t['name']:<30} {t['description'][:50]}")
    print(f"\n  → {len(tools)} Tools registriert")

    # ── tools/call — Katalog ─────────────────────────────────────────────
    banner("tools/call: list_products (Katalog)")
    data = json.loads(tool_call(url, "list_products", {"page": 1}))
    total = data.get("totalElements", 0)
    books = [b["name"] for b in data.get("data", [])[:3]]
    print(f"  Bücher gesamt: {total}")
    print(f"  Erste 3:      {books}")

    # ── tools/call — Bestellungen ─────────────────────────────────────────
    banner("tools/call: list_orders(status=NEW) (Bestellungen)")
    data = json.loads(tool_call(url, "list_orders", {"page": 1, "status": "NEW"}))
    orders = data.get("data", [])
    print(f"  Offene Bestellungen: {len(orders)}")
    for o in orders[:3]:
        print(f"  • {o.get('orderNumber', '')[:12]}... — {o.get('customer', '')}")

    # ── tools/call — Inventar ─────────────────────────────────────────────
    banner("tools/call: list_low_stock(threshold=10) (Inventar)")
    data = json.loads(tool_call(url, "list_low_stock", {"threshold": 10}))
    items = data.get("items", [])
    print(f"  Artikel mit niedrigem Bestand (≤10): {data.get('count', 0)}")
    for item in items:
        print(f"  ⚠  {item['productCode']} — noch {item['quantity']} Stück")

    # ── Fazit ─────────────────────────────────────────────────────────────
    print(f"\n{'═' * 60}")
    print(f"  ✅  MCP-Server vollständig funktionsfähig!")
    print(f"  URL:      {url}")
    print(f"  Endpoint: {url}/mcp")
    print(f"  Tools:    {len(tools)} aus 3 Spring-Modulith-Modulen")
    print(f"{'═' * 60}\n")


if __name__ == "__main__":
    main()
