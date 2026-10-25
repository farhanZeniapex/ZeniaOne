import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    db = AsyncIOMotorClient('mongodb://localhost:27017')['zenaipex']
    convs = await db.conversations.find().to_list(None)
    
    from collections import Counter
    counts = Counter(str(c.get('channel_id')) for c in convs)
    
    print('Total conversations:', len(convs))
    for cid, count in counts.items():
        print(f'Channel {cid}: {count} calls')

asyncio.run(main())
