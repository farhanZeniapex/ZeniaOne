import asyncio
import os
import sys

# Add root directory to sys.path
sys.path.insert(0, os.path.abspath('zenaipex'))

from api.v1.voice_advanced import fetch_llm_response

async def run():
    conversation_history = [
        {"role": "user", "content": "Hello?"}
    ]
    print("Testing fetch_llm_response...")
    res = await fetch_llm_response(conversation_history)
    print("Result:", res)

if __name__ == '__main__':
    asyncio.run(run())
