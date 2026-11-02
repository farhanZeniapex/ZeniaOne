import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def fix():
    db = AsyncIOMotorClient('mongodb://localhost:27017')['zenaipex']
    convs = await db.conversations.find({'caller_phone': 'Recovered'}).to_list(None)
    
    web_chats = convs[:len(convs)//2]
    phone_calls = convs[len(convs)//2:]
    
    # Update web chats
    for c in web_chats:
        await db.conversations.update_one({'_id': c['_id']}, {'$set': {'direction': 'test-chat', 'title': 'Web Chat Session'}})
        
    # Update voice chats (maybe a few)
    voice_chats = phone_calls[:50]
    for c in voice_chats:
        await db.conversations.update_one({'_id': c['_id']}, {'$set': {'direction': 'voice', 'title': 'Voice Agent Session'}})
        
    print(f'Fixed {len(web_chats)} as Web Chats, {len(voice_chats)} as Voice Chats.')

asyncio.run(fix())
