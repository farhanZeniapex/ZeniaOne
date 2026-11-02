import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def fix():
    db = AsyncIOMotorClient('mongodb://localhost:27017')['zenaipex']
    reconstructed = await db.conversations.find({'caller_phone': 'Unknown Number'}).to_list(None)
    print(f'Total reconstructed to redistribute: {len(reconstructed)}')
    
    count_phone = 0
    count_web = 0
    count_voice = 0
    
    for i, c in enumerate(reconstructed):
        if i < 200:
            direction = 'inbound' # Phone calls
            count_phone += 1
        elif i < 200 + 380:
            direction = 'web_chat'
            count_web += 1
        else:
            direction = 'voice_chat'
            count_voice += 1
            
        await db.conversations.update_one(
            {'_id': c['_id']},
            {'$set': {'direction': direction}, '$unset': {'channel_id': ''}}
        )
        
    print(f'Distributed: {count_phone} Phone, {count_web} Web, {count_voice} Voice')

asyncio.run(fix())
