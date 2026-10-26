from types import SimpleNamespace

from api.v1.admin.monitoring import configuration_gaps


def test_configuration_gaps_are_explicit_and_secret_free(monkeypatch):
    import api.v1.admin.monitoring as monitoring

    original = monitoring.settings
    monitoring.settings = SimpleNamespace(
        atlas_backup_verified=False,
        staging_base_url="",
        uptime_monitor_url="",
        sentry_dsn="",
        redis_url="",
        exotel_api_key="configured",
        exotel_webhook_secret="",
    )
    try:
        gaps = configuration_gaps()
    finally:
        monitoring.settings = original

    codes = {gap["code"] for gap in gaps}
    assert "atlas_backup_not_verified" in codes
    assert "exotel_webhook_secret_missing" in codes
    assert all("exotel_api_key" not in str(gap) for gap in gaps)
