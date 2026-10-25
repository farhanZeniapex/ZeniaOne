import os
import json
import asyncio
import time
import websockets
from dotenv import load_dotenv

load_dotenv(".env")
load_dotenv("zenaipex/.env")

API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

CANDIDATE_MODELS = [
    "gemini-2.0-flash-exp",
    "gemini-2.5-flash-live-preview",
    "gemini-3.1-flash-live-preview",
    "gemini-3.8-live",
]

WS_URL = f"wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key={API_KEY}"

async def test_model(model_name: str):
    print(f"\n--- Testing model: {model_name} ---")
    start_t = time.perf_counter()
    try:
        async with websockets.connect(WS_URL, open_timeout=7, close_timeout=5) as ws:
            connect_t = time.perf_counter() - start_t
            print(f"Connected in {connect_t*1000:.1f}ms")

            setup_msg = {
                "setup": {
                    "model": f"models/{model_name}",
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
                    "outputAudioTranscription": {},
                    "systemInstruction": {
                        "parts": [{"text": "You are ZeniaOne AI assistant. Answer in natural Hindi or English concisely."}]
                    }
                }
            }
            await ws.send(json.dumps(setup_msg))
            resp = await asyncio.wait_for(ws.recv(), timeout=7.0)
            print(f"Setup response: {resp}")

            # Send a user question
            question_t = time.perf_counter()
            question = "Namaste! Aapka naam kya hai aur aap meri kya madad kar sakte hain?"
            print(f"Sending User Question: '{question}'")
            turn_msg = {
                "clientContent": {
                    "turns": [{
                        "role": "user",
                        "parts": [{"text": question}]
                    }],
                    "turnComplete": True
                }
            }
            await ws.send(json.dumps(turn_msg))

            # Receive turns until turnComplete
            first_byte_t = None
            total_audio_bytes = 0
            transcript_parts = []

            while True:
                msg = await asyncio.wait_for(ws.recv(), timeout=12.0)
                data = json.loads(msg)
                sc = data.get("serverContent", {})

                # Check text delta
                if "outputTranscription" in sc:
                    t = sc["outputTranscription"].get("text", "")
                    if t:
                        transcript_parts.append(t)

                # Check audio chunks
                model_turn = sc.get("modelTurn", {})
                for part in model_turn.get("parts", []):
                    if "inlineData" in part:
                        if first_byte_t is None:
                            first_byte_t = time.perf_counter() - question_t
                        raw_data = part["inlineData"].get("data", "")
                        total_audio_bytes += len(raw_data)

                if sc.get("turnComplete"):
                    break

            total_t = time.perf_counter() - question_t
            print(f"SUCCESS with {model_name}!")
            print(f"Time to First Audio Byte (Latency): {first_byte_t*1000:.1f}ms ({first_byte_t:.2f} seconds)")
            print(f"Total Turn Time: {total_t:.2f} seconds")
            print(f"Received Audio Data Length: {total_audio_bytes} chars b64")
            print(f"AI Spoken Transcript: '{''.join(transcript_parts)}'")
            return True, model_name, first_byte_t, "".join(transcript_parts)

    except Exception as e:
        print(f"Failed with {model_name}: {e}")
        return False, model_name, None, str(e)

async def main():
    results = []
    for m in CANDIDATE_MODELS:
        ok, name, lat, text = await test_model(m)
        results.append((ok, name, lat, text))
        if ok:
            print(f"\nFound working live model: {name}")
            break

if __name__ == "__main__":
    asyncio.run(main())
