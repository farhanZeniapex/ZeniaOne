import os
import subprocess
from pathlib import Path

import pytest


def test_restore_requires_confirmation(tmp_path, monkeypatch):
    monkeypatch.setenv("MONGODB_URI", "mongodb://localhost/test")
    monkeypatch.setenv("MONGODB_DB_NAME", "zenaipex_test")
    from scripts import mongodb_backup

    args = mongodb_backup.parser().parse_args(["restore", str(tmp_path / "missing.archive.gz")])
    with pytest.raises(SystemExit, match="confirm-restore"):
        args.func(args)


def test_production_restore_requires_explicit_allowance(tmp_path, monkeypatch):
    archive = tmp_path / "backup.archive.gz"
    archive.write_bytes(b"not-a-real-archive")
    monkeypatch.setenv("MONGODB_URI", "mongodb://localhost/test")
    monkeypatch.setenv("MONGODB_DB_NAME", "zenaipex_test")
    monkeypatch.setenv("APP_ENV", "production")
    from scripts import mongodb_backup

    args = mongodb_backup.parser().parse_args(["restore", str(archive), "--confirm-restore", "--dry-run"])
    with pytest.raises(SystemExit, match="allow-production"):
        args.func(args)
