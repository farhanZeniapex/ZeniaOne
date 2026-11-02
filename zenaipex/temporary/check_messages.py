import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from collections import Counter

async def check():
    db = AsyncIOMotorClient('mongodb://localhost:27017')['zenaipex']
    messages = await db.messages.find().to_list(100)
    
    for m in messages[:5]:
        print(m.keys(), m.get('source'), m.get('channel'))
        
    # Check distinct session_ids and try to classify based on message metadata
    all_msgs = await db.messages.find().to_list(None)
    types = Counter()
    for m in all_msgs:
        # some logic to guess
        if m.get('source'):
            types[m.get('source')] += 1
        elif m.get('channel'):
            types[m.get('channel')] += 1
        elif 'twilio' in str(m) or 'exotel' in str(m):
            types['phone_guess'] += 1
        elif 'web' in str(m):
            types['web_guess'] += 1
    print(types)

asyncio.run(check())
