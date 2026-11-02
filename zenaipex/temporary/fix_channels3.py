import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def fix():
    db = AsyncIOMotorClient('mongodb://localhost:27017')['zenaipex']
    
    # 1. Fetch all channels
    channels = await db.channels.find().to_list(None)
    phone_to_channel = {}
    for c in channels:
        if c.get('phone_number'):
            phone = c['phone_number'].replace('+', '')
            phone_to_channel[phone] = str(c['_id'])
            phone_to_channel['+' + phone] = str(c['_id'])
            
    web_id = '6aa5922fabed419efb9e10a7'
    
    # 2. Fix recovered conversations (they all have caller_phone = 'Unknown Number' or 'Recovered' or None)
    # Make them all test-chat
    r1 = await db.conversations.update_many(
        {'caller_phone': 'Unknown Number'},
        {'$set': {'direction': 'test-chat', 'channel_id': web_id, 'caller_phone': None, 'title': 'Web Chat Session'}}
    )
    
    # 3. Fix the real 35 calls by looking at caller_to
    convs = await db.conversations.find({'caller_phone': {'$ne': None}}).to_list(None)
    fixed_real = 0
    for c in convs:
        c_to = c.get('caller_to')
        if c_to and c_to in phone_to_channel:
            correct_id = phone_to_channel[c_to]
            if str(c.get('channel_id')) != correct_id:
                await db.conversations.update_one({'_id': c['_id']}, {'$set': {'channel_id': correct_id}})
                fixed_real += 1
                
    print(f'Converted {r1.modified_count} recovered calls into Web Chats.')
    print(f'Restored {fixed_real} real calls to their original respective numbers.')

asyncio.run(fix())
