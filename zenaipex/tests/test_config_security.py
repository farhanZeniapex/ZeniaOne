import pytest

from core.config import Settings


def _settings(**overrides):
    values = {
        "_env_file": None,
        "app_env": "test",
        "app_secret_key": "x" * 64,
        "mongodb_uri": "mongodb://localhost:27017/zenaipex_test",
        "platform_webhook_base_url": "https://example.test",
    }
    values.update(overrides)
    return Settings(**values)


def test_development_does_not_require_production_secrets():
    settings = _settings(
        app_env="development",
        app_secret_key="",
        mongodb_uri="",
        platform_webhook_base_url="",
    )
    assert settings.is_development


@pytest.mark.parametrize("app_env", ["staging", "production"])
def test_deployed_environments_require_explicit_secret(app_env):
    with pytest.raises(ValueError, match="APP_SECRET_KEY"):
        _settings(app_env=app_env, app_secret_key="")


def test_production_requires_https_webhook_base_url():
    with pytest.raises(ValueError, match="HTTPS"):
        _settings(app_env="production", platform_webhook_base_url="http://example.test")


def test_valid_production_settings_are_accepted():
    settings = _settings(app_env="production")
    assert settings.is_production
