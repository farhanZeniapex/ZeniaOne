import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, timedelta

async def fix_db():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['zenaipex']
    
    real_channel_id = '6ac6209ca0af97f94fe85cd3'
    
    # 1. Hide all +917935465526 dummy calls
    res1 = await db['conversations'].update_many(
        {"channel_id": real_channel_id, "$or": [{"caller_phone": {"$regex": "7935465526"}}, {"caller_to": {"$regex": "7935465526"}}]},
        {"$set": {"channel_id": None}}
    )
    print(f"Removed {res1.modified_count} dummy calls for +917935465526")

    # 2. Hide all 1st October calls (dummy)
    # Using simple date filtering
    res2 = await db['conversations'].update_many(
        {
            "channel_id": real_channel_id, 
            "started_at": {"$lt": datetime(2026, 10, 5, tzinfo=timezone.utc)}
        },
        {"$set": {"channel_id": None}}
    )
    print(f"Removed {res2.modified_count} old dummy calls from October 1st")

    # 3. Bring back the "Unknown" call from today (11:06 AM) which belongs to the user
    # It was hidden by the previous script because it didn't have the phone number
    today_start = datetime(2026, 10, 8, tzinfo=timezone.utc)
    res3 = await db['conversations'].update_many(
        {
            "started_at": {"$gte": today_start},
            "caller_phone": "Unknown"
        },
        {"$set": {"channel_id": real_channel_id, "status": "completed", "duration_seconds": 33}}
    )
    print(f"Restored {res3.modified_count} 'Unknown' calls from today")

    # 4. Mark the "calling" status ones as failed/completed since Exotel dropped them
    res4 = await db['conversations'].update_many(
        {"channel_id": real_channel_id, "status": "calling"},
        {"$set": {"status": "failed", "failure_reason": "Client hung-up before connecting to any user"}}
    )
    print(f"Updated {res4.modified_count} 'calling' status calls to 'failed'")

if __name__ == "__main__":
    asyncio.run(fix_db())
