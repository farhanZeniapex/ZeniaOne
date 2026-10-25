import asyncio
import json
import os
import sys

sys.path.append('.')
from core.database import col_conversations, connect_db
from dotenv import load_dotenv

async def run():
    load_dotenv()
    await connect_db()
    docs = await col_conversations().find({'caller_phone': '08799046710'}).sort('_id', -1).limit(5).to_list(10)
    print(json.dumps([{'id': str(d['_id']), 'direction': d.get('direction'), 'caller': d.get('caller_phone')} for d in docs], indent=2))

if __name__ == '__main__':
    asyncio.run(run())
