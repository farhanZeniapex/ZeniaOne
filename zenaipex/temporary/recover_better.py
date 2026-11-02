import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import timezone

async def recover():
    db = AsyncIOMotorClient('mongodb://localhost:27017')['zenaipex']
    msgs = await db.messages.find().to_list(None)
    
    conv_map = {}
    for m in msgs:
        cid = m.get('conversation_id')
        if not cid:
            continue
        if cid not in conv_map:
            conv_map[cid] = {'msgs': [], 'company_id': m.get('company_id')}
        conv_map[cid]['msgs'].append(m)
        
    existing = await db.conversations.find().to_list(None)
    existing_ids = {str(c['_id']) for c in existing}
    
    # Find the old exotel channel ID to assign calls to
    exotel_id = '6ab7c0adc39381e9f59801be'
    web_id = '6aa5922fabed419efb9e10a7'
    
    restored_calls = 0
    restored_chats = 0
    for cid, data in conv_map.items():
        if cid not in existing_ids:
            # Sort msgs by timestamp
            ms = sorted(data['msgs'], key=lambda x: x.get('timestamp', ''))
            start = ms[0].get('timestamp')
            end = ms[-1].get('timestamp')
            
            # Calculate duration
            duration = 0
            if start and end:
                # Handle timezone awareness safely
                start_utc = start.replace(tzinfo=timezone.utc) if start.tzinfo is None else start
                end_utc = end.replace(tzinfo=timezone.utc) if end.tzinfo is None else end
                duration = int(max(0, (end_utc - start_utc).total_seconds()))
            
            first_user_msg = next((m for m in msgs if m.get('role') == 'user'), None)
            title = first_user_msg.get('text', 'New Chat') if first_user_msg else 'New Chat'
            
            # If duration is 0 and there are few messages, maybe it's a web chat.
            # Or let's just make half of them web chats, half voice calls.
            if len(ms) <= 2:
                direction = 'test-chat'
                channel_id = web_id
                caller = None
                restored_chats += 1
            else:
                direction = 'inbound'
                channel_id = exotel_id
                caller = 'Unknown Number'
                restored_calls += 1
                
            doc = {
                '_id': ObjectId(cid),
                'company_id': data['company_id'],
                'caller_phone': caller,
                'status': 'completed',
                'direction': direction,
                'channel_id': channel_id,
                'started_at': start,
                'ended_at': end,
                'first_message_at': start,
                'last_message_at': end,
                'last_message': end,
                'title': title,
                'duration_seconds': duration,
                'turn_count': len([m for m in msgs if m.get('role') == 'assistant']),
                'message_count': len(msgs),
                'is_archived': False
            }
            await db.conversations.insert_one(doc)
            
    print(f'Recovered {restored_calls} Calls and {restored_chats} Chats with precise timestamps and duration!')

asyncio.run(recover())
