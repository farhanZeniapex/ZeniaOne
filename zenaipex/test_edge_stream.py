import asyncio
import time
from modules.sarvam_tts import stream_fallback_neural_tts

async def main():
    text = "ZeniaOne is an enterprise AI voice and chat agent platform. It helps automate lead generation, customer support, and sales across multiple channels."
    print(f"Testing TTS streaming for text: {text}")
    
    start_time = time.time()
    first_chunk_time = None
    chunks = 0
    total_bytes = 0
    
    async for chunk in stream_fallback_neural_tts(text, "en-US-AriaNeural"):
        if first_chunk_time is None:
            first_chunk_time = time.time()
            print(f"FIRST AUDIO latency: {int((first_chunk_time - start_time) * 1000)} ms")
        
        chunks += 1
        total_bytes += len(chunk)
        
    end_time = time.time()
    print(f"TOTAL TTS generation time: {int((end_time - start_time) * 1000)} ms")
    print(f"Total chunks: {chunks}")
    print(f"Total bytes: {total_bytes}")

if __name__ == "__main__":
    asyncio.run(main())
