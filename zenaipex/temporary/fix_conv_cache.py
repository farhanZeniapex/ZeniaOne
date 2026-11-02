import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def optimize():
    db = AsyncIOMotorClient('mongodb://localhost:27017')['zenaipex']
    convs = await db.conversations.find().to_list(None)
    updated = 0
    for c in convs:
        cid = str(c['_id'])
        # Get messages
        msgs = await db.messages.find({'conversation_id': cid}).sort('timestamp', 1).to_list(None)
        if not msgs:
            continue
        
        first_msg = next((m for m in msgs if m.get('role') == 'user'), None)
        last_msg = msgs[-1]
        msg_count = len(msgs)
        turn_count = len([m for m in msgs if m.get('role') == 'assistant'])
        
        update_fields = {
            'message_count': msg_count,
            'turn_count': turn_count,
            'first_message_at': first_msg.get('timestamp') if first_msg else msgs[0].get('timestamp'),
            'last_message_at': last_msg.get('timestamp'),
            'last_message': last_msg.get('text', '') or last_msg.get('content', '')
        }
        if not c.get('title') or c.get('title') == 'Recovered Conversation' or c.get('title') == 'Web Chat Session' or c.get('title') == 'Voice Agent Session':
            update_fields['title'] = c.get('title') or (first_msg.get('text', 'New Chat') if first_msg else 'New Chat')
            
        await db.conversations.update_one({'_id': c['_id']}, {'$set': update_fields})
        updated += 1
    print(f'Cached stats on {updated} conversations.')

asyncio.run(optimize())
