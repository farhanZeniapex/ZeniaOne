"""Durable Mongo-backed background jobs for work that must survive restarts."""
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from pymongo import ReturnDocument

from core.database import col_background_jobs, col_scheduled_calls

logger = logging.getLogger(__name__)
_worker_task: Optional[asyncio.Task] = None
_scheduled_call_worker_task: Optional[asyncio.Task] = None
_stop_event: Optional[asyncio.Event] = None
_last_job_recovery: float = 0.0
_last_call_recovery: float = 0.0


async def enqueue_scheduled_call(
    *, channel_id: str, company_id: str, scheduled_at: datetime, payload: dict[str, Any]
) -> str:
    """Persist an outbound call before returning to the caller.

    Scheduled calls are deliberately stored in MongoDB instead of only in an
    APScheduler process.  This makes them survive Render restarts and lets a
    replacement worker safely claim them with a lease.
    """
    now = datetime.now(timezone.utc)
    result = await col_scheduled_calls().insert_one({
        "channel_id": channel_id,
        "company_id": company_id,
        "scheduled_at": scheduled_at,
        "status": "pending",
        "attempts": 0,
        "payload": payload,
        "created_at": now,
        "updated_at": now,
    })
    return str(result.inserted_id)


async def enqueue_document_processing(
    *, company_id: str, kb_id: str, doc_id: str, storage_path: str,
    filename: str, content_type: str, target_version: int,
) -> str:
    now = datetime.now(timezone.utc)
    result = await col_background_jobs().insert_one({
        "job_type": "document_process",
        "company_id": company_id,
        "status": "pending",
        "attempts": 0,
        "payload": {
            "company_id": company_id, "kb_id": kb_id, "doc_id": doc_id,
            "storage_path": storage_path, "filename": filename,
            "content_type": content_type, "target_version": target_version,
        },
        "created_at": now,
        "updated_at": now,
    })
    return str(result.inserted_id)


async def _claim_job() -> Optional[dict]:
    global _last_job_recovery
    import time
    now = datetime.now(timezone.utc)
    now_mono = time.monotonic()
    # Recover jobs whose worker died after claiming them (throttled to once per minute to avoid Atlas load)
    if now_mono - _last_job_recovery > 60:
        _last_job_recovery = now_mono
        await col_background_jobs().update_many(
            {"status": "running", "lease_until": {"$lt": now}},
            {"$set": {"status": "pending", "updated_at": now}, "$unset": {"lease_until": ""}},
        )
    return await col_background_jobs().find_one_and_update(
        {"status": "pending"},
        {"$set": {
            "status": "running", "updated_at": now,
            "lease_until": now + timedelta(hours=1),
        }, "$inc": {"attempts": 1}},
        sort=[("created_at", 1)],
        return_document=ReturnDocument.AFTER,
    )


async def _run_job(job: dict) -> None:
    if job.get("job_type") != "document_process":
        raise ValueError(f"Unsupported background job type: {job.get('job_type')}")
    from services.knowledge_service import _process_document_task
    await _process_document_task(**job["payload"])


async def _worker_loop() -> None:
    logger.info("Durable background job worker started")
    while _stop_event and not _stop_event.is_set():
        job = await _claim_job()
        if not job:
            try:
                await asyncio.wait_for(_stop_event.wait(), timeout=2)
            except asyncio.TimeoutError:
                continue
            break
        try:
            await _run_job(job)
            await col_background_jobs().update_one(
                {"_id": job["_id"]},
                {"$set": {"status": "completed", "updated_at": datetime.now(timezone.utc)}, "$unset": {"lease_until": ""}},
            )
        except Exception as exc:
            attempts = int(job.get("attempts", 1))
            terminal = attempts >= 3
            await col_background_jobs().update_one(
                {"_id": job["_id"]},
                {"$set": {
                    "status": "failed" if terminal else "pending",
                    "last_error": str(exc)[:2000],
                    "updated_at": datetime.now(timezone.utc),
                }, "$unset": {"lease_until": ""}},
            )
            logger.exception("Background job %s failed (attempt %s)", job.get("_id"), attempts)


