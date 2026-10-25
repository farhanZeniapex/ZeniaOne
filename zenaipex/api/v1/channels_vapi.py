import logging
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from core.database import col_conversations
from services.conversation_service import create_conversation, end_conversation, add_message

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Vapi Webhook"])

@router.post("/webhook/vapi")
@router.get("/webhook/vapi")
async def vapi_server_webhook(request: Request):
    """
    Handle Vapi assistant serverUrl events:
    Logs live calls, messages, transcripts, and end-of-call reports into ZeniaOne database.
    """
    try:
        data = await request.json()
    except Exception:
        return JSONResponse(content={"status": "ok"})

    msg = data.get("message", {})
    msg_type = msg.get("type", "")
    call = msg.get("call", {}) or data.get("call", {})
    call_id = call.get("id") or msg.get("callId", "")
    caller = call.get("customer", {}).get("number", "Unknown")
    phone_number = call.get("phoneNumber", {}).get("number", "+13233068091")

    logger.info(f"🎙️ [VAPI] Event received: {msg_type} (Call ID: {call_id})")

    if msg_type == "status-update":
        status = msg.get("status")
        if status == "in-progress":
            await create_conversation(
                company_id="6a990b403e9b17bef89acf87",
                agent_id="6a990b403e9b17bef89acf8b",
                call_sid=call_id,
                caller_phone=caller,
                caller_to=phone_number,
                direction="inbound"
            )
        elif status == "ended":
            await end_conversation(call_sid=call_id, status="completed")

    elif msg_type == "transcript":
        role = msg.get("role", "user")
        transcript = msg.get("transcript", "")
        if transcript:
            await add_message(
                company_id="6a990b403e9b17bef89acf87",
                conversation_id=None,
                role=role,
                content=transcript,
                call_sid=call_id
            )

    elif msg_type == "end-of-call-report":
        await end_conversation(call_sid=call_id, status="completed")

    return JSONResponse(content={"status": "received"})
