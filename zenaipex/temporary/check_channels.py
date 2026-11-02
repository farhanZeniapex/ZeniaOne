import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def inspect():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['zenaipex']
    ch = await db['channels'].find({'company_id': '6a990b403e9b17bef89acf87'}).to_list(None)
    for c in ch:
        print(f"{c['_id']} | {c.get('type')} | {c.get('phone_number')}")

if __name__ == "__main__":
    asyncio.run(inspect())
