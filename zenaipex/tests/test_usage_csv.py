from zenaipex.api.v1.companies import _build_usage_csv


def test_usage_csv_contains_only_approved_metrics():
    content = _build_usage_csv(
        "ZeniaOne", "company-1", "2026-10",
        {"call_minutes_used": 12.345, "llm_api_calls": 4, "total_tokens": 900},
    )
    lines = content.strip().splitlines()
    assert lines[0] == "company_id,company_name,month,metric,value,unit"
    assert "company-1,ZeniaOne,2026-10,voice_minutes,12.35,minutes" in lines
    assert "company-1,ZeniaOne,2026-10,ai_requests,4,requests" in lines
    assert "api_key" not in content
    assert "password" not in content
