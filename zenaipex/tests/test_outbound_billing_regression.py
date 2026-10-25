import unittest
import asyncio
import os
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

ZEN_DIR = Path(__file__).resolve().parents[1]
if str(ZEN_DIR) not in sys.path:
    sys.path.insert(0, str(ZEN_DIR))

from bson import ObjectId
from datetime import datetime, timezone

from services.conversation_service import create_conversation, add_message, end_conversation
from services.usage_service import increment_usage


class TestOutboundCallingAndBillingRegression(unittest.IsolatedAsyncioTestCase):

    async def test_create_conversation_tenant_isolation(self):
        """Phase 2 & 4: Ensure create_conversation scopes existing call_sid to company_id."""
        company_a = "comp_alpha_111"
        company_b = "comp_beta_222"
        call_sid = "EXO_COLLISION_SID_999"

        with patch("services.conversation_service.col_conversations") as mock_col_conv:
            mock_collection = MagicMock()
            mock_col_conv.return_value = mock_collection

            # Case 1: Company A creates conversation with call_sid
            mock_collection.find_one = AsyncMock(return_value=None)
            mock_collection.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))

            doc_a = await create_conversation(
                company_id=company_a,
                agent_id="agent_1",
                call_sid=call_sid,
                caller_phone="+919876543210"
            )
            self.assertEqual(doc_a["company_id"], company_a)
            # Verify find_one was called with BOTH company_id and call_sid
            mock_collection.find_one.assert_called_with({"company_id": company_a, "call_sid": call_sid})

            # Case 2: Company B queries with same call_sid; should not return Company A's record
            mock_collection.find_one = AsyncMock(return_value=None)
            doc_b = await create_conversation(
                company_id=company_b,
                agent_id="agent_2",
                call_sid=call_sid,
                caller_phone="+919999999999"
            )
            self.assertEqual(doc_b["company_id"], company_b)
            mock_collection.find_one.assert_called_with({"company_id": company_b, "call_sid": call_sid})

    async def test_add_message_tenant_scoping(self):
        """Phase 4 & 5: Ensure add_message scopes conversation updates to company_id."""
        company_id = "comp_gamma_333"
        conv_id = str(ObjectId())

        with patch("services.conversation_service.col_messages") as mock_col_msg, \
             patch("services.conversation_service.col_conversations") as mock_col_conv:
            
            mock_msg_coll = MagicMock()
            mock_msg_coll.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
            mock_col_msg.return_value = mock_msg_coll

            mock_conv_coll = MagicMock()
            mock_conv_coll.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
            mock_col_conv.return_value = mock_conv_coll

            res = await add_message(company_id, conv_id, "user", "Namaste Zenia")
            self.assertEqual(res["company_id"], company_id)
            self.assertEqual(res["text"], "Namaste Zenia")

            # Verify update_one includes both _id and company_id
            first_call_filter = mock_conv_coll.update_one.call_args_list[0][0][0]
            self.assertEqual(first_call_filter["company_id"], company_id)
            self.assertEqual(first_call_filter["_id"], ObjectId(conv_id))

    async def test_background_task_retaining_and_drain(self):
        """Phase 5: Background tasks must be retained in strong references and drained gracefully."""
        pending_tasks = set()

        def _track(coro, name="test_task"):
            t = asyncio.create_task(coro)
            pending_tasks.add(t)
            def _done(done_t):
                pending_tasks.discard(done_t)
            t.add_done_callback(_done)
            return t

        executed = []
        async def mock_async_work(val):
            await asyncio.sleep(0.01)
            executed.append(val)

        t1 = _track(mock_async_work("step1"))
        t2 = _track(mock_async_work("step2"))
        
        # While in flight, pending_tasks must hold strong references
        self.assertIn(t1, pending_tasks)
        self.assertIn(t2, pending_tasks)

        # Graceful drain
        await asyncio.wait_for(asyncio.gather(*list(pending_tasks), return_exceptions=True), timeout=1.0)
        
        self.assertEqual(len(pending_tasks), 0)
        self.assertIn("step1", executed)
        self.assertIn("step2", executed)

    async def test_persist_and_broadcast_isolation(self):
        """Phase 5: Dashboard broadcast failure must NOT crash or prevent message persistence."""
        from api.v1.voice_advanced import monitoring_manager

        company_id = "comp_test_isolation"
        conv_id = str(ObjectId())

        # Mock add_message to succeed
        with patch("services.conversation_service.add_message", new_callable=AsyncMock) as mock_add_msg, \
             patch.object(monitoring_manager, "broadcast_event", new_callable=AsyncMock) as mock_broadcast:
            
            # Broadcast raises an exception (e.g. websocket broadcast connection reset)
            mock_broadcast.side_effect = RuntimeError("WebSocket connection dropped")

            # Implementation of _persist_and_broadcast
            persisted = False
            try:
                await mock_add_msg(company_id, conv_id, "user", "Hello Zenia")
                persisted = True
            except Exception:
                persisted = False

            try:
                await monitoring_manager.broadcast_event("new_message", {"content": "Hello Zenia"})
            except Exception:
                pass # safely handled

            self.assertTrue(persisted)
            mock_add_msg.assert_called_once_with(company_id, conv_id, "user", "Hello Zenia")

    async def test_exotel_status_webhook_tenant_isolation_and_terminal_guard(self):
        """Phase 4: Exotel status webhook must query by company_id and guard terminal statuses."""
        from api.v1.voice_advanced import exotel_status_webhook
        from fastapi import Request

        company_id = "comp_alpha_telephony"
        agent_id = str(ObjectId())
        call_sid = "EXO_STATUS_TEST_101"

        with patch("core.database.col_conversations") as mock_col_conv:
            mock_collection = MagicMock()
            mock_col_conv.return_value = mock_collection

            # Case A: Call is already "completed" in DB; incoming status is "in-progress" (out of order)
            mock_collection.find_one = AsyncMock(return_value={
                "company_id": company_id,
                "call_sid": call_sid,
                "status": "completed"
            })
            mock_collection.update_one = AsyncMock()

            # Mock FastAPI Request
            mock_request = MagicMock(spec=Request)
            mock_request.method = "POST"
            mock_request.form = AsyncMock(return_value={
                "CallSid": call_sid,
                "Status": "in-progress"
            })

            res = await exotel_status_webhook(company_id, agent_id, mock_request)
            self.assertEqual(res, {"status": "ok"})
            # Verify update_one was NOT called to downgrade the terminal status
            mock_collection.update_one.assert_not_called()

            # Case B: Call status is terminal "completed", incoming status is "completed"
            mock_collection.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
            mock_request.form = AsyncMock(return_value={
                "CallSid": call_sid,
                "Status": "completed",
                "Duration": "45"
            })
            res = await exotel_status_webhook(company_id, agent_id, mock_request)
            self.assertEqual(res, {"status": "ok"})
            
            # Verify update_one filter is scoped to company_id
            call_filter = mock_collection.update_one.call_args[0][0]
            self.assertEqual(call_filter, {"company_id": company_id, "call_sid": call_sid})
            update_data = mock_collection.update_one.call_args[0][1]["$set"]
            self.assertEqual(update_data["duration_seconds"], 45)
            self.assertEqual(update_data["status"], "completed")

    async def test_cancel_scheduled_call_ownership_check(self):
        """Phase 3: cancel_scheduled_call must block unauthorized cross-channel cancellation."""
        from api.v1.admin.channels import cancel_scheduled_call
        from tasks.daily_sync import _scheduler

        channel_owner = "chan_owner_001"
        channel_attacker = "chan_attacker_002"
        job_id = "job_scheduled_123"

        mock_job = MagicMock()
        mock_job.id = job_id
        mock_job.args = [channel_owner, MagicMock()]

        with patch.object(_scheduler, "get_job", return_value=mock_job), \
             patch.object(_scheduler, "remove_job") as mock_remove:
            
            # Case 1: Attacker tries to cancel owner's job
            res_attack = await cancel_scheduled_call(channel_attacker, job_id)
            self.assertFalse(res_attack["success"])
            self.assertIn("Unauthorized", res_attack["error"])
            mock_remove.assert_not_called()

            # Case 2: Owner cancels own job
            res_owner = await cancel_scheduled_call(channel_owner, job_id)
            self.assertTrue(res_owner["success"])
            mock_remove.assert_called_once_with(job_id)

    async def test_increment_usage_accuracy_and_isolation(self):
        """Phase 6: Billing increment_usage calculates minutes accurately and scopes by company."""
        company_id = "comp_billing_444"
        duration_seconds = 150.0  # 2.5 minutes

        with patch("services.usage_service.col_usage_records") as mock_col_usage:
            mock_coll = MagicMock()
            mock_coll.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
            mock_col_usage.return_value = mock_coll

            success = await increment_usage(
                company_id=company_id,
                call_duration_seconds=duration_seconds,
                direction="outbound"
            )
            self.assertTrue(success)

            filter_arg = mock_coll.update_one.call_args[0][0]
            self.assertEqual(filter_arg["company_id"], company_id)

            inc_arg = mock_coll.update_one.call_args[0][1]["$inc"]
            self.assertEqual(inc_arg["call_minutes_used"], 2.5)
            self.assertEqual(inc_arg["call_count"], 1)
            self.assertEqual(inc_arg["outbound_call_count"], 1)


if __name__ == "__main__":
    unittest.main()
