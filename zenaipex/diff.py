import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def diff():
    db = AsyncIOMotorClient('mongodb://localhost:27017')['zenaipex']
    st = AsyncIOMotorClient('mongodb://localhost:27017')['zenaipex_staging']
    
    curr = await db.conversations.find().to_list(None)
    stag = await st.conversations.find().to_list(None)
    
    curr_ids = {c['_id']: c for c in curr}
    stag_ids = {c['_id']: c for c in stag}
    
    print(f'Current: {len(curr_ids)} | Staging: {len(stag_ids)}')
    
    reconstructed = [c for c in curr if 'Unknown Number' in str(c.get('caller_phone')) or c.get('caller_phone') == 'Unknown Number']
    print(f'Reconstructed (Unknown Number): {len(reconstructed)}')
    
    # 66 reconstructed records
    old_exotel = '6ab7c0adc39381e9f59801be'
    old_mapped = [c for c in curr if str(c.get('channel_id')) == old_exotel]
    print(f'Mapped to Old Exotel (080...): {len(old_mapped)}')

asyncio.run(diff())
