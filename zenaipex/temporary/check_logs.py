import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def query():
    db = AsyncIOMotorClient('mongodb://localhost:27017')['zenaipex_staging']
    logs = await db.activity_logs.find({'action': {'$regex': '(?i)delete|remove'}}).to_list(None)
    for l in logs:
        print(str(l.get('created_at')) + ': ' + str(l.get('action')) + ' - ' + str(l.get('details')))

asyncio.run(query())
