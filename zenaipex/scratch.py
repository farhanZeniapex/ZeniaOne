import asyncio
from modules.sarvam_tts import stream_fallback_neural_tts
async def test():
    count = 0
    async for c in stream_fallback_neural_tts('hello world'):
        count += len(c)
    print('total bytes:', count)
asyncio.run(test())
