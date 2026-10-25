from datetime import datetime, timezone
from bson import ObjectId

from zenaipex.api.v1.companies import _export_safe


def test_data_export_redacts_credentials_and_serializes_mongo_values():
    safe = _export_safe({
        "_id": ObjectId(),
        "created_at": datetime.now(timezone.utc),
        "password_hash": "secret",
        "api_key": "secret",
        "nested": {"refresh_token": "secret", "name": "ZeniaOne"},
    })
    assert "password_hash" not in safe
    assert "api_key" not in safe
    assert "refresh_token" not in safe["nested"]
    assert safe["nested"]["name"] == "ZeniaOne"
    assert isinstance(safe["_id"], str)
    assert isinstance(safe["created_at"], str)
