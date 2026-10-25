import asyncio
import os
import sys
from datetime import datetime, timezone
import json

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

async def main():
    print("==================================================")
    print("RECONCILE STUCK ACTIVE CONVERSATIONS")
    print("==================================================")
    
    dry_run = "--apply" not in sys.argv
    if dry_run:
        print("MODE: DRY RUN (No data will be changed)")
    else:
        print("MODE: APPLY (Database will be updated!)")
        
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    dbs = await client.list_database_names()
    db_name = 'zenaipex_db' if 'zenaipex_db' in dbs else 'zenaipex'
    db = client[db_name]
    
    total = await db.conversations.count_documents({})
    active = await db.conversations.count_documents({"status": "active"})
    active_zero_duration = await db.conversations.count_documents({"status": "active", "duration_seconds": 0})
    
    print(f"\nAUDIT BEFORE:")
    print(f"Total conversations : {total}")
    print(f"Total active        : {active}")
    print(f"Active + duration 0 : {active_zero_duration}")
    
    # We will reconcile all active calls older than 3 hours
    cutoff = datetime.now(timezone.utc).timestamp() - (3 * 3600)
    
    cursor = db.conversations.find({"status": "active"})
    
    reconciled_count = 0
    unknown_count = 0
    skipped_recent_count = 0
    
    print("\nReconciling...")
    
    async for conv in cursor:
        started_at = conv.get("started_at")
        if not started_at:
            continue
            
        # Check if call is very recent (might genuinely be active)
        if started_at.timestamp() > cutoff:
            skipped_recent_count += 1
            continue
            
        # Determine real status
        ended_at = conv.get("ended_at")
        answered_at = conv.get("answered_at")
        duration = conv.get("duration_seconds", 0)
        recording_url = conv.get("recording_url")
        
        new_status = None
        
        # If it has a recording, it was definitely answered and completed/hung-up
        if recording_url:
            new_status = "completed"
        # If we have ended_at, it's definitely ended
        elif ended_at:
            if answered_at:
                new_status = "completed"
            else:
                new_status = "no-answer"
        # If no answered_at, and duration is 0, it was likely no-answer or failed
        elif not answered_at and duration == 0:
            new_status = "no-answer"
        elif not answered_at and duration > 0:
            new_status = "completed"
        else:
            new_status = "unknown"
            
        if new_status == "unknown":
            unknown_count += 1
        else:
            if not dry_run:
                # Update DB
                await db.conversations.update_one(
                    {"_id": conv["_id"]},
                    {"$set": {"status": new_status}}
                )
            reconciled_count += 1
            
        if (reconciled_count + unknown_count) <= 5:
            print(f"Sample: _id={conv['_id']} started_at={started_at} duration={duration} -> {new_status}")
            
    print("\nRESULTS:")
    print(f"Reconciled   : {reconciled_count}")
    print(f"Unknown      : {unknown_count}")
    print(f"Skipped(Live): {skipped_recent_count}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
