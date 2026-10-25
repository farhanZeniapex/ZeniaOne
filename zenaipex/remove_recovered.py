import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def remove():
    db = AsyncIOMotorClient('mongodb://localhost:27017')['zenaipex']
    r = await db.conversations.delete_many({'caller_phone': 'Recovered'})
    print(f'Deleted {r.deleted_count} recovered conversations.')

asyncio.run(remove())
