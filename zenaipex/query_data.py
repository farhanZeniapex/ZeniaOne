import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    db = AsyncIOMotorClient('mongodb://localhost:27017')['zenaipex']
    channel = await db.channels.find_one({'phone_number': {'$regex': '08047285182'}})
    cid = str(channel['_id']) if channel else None
    print('Channel ID:', cid)
    
    count1 = await db.conversations.count_documents({'channel_id': cid})
    print('Total Calls currently mapped to this channel_id:', count1)
    
    count2 = await db.conversations.count_documents({'caller_to': {'$regex': '08047285182'}})
    print('Total Calls with caller_to = 08047285182:', count2)
    
    convs = await db.conversations.find({'channel_id': cid}).sort('started_at', 1).to_list(None)
    if convs:
        print('First Call Date:', convs[0].get('started_at'))
        print('Last Call Date:', convs[-1].get('started_at'))

asyncio.run(main())
