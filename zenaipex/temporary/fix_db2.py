import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def fix_db():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['zenaipex']
    
    real_channel_id = '6ac6209ca0af97f94fe85cd3'
    
    # We want to KEEP conversations where:
    # caller_to contains '07948502295'
    # OR caller_phone contains '08799046710' or '07600858654'
    
    # First, let's find all conversations currently in this channel
    convs = await db['conversations'].find({"channel_id": real_channel_id}).to_list(None)
    
    to_remove = []
    to_keep = []
    
    for c in convs:
        c_to = c.get('caller_to', '') or ''
        c_from = c.get('caller_phone', '') or ''
        
        is_mine = False
        if '07948502295' in c_to or '07948502295' in c_from:
            is_mine = True
        elif '08799046710' in c_from or '08799046710' in c_to:
            is_mine = True
        elif '07600858654' in c_from or '07600858654' in c_to:
            is_mine = True
        elif '+917935465526' in c_to or '+917935465526' in c_from:
            is_mine = True
            
        if is_mine:
            to_keep.append(c['_id'])
        else:
            to_remove.append(c['_id'])
            
    print(f"Keeping {len(to_keep)} conversations. Removing {len(to_remove)} from the channel.")
    
    if to_remove:
        # Revert channel_id to None for the irrelevant ones
        res = await db['conversations'].update_many(
            {"_id": {"$in": to_remove}},
            {"$set": {"channel_id": None}}
        )
        print(f"Successfully reverted {res.modified_count} calls back to hidden/None.")

if __name__ == "__main__":
    asyncio.run(fix_db())
