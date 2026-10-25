import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

async def deactivate():
    db = AsyncIOMotorClient('mongodb://localhost:27017')['zenaipex']
    old_exotel_id = ObjectId('6ab7c0adc39381e9f59801be')
    
    r = await db.channels.update_one(
        {'_id': old_exotel_id},
        {'$set': {'status': 'inactive', 'is_active': False}}
    )
    print(f'Deactivated channel: {r.modified_count}')

asyncio.run(deactivate())
