import asyncio
import base64
import json
import unittest

from modules.gemini_transcribe import GeminiLiveTranscriber
from modules.voice_runtime import VoiceRuntimeConfig, VoiceSentenceSegmenter, VoiceTurnMetrics


class FakeWebSocket:
    def __init__(self, incoming=None):
        self.incoming = list(incoming or [])
        self.sent = []
        self.closed = False

    async def send(self, payload):
        self.sent.append(json.loads(payload))

    async def recv(self):
        return json.dumps(self.incoming.pop(0))

    async def close(self):
        self.closed = True


class GeminiTranscribeAdapterTests(unittest.TestCase):
    def test_phone_pcm_is_resampled_and_sent_as_16khz(self):
        async def scenario():
            socket = FakeWebSocket()
            adapter = GeminiLiveTranscriber(socket)
            await adapter.send(b"\x00\x00" * 160)
            audio = socket.sent[0]["realtimeInput"]["audio"]
            decoded = base64.b64decode(audio["data"])
            self.assertEqual(audio["mimeType"], "audio/pcm;rate=16000")
            self.assertGreater(len(decoded), 320)

        asyncio.run(scenario())

    def test_browser_pcm_is_sent_without_double_resampling(self):
        async def scenario():
            socket = FakeWebSocket()
            adapter = GeminiLiveTranscriber(socket, source_sample_rate=16000)
            pcm_16khz = b"\x00\x00" * 320
            await adapter.send(pcm_16khz)
            audio = socket.sent[0]["realtimeInput"]["audio"]
            self.assertEqual(base64.b64decode(audio["data"]), pcm_16khz)
            self.assertEqual(audio["mimeType"], "audio/pcm;rate=16000")

        asyncio.run(scenario())

    def test_interim_and_final_events_match_phone_pipeline_shape(self):
        async def scenario():
            socket = FakeWebSocket([
                {"serverContent": {"interimInputTranscription": {"text": "hello ze"}}},
                {"serverContent": {"inputTranscription": {"text": "Hello Zenia"}}},
            ])
            adapter = GeminiLiveTranscriber(socket)
            interim = json.loads(await adapter.recv())
            final = json.loads(await adapter.recv())
            self.assertFalse(interim["is_final"])
            self.assertEqual(final["channel"]["alternatives"][0]["transcript"], "Hello Zenia")
            self.assertTrue(final["is_final"])

        asyncio.run(scenario())

    def test_agent_runtime_caps_latency_and_voice_response_length(self):
        config = VoiceRuntimeConfig.from_agent({
            "supported_languages": ["hi-IN", "en-IN", "gu-IN"],
            "default_language": "hi-IN",
            "silence_timeout_ms": 3000,
            "llm_max_tokens": 1200,
            "llm_model": "gemini-3.5-flash-lite",
            "tts_voice": "custom-voice-id",
        })
        self.assertEqual(config.stt_language, "multi")
        self.assertEqual(config.endpointing_ms, 1200)
        self.assertEqual(config.llm_max_tokens, 220)
        self.assertEqual(config.tts_voice, "custom-voice-id")

    def test_metrics_are_serializable_for_mongodb(self):
        metrics = VoiceTurnMetrics("hello", llm_model="gemini", tts_voice="OM")
        metrics.mark_llm_first_token()
        metrics.mark_llm_complete()
        metrics.mark_tts_first_audio()
        metrics.finish()
        document = metrics.as_document()
        self.assertGreaterEqual(document["complete_ms"], document["llm_first_token_ms"])
        self.assertEqual(document["tts_voice"], "OM")

    def test_streamed_tokens_are_emitted_as_speakable_sentences(self):
        segmenter = VoiceSentenceSegmenter(max_chars=110)
        spoken = []
        for token in ["Namaste! ", "Main OM ki awaaz mein ", "aapki madad kar sakta hoon. ", "Boliye?"]:
            spoken.extend(segmenter.push(token))
        spoken.extend(segmenter.finish())

        self.assertEqual(spoken, [
            "Namaste!",
            "Main OM ki awaaz mein aapki madad kar sakta hoon.",
            "Boliye?",
        ])

    def test_sentence_segmenter_flushes_long_unpunctuated_text(self):
        segmenter = VoiceSentenceSegmenter(max_chars=48)
        spoken = segmenter.push("ye ek lamba jawab hai jo bina punctuation ke bhi audio ko rokna nahi chahiye")
        self.assertTrue(spoken)
        self.assertLessEqual(len(spoken[0]), 48)


if __name__ == "__main__":
    unittest.main()
