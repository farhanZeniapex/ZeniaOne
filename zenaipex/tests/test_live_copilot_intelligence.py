import asyncio
from core.database import connect_db
from api.v1.admin.copilot import (
    _normalize_analytics_query,
    _answer,
    _question_intent,
)


def _run(coro):
    async def _runner():
        await connect_db()
        return await coro
    return asyncio.run(_runner())


def test_typo_normalizer():
    raw = "aj kitni copmny bani kal kitni bane sbse jyada kiski kab kyu kaha se clall atihe kya bate htihe kitni der hotihe abhi live chalihe horihe"
    norm = _normalize_analytics_query(raw)
    assert "company" in norm
    assert "call" in norm
    assert "sabse" in norm
    assert "zyada" in norm
    assert "aati hai" in norm
    assert "hoti hai" in norm
    assert "baat" in norm
    assert "chal rahi hai" in norm
    assert "ho rahi hai" in norm


def test_today_vs_yesterday_calls():
    answer, sources = _run(_answer("aj kitni call aay kal kitni aaj"))
    assert "Call Volume Comparison: Aaj vs Kal" in answer
    assert any(s.get("metric") == "today_vs_yesterday" for s in sources)


def test_company_creation_super_admin():
    answer, sources = _run(_answer("aj kitni copmny bani kal kitni bane", is_super_admin=True))
    assert "Platform Company & Tenant Registration Analytics" in answer
    assert any(s.get("metric") == "creation_stats" for s in sources)


def test_company_creation_tenant_isolation_refusal():
    answer, sources = _run(_answer(
        "aj kitni copmny bani kal kitni bane",
        is_super_admin=False,
        user_company_id="6adba4500000000000000001",
    ))
    assert "permission sirf Super Admin ke paas hai" in answer
    assert any(s.get("type") == "security_refusal" for s in sources)


def test_top_callers_comprehensive_intelligence():
    answer, sources = _run(_answer(
        "sbse jyada kiski kab kyu kaha se clall atihe kya bate htihe kitni der hotihe"
    ))
    assert ("Top Caller" in answer or "Platform par abhi koi recorded" in answer)
    assert any(s.get("metric") == "top_callers" for s in sources)


def test_live_radar_active_calls():
    answer, sources = _run(_answer("abhi live kiski call chalihe kya bate horihe"))
    assert "Live Call Radar" in answer
    assert any(s.get("type") == "active_calls" for s in sources)


def test_company_distribution_super_admin():
    answer, sources = _run(_answer("kis company me kitni call aayi", is_super_admin=True))
    assert "Company-Wise Call Volume Breakdown" in answer
    assert any(s.get("metric") == "company_distribution" for s in sources)


def test_company_distribution_tenant_isolation():
    answer, sources = _run(_answer(
        "kis company me kitni call aayi",
        is_super_admin=False,
        user_company_id="6adba4500000000000000001",
    ))
    assert "permission sirf Platform Super Admin ke paas hai" in answer
    assert any(s.get("type") == "security_refusal" for s in sources)


def test_call_topics_answer():
    answer, sources = _run(_answer("call me kya bate hoti he"))
    assert "Common Call Topics & Customer Inquiries" in answer
    assert any(s.get("metric") == "call_topics" for s in sources)
