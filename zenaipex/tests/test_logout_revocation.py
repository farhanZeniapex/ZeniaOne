from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.mark.asyncio
async def test_logout_increments_session_version():
    from services.auth_service import revoke_all_sessions

    collection = MagicMock()
    collection.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
    with patch("services.auth_service.col_users", return_value=collection):
        assert await revoke_all_sessions("507f1f77bcf86cd799439011") is True

    collection.update_one.assert_awaited_once()
    query, update = collection.update_one.await_args.args
    assert query["_id"]
    assert update["$inc"] == {"session_version": 1}
