import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    db = AsyncIOMotorClient('mongodb://localhost:27017')['zenaipex']
    channels = await db.channels.find().to_list(None)
    for c in channels:
        print(c['_id'], c.get('type'), c.get('phone_number'), c.get('name'))

asyncio.run(main())
