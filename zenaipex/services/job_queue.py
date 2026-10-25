"""Durable Mongo-backed background jobs for work that must survive restarts."""
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from pymongo import ReturnDocument

from core.database import col_background_jobs

logger = logging.getLogger(__name__)
_worker_task: Optional[asyncio.Task] = None
_stop_event: Optional[asyncio.Event] = None


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
    now = datetime.now(timezone.utc)
    # Recover jobs whose worker died after claiming them.
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


def start_worker() -> None:
    global _worker_task, _stop_event
    if _worker_task and not _worker_task.done():
        return
    _stop_event = asyncio.Event()
    _worker_task = asyncio.create_task(_worker_loop(), name="zeniaone-background-worker")


async def stop_worker() -> None:
    global _worker_task, _stop_event
    if not _worker_task:
        return
    _stop_event.set()
    try:
        await asyncio.wait_for(_worker_task, timeout=10)
    except (asyncio.TimeoutError, asyncio.CancelledError):
        _worker_task.cancel()
    _worker_task = None
    _stop_event = None
