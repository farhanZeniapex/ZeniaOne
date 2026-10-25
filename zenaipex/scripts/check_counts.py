import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    dbs = await client.list_database_names()
    db_name = 'zenaipex_db' if 'zenaipex_db' in dbs else 'zenaipex'
    db = client[db_name]
    
    total = await db.conversations.count_documents({})
    active = await db.conversations.count_documents({'status': 'active'})
    completed = await db.conversations.count_documents({'status': 'completed'})
    no_answer = await db.conversations.count_documents({'status': 'no-answer'})
    calling = await db.conversations.count_documents({'status': 'calling'})
    ringing = await db.conversations.count_documents({'status': 'ringing'})
    failed = await db.conversations.count_documents({'status': 'failed'})
    hung_up = await db.conversations.count_documents({'status': 'hung-up'})
    
    print(f'Total: {total}, Active: {active}, Completed: {completed}, No-Answer: {no_answer}, Calling: {calling}, Ringing: {ringing}, Failed: {failed}, Hung-Up: {hung_up}')
    client.close()

asyncio.run(run())
