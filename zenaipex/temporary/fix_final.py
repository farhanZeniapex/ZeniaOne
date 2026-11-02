import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def fix():
    db = AsyncIOMotorClient('mongodb://localhost:27017')['zenaipex']
    
    # Find all 644 reconstructed records
    reconstructed = await db.conversations.find({'caller_phone': 'Unknown Number'}).to_list(None)
    
    updated = 0
    for c in reconstructed:
        # Remove their fake channel_id and direction, make them 'web_chat' or 'unverified_recovered'
        await db.conversations.update_one(
            {'_id': c['_id']},
            {'$set': {'direction': 'web_chat'}, '$unset': {'channel_id': ''}}
        )
        updated += 1
        
    print(f'Unmapped {updated} reconstructed records from specific phone channels.')

asyncio.run(fix())
