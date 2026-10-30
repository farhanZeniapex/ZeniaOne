"""Run the ZeniaOne backend and ngrok tunnel with automatic recovery."""

from __future__ import annotations

import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
import urllib.request


ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "zenaipex"
ENV_FILE = BACKEND / ".env"
BACKEND_PORT = int(os.getenv("ZENIA_BACKEND_PORT", "8003"))
NGROK_DOMAIN = os.getenv("ZENIA_NGROK_DOMAIN", "nonperverse-bess-unplayfully.ngrok-free.dev")


def tunnel_url() -> str | None:
    try:
        with urllib.request.urlopen("http://127.0.0.1:4040/api/tunnels", timeout=2) as response:
            tunnels = json.loads(response.read().decode("utf-8")).get("tunnels", [])
            tunnel = next((item for item in tunnels if item.get("public_url", "").startswith("https://")), None)
            return tunnel.get("public_url") if tunnel else None
    except Exception:
        return None


def update_webhook_url(public_url: str) -> None:
    content = ENV_FILE.read_text(encoding="utf-8") if ENV_FILE.exists() else ""
    line = f"PLATFORM_WEBHOOK_BASE_URL={public_url}"
    if re.search(r"(?m)^PLATFORM_WEBHOOK_BASE_URL=.*$", content):
        content = re.sub(r"(?m)^PLATFORM_WEBHOOK_BASE_URL=.*$", line, content)
    else:
        content = f"{content.rstrip()}\n{line}\n"
    ENV_FILE.write_text(content, encoding="utf-8")


def start_ngrok() -> subprocess.Popen | None:
    existing = tunnel_url()
    if existing:
        print(f"[tunnel] Reusing {existing}", flush=True)
        update_webhook_url(existing)
        return None

    ngrok_bin = (
        shutil.which("ngrok.cmd")
        or shutil.which("ngrok.exe")
        or shutil.which("ngrok")
    )
    if ngrok_bin:
        cmd = [ngrok_bin, "http", f"--url={NGROK_DOMAIN}", str(BACKEND_PORT)]
    else:
        npx = shutil.which("npx.cmd") or shutil.which("npx")
        if not npx:
            print("[tunnel] ngrok and npx unavailable; backend will still start locally", flush=True)
            return None
        cmd = [npx, "ngrok", "http", f"--url={NGROK_DOMAIN}", str(BACKEND_PORT)]

    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    process = subprocess.Popen(
        cmd,
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=flags,
        shell=(os.name == "nt"),
    )
    for _ in range(20):
        if process.poll() is not None:
            print(f"[tunnel] ngrok exited with code {process.returncode}", flush=True)
            return process
        public_url = tunnel_url()
        if public_url:
            update_webhook_url(public_url)
            print(f"[tunnel] Ready: {public_url}", flush=True)
            return process
        time.sleep(0.5)
    print("[tunnel] ngrok started but its URL was not available yet", flush=True)
    return process


def run_backend() -> int:
    command = [sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", str(BACKEND_PORT)]
    if os.getenv("ZENIA_DEV_RELOAD", "true").lower() in {"1", "true", "yes"}:
        command.append("--reload")
    print(f"[backend] Starting on port {BACKEND_PORT}", flush=True)
    return subprocess.run(command, cwd=BACKEND).returncode


def main() -> int:
    ngrok_process = start_ngrok()
    try:
        while True:
            code = run_backend()
            if code == 0:
                return 0
            print(f"[backend] Exited with code {code}; restarting in 2 seconds", flush=True)
            time.sleep(2)
            # Always check and restart ngrok if it died
            if ngrok_process is None or ngrok_process.poll() is not None:
                print("[supervisor] Restarting ngrok...", flush=True)
                ngrok_process = start_ngrok()
    except KeyboardInterrupt:
        print("\n[supervisor] Stopping", flush=True)
        return 0
    finally:
        if ngrok_process is not None and ngrok_process.poll() is None:
            ngrok_process.terminate()


if __name__ == "__main__":
    raise SystemExit(main())
