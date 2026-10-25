from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.mark.asyncio
async def test_enqueue_scheduled_call_persists_tenant_and_payload():
    from services.job_queue import enqueue_scheduled_call

    collection = MagicMock()
    collection.insert_one = AsyncMock(return_value=SimpleNamespace(inserted_id="scheduled-1"))
    with patch("services.job_queue.col_scheduled_calls", return_value=collection):
        job_id = await enqueue_scheduled_call(
            channel_id="channel-1",
            company_id="company-1",
            scheduled_at=datetime.now(timezone.utc),
            payload={"channel_id": "channel-1", "request": {"topic": "demo"}},
        )

    assert job_id == "scheduled-1"
    document = collection.insert_one.await_args.args[0]
    assert document["company_id"] == "company-1"
    assert document["channel_id"] == "channel-1"
    assert document["status"] == "pending"
    assert document["payload"]["request"]["topic"] == "demo"


@pytest.mark.asyncio
async def test_scheduled_call_executor_rehydrates_request_and_invokes_call():
    from services.job_queue import _run_scheduled_call

    trigger = AsyncMock()
    job = {
        "payload": {
            "channel_id": "channel-1",
            "request": {
                "contact_name": "Customer",
                "phone_number": "+919999999999",
                "topic": "Follow up",
                "system_prompt": None,
            },
        }
    }
    with patch("api.v1.admin.channels.trigger_test_call", trigger):
        await _run_scheduled_call(job)

    trigger.assert_awaited_once()
    assert trigger.await_args.args[0] == "channel-1"
    assert trigger.await_args.args[1].phone_number == "+919999999999"

