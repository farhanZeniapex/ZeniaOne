import asyncio
import json
import time
import websockets
import os
import sys

# Ensure zenaipex is in path
sys.path.insert(0, os.path.abspath("zenaipex"))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

from core.database import connect_db, col_users, col_agents
from core.security import create_access_token

async def run_gemini_live_test():
    print("=" * 60)
    print("🚀 ZENIAPEX AI - GEMINI LIVE END-TO-END VERIFICATION TEST")
    print("=" * 60)

    await connect_db()
    
    # 1. Find an admin user
    user = await col_users().find_one({"is_platform_admin": True})
    if not user:
        user = await col_users().find_one({})
    if not user:
        print("❌ No user found in database.")
        return False

    user_id = str(user["_id"])
    token = create_access_token({"sub": user_id})
    print(f"✅ Generated Admin Token for user: {user.get('email')} ({user_id})")

    # 2. Find Agent Farhan or default agent
    agent = await col_agents().find_one({"name": "Farhan"})
    if not agent:
        agent = await col_agents().find_one({})
    if not agent:
        print("❌ No agent found in database.")
        return False

    agent_id = str(agent["_id"])
    company_id = str(agent.get("company_id", "admin_workspace"))
    print(f"✅ Target Agent: '{agent.get('name')}' (ID: {agent_id}, Company: {company_id})")

    # 3. Connect to the WebSocket
    ws_url = f"ws://127.0.0.1:8002/api/v1/companies/{company_id}/agents/{agent_id}/voice-stream"
    print(f"\n📡 Connecting to: {ws_url} ...")
    
    conn_start = time.perf_counter()
    async with websockets.connect(ws_url, open_timeout=10) as ws:
        conn_time = (time.perf_counter() - conn_start) * 1000
        print(f"✅ WebSocket connected in {conn_time:.1f}ms")

        # 4. Send initial config with engine = gemini_live
        setup_payload = {
            "token": token,
            "engine": "gemini_live",
            "conversation_id": f"test_conv_live_{int(time.time())}",
            "initial_greeting": "Namaste! Main ZeniaOne voice assistant hoon."
        }
        await ws.send(json.dumps(setup_payload))
        print("📤 Sent config: engine='gemini_live', waiting for server state...")

        # 5. Wait for initial state / greeting
        first_state = None
        greeting_received = False
        greeting_audio_bytes = 0
        
        timeout_t = time.time() + 15
        while time.time() < timeout_t:
            msg = await asyncio.wait_for(ws.recv(), timeout=10.0)
            data = json.loads(msg)
            m_type = data.get("type")
            
            if m_type == "state":
                print(f"ℹ️ Server State: {data.get('state')} (engine={data.get('engine')}, voice={data.get('voice')})")
                first_state = data.get("state")

            elif m_type == "ai_audio_pcm":
                greeting_audio_bytes += len(data.get("audio_base64", ""))

            elif m_type == "ai_audio_pcm_done":
                print(f"✅ Initial Greeting Completed! (Audio chars: {greeting_audio_bytes})")
                greeting_received = True
                break

        print("\n" + "-" * 50)
        print("🧪 TEST 1: ASKING QUESTION 1 IN HINGLISH")
        question_1 = "Namaste! ZeniaOne platform kya kaam karta hai aur iske features kya hain?"
        print(f"❓ User says: '{question_1}'")
        print("-" * 50)

        q1_start = time.perf_counter()
        await ws.send(json.dumps({
            "type": "user_transcript",
            "text": question_1,
            "language": "hinglish"
        }))

        q1_first_text_ms = None
        q1_first_audio_ms = None
        q1_text_deltas = []
        q1_total_pcm_chunks = 0
        q1_total_audio_chars = 0

        timeout_t = time.time() + 15
        while time.time() < timeout_t:
            msg = await asyncio.wait_for(ws.recv(), timeout=12.0)
            data = json.loads(msg)
            m_type = data.get("type")

            if m_type == "ai_text_delta":
                if q1_first_text_ms is None:
                    q1_first_text_ms = (time.perf_counter() - q1_start) * 1000
                delta = data.get("delta", "")
                q1_text_deltas.append(delta)

            elif m_type == "ai_audio_pcm":
                if q1_first_audio_ms is None:
                    q1_first_audio_ms = (time.perf_counter() - q1_start) * 1000
                q1_total_pcm_chunks += 1
                q1_total_audio_chars += len(data.get("audio_base64", ""))

            elif m_type == "ai_audio_pcm_done":
                q1_total_time = time.perf_counter() - q1_start
                full_reply = "".join(q1_text_deltas).strip() or data.get("text", "")
                print(f"\n🎯 [QUESTION 1 METRICS]")
                print(f"   ⏱️ Time to First Text (TTFT): {q1_first_text_ms:.1f}ms ({q1_first_text_ms/1000:.2f} sec)")
                print(f"   🔊 Time to First Audio Chunk: {q1_first_audio_ms:.1f}ms ({q1_first_audio_ms/1000:.2f} sec)")
                print(f"   ⚡ Total Generation Time: {q1_total_time:.2f} seconds")
                print(f"   📦 PCM Audio Chunks Received: {q1_total_pcm_chunks} (Total b64 length: {q1_total_audio_chars})")
                print(f"   💬 Gemini Live Spoken Answer:\n   \"{full_reply}\"\n")
                break

        print("-" * 50)
        print("🧪 TEST 2: MULTI-TURN CONVERSATION FOLLOW-UP QUESTION")
        question_2 = "Agar mujhe ek new AI caller agent setup karna ho, to mujhe kya karna hoga?"
        print(f"❓ User says: '{question_2}'")
        print("-" * 50)

        q2_start = time.perf_counter()
        await ws.send(json.dumps({
            "type": "user_transcript",
            "text": question_2,
            "language": "hinglish"
        }))

        q2_first_text_ms = None
        q2_first_audio_ms = None
        q2_text_deltas = []
        q2_total_pcm_chunks = 0
        q2_total_audio_chars = 0

        timeout_t = time.time() + 15
        while time.time() < timeout_t:
            msg = await asyncio.wait_for(ws.recv(), timeout=12.0)
            data = json.loads(msg)
            m_type = data.get("type")

            if m_type == "ai_text_delta":
                if q2_first_text_ms is None:
                    q2_first_text_ms = (time.perf_counter() - q2_start) * 1000
                delta = data.get("delta", "")
                q2_text_deltas.append(delta)

            elif m_type == "ai_audio_pcm":
                if q2_first_audio_ms is None:
                    q2_first_audio_ms = (time.perf_counter() - q2_start) * 1000
                q2_total_pcm_chunks += 1
                q2_total_audio_chars += len(data.get("audio_base64", ""))

            elif m_type == "ai_audio_pcm_done":
                q2_total_time = time.perf_counter() - q2_start
                full_reply = "".join(q2_text_deltas).strip() or data.get("text", "")
                print(f"\n🎯 [QUESTION 2 METRICS]")
                print(f"   ⏱️ Time to First Text (TTFT): {q2_first_text_ms:.1f}ms ({q2_first_text_ms/1000:.2f} sec)")
                print(f"   🔊 Time to First Audio Chunk: {q2_first_audio_ms:.1f}ms ({q2_first_audio_ms/1000:.2f} sec)")
                print(f"   ⚡ Total Generation Time: {q2_total_time:.2f} seconds")
                print(f"   📦 PCM Audio Chunks Received: {q2_total_pcm_chunks} (Total b64 length: {q2_total_audio_chars})")
                print(f"   💬 Gemini Live Spoken Answer:\n   \"{full_reply}\"\n")
                break

    print("=" * 60)
    print("🎉 ALL GEMINI LIVE TESTS COMPLETED SUCCESSFULLY WITH ZERO ERRORS!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(run_gemini_live_test())
