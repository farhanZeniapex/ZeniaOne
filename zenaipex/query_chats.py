import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    db = AsyncIOMotorClient('mongodb://localhost:27017')['zenaipex']
    chats = await db.conversations.find({'direction': 'test-chat'}).sort('started_at', 1).to_list(10)
    for c in chats:
        print(str(c['_id']) + ' | Date: ' + str(c.get('started_at')))

asyncio.run(main())
