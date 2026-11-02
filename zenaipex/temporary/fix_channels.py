import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

async def fix():
    db = AsyncIOMotorClient('mongodb://localhost:27017')['zenaipex']
    
    web_id = '6aa5922fabed419efb9e10a7'
    phone_id = '6ac6209ca0af97f94fe85cd3'
    old_phone_id = '6ab7c0adc39381e9f59801be'
    
    # Web chats
    r1 = await db.conversations.update_many(
        {'direction': 'test-chat', 'channel_id': {'$exists': False}},
        {'$set': {'channel_id': web_id}}
    )
    
    # Phone calls
    # Half to new phone, half to old phone, to make it look realistic?
    # Let's just put all missing channel phone calls to the new phone.
    r2 = await db.conversations.update_many(
        {'direction': {'$in': ['inbound', 'outbound', 'voice']}, 'channel_id': {'$exists': False}},
        {'$set': {'channel_id': phone_id}}
    )
    
    print(f'Assigned channels: {r1.modified_count} web chats, {r2.modified_count} phone calls.')

asyncio.run(fix())
