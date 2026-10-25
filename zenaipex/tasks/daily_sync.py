import logging
import asyncio
from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from core.database import col_documents
from services.knowledge_service import ingest_document
from services.document_extractor import extract_url_text_with_report, CrawlOptions

logger = logging.getLogger(__name__)

async def sync_auto_documents():
    """
    Finds all documents marked for auto-sync (e.g. URLs added by clients)
    and re-ingests them to update the chunks with the latest content.
    """
    logger.info("[AUTO_SYNC] Starting daily auto-sync for knowledge base documents...")
    
    try:
        cursor = col_documents().find({"auto_sync": True, "source_url": {"$exists": True}})
        
        sync_count = 0
        failed_count = 0
        
        async for doc in cursor:
            company_id = doc.get("company_id")
            kb_id = doc.get("knowledge_base_id")
            url = doc.get("source_url")
            filename = doc.get("filename")
            
            if not all([company_id, kb_id, url]):
                continue
                
            try:
                logger.info(f"[AUTO_SYNC] Re-syncing document: {filename} from {url}")
                # Re-fetch the latest content
                crawl_options = CrawlOptions(**(doc.get("crawl_options") or {})).normalized()
                crawl_report = await extract_url_text_with_report(url, crawl_options)
                text_content = crawl_report["text"]
                content_bytes = text_content.encode("utf-8")
                
                # Create storage path
                import time
                storage_path = f"kb/{company_id}/{kb_id}/url_{int(time.time())}.txt"
                
                import os
                import aiofiles
                from services.storage_service import STORAGE_ROOT
                
                full_path = os.path.join(STORAGE_ROOT, storage_path)
                os.makedirs(os.path.dirname(full_path), exist_ok=True)
                async with aiofiles.open(full_path, "wb") as f:
                    await f.write(content_bytes)
                
                # Re-ingest the document, passing the existing_doc so Pinecone vectors are updated
                await ingest_document(
                    company_id=company_id,
                    kb_id=kb_id,
                    filename=filename,
                    content_type="text/plain",
                    storage_path=storage_path,
                    file_size_bytes=len(content_bytes),
                    existing_doc=doc
                )
                await col_documents().update_one(
                    {"_id": doc["_id"]},
                    {"$set": {"crawl_options": crawl_options.__dict__, "crawl_report": crawl_report}}
                )
                sync_count += 1
                
            except Exception as e:
                logger.warning(f"[AUTO_SYNC] Failed to sync document {doc.get('_id')} ({url}): {e}")
                failed_count += 1
                
        logger.info(f"[AUTO_SYNC] Completed. Synced: {sync_count}, Failed: {failed_count}")
        
    except Exception as e:
        logger.error(f"[AUTO_SYNC] Critical error during auto-sync job: {e}")


# Global scheduler instance
_scheduler = AsyncIOScheduler()
_scheduler_started = False

def start_scheduler():
    """Starts the background scheduler for daily tasks."""
    global _scheduler_started
    if _scheduler_started or _scheduler.running:
        logger.info("Background task scheduler already running; startup skipped.")
        return
    # Schedule to run every day at 2:00 AM
    _scheduler.add_job(
        sync_auto_documents,
        CronTrigger(hour=2, minute=0),
        id="daily_kb_sync",
        replace_existing=True,
        misfire_grace_time=3600,
        coalesce=True,
        max_instances=1,
    )
    _scheduler.start()
    _scheduler_started = True
    logger.info("🚀 Background task scheduler started. Daily KB sync scheduled at 2:00 AM.")

def stop_scheduler():
    """Stops the scheduler on app shutdown."""
    global _scheduler_started
    if _scheduler.running:
        _scheduler.shutdown()
        _scheduler_started = False
        logger.info("Background task scheduler stopped.")
