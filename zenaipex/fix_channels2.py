import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def fix():
    db = AsyncIOMotorClient('mongodb://localhost:27017')['zenaipex']
    real_channel_id = '6ac6209ca0af97f94fe85cd3'
    
    r = await db.conversations.update_many(
        {'_id': {'$exists': True}},
        {'$set': {'channel_id': real_channel_id}}
    )
    print(f'Moved {r.modified_count} calls to {real_channel_id}')

asyncio.run(fix())
