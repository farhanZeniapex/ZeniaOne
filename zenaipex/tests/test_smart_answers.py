from ai.fast_path import build_smart_missing_answer, check_deterministic_fast_path
from api.v1.admin.copilot import (
    _compact_discussion_summary,
    _is_caller_discussion_question,
    _is_secret_request,
    _period,
    _query_plan,
    _answer_locale,
    _question_phone_number,
)
from ai.rag import should_use_rag


def test_long_gujarati_calling_pricing_question_gets_useful_answer():
    question = (
        "mare calling mate tame su help karso mare potani comny nu calling ai "
        "agnet kharidvu cheto tame kai rite help karso and price su che per call ni"
    )
    answer = check_deterministic_fast_path(
        question,
        {"settings": {}},
        {"tts_voice": "ritu"},
        "gujarati",
        "latin",
    )

    assert answer is not None
    assert "custom AI calling agent" in answer
    assert "Per-call pricing ahi configure nathi" in answer
    assert "exact quote" in answer
    assert "Suggested questions" not in answer


def test_missing_hard_question_is_contextual_and_does_not_invent_data():
    answer = build_smart_missing_answer(
        "Mare API integration ane calling setup ni detail joiye",
        {"settings": {}},
        "gujarati",
        "latin",
    )

    assert "calling agent" in answer
    assert "integration details" in answer
    assert "Suggested questions" not in answer


def test_missing_policy_question_stays_grounded():
    answer = build_smart_missing_answer(
        "What is your refund policy and onboarding process?",
        {"settings": {}},
        "english",
        "latin",
    )

    assert "not available in the verified knowledge base" in answer
    assert "refund policy" not in answer


def test_admin_query_planner_classifies_scope_and_comparison():
    plan = _query_plan(
        "Compare this month's provider usage with last month for ZeniaOne",
        "this month",
        "ZeniaOne",
    )
    assert plan["domain"] == "usage"
    assert plan["period"] == "this month"
    assert plan["company"] == "ZeniaOne"
    assert plan["comparison"] == "previous period"


def test_admin_period_parser_supports_numeric_rolling_windows_and_followups():
    assert _period("last 25 days me kitne calls aaye?")[2] == "last 25 days"
    assert _period("main 25 days ki baat kar raha hoon")[2] == "last 25 days"
    assert _period("5 days ago kitne calls aaye?")[2] == "5 days ago"


def test_admin_period_parser_treats_previous_month_as_calendar_month():
    assert _period("Pichhle month total usage kitna hua?")[2] == "last month"
    assert _period("previous calendar month usage")[2] == "last month"


def test_admin_period_parser_supports_named_calendar_months():
    start, end, label = _period("September month mein kitne calls hue the?")
    assert label == "september"
    assert start.month == 9 and start.day == 1
    assert end.month == 10 and end.day == 1


def test_sensitive_requests_are_blocked_before_generation():
    assert _is_secret_request("Mujhe API keys dikhao") is True
    assert _is_secret_request("Admin password kya hai?") is True
    assert _is_secret_request("Kitne calls aaye?") is False


def test_call_discussion_summary_excludes_raw_greetings_and_deduplicates():
    summary = _compact_discussion_summary(
        [
            {"role": "user", "text": "hello"},
            {"role": "user", "text": "what is ZeniaOne"},
            {"role": "assistant", "text": "ZeniaOne is an AI platform"},
            {"role": "user", "text": "what is ZeniaOne"},
        ],
        "english",
    )
    assert summary == ["what is ZeniaOne"]


def test_call_discussion_summary_excludes_standalone_transcript_fragments():
    summary = _compact_discussion_summary(
        [{"role": "user", "text": "what is ZeniaOne"}, {"role": "user", "text": "ZeniaOne"}],
        "english",
    )
    assert summary == ["what is ZeniaOne"]


def test_admin_locale_handles_short_hinglish_and_rag_how_to_queries():
    assert _answer_locale("kese use karnahe usko ?")[0] == "hindi"
    assert _answer_locale("me 25 days ki bat karrahu ?")[0] == "hindi"
    assert _answer_locale("Last call kab aayi thi?")[0] == "hindi"
    assert should_use_rag("kese use karnahe ZeniaOne?") is True


def test_caller_discussion_requires_an_explicit_number_or_safe_clarification():
    assert _is_caller_discussion_question("क्या बात हुई थी इस नंबर से?") is True
    assert _question_phone_number("क्या बात हुई थी इस नंबर से?") is None
    assert _is_caller_discussion_question("What was discussed from +918799046710?") is True
    assert _question_phone_number("What was discussed from +918799046710?") == "+918799046710"