async def _claim_scheduled_call() -> Optional[dict]:
    global _last_call_recovery
    import time
    now = datetime.now(timezone.utc)
    now_mono = time.monotonic()
    # A process can die after claiming a call. Recover leases periodically without pounding the database.
    if now_mono - _last_call_recovery > 60:
        _last_call_recovery = now_mono
        await col_scheduled_calls().update_many(
            {"status": "running", "lease_until": {"$lt": now}},
            {"$set": {"status": "pending", "updated_at": now}, "$unset": {"lease_until": ""}},
        )
    return await col_scheduled_calls().find_one_and_update(
        {
            "status": "pending",
            "scheduled_at": {"$lte": now},
            "$or": [{"next_retry_at": {"$exists": False}}, {"next_retry_at": {"$lte": now}}],
        },
        {
            "$set": {
                "status": "running",
                "updated_at": now,
                "lease_until": now + timedelta(minutes=10),
            },
            "$inc": {"attempts": 1},
        },
        sort=[("scheduled_at", 1), ("created_at", 1)],
        return_document=ReturnDocument.AFTER,
    )


async def _run_scheduled_call(job: dict) -> None:
    # Import lazily to avoid an API-router <-> worker import cycle at startup.
    from api.v1.admin.channels import TestCallRequest, trigger_test_call

    payload = job.get("payload") or {}
    request = TestCallRequest(**payload["request"])
    await trigger_test_call(payload["channel_id"], request)


async def _scheduled_call_worker_loop() -> None:
    logger.info("Durable scheduled-call worker started")
    while _stop_event and not _stop_event.is_set():
        job = await _claim_scheduled_call()
        if not job:
            try:
                await asyncio.wait_for(_stop_event.wait(), timeout=2)
            except asyncio.TimeoutError:
                continue
            break
        try:
            await _run_scheduled_call(job)
            now = datetime.now(timezone.utc)
            await col_scheduled_calls().update_one(
                {"_id": job["_id"], "status": "running"},
                {"$set": {"status": "completed", "completed_at": now, "updated_at": now}, "$unset": {"lease_until": ""}},
            )
        except Exception as exc:
            attempts = int(job.get("attempts", 1))
            terminal = attempts >= 3
            now = datetime.now(timezone.utc)
            update = {
                "$set": {
                    "status": "failed" if terminal else "pending",
                    "last_error": str(exc)[:2000],
                    "updated_at": now,
                },
                "$unset": {"lease_until": ""},
            }
            if not terminal:
                update["$set"]["next_retry_at"] = now + timedelta(minutes=2 ** attempts)
            await col_scheduled_calls().update_one({"_id": job["_id"]}, update)
            logger.exception("Scheduled call %s failed (attempt %s)", job.get("_id"), attempts)


def start_worker() -> None:
    global _worker_task, _scheduled_call_worker_task, _stop_event
    if _worker_task and not _worker_task.done():
        return
    _stop_event = asyncio.Event()
    _worker_task = asyncio.create_task(_worker_loop(), name="zeniaone-background-worker")
    _scheduled_call_worker_task = asyncio.create_task(
        _scheduled_call_worker_loop(), name="zeniaone-scheduled-call-worker"
    )


async def stop_worker() -> None:
    global _worker_task, _scheduled_call_worker_task, _stop_event
    if not _worker_task:
        return
    _stop_event.set()
    try:
        await asyncio.wait_for(_worker_task, timeout=10)
    except (asyncio.TimeoutError, asyncio.CancelledError):
        _worker_task.cancel()
    _worker_task = None
    if _scheduled_call_worker_task:
        try:
            await asyncio.wait_for(_scheduled_call_worker_task, timeout=10)
        except (asyncio.TimeoutError, asyncio.CancelledError):
            _scheduled_call_worker_task.cancel()
    _scheduled_call_worker_task = None
    _stop_event = None
