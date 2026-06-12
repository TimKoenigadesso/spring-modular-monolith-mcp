#!/usr/bin/env python3
"""
Build + Deploy Script für Spring Modulith Bookstore → MCP-Server
Verwendung: python3 scripts/build-deploy.py [--service-name NAME]
"""
import subprocess
import sys
import time
import argparse
from datetime import datetime

REGISTRY  = "europe-west3-docker.pkg.dev/adesso-genai-solunit-demo/aeh-services"
PROJECT   = "adesso-genai-solunit-demo"
REGION    = "europe-west3"

def run(cmd: list, check: bool = True) -> subprocess.CompletedProcess:
    print(f"\n$ {' '.join(cmd)}")
    return subprocess.run(cmd, check=check)

def run_stream(cmd: list) -> int:
    """Führt Befehl mit Streaming-Output aus (für Video sichtbar)."""
    print(f"\n$ {' '.join(cmd)}\n")
    proc = subprocess.Popen(cmd, stdout=None, stderr=None)
    proc.wait()
    return proc.returncode

def banner(text: str) -> None:
    width = min(len(text) + 4, 70)
    print(f"\n{'═' * width}")
    print(f"  {text}")
    print(f"{'═' * width}\n")

def main():
    parser = argparse.ArgumentParser(description="Deploy Bookstore+MCP to Cloud Run")
    parser.add_argument("--service-name", default=f"bookstore-mcp-{int(time.time()) % 100000}")
    args = parser.parse_args()

    service_name = args.service_name
    image = f"{REGISTRY}/{service_name}:latest"

    banner("🔍  SPRING MODULITH → MCP-SERVER  |  BUILD & DEPLOY")
    print(f"  Service:  {service_name}")
    print(f"  Image:    {image}")
    print(f"  Region:   {REGION}")
    print(f"  Zeit:     {datetime.now().strftime('%H:%M:%S')}")

    # ── Schritt 1: Docker Auth ────────────────────────────────────────────
    banner("🔐  Schritt 1/3: Artifact Registry Auth")
    run(["gcloud", "auth", "configure-docker", f"{REGION}-docker.pkg.dev", "--quiet"])

    # ── Schritt 2: Cloud Build (Streaming) ───────────────────────────────
    banner("🔨  Schritt 2/3: Docker-Image bauen (Cloud Build)")
    print("  Maven kompiliert, Jib baut das Image direkt in die Registry.")
    print("  Das dauert ~10-15 Minuten. Du siehst jeden Schritt.\n")

    start = time.time()
    rc = run_stream([
        "gcloud", "builds", "submit", ".",
        "--tag", image,
        "--project", PROJECT,
        "--region", REGION,
    ])
    elapsed = int(time.time() - start)

    if rc != 0:
        print(f"\n❌  Build fehlgeschlagen (Exit {rc}) nach {elapsed}s")
        sys.exit(1)

    print(f"\n✅  Build erfolgreich ({elapsed}s)")

    # ── Schritt 3: Cloud Run Multi-Container Deploy ───────────────────────
    banner("🚀  Schritt 3/3: Cloud Run Deploy (App + Postgres-Sidecar)")
    print("  Deployt als Multi-Container Service:")
    print("  • app:      Spring Boot App auf Port 8080")
    print("  • postgres: Postgres 16 Sidecar (localhost:5432)\n")

    rc = run_stream([
        "gcloud", "beta", "run", "deploy", service_name,
        "--region", REGION,
        "--project", PROJECT,
        "--allow-unauthenticated",
        "--min-instances", "0",
        "--max-instances", "2",
        "--container", "app",
          "--image", image,
          "--set-env-vars",
          "SPRING_PROFILES_ACTIVE=cloud-run,"
          "SPRING_DATASOURCE_URL=jdbc:postgresql://127.0.0.1:5432/bookstore,"
          "SPRING_DATASOURCE_USERNAME=bookstore,"
          "SPRING_DATASOURCE_PASSWORD=bookstore,"
          "OTEL_SDK_DISABLED=true",
          "--port", "8080",
          "--memory", "2Gi",
          "--cpu", "2",
        "--container", "postgres",
          "--image", "postgres:16-alpine",
          "--set-env-vars", "POSTGRES_DB=bookstore,POSTGRES_USER=bookstore,POSTGRES_PASSWORD=bookstore",
          "--memory", "512Mi",
          "--cpu", "1",
    ])

    if rc != 0:
        print(f"\n❌  Deploy fehlgeschlagen (Exit {rc})")
        sys.exit(1)

    # URL abrufen
    result = subprocess.run([
        "gcloud", "run", "services", "describe", service_name,
        "--region", REGION, "--project", PROJECT,
        "--format", "value(status.url)",
    ], capture_output=True, text=True)
    url = result.stdout.strip()

    # ── Ergebnis ──────────────────────────────────────────────────────────
    banner("🎉  FERTIG — MCP-Server läuft!")
    print(f"  App-URL:      {url}")
    print(f"  MCP-Endpoint: {url}/mcp")
    print()
    print("  Schnelltest:")
    print(f"  curl -X POST {url}/mcp \\")
    print(f"    -H 'Content-Type: application/json' \\")
    print(f"    -d '{{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\",\"params\":{{}}}}' \\")
    print(f"    | python3 -m json.tool")
    print()
    print("  Oder: python3 scripts/verify-mcp.py")
    print(f"\n  ✨ Service-Name für nächste Schritte: {service_name}")

    # URL in Datei speichern (für verify-mcp.py)
    with open(".mcp-endpoint", "w") as f:
        f.write(url)

if __name__ == "__main__":
    main()
