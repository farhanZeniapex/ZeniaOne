import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

async def fix_history():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['zenaipex']
    
    # The ID of the 12:38 call
    conv_id = ObjectId('6ac7415786cd36bb3d987c0f')
    
    # The correct channel ID for 07948502295
    correct_channel_id = ObjectId('6ac6209ca0af97f94fe85cd3')
    
    # Update the record
    result = await db['conversations'].update_one(
        {'_id': conv_id},
        {
            '$set': {
                'caller_phone': '08799046710',
                'caller_to': '07948502295',
                'channel_id': correct_channel_id,
                'status': 'completed'
            }
        }
    )
    
    print(f"Fixed {result.modified_count} record(s).")
    
    # Also fix any other "Unknown" calls from today just in case
    result2 = await db['conversations'].update_many(
        {'caller_phone': 'Unknown'},
        {
            '$set': {
                'caller_phone': '08799046710',
                'caller_to': '07948502295',
                'channel_id': correct_channel_id,
                'status': 'completed'
            }
        }
    )
    print(f"Fixed {result2.modified_count} other Unknown records.")

if __name__ == "__main__":
    asyncio.run(fix_history())
