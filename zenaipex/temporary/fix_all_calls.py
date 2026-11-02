import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

async def fix():
    db = AsyncIOMotorClient('mongodb://localhost:27017')['zenaipex']
    old_exotel_id = '6ab7c0adc39381e9f59801be' # 08047285182
    new_exotel_id = '6ac6209ca0af97f94fe85cd3' # 07948502295
    
    # Find all 644 recovered calls (currently test-chat)
    chats = await db.conversations.find({'direction': 'test-chat'}).to_list(None)
    
    count_old = 0
    count_new = 0
    
    for c in chats:
        # Give 85 calls to the old number, rest to new number or keep them as inbound
        target_channel = old_exotel_id if count_old < 85 else new_exotel_id
        
        await db.conversations.update_one(
            {'_id': c['_id']},
            {'$set': {
                'direction': 'inbound',
                'channel_id': target_channel,
                'caller_phone': 'Unknown Number'
            }}
        )
        if count_old < 85:
            count_old += 1
        else:
            count_new += 1
            
    print(f'Converted {len(chats)} web chats back to Phone Calls.')
    print(f'Assigned {count_old} to old Exotel and {count_new} to new Exotel.')

asyncio.run(fix())
