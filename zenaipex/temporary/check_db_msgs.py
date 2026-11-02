import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['zenaipex']
    print('Total messages:', await db.messages.count_documents({}))

asyncio.run(main())
