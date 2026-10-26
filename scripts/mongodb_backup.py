#!/usr/bin/env python3
"""Safe MongoDB backup/restore helper for ZeniaOne operations.

Requires MongoDB Database Tools (`mongodump`/`mongorestore`) on PATH.
Restore is always explicit and never drops collections by default.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
from datetime import datetime, timezone


def _required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise SystemExit(f"{name} is required")
    return value


def _safe_db_name(value: str) -> str:
    if not value or any(ch not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-" for ch in value):
        raise SystemExit("MONGODB_DB_NAME contains unsafe characters")
    return value


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _tool(name: str) -> str:
    path = shutil.which(name)
    if not path:
        raise SystemExit(f"{name} is required; install MongoDB Database Tools first")
    return path


def backup(args: argparse.Namespace) -> int:
    uri = _required_env("MONGODB_URI")
    database = _safe_db_name(os.getenv("MONGODB_DB_NAME", "zenaipex"))
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    archive = output_dir / f"{database}-{stamp}.archive.gz"

    subprocess.run(
        [_tool("mongodump"), "--uri", uri, "--db", database, "--archive", str(archive), "--gzip"],
        check=True,
        timeout=args.timeout,
    )
    manifest = {
        "database": database,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "archive": archive.name,
        "sha256": _sha256(archive),
        "compressed": True,
    }
    manifest_path = archive.with_suffix(archive.suffix + ".manifest.json")
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest))
    return 0


def restore(args: argparse.Namespace) -> int:
    if not args.confirm_restore:
        raise SystemExit("Restore requires --confirm-restore")
    if os.getenv("APP_ENV", "development").lower() == "production" and not args.allow_production:
        raise SystemExit("Production restore also requires --allow-production")
    uri = _required_env("MONGODB_URI")
    database = _safe_db_name(os.getenv("MONGODB_DB_NAME", "zenaipex"))
    archive = Path(args.archive).resolve()
    if not archive.is_file():
        raise SystemExit(f"Backup archive not found: {archive}")
    if args.dry_run:
        print(json.dumps({"action": "restore", "database": database, "archive": str(archive), "dry_run": True}))
        return 0

    subprocess.run(
        [
            _tool("mongorestore"), "--uri", uri, "--nsInclude", f"{database}.*",
            "--archive", str(archive), "--gzip", "--stopOnError",
        ],
        check=True,
        timeout=args.timeout,
    )
    print(json.dumps({"action": "restore", "database": database, "archive": str(archive), "dry_run": False}))
    return 0


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description=__doc__)
    sub = root.add_subparsers(dest="command", required=True)
    dump = sub.add_parser("backup")
    dump.add_argument("--output-dir", default="backups")
    dump.add_argument("--timeout", type=int, default=1800)
    dump.set_defaults(func=backup)
    load = sub.add_parser("restore")
    load.add_argument("archive")
    load.add_argument("--confirm-restore", action="store_true")
    load.add_argument("--allow-production", action="store_true")
    load.add_argument("--dry-run", action="store_true")
    load.add_argument("--timeout", type=int, default=1800)
    load.set_defaults(func=restore)
    return root


if __name__ == "__main__":
    arguments = parser().parse_args()
    raise SystemExit(arguments.func(arguments))
