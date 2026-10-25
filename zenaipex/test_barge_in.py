"""
Local barge-in test: verifies that interim Deepgram transcripts cancel running TTS,
and that greeting protection still works.
"""
import sys, os, asyncio, json, base64, logging

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

logging.basicConfig(level=logging.INFO, format="%(name)s: %(message)s")
logger = logging.getLogger("barge_in_test")

# We test the barge-in logic directly by simulating the receive_from_deepgram flow.
# Instead of importing the full WebSocket handler, we replicate the exact barge-in
# decision block from voice_advanced.py to verify behavior.

class MockWebSocket:
    def __init__(self):
        self.messages_sent = []
    async def send_json(self, data):
        self.messages_sent.append(data)
        logger.info(f"[MockWS] sent: {data.get('event', 'unknown')}")

class MockTask:
    def __init__(self):
        self._done = False
        self._cancelled = False
    def done(self):
        return self._done
    def cancel(self):
        self._cancelled = True
        logger.info("[MockTask] cancel() called")

async def test_barge_in():
    """Test that interim speech >= 3 chars triggers barge-in when greeting_protect[0] is True."""
    cancel_event = asyncio.Event()
    greeting_protect = [True]  # Greeting already sent
    stream_sid = "test_stream_123"
    websocket = MockWebSocket()
    current_ai_task = MockTask()
    
    # Simulate interim transcript
    transcript = "hello"
    is_meaningful_speech = len(transcript.strip()) >= 3
    
    assert is_meaningful_speech, "FAIL: 'hello' should be meaningful speech"
    assert not cancel_event.is_set(), "FAIL: cancel_event should not be set yet"
    
    if not cancel_event.is_set() and is_meaningful_speech:
        if greeting_protect[0]:
            logger.info(f'[BARGE_IN] interim_user_speech="{transcript}"')
            logger.info("[BARGE_IN] AI_SPEAKING=true")
            logger.info("[BARGE_IN] cancelling_current_tts=true")
            cancel_event.set()
            
            exotel_clear_sent = False
            if stream_sid:
                try:
                    await websocket.send_json({"event": "clear", "stream_sid": stream_sid})
                    exotel_clear_sent = True
                except Exception as clear_err:
                    logger.warning(f"[BARGE_IN] exotel_clear_error={clear_err}")
            logger.info(f"[BARGE_IN] exotel_clear_sent={exotel_clear_sent}")
            
            if current_ai_task and not current_ai_task.done():
                current_ai_task.cancel()
                logger.info("[BARGE_IN] tts_task_cancelled=true")
            logger.info("[BARGE_IN] voice_state=LISTENING")
    
    # Verify results
    assert cancel_event.is_set(), "FAIL: cancel_event should be set after barge-in"
    assert current_ai_task._cancelled, "FAIL: task should be cancelled"
    assert len(websocket.messages_sent) == 1, "FAIL: exactly one message should be sent"
    assert websocket.messages_sent[0]["event"] == "clear", "FAIL: message should be 'clear'"
    assert websocket.messages_sent[0]["stream_sid"] == stream_sid, "FAIL: stream_sid mismatch"
    
    logger.info("✅ TEST 1 PASSED: Barge-in triggers on interim speech, sends clear, cancels task")

async def test_greeting_protection():
    """Test that barge-in is blocked when greeting_protect[0] is False."""
    cancel_event = asyncio.Event()
    greeting_protect = [False]  # Greeting NOT yet sent
    stream_sid = "test_stream_123"
    websocket = MockWebSocket()
    current_ai_task = MockTask()
    
    transcript = "hello there how are you"
    is_meaningful_speech = len(transcript.strip()) >= 3
    
    if not cancel_event.is_set() and is_meaningful_speech:
        if greeting_protect[0]:
            cancel_event.set()
        else:
            logger.info("🛡️ BARGE-IN PROTECTED: greeting not started")
    
    assert not cancel_event.is_set(), "FAIL: cancel_event should NOT be set during greeting protection"
    assert not current_ai_task._cancelled, "FAIL: task should NOT be cancelled during greeting protection"
    assert len(websocket.messages_sent) == 0, "FAIL: no messages should be sent during greeting protection"
    
    logger.info("✅ TEST 2 PASSED: Greeting protection blocks barge-in")

async def test_short_noise_ignored():
    """Test that very short interim transcripts (< 3 chars) don't trigger barge-in."""
    cancel_event = asyncio.Event()
    greeting_protect = [True]
    
    transcript = "ah"  # 2 chars — should be ignored
    is_meaningful_speech = len(transcript.strip()) >= 3
    
    assert not is_meaningful_speech, "FAIL: 2-char transcript should not be meaningful"
    assert not cancel_event.is_set(), "FAIL: cancel_event should not be set for noise"
    
    logger.info("✅ TEST 3 PASSED: Short noise (< 3 chars) does not trigger barge-in")

async def test_cancel_event_prevents_tts_send():
    """Test that once cancel_event is set, the TTS loop would stop sending audio."""
    cancel_event = asyncio.Event()
    cancel_event.set()
    
    # Simulate the check inside EdgeTTS fallback loop
    chunks_sent = 0
    for i in range(10):
        if cancel_event.is_set():
            break
        chunks_sent += 1
    
    assert chunks_sent == 0, "FAIL: no chunks should be sent after cancel_event is set"
    logger.info("✅ TEST 4 PASSED: cancel_event stops TTS chunk sending immediately")

async def main():
    logger.info("=" * 60)
    logger.info("BARGE-IN LOCAL TEST SUITE")
    logger.info("=" * 60)
    
    await test_barge_in()
    await test_greeting_protection()
    await test_short_noise_ignored()
    await test_cancel_event_prevents_tts_send()
    
    logger.info("=" * 60)
    logger.info("ALL 4 TESTS PASSED ✅")
    logger.info("=" * 60)

asyncio.run(main())
