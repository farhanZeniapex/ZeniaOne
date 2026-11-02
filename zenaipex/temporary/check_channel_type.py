import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def inspect():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['zenaipex']
    docs = await db['conversations'].find({'company_id': '6a990b403e9b17bef89acf87'}).limit(5).to_list(None)
    for d in docs:
        print(f"ID: {d['_id']} | channel_id type: {type(d.get('channel_id'))} | val: {d.get('channel_id')}")
        
if __name__ == "__main__":
    asyncio.run(inspect())
