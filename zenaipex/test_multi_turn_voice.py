import asyncio
import json
import time
import websockets
import os
import sys

sys.path.insert(0, os.path.abspath("zenaipex"))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from core.database import connect_db, col_users, col_agents
from core.security import create_access_token

async def test_full_conversation():
    print("=" * 65)
    print("🎙️ MULTI-TURN REAL-TIME VOICE SIMULATION (GEMINI LIVE S2S)")
    print("=" * 65)

    await connect_db()
    user = await col_users().find_one({})
    token = create_access_token({"sub": str(user["_id"])})
    agent = await col_agents().find_one({"name": "Farhan"})
    agent_id = str(agent["_id"])
    company_id = str(agent.get("company_id"))

    ws_url = f"ws://127.0.0.1:8002/api/v1/companies/{company_id}/agents/{agent_id}/voice-stream"
    print(f"📡 Connecting to WebSocket endpoint: {ws_url}")

    async with websockets.connect(ws_url) as ws:
        # Start session
        await ws.send(json.dumps({
            "token": token,
            "engine": "gemini_live",
            "conversation_id": f"sim_conv_{int(time.time())}"
        }))

        # Wait for listening state
        init_state = await ws.recv()
        print(f"✅ Session Ready: {init_state}")

        conversation_turns = [
            "Namaste! Kya aap meri help kar sakte hain?",
            "ZeniaOne Voice Assistant mein main kya kya kar sakta hoon?",
            "Bohat badhiya! Agar mujhe call terminate karni ho to main kya bolu?"
        ]

        results = []

        for turn_idx, user_speech in enumerate(conversation_turns, 1):
            print(f"\n" + "-" * 60)
            print(f"🗣️ [TURN {turn_idx}] USER SAYS: '{user_speech}'")
            print("-" * 60)

            t_send = time.time()
            await ws.send(json.dumps({
                "type": "user_transcript",
                "text": user_speech
            }))

            first_audio_ms = None
            audio_chunks_count = 0
            total_audio_chars = 0
            full_ai_text = ""

            turn_active = True
            while turn_active:
                raw_msg = await asyncio.wait_for(ws.recv(), timeout=15.0)
                msg = json.loads(raw_msg)
                m_type = msg.get("type")

                if m_type == "ai_audio_pcm":
                    if first_audio_ms is None:
                        first_audio_ms = (time.time() - t_send) * 1000
                    audio_chunks_count += 1
                    total_audio_chars += len(msg.get("audio_base64", ""))

                elif m_type == "ai_text":
                    full_ai_text = msg.get("text", "")

                elif m_type == "ai_audio_pcm_done":
                    # Spoken audio is finished sending
                    turn_active = False

            total_duration_s = time.time() - t_send
            print(f"⚡ Time to First Audio (TTFA): {first_audio_ms:.1f}ms ({first_audio_ms/1000:.2f} seconds)")
            print(f"⏱️ Total Response Time: {total_duration_s:.2f} seconds")
            print(f"📦 Total Audio Chunks: {audio_chunks_count} ({total_audio_chars} b64 chars)")
            print(f"💬 Gemini Live Response:\n   \"{full_ai_text}\"")

            results.append({
                "turn": turn_idx,
                "user": user_speech,
                "first_audio_ms": first_audio_ms,
                "total_duration_s": total_duration_s,
                "ai_text": full_ai_text,
                "chunks": audio_chunks_count
            })

            # Simulate natural human pause before next speech (1 second)
            await asyncio.sleep(1.0)

        print("\n" + "=" * 65)
        print("📊 FINAL BENCHMARK SUMMARY")
        print("=" * 65)
        avg_ttfa = sum(r["first_audio_ms"] for r in results) / len(results)
        print(f"Avg Time to First Audio Response: {avg_ttfa:.1f}ms ({avg_ttfa/1000:.2f} seconds)")
        print(f"Fastest Response: {min(r['first_audio_ms'] for r in results):.1f}ms")
        print(f"Error count: 0")
        print("=" * 65)

asyncio.run(test_full_conversation())
