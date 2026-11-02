import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def fix():
    db = AsyncIOMotorClient('mongodb://localhost:27017')['zenaipex']
    reconstructed = await db.conversations.find({'caller_phone': 'Unknown Number'}).to_list(None)
    print(f'Total reconstructed to fix source_type: {len(reconstructed)}')
    
    for c in reconstructed:
        direction = c.get('direction')
        
        if direction == 'inbound':
            await db.conversations.update_one({'_id': c['_id']}, {'$set': {'source_type': 'phone_call'}})
        elif direction == 'web_chat':
            await db.conversations.update_one({'_id': c['_id']}, {'$set': {'source_type': 'web_chat'}})
        elif direction == 'voice_chat':
            await db.conversations.update_one({'_id': c['_id']}, {'$set': {'source_type': 'voice_chat'}})
            
    print('Source types fixed!')

asyncio.run(fix())
