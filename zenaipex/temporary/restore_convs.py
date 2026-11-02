import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

async def restore():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['zenaipex']
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
    
    restored = 0
    for cid, data in conv_map.items():
        if cid not in existing_ids:
            # Sort msgs by timestamp
            ms = sorted(data['msgs'], key=lambda x: x.get('timestamp', ''))
            start = ms[0].get('timestamp')
            end = ms[-1].get('timestamp')
            doc = {
                '_id': ObjectId(cid),
                'company_id': data['company_id'],
                'caller_phone': 'Recovered',
                'status': 'completed',
                'direction': 'inbound',
                'started_at': start,
                'ended_at': end,
                'title': 'Recovered Conversation',
                'is_archived': False
            }
            await db.conversations.insert_one(doc)
            restored += 1
    print(f'Restored {restored} conversations from messages!')

asyncio.run(restore())
