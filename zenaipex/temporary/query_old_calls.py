import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    db = AsyncIOMotorClient('mongodb://localhost:27017')['zenaipex']
    convs = await db.conversations.find({'caller_to': {'$regex': '08047285182'}}).to_list(None)
    for c in convs:
        print(f'{c[\'_id\']} | Date: {c.get(\'started_at\')} | From: {c.get(\'caller_phone\')} | To: {c.get(\'caller_to\')}')

asyncio.run(main())
