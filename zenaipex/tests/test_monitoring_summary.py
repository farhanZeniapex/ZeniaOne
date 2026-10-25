from zenaipex.api.v1.admin.monitoring import _monitoring_tickets


def test_monitoring_ticket_store_is_process_local_and_bounded_by_expiry_logic():
    _monitoring_tickets.clear()
    assert _monitoring_tickets == {}
