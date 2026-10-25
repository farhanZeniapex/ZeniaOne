from datetime import datetime, timezone

from zenaipex.services.usage_service import _month_keys_in_range


def test_month_keys_cover_only_months_touched_by_range():
    start = datetime(2026, 9, 25, tzinfo=timezone.utc)
    end = datetime(2026, 10, 25, tzinfo=timezone.utc)

    assert _month_keys_in_range(start, end) == ["2026-09", "2026-10"]


def test_month_keys_support_year_boundary():
    start = datetime(2025, 12, 31, tzinfo=timezone.utc)
    end = datetime(2026, 1, 1, tzinfo=timezone.utc)

    assert _month_keys_in_range(start, end) == ["2025-12", "2026-01"]
