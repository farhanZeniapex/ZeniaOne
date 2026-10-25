import sys, os, asyncio, base64
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath('main.py'))))
sys.path.insert(0, os.path.dirname(os.path.abspath('main.py')))
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test")

from api.v1.voice_advanced import text_to_speech_and_stream

class MockWebSocket:
    def __init__(self):
        self.bytes_sent = 0
        self.chunks_sent = 0
    async def send_json(self, data):
        if data["event"] == "media":
            b64_payload = data["media"]["payload"]
            decoded = base64.b64decode(b64_payload)
            self.bytes_sent += len(decoded)
            self.chunks_sent += 1
            if self.chunks_sent == 1:
                logger.info(f"[MockWebSocket] First chunk size: {len(decoded)} bytes")
        else:
            logger.info(f"[MockWebSocket] sent {data['event']}")

async def run_test():
    ws = MockWebSocket()
    cancel_event = asyncio.Event()
    greeting_protect = [False]
    
    # Patch sarvam_tts to force an exception
    import api.v1.voice_advanced
    async def fake_realtime_tts_stream(*args, **kwargs):
        raise ValueError("Simulated Sarvam Exception for Testing")
        yield b""
    
    import modules.sarvam_tts
    modules.sarvam_tts.realtime_tts_stream = fake_realtime_tts_stream
    
    logger.info("Starting TTS test...")
    await text_to_speech_and_stream("Hello world, this is a fallback test", ws, "stream_test", cancel_event, greeting_protect)
    logger.info(f"Test complete. Total chunks sent: {ws.chunks_sent}, Total bytes sent: {ws.bytes_sent}")

asyncio.run(run_test())
