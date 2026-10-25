import asyncio
import os
import sys

# Setup environment for testing
from dotenv import load_dotenv
load_dotenv()

# Import the function
sys.path.append('.')
from api.v1.voice_advanced import fetch_llm_response

async def test():
    # Test 1
    print('--- TEST 1: What is ZeniaONE? ---')
    history = [{'role': 'user', 'content': 'What is ZeniaONE?'}]
    res = await fetch_llm_response(history)
    print('Final text:', res)
    
    print('\n--- TEST 2: What is the venue One? ---')
    history = [{'role': 'user', 'content': 'What is the venue One?'}]
    res = await fetch_llm_response(history)
    print('Final text:', res)

asyncio.run(test())
