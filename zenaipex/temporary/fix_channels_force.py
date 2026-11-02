import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def fix():
    db = AsyncIOMotorClient('mongodb://localhost:27017')['zenaipex']
    new_channel = '6ac6209ca0af97f94fe85cd3'
    
    # Find the 35 real calls (they have caller_phone != None and direction in inbound/outbound/voice)
    r = await db.conversations.update_many(
        {'caller_phone': {'$ne': None}, 'direction': {'$in': ['inbound', 'outbound', 'voice']}},
        {'$set': {'channel_id': new_channel}}
    )
    print(f'Moved {r.modified_count} calls back to {new_channel}')

asyncio.run(fix())
