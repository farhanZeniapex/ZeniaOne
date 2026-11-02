import asyncio
from core.database import col_conversations, connect_db

async def fix():
    await connect_db()
    result = await col_conversations().update_one({"status": "failed"}, {"$set": {"status": "calling"}})
    print(f"Set 1 call back to calling state.")

asyncio.run(fix())
