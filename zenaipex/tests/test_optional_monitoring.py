from zenaipex.core.config import Settings


def test_sentry_configuration_is_optional_and_bounded():
    settings = Settings(app_env="test", sentry_traces_sample_rate=0.25)
    assert settings.sentry_dsn == ""
    assert settings.sentry_traces_sample_rate == 0.25
