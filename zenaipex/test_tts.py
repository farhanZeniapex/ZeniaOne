import sys
import asyncio
import main
from modules.sarvam_tts import stream_fallback_neural_tts

async def test():
    try:
        async for chunk in stream_fallback_neural_tts("hello", speaker="svc-366db9ac-bf2b-4aa1-9f91-d9f92074ab65"):
            print(f"Got chunk of size {len(chunk)}")
    except Exception as e:
        import traceback
        traceback.print_exc()

asyncio.run(test())
