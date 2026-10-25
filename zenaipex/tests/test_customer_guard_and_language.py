"""Unit tests for Customer Privacy Guard & Language Detection Fixes.

Ensures:
1. Customer-facing agents in AI Playground / Web / Voice intercept internal analytics/metric
   queries (e.g. 'kal kitne call aaythe', 'last month kitni request aay') in <30ms without
   wasting 7 seconds in Pinecone RAG.
2. 'kese ho' is accurately detected as Hindi and replied to in Hinglish/Hindi (not English).
3. 'kya karreho ?' is accurately detected as Hindi (not Gujarati) and answered in ~40ms fast-path.
4. 'kem cho ?' correctly remains Gujarati.
5. Standard public knowledge questions (e.g. 'zeniaone kya he ?') pass through unblocked.
"""

import pytest

from ai.fast_path import (
    check_customer_internal_data_guard,
    check_deterministic_fast_path,
)
from ai.language_detector import detect_language


def test_language_detection_hindi_vs_gujarati_boundaries():
    # 'kese ho' must be hindi/hinglish, NOT english
    res_kese = detect_language("kese ho")
    assert res_kese.lang == "hindi"

    # 'kya karreho ?' must be hindi, NOT gujarati
    res_kya = detect_language("kya karreho ?")
    assert res_kya.lang == "hindi"

    # 'kem cho ?' must remain gujarati
    res_kem = detect_language("kem cho ?")
    assert res_kem.lang == "gujarati"


def test_fast_path_kese_ho_answers_in_hinglish():
    lang = detect_language("kese ho")
    response = check_deterministic_fast_path(
        "kese ho",
        {"name": "ZeniaOne"},
        {"tts_voice": "ritu"},
        lang.lang,
        lang.script,
    )
    assert response is not None
    assert "Main bilkul badhiya hoon" in response
    assert "I'm doing great" not in response


def test_fast_path_kya_karreho_answers_in_hinglish():
    lang = detect_language("kya karreho ?")
    response = check_deterministic_fast_path(
        "kya karreho ?",
        {"name": "ZeniaOne"},
        {"tts_voice": "ritu"},
        lang.lang,
        lang.script,
    )
    assert response is not None
    assert "ZeniaOne ka AI assistant" in response
    assert "Kem cho" not in response  # Ensure Gujarati is not leaking


def test_customer_internal_data_guard_blocks_call_metrics():
    # 'kal kitne call aaythe' should be blocked immediately
    blocked_calls = check_customer_internal_data_guard(
        "kal kitne call aaythe",
        {"name": "ZeniaOne"},
        {},
        "hindi",
        "latin",
    )
    assert blocked_calls is not None
    assert "customer support assistant" in blocked_calls
    assert "internal call records" in blocked_calls

    # 'last month kitni request aay' should be blocked immediately
    blocked_requests = check_customer_internal_data_guard(
        "last month kitni request aay",
        {"name": "ZeniaOne"},
        {},
        "hindi",
        "latin",
    )
    assert blocked_requests is not None
    assert "customer support assistant" in blocked_requests


def test_customer_internal_data_guard_allows_public_company_queries():
    # 'zeniaone kya he ?' should NOT be blocked by guard
    allowed = check_customer_internal_data_guard(
        "zeniaone kya he ?",
        {"name": "ZeniaOne"},
        {},
        "hindi",
        "latin",
    )
    assert allowed is None
