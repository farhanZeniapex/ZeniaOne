import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def fix_type():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['zenaipex']
    
    # Find all where channel_id is ObjectId and convert to str
    docs = await db['conversations'].find().to_list(None)
    fixed = 0
    for d in docs:
        cid = d.get('channel_id')
        if cid and not isinstance(cid, str):
            await db['conversations'].update_one(
                {'_id': d['_id']},
                {'$set': {'channel_id': str(cid)}}
            )
            fixed += 1
            
    print(f"Fixed {fixed} records with wrong channel_id type.")

if __name__ == "__main__":
    asyncio.run(fix_type())
