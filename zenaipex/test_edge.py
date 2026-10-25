import sys
import asyncio
sys.path.insert(0, r'D:\zeniaOne-Voice-Assistant')
sys.path.insert(0, r'D:\zeniaOne-Voice-Assistant\zenaipex')
from modules.sarvam_tts import stream_fallback_neural_tts

async def main():
    try:
        count = 0
        async for chunk in stream_fallback_neural_tts('hello', speaker='en-IN-PrabhatNeural'):
            count += len(chunk)
        print('Total bytes:', count)
    except Exception as e:
        print('Error:', e)

asyncio.run(main())
