import re


def test_billing_month_format_accepts_calendar_months_only():
    pattern = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")
    assert pattern.fullmatch("2026-10")
    assert not pattern.fullmatch("2026-13")
    assert not pattern.fullmatch("October-2026")
