from zenaipex.api.v1.companies import _calculate_provider_cost_inr


def test_provider_cost_uses_configured_input_output_rates_and_exchange_rate():
    cost = _calculate_provider_cost_inr(
        [{"provider": "gemini", "model": "flash", "input_tokens": 1_000_000, "output_tokens": 500_000}],
        {"usd_to_inr_rate": 80, "gemini": {"flash": {"input_1m": 2, "output_1m": 4}}},
    )
    assert cost == 320.0


def test_provider_cost_is_unknown_when_no_matching_price_exists():
    assert _calculate_provider_cost_inr(
        [{"provider": "unknown", "model": "x", "input_tokens": 100}],
        {"gemini": {"default": {"input_1m": 1}}},
    ) is None
