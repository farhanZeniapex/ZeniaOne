from zenaipex.core.security import create_refresh_token, decode_refresh_claims


def test_refresh_tokens_carry_a_session_version():
    claims = decode_refresh_claims(create_refresh_token("user-1", session_version=7))
    assert claims is not None
    assert claims["sub"] == "user-1"
    assert claims["sv"] == 7
