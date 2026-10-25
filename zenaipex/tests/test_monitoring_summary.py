from zenaipex.api.v1.admin.monitoring import _monitoring_tickets, _build_monitoring_alerts


def test_monitoring_ticket_store_is_process_local_and_bounded_by_expiry_logic():
    _monitoring_tickets.clear()
    assert _monitoring_tickets == {}


def test_monitoring_alerts_surface_failed_jobs_and_open_provider_circuits():
    alerts = _build_monitoring_alerts(
        {"pending": 0, "running": 0, "failed": 2},
        12,
        {"gemini": {"state": "OPEN"}},
    )
    codes = {alert["code"] for alert in alerts}
    assert codes == {"background_jobs_failed", "ai_failures_elevated", "provider_circuit_open"}


def test_monitoring_alerts_surface_failed_scheduled_calls():
    alerts = _build_monitoring_alerts(
        {"pending": 0, "running": 0, "failed": 0},
        0,
        {},
        {"pending": 1, "running": 0, "failed": 3},
    )
    assert alerts == [{"code": "scheduled_calls_failed", "severity": "warning", "count": 3}]
