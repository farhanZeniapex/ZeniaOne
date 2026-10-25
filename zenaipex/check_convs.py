import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def inspect():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['zenaipex']
    docs = await db['conversations'].find().sort('started_at', -1).limit(5).to_list(None)
    for d in docs:
        print(f"ID: {d['_id']} | Company: {d.get('company_id')} | Channel: {d.get('channel_id')} | Caller: {d.get('caller_phone')} | To: {d.get('caller_to')} | Start: {d.get('started_at')}")

if __name__ == "__main__":
    asyncio.run(inspect())
