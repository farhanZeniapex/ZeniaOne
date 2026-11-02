import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['zenaipex']
    print('Total convs:', await db.conversations.count_documents({}))
    print('Archived:', await db.conversations.count_documents({'is_archived': True}))
    print('Not Archived:', await db.conversations.count_documents({'': [{'is_archived': False}, {'is_archived': {'$exists': False}}]}))

asyncio.run(main())
