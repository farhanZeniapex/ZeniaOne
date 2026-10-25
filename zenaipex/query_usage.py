import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    db = AsyncIOMotorClient('mongodb://localhost:27017')['zenaipex']
    usage = await db.usage_records.find().to_list(None)
    total_calls = sum(u.get('call_count', 0) for u in usage)
    print('Total calls historically in usage_records:', total_calls)
    for u in usage:
        print(str(u.get('month')) + ': ' + str(u.get('call_count')) + ' calls')

asyncio.run(main())
