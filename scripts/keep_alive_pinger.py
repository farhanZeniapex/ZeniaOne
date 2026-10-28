#!/usr/bin/env python3
"""
ZeniaOne Smart Keep-Alive Pinger
=================================
Keeps Render hosted services (backend & frontend) awake and responsive by pinging
them every 8 minutes (before Render's 15-minute inactivity spin-down occurs).

Usage:
    python scripts/keep_alive_pinger.py           # Runs continuously in background
    python scripts/keep_alive_pinger.py --once    # Ping once and exit (test)
    python scripts/keep_alive_pinger.py --interval 5  # Ping every 5 minutes
"""

import argparse
import datetime
import json
import ssl
import sys
import time
import urllib.error
import urllib.request

BACKEND_HEALTH_URL = "https://zeniaone-backend.onrender.com/health"
BACKEND_READY_URL = "https://zeniaone-backend.onrender.com/ready"
FRONTEND_URL = "https://zeniaone-web.onrender.com/"

# Reconfigure standard output to utf-8 if possible on Windows
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Tolerant SSL context
SSL_CTX = ssl.create_default_context()


def log(msg: str):
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    # Clean fallback for Windows CP1252 terminal
    safe_msg = msg.encode("ascii", errors="replace").decode("ascii") if sys.platform == "win32" and not (sys.stdout and sys.stdout.encoding == "utf-8") else msg
    print(f"[{timestamp}] {safe_msg}", flush=True)


def ping_endpoint(url: str, name: str, timeout: int = 90) -> bool:
    """Send an HTTP GET request to keep the service warm."""
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "ZeniaOne-KeepAlive/1.0 (+https://zeniaone-web.onrender.com)",
            "Accept": "application/json, text/html, */*",
        },
    )
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=SSL_CTX) as response:
            elapsed = time.perf_counter() - start
            status = response.getcode()
            body = response.read(256).decode("utf-8", errors="ignore").strip()
            log(f"[OK] {name}: HTTP {status} in {elapsed:.2f}s | {body[:60]}")
            return True
    except urllib.error.HTTPError as e:
        elapsed = time.perf_counter() - start
        log(f"[WARN] {name}: HTTP {e.code} in {elapsed:.2f}s | {e.reason}")
        return False
    except urllib.error.URLError as e:
        elapsed = time.perf_counter() - start
        log(f"[FAIL] {name}: Connection failed in {elapsed:.2f}s | {e.reason}")
        return False
    except Exception as e:
        elapsed = time.perf_counter() - start
        log(f"[FAIL] {name}: Error in {elapsed:.2f}s | {e}")
        return False


def run_ping_cycle():
    """Ping both backend and frontend."""
    log("--- Starting Warm-Up Cycle ---")
    b_ok = ping_endpoint(BACKEND_HEALTH_URL, "Backend Health", timeout=90)
    ping_endpoint(BACKEND_READY_URL, "Backend Ready", timeout=60)
    f_ok = ping_endpoint(FRONTEND_URL, "Frontend Web", timeout=60)
    if b_ok and f_ok:
        log("[SUCCESS] Both services are awake and warm.")
    else:
        log("[INFO] Ping completed (services are warming up).")


def main():
    parser = argparse.ArgumentParser(description="ZeniaOne Keep-Alive Pinger")
    parser.add_argument("--once", action="store_true", help="Ping once and exit")
    parser.add_argument(
        "--interval",
        type=int,
        default=8,
        help="Interval in minutes between pings (default: 8 minutes)",
    )
    args = parser.parse_args()

    log("=" * 60)
    log(">> ZeniaOne Keep-Alive Monitor Active")
    log(f"   Backend:  {BACKEND_HEALTH_URL}")
    log(f"   Frontend: {FRONTEND_URL}")
    log(f"   Interval: Every {args.interval} minutes")
    log("=" * 60)

    if args.once:
        run_ping_cycle()
        return

    while True:
        try:
            run_ping_cycle()
            sleep_seconds = args.interval * 60
            log(f">> Sleeping for {args.interval} minutes until next ping...")
            time.sleep(sleep_seconds)
        except KeyboardInterrupt:
            log("[STOP] Keep-Alive Pinger stopped by user.")
            sys.exit(0)
        except Exception as e:
            log(f"[WARN] Unexpected error in ping loop: {e}")
            time.sleep(30)



if __name__ == "__main__":
    main()
