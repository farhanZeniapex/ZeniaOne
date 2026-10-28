"""
Zenaipex AI - Gemini Live Speech-to-Speech Engine
Bidirectional Realtime Voice streaming over WebSockets using Gemini Live API
(gemini-3.1-flash-live-preview).
"""

import os
import json
import base64
import asyncio
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from bson import ObjectId
import websockets
from services.voice_input_normalizer import normalize_voice_transcript

logger = logging.getLogger("zenaipex.gemini_live")

GEMINI_LIVE_MODEL = "gemini-3.1-flash-live-preview"
GEMINI_WS_URL_TEMPLATE = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key={api_key}"

PREBUILT_VOICES = {
    "aoede": "Aoede",     # Expressive female
    "puck": "Puck",       # Conversational male
    "charon": "Charon",   # Deep male
    "fenrir": "Fenrir",   # Confident male
    "kore": "Kore",       # Balanced female
}


def get_gemini_api_key() -> str:
    """Resolve Gemini API key from environment."""
    return os.getenv("GEMINI_API_KEY", "").strip() or os.getenv("GOOGLE_API_KEY", "").strip()


def is_gemini_live_available() -> bool:
    """Check if Gemini Live API is configured."""
    return bool(get_gemini_api_key())


async def handle_gemini_live_session(
    client_ws: Any,
    agent: Dict[str, Any],
    company_id: str,
    user_id: str,
    conversation_id: Optional[str] = None,
    initial_greeting: Optional[str] = None,
    language_mode: str = "hinglish"
):
    """
    Bridges the client WebSocket (Browser Web Audio 16kHz PCM)
    directly with Google Gemini Live WebSocket (24kHz PCM bidirectional).
    """
    api_key = get_gemini_api_key()
    if not api_key:
        logger.error("[GEMINI_LIVE] GEMINI_API_KEY not configured in environment")
        await client_ws.send_json({"type": "error", "message": "Gemini Live API key not configured."})
        return

    # 1. Resolve Voice & Persona
    agent_name = agent.get("name", "AI Assistant")
    role = agent.get("role", "customer service assistant")
    company_name = agent.get("company_name", "ZeniaOne")
    system_prompt = agent.get("system_prompt", "").strip()
    preferred_lang = agent.get("default_language", "en-IN")
    session_started_at = datetime.now(timezone.utc)

    language_instructions = {
        "hinglish": "Reply in natural Hinglish and mirror the user's script: use Devanagari when the user speaks Hindi in Devanagari, and use Roman/Latin when the user writes or speaks Roman Hindi. If the user clearly switches to Gujarati or English, switch immediately and keep the same language until the user changes again.",
        "hindi": "Reply in natural Hindi. Use Devanagari when the user speaks Hindi in Devanagari, otherwise use clear Roman Hindi. Switch immediately if the user changes language.",
        "gujarati": "Reply in natural Gujarati using Gujarati script. Switch immediately if the user changes language.",
        "english": "Reply in clear natural English. Switch immediately if the user changes language.",
    }
    active_language_instruction = language_instructions.get(str(language_mode).lower(), language_instructions["hinglish"])

    # Pick best prebuilt voice according to agent preference or gender
    configured_voice = (agent.get("gemini_voice") or agent.get("live_voice") or "").lower()
    selected_voice = PREBUILT_VOICES.get(configured_voice)
    if not selected_voice:
        # Check gender or name
        is_female = any(w in agent_name.lower() for w in ["ritu", "priya", "pooja", "neha", "aarti", "kavita", "shreya"])
        selected_voice = "Aoede" if is_female else "Puck"

    instruction_text = (
        f"You are {agent_name}, a helpful and polite {role} at {company_name}. "
        f"{active_language_instruction} "
        "The company/product brand name is exactly ZeniaOne. Always pronounce and write it as ZeniaOne; never say or write ZeniaAI, Zenia AI, Zenia One, or any other variant. "
        "Keep your spoken answers concise, clear, and conversational (typically 1-3 sentences) suitable for a real-time voice call. "
        "If the user says bye, goodbye, or thank you and bye, reply with a short goodbye and do not repeat the previous answer. "
        "If the user starts speaking while you are answering, stop your current answer immediately and listen to the user. Never continue talking over the user. "
        "Do not interpret ambiguous phrases such as 'porque vai', 'por que vai', 'okay', or 'good' as a goodbye. Only end the conversation when the user clearly says bye, goodbye, alvida, or an equivalent farewell. "
        "Avoid reading out raw bullet points, symbols, URLs, or markdown stars. "
        "Answer the user's exact question first and stay tightly on the requested topic. "
        "Do not volunteer unrelated products, features, company facts, or suggested questions. "
        "If the user asks what ZeniaOne is, explain ZeniaOne itself in 2-4 clear sentences before mentioning any product. "
        "If the user asks how to use it, explain a short practical workflow; if they ask when to use it, explain the relevant use cases. "
        "If a name or phrase is unclear because of speech recognition, ask one short clarification instead of guessing or changing the topic. "
        "If the user pauses after an incomplete phrase or asks only part of a question, do not stay silent: ask one short clarification, such as 'Aap ZeniaOne mein kya jaana chahte hain?' "
        "When the user corrects you, acknowledge the correction and answer only the corrected request."
    )
    instruction_text += (
        "\nAUTHORITATIVE PRODUCT CATALOG (use only when the user explicitly asks about products, offerings, or the product list): "
        "ZeniaPex has exactly 4 products: "
        "ZeniaHR (workforce and payroll), Zenia Fleets (fleet and transport operations), "
        "Tender Guruji (government tender and procurement intelligence), and "
        "Zenia Chat (WhatsApp-first multilingual customer-support AI). "
        "Do not list these products when the user is asking about ZeniaOne generally unless they ask for examples or products. "
        "When explicitly asked for the total number or names of products, answer these four directly."
    )
    instruction_text += (
        "\nAUTHORITATIVE ZENIAONE PRODUCT FACTS: ZeniaOne itself is an enterprise AI Voice and Chat Agents platform, "
        "not an HR, payroll, fleet, or tender product. Its core capabilities include creating custom AI agents; "
        "connecting company documents and FAQs through a Knowledge Base/RAG search; handling browser voice and web-chat/widget conversations; "
        "receiving inbound phone calls and placing outbound calls through configured telephony channels such as Twilio, Exotel, or EnableX; "
        "using multilingual speech and text; using built-in or cloned voices where the selected runtime supports them; "
        "saving conversation history and transcripts; and showing call, AI usage, provider, token, cost, and reliability analytics. "
        "When asked whether ZeniaOne supports an automatic AI calling system, answer yes: an AI agent can speak with callers on inbound or outbound calls "
        "after a telephony channel and agent are configured. Explain that exact availability depends on the configured channel/provider. "
        "Do not deny voice calling, telephony, AI agents, Knowledge Base, cloned voice, or web chat as ZeniaOne capabilities. "
        "Answer the requested ZeniaOne capability directly before giving examples."
    )
    if system_prompt:
        instruction_text += f"\nSpecific Instructions:\n{system_prompt}"

    gemini_url = GEMINI_WS_URL_TEMPLATE.format(api_key=api_key)
    logger.info(f"[GEMINI_LIVE_CONNECT] Connecting to Live API (model={GEMINI_LIVE_MODEL}, voice={selected_voice})")

    try:
        async with websockets.connect(gemini_url, ping_interval=20, ping_timeout=15) as gemini_ws:
            # Admin My AI needs verified live answers while keeping Gemini's
            # native audio. The tool returns data from the same deterministic
            # copilot router used by the text admin chat; customer agents do
            # not receive this tool and therefore cannot access admin data.
            is_admin_copilot = (
                "internal ai" in system_prompt.lower()
                or "platform super admin" in system_prompt.lower()
                or agent.get("name") == "Farhan"
            )
            if is_admin_copilot:
                instruction_text += (
                    "\nLIVE ADMIN DATA RULE: For any question about calls, chats, conversations, caller numbers, "
                    "usage, tokens, costs, providers, models, documents, activity, or call transcripts, "
                    "you MUST call get_verified_admin_data first and answer only from its result. "
                    "Never say that the data is unavailable before using the tool, and never invent a number."
                )
            # 2. Send Setup Message
            setup_payload = {
                "setup": {
                    "model": f"models/{GEMINI_LIVE_MODEL}",
                    "generationConfig": {
                        "responseModalities": ["AUDIO"],
                        "speechConfig": {
                            "voiceConfig": {
                                "prebuiltVoiceConfig": {
                                    "voiceName": selected_voice
                                }
                            }
                        }
                    },
                    "realtimeInputConfig": {
                        "automaticActivityDetection": {
                            "disabled": False,
                            "startOfSpeechSensitivity": "START_SENSITIVITY_HIGH",
                            "endOfSpeechSensitivity": "END_SENSITIVITY_LOW",
                            "prefixPaddingMs": 80,
                            "silenceDurationMs": 700
                        },
                        "activityHandling": "START_OF_ACTIVITY_INTERRUPTS"
                    },
                    "inputAudioTranscription": {},
                    "outputAudioTranscription": {},
                    "systemInstruction": {
                        "parts": [{"text": instruction_text}]
                    }
                }
            }
            if is_admin_copilot:
                setup_payload["setup"]["tools"] = [{
                    "functionDeclarations": [{
                        "name": "get_verified_admin_data",
                        "description": (
                            "Use this for live platform questions about calls, chats, conversations, "
                            "caller numbers, usage, tokens, costs, providers, models, documents, "
                            "recent activity, or the latest call. It queries verified platform history."
                        ),
                        "parameters": {
                            "type": "OBJECT",
                            "properties": {
                                "question": {
                                    "type": "STRING",
                                    "description": "The user's complete question, preserving the user's wording and time period."
                                }
                            },
                            "required": ["question"]
                        }
                    }]
                }]
            await gemini_ws.send(json.dumps(setup_payload))
            setup_ack = await asyncio.wait_for(gemini_ws.recv(), timeout=10.0)
            logger.info(f"[GEMINI_LIVE_SETUP_ACK] Received: {setup_ack[:120] if isinstance(setup_ack, str) else setup_ack}")

            # Notify frontend that Gemini Live is connected & active
            await client_ws.send_json({
                "type": "state",
                "state": "listening",
                "engine": "gemini_live",
                "voice": selected_voice
            })

            # 3. Handle Initial Greeting if specified
            if initial_greeting:
                greeting_text = initial_greeting.strip()
                logger.info(f"[GEMINI_LIVE_GREETING] Sending initial greeting prompt: {greeting_text}")
                turn_msg = {
                    "clientContent": {
                        "turns": [{
                            "role": "user",
                            "parts": [{"text": f"Please greet the user now by saying: {greeting_text}"}]
                        }],
                        "turnComplete": True
                    }
                }
                await gemini_ws.send(json.dumps(turn_msg))

            # Shared turn tracking
            accumulated_ai_text = []
            current_user_transcript = []
            db_save_lock = asyncio.Lock()

            async def _persist_turn(user_t: str, ai_t: str):
                if not conversation_id or not (user_t.strip() or ai_t.strip()):
                    return
                try:
                    async with db_save_lock:
                        from core.database import col_messages, col_conversations
                        now = datetime.now(timezone.utc)
                        docs = []
                        if user_t.strip():
                            docs.append({
                                "company_id": company_id,
                                "conversation_id": conversation_id,
                                "role": "user",
                                "content": user_t.strip(),
                                "source": "gemini_live",
                                "timestamp": now
                            })
                        if ai_t.strip():
                            docs.append({
                                "company_id": company_id,
                                "conversation_id": conversation_id,
                                "role": "assistant",
                                "content": ai_t.strip(),
                                "source": "gemini_live",
                                "timestamp": now
                            })
                        if docs:
                            await col_messages().insert_many(docs)
                            if conversation_id and ObjectId.is_valid(str(conversation_id)):
                                message_filter = {"conversation_id": str(conversation_id)}
                                message_count = await col_messages().count_documents(message_filter)
                                user_turn_count = await col_messages().count_documents({
                                    **message_filter,
                                    "role": "user",
                                    "content": {"$not": {"$regex": r"^__GREETING__:"}},
                                })
                                await col_conversations().update_one(
                                    {"_id": ObjectId(str(conversation_id)), "company_id": company_id},
                                    {"$set": {
                                        "source_type": "voice_chat",
                                        "direction": "voice_chat",
                                        "title": (user_t.strip()[:80] if user_t.strip() else "Voice Chat"),
                                        "message_count": message_count,
                                        "turn_count": user_turn_count,
                                    }},
                                )
                            logger.info(f"[GEMINI_LIVE_SAVED] Saved conversation turns to MongoDB conv={conversation_id}")
                except Exception as save_err:
                    logger.warning(f"[GEMINI_LIVE_SAVE_WARN] {save_err}")

            # 4. Gemini -> Client Receiver Loop
            async def gemini_to_client_loop():
                nonlocal accumulated_ai_text, current_user_transcript
                try:
                    while True:
                        msg = await gemini_ws.recv()
                        data = json.loads(msg)
                        sc = data.get("serverContent", {})

                        # Gemini Live function calling for verified admin data.
                        # Return the answer as tool output; Gemini then speaks
                        # the grounded result using its native voice.
                        tool_call = data.get("toolCall") or sc.get("toolCall")
                        if tool_call and is_admin_copilot:
                            function_responses = []
                            for call in tool_call.get("functionCalls", []):
                                if call.get("name") != "get_verified_admin_data":
                                    continue
                                args = call.get("args") or {}
                                question = str(args.get("question") or "").strip()
                                if not question:
                                    question = "".join(current_user_transcript).strip()
                                from services.voice_input_normalizer import normalize_voice_transcript
                                question = normalize_voice_transcript(question)
                                try:
                                    from api.v1.admin.copilot import answer_admin_voice_question
                                    admin_agent_id = str(agent.get("_id") or agent.get("id") or "")
                                    verified_answer, _sources = await answer_admin_voice_question(
                                        question,
                                        admin_agent_id=admin_agent_id,
                                    )
                                    logger.info(
                                        "[GEMINI_LIVE_ADMIN_TOOL] question=%r sources=%s",
                                        question[:160], len(_sources),
                                    )
                                    function_responses.append({
                                        "id": call.get("id"),
                                        "name": call.get("name"),
                                        "response": {"result": verified_answer},
                                    })
                                except Exception as tool_err:
                                    logger.exception("[GEMINI_LIVE_ADMIN_TOOL_ERROR] %s", tool_err)
                                    function_responses.append({
                                        "id": call.get("id"),
                                        "name": call.get("name"),
                                        "response": {"error": "Verified admin data is temporarily unavailable."},
                                    })
                            if function_responses:
                                await gemini_ws.send(json.dumps({
                                    "toolResponse": {"functionResponses": function_responses}
                                }))
                            continue

                        # 4.1 Barge-in / Interruption handling
                        if sc.get("interrupted"):
                            logger.info("[GEMINI_LIVE_INTERRUPTED] User interrupted AI speech")
                            accumulated_ai_text.clear()
                            await client_ws.send_json({"type": "interrupted"})
                            await client_ws.send_json({"type": "state", "state": "listening"})
                            continue

                        # 4.2 User audio transcription (Real-time Speech-to-Text)
                        if "inputTranscription" in sc:
                            it_text = sc["inputTranscription"].get("text", "")
                            if it_text:
                                current_user_transcript.append(it_text)
                                display_transcript = normalize_voice_transcript("".join(current_user_transcript))
                                await client_ws.send_json({
                                    "type": "transcript",
                                    "text": display_transcript,
                                    "is_final": False
                                })

                        # 4.3 AI Output transcription (Subtitle streaming)
                        if "outputTranscription" in sc:
                            ot_text = sc["outputTranscription"].get("text", "")
                            if ot_text:
                                accumulated_ai_text.append(ot_text)
                                await client_ws.send_json({
                                    "type": "ai_text_delta",
                                    "delta": ot_text
                                })

                        # 4.4 Model Turn (PCM Audio 24kHz stream)
                        model_turn = sc.get("modelTurn", {})
                        parts = model_turn.get("parts", [])
                        for p in parts:
                            if "inlineData" in p:
                                audio_b64 = p["inlineData"].get("data", "")
                                if audio_b64:
                                    await client_ws.send_json({
                                        "type": "ai_audio_pcm",
                                        "audio_base64": audio_b64
                                    })
                                    await client_ws.send_json({"type": "state", "state": "speaking"})

                        # 4.5 Turn Completion
                        if sc.get("turnComplete"):
                            full_ai = "".join(accumulated_ai_text).strip()
                            full_user = normalize_voice_transcript("".join(current_user_transcript))
                            logger.info(f"[GEMINI_LIVE_TURN_COMPLETE] AI response: '{full_ai[:80]}'")

                            # Publish the final user transcript separately.
                            # Interim STT text is only a live preview and must
                            # not be the only transcript state in the UI.
                            if full_user:
                                await client_ws.send_json({
                                    "type": "transcript",
                                    "text": full_user,
                                    "is_final": True,
                                })
                            
                            await client_ws.send_json({
                                "type": "ai_text",
                                "text": full_ai,
                                "conversation_id": conversation_id,
                                "user_message": full_user
                            })
                            await client_ws.send_json({"type": "ai_audio_pcm_done", "text": full_ai})
                            await client_ws.send_json({"type": "state", "state": "listening"})

                            # Async persist in background
                            asyncio.create_task(_persist_turn(full_user, full_ai))

                            accumulated_ai_text.clear()
                            current_user_transcript.clear()

                except asyncio.CancelledError:
                    pass
                except Exception as loop_err:
                    logger.error(f"[GEMINI_LIVE_RECV_ERR] {loop_err}")
                    try:
                        await client_ws.send_json({
                            "type": "error",
                            "code": "gemini_live_receive_failed",
                            "message": "Gemini Live audio connection failed. Please start a new voice session."
                        })
                        await client_ws.send_json({"type": "state", "state": "error"})
                    except Exception:
                        pass

            # 5. Client -> Gemini Forwarder Loop
            async def client_to_gemini_loop():
                try:
                    while True:
                        msg = await client_ws.receive()
                        if msg["type"] == "websocket.disconnect":
                            logger.info("[GEMINI_LIVE_CLIENT_DISCONNECT] Client WebSocket disconnected")
                            break

                        # Binary audio from client mic (PCM 16kHz)
                        if "bytes" in msg and msg["bytes"]:
                            raw_pcm = msg["bytes"]
                            realtime_chunk = {
                                "realtimeInput": {
                                    "audio": {
                                        "mimeType": "audio/pcm;rate=16000",
                                        "data": base64.b64encode(raw_pcm).decode("ascii")
                                    }
                                }
                            }
                            await gemini_ws.send(json.dumps(realtime_chunk))

                        # Text message from client
                        elif "text" in msg and msg["text"]:
                            try:
                                payload = json.loads(msg["text"])
                                p_type = payload.get("type")

                                if p_type == "user_transcript":
                                    user_t = payload.get("text", "").strip()
                                    if user_t:
                                        logger.info(f"[GEMINI_LIVE_CLIENT_TEXT] User sent text turn: {user_t}")
                                        await client_ws.send_json({"type": "state", "state": "processing"})
                                        turn_msg = {
                                            "clientContent": {
                                                "turns": [{
                                                    "role": "user",
                                                    "parts": [{"text": user_t}]
                                                }],
                                                "turnComplete": True
                                            }
                                        }
                                        await gemini_ws.send(json.dumps(turn_msg))

                                elif p_type == "audio_stream_end":
                                    # Optional client silence notice
                                    pass

                            except json.JSONDecodeError:
                                pass

                except asyncio.CancelledError:
                    pass
                except Exception as client_err:
                    logger.error(f"[GEMINI_LIVE_CLIENT_ERR] {client_err}")
                    try:
                        await client_ws.send_json({
                            "type": "error",
                            "code": "gemini_live_send_failed",
                            "message": "Gemini Live could not receive microphone audio. Please start a new voice session."
                        })
                        await client_ws.send_json({"type": "state", "state": "error"})
                    except Exception:
                        pass

            # Run both loops concurrently
            consumer_task = asyncio.create_task(gemini_to_client_loop())
            producer_task = asyncio.create_task(client_to_gemini_loop())

            done, pending = await asyncio.wait(
                [consumer_task, producer_task],
                return_when=asyncio.FIRST_COMPLETED
            )
            for t in pending:
                t.cancel()

            # Close the browser voice session as a completed Voice Chat record
            # and persist its real elapsed duration for admin history/analytics.
            if conversation_id and ObjectId.is_valid(str(conversation_id)):
                ended_at = datetime.now(timezone.utc)
                duration_seconds = max(0, int((ended_at - session_started_at).total_seconds()))
                from core.database import col_conversations
                await col_conversations().update_one(
                    {"_id": ObjectId(str(conversation_id)), "company_id": company_id},
                    {"$set": {
                        "source_type": "voice_chat",
                        "direction": "voice_chat",
                        "status": "completed",
                        "ended_at": ended_at,
                        "duration_seconds": duration_seconds,
                    }},
                )

    except Exception as e:
        # Keep provider credentials, URLs, and internal exception text out of
        # the browser. The detailed reason remains in server logs for repair.
        logger.exception("[GEMINI_LIVE_SESSION_ERR] Error during Live session: %s", type(e).__name__)
        try:
            await client_ws.send_json({
                "type": "error",
                "code": "voice_provider_unavailable",
                "message": "Voice service temporarily unavailable. Please retry the voice session.",
            })
        except Exception:
            pass
