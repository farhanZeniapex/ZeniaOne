import pyotp

from zenaipex.core.security import create_2fa_challenge_token, decode_2fa_challenge_token


def test_two_factor_challenge_token_is_scoped_and_short_lived():
    token = create_2fa_challenge_token("user-123")
    assert decode_2fa_challenge_token(token) == "user-123"


def test_totp_code_verification():
    secret = pyotp.random_base32()
    code = pyotp.TOTP(secret).now()
    assert pyotp.TOTP(secret).verify(code, valid_window=1)
    assert not pyotp.TOTP(secret).verify("000000", valid_window=1)
