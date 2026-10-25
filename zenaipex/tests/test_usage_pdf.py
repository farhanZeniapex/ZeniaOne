from zenaipex.api.v1.companies import _build_usage_pdf


def test_usage_pdf_is_a_valid_pdf_without_secrets():
    content = _build_usage_pdf(
        "ZeniaOne", "company-1", "2026-10",
        {"call_minutes_used": 2.5, "llm_api_calls": 3},
    )
    assert content.startswith(b"%PDF-")
    assert b"password" not in content.lower()
    assert b"api_key" not in content.lower()
