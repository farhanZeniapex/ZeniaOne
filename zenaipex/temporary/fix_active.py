import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

async def fix_ended_at():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['zenaipex']
    
    # 1. First, forcefully ensure ALL conversations have status completed or failed
    # if they are active. We already did this, but just in case.
    await db['conversations'].update_many(
        {"status": {"$in": ["active", "calling"]}},
        {"$set": {"status": "failed", "failure_reason": "Force closed"}}
    )
    
    # 2. Give all completed/failed calls an ended_at if they don't have one
    res = await db['conversations'].update_many(
        {"ended_at": None},
        {"$set": {"ended_at": datetime.now(timezone.utc)}}
    )
    print(f"Set ended_at for {res.modified_count} calls!")
    
    # 3. Print count of remaining active
    rem = await db['conversations'].count_documents({"status": "active"})
    print(f"Remaining active: {rem}")

if __name__ == "__main__":
    asyncio.run(fix_ended_at())
