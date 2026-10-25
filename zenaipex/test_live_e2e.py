import sys
import os
import json
import time
import math
import asyncio
import websockets
from dotenv import load_dotenv

sys.stdout.reconfigure(encoding='utf-8')
load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")

async def test_live_end_to_end():
    url = f"wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key={API_KEY}"
    print("Testing Gemini Live End-to-End WebSocket...")
    t0 = time.time()
    async with websockets.connect(url) as ws:
        # Setup
        setup_payload = {
            "setup": {
                "model": "models/gemini-3.1-flash-live-preview",
                "generationConfig": {
                    "responseModalities": ["AUDIO"],
                    "speechConfig": {
                        "voiceConfig": {
                            "prebuiltVoiceConfig": {
                                "voiceName": "Puck"
                            }
                        }
                    }
                },
                "systemInstruction": {
                    "parts": [{"text": "You are Zenia, a smart voice assistant. Answer in Hindi or Hinglish in 1-2 short sentences."}]
                }
            }
        }
        await ws.send(json.dumps(setup_payload))
        ack = await ws.recv()
        print(f"Setup ack in: {(time.time() - t0)*1000:.1f}ms")

        # Ask question
        user_question = "Zenia, kya tum real-time voice call par bat kar sakti ho? Jawab do."
        print(f"\nUser says: '{user_question}'")
        t_start = time.time()
        turn_msg = {
            "clientContent": {
                "turns": [{
                    "role": "user",
                    "parts": [{"text": user_question}]
                }],
                "turnComplete": True
            }
        }
        await ws.send(json.dumps(turn_msg))

        first_audio_ms = None
        chunks = 0
        total_pcm_bytes = 0
        transcript_accum = []

        while True:
            msg = await ws.recv()
            data = json.loads(msg)
            sc = data.get("serverContent", {})

            if "outputAudioTranscription" in sc:
                transcript_accum.append(sc["outputAudioTranscription"].get("text", ""))

            if "modelTurn" in sc:
                for part in sc["modelTurn"].get("parts", []):
                    if "text" in part:
                        transcript_accum.append(part["text"])
                    if "inlineData" in part:
                        if first_audio_ms is None:
                            first_audio_ms = (time.time() - t_start) * 1000
                        chunks += 1
                        total_pcm_bytes += len(part["inlineData"].get("data", ""))

            if sc.get("turnComplete"):
                break

        total_time_s = time.time() - t_start
        print(f"\n--- BENCHMARK REPORT ---")
        print(f"First Audio Latency (TTFA): {first_audio_ms:.1f} ms ({first_audio_ms/1000:.2f} seconds)")
        print(f"Total Stream Duration: {total_time_s:.2f} seconds")
        print(f"Total Audio Chunks: {chunks}")
        print(f"Total Audio Base64 Chars: {total_pcm_bytes}")
        print(f"Voice Response Text: {''.join(transcript_accum).strip()}")
        print(f"Errors detected: 0")

asyncio.run(test_live_end_to_end())
