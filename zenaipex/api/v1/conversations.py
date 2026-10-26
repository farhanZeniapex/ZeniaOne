"""
Zenaipex AI — Conversations API router.

GET /api/v1/companies/{id}/conversations              List conversations
GET /api/v1/companies/{id}/conversations/{cid}        Get conversation
GET /api/v1/companies/{id}/conversations/{cid}/messages  Get transcript
GET /api/v1/companies/{id}/usage                      Get usage summary
"""
from fastapi import APIRouter, Depends, Path, Query, HTTPException
from typing import Optional

from core.dependencies import get_auth_context, AuthContext
from core.exceptions import NotFoundError, InsufficientPermissionsError
from services import conversation_service
from services.channel_service import get_channel
from pydantic import BaseModel
import time
from ai.rag import get_rag_pipeline
from ai.llm import AgentLLMClient
from core.database import col_agents, col_companies
from bson import ObjectId

class ChatRequest(BaseModel):
    message: str
from services.usage_service import get_usage_summary

router = APIRouter(tags=["Conversations & Usage"])


def _fmt_conv(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "company_id": doc["company_id"],
        "agent_id": doc.get("agent_id"),
        "caller_phone": doc.get("caller_phone"),
        "direction": doc.get("direction", "inbound"),
        "language": doc.get("language", "en-IN"),
        "status": doc.get("status", "completed"),
        "started_at": doc.get("started_at"),
        "ended_at": doc.get("ended_at"),
        "duration_seconds": doc.get("duration_seconds", 0),
        "turn_count": doc.get("turn_count", 0),
        "booking_confirmed": doc.get("booking_confirmed", False),
        "is_pinned": doc.get("is_pinned", False),
        "appointment_data": doc.get("appointment_data"),
        "call_sid": doc.get("call_sid"),
        "recording_url": doc.get("recording_url"),
        "recording_sid": doc.get("recording_sid"),
        "caller_to": doc.get("caller_to"),
        "title": doc.get("title"),
        "last_message": doc.get("last_message"),
    }


def _fmt_msg(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "conversation_id": doc["conversation_id"],
        "role": doc.get("role", "user"),
        "text": doc.get("text") or doc.get("content", ""),
        "language": doc.get("language"),
        "timestamp": doc.get("timestamp"),
    }


@router.get(
    "/companies/{company_id}/conversations",
    summary="List conversations",
)
async def list_conversations(
    company_id: str = Path(...),
    agent_id: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    is_archived: Optional[bool] = Query(default=False),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, le=200),
    ctx: AuthContext = Depends(get_auth_context),
):
    """
    List call conversations for the company, newest first.
    Optional filters: agent_id, status (active/completed/failed), is_archived.
    """
    convs = await conversation_service.list_conversations(
        company_id=company_id,
        agent_id=agent_id,
        status=status,
        is_archived=is_archived,
        skip=skip,
        limit=limit,
    )
    
    formatted_convs = []
    from core.database import col_messages

    # Do not issue three MongoDB queries per conversation. Chat History asks
    # for up to 150 rows; the old N+1 loop could therefore make 450 serial
    # round trips and leave the page loading for minutes on Render. Fetch the
    # message metadata in two bounded aggregations instead.
    conversation_ids = [str(c["_id"]) for c in convs]
    message_stats: dict[str, dict] = {}
    first_user_messages: dict[str, dict] = {}
    if conversation_ids:
        stats_cursor = col_messages().aggregate([
            {"$match": {
                "company_id": company_id,
                "conversation_id": {"$in": conversation_ids},
            }},
            {"$sort": {"timestamp": 1}},
            {"$group": {
                "_id": "$conversation_id",
                "count": {"$sum": 1},
                "first": {"$first": "$timestamp"},
                "last": {"$last": "$timestamp"},
                "last_text": {"$last": {"$ifNull": ["$text", {"$ifNull": ["$content", ""]}]}},
            }},
        ])
        async for row in stats_cursor:
            message_stats[str(row["_id"])] = row

        first_user_cursor = col_messages().aggregate([
            {"$match": {
                "company_id": company_id,
                "conversation_id": {"$in": conversation_ids},
                "role": "user",
            }},
            {"$sort": {"timestamp": 1}},
            {"$group": {
                "_id": "$conversation_id",
                "text": {"$first": {"$ifNull": ["$text", {"$ifNull": ["$content", ""]}]}},
            }},
        ])
        async for row in first_user_cursor:
            first_user_messages[str(row["_id"])] = row

    for c in convs:
        conversation_id = str(c["_id"])
        fmt = _fmt_conv(c)
        stats = message_stats.get(conversation_id, {})
        first_msg = first_user_messages.get(conversation_id)
        fmt["message_count"] = int(stats.get("count", 0) or 0)
        if stats.get("first"):
            fmt["first_message_at"] = stats["first"]
        if stats.get("last"):
            fmt["last_message_at"] = stats["last"]

        if fmt["direction"] == "test-chat" or fmt["direction"] == "inbound":
            # Use existing title when available, otherwise use the first user message.
            fmt["title"] = c.get("title") or (first_msg or {}).get("text") or "New Chat"
            fmt["last_message"] = stats.get("last_text", "") or ""

        formatted_convs.append(fmt)

    return {"conversations": formatted_convs, "count": len(convs)}


@router.get(
    "/companies/{company_id}/conversations/{conv_id}",
    summary="Get conversation details",
)
async def get_conversation(
    company_id: str = Path(...),
    conv_id: str = Path(...),
    ctx: AuthContext = Depends(get_auth_context),
):
    """Get metadata for a single conversation."""
    conv = await conversation_service.get_conversation(company_id, conv_id)
    if not conv:
        raise NotFoundError("Conversation")
    return _fmt_conv(conv)


@router.get(
    "/companies/{company_id}/conversations/{conv_id}/messages",
    summary="Get conversation transcript",
)
async def get_messages(
    company_id: str = Path(...),
    conv_id: str = Path(...),
    ctx: AuthContext = Depends(get_auth_context),
):
    """Get the full transcript (turn-by-turn messages) for a conversation."""
    # Verify conversation belongs to company
    conv = await conversation_service.get_conversation(company_id, conv_id)
    if not conv:
        raise NotFoundError("Conversation")

    messages = await conversation_service.get_conversation_messages(company_id, conv_id)
    return {
        "conversation_id": conv_id,
        "messages": [_fmt_msg(m) for m in messages],
        "count": len(messages),
    }


# ── POST Routes for Dashboard Chat ──────────────────────────────────────────────

@router.post(
    "/companies/{company_id}/channels/{channel_id}/conversations",
    summary="Create a new conversation for a channel",
)
async def create_new_conversation(
    company_id: str = Path(...),
    channel_id: str = Path(...),
    ctx: AuthContext = Depends(get_auth_context),
):
    if not ctx.is_member:
        raise InsufficientPermissionsError("Must be a team member")
        
    channel = await get_channel(company_id, channel_id)
    if not channel:
        raise NotFoundError("Channel")
        
    agent = await col_agents().find_one({"_id": ObjectId(channel["agent_id"]), "company_id": company_id})
    if not agent:
        raise NotFoundError("Agent")
        
    conv = await conversation_service.create_conversation(
        company_id=company_id,
        agent_id=channel["agent_id"],
        channel_id=channel_id,
        direction="inbound", # or web-chat
        language=agent.get("default_language", "en-IN")
    )
    return _fmt_conv(conv)


@router.post(
    "/companies/{company_id}/conversations/{conv_id}/chat",
    summary="Send a chat message",
)
async def chat_in_conversation(
    req: ChatRequest,
    company_id: str = Path(...),
    conv_id: str = Path(...),
    ctx: AuthContext = Depends(get_auth_context),
):
    if not ctx.is_member:
        raise InsufficientPermissionsError("Must be a team member")
        
    from bson import ObjectId
    if not ObjectId.is_valid(conv_id):
        raise NotFoundError("Conversation")
        
    conv = await conversation_service.get_conversation(company_id, conv_id)
    if not conv:
        raise NotFoundError("Conversation")
        
    agent = await col_agents().find_one({"_id": ObjectId(conv["agent_id"]), "company_id": company_id})
    if not agent:
        raise NotFoundError("Agent")
        
    company = await col_companies().find_one({"_id": ObjectId(company_id)})
    
    messages = await conversation_service.get_conversation_messages(company_id, conv_id)
    history = [{"role": m["role"], "content": m.get("text", "")} for m in messages]
    
    # ALWAYS Save user msg first
    await conversation_service.add_message(company_id, conv_id, "user", req.message)
    
    context_docs = None
    sources = []
    from ai.language_detector import detect_language as _detect_lang
    _lang_result = _detect_lang(req.message, history)
    
    from ai.fast_path import check_deterministic_fast_path, build_smart_missing_answer
    fast_response = check_deterministic_fast_path(
        message=req.message,
        company=company,
        agent=agent,
        detected_lang=_lang_result.lang,
        detected_script=_lang_result.script
    )
    
    if fast_response:
        response_text = fast_response
        await conversation_service.add_message(company_id, conv_id, "assistant", response_text)
        return {"answer": response_text, "sources": []}
    
    try:
        rag = get_rag_pipeline(company_id, agent)
        if rag.should_retrieve(req.message):
            context_docs = await rag.retrieve(req.message)
            sources = [doc["text"][:100] + "..." for doc in context_docs]
            
        # Do not spend an LLM call on an unanswered question when retrieval has
        # no evidence. Return a contextual, grounded next step instead of the
        # old generic "Suggested questions" message.
        if rag.should_retrieve(req.message) and not context_docs:
            response_text = build_smart_missing_answer(
                message=req.message,
                company=company,
                detected_lang=_lang_result.lang,
                detected_script=_lang_result.script,
            )
        else:
            llm = await AgentLLMClient.create(agent)
            response_text, _ = await llm.generate(
                user_message=req.message,
                conversation_history=history,
                context_docs=context_docs,
                language=agent.get("default_language", "en-IN"),
                current_date=time.strftime("%A, %B %d, %Y"),
                company_name=company["name"] if company else "Company"
            )
        if not response_text:
            response_text = "⚠️ Error: All providers unavailable"
            
        await conversation_service.add_message(company_id, conv_id, "assistant", response_text)
    except Exception as e:
        # Catch ANY error (Pinecone, OpenAI, Timeout) and return 500 cleanly 
        # so frontend knows it failed but the user message is saved.
        import logging
        logging.error(f"AI Generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
    return {
        "answer": response_text,
        "sources": sources
    }

# ── Conversation Management ─────────────────────────────────────────────────────

@router.post(
    "/companies/{company_id}/conversations/{conv_id}/archive",
    summary="Archive a conversation",
)
async def archive_conversation(
    company_id: str = Path(...),
    conv_id: str = Path(...),
    ctx: AuthContext = Depends(get_auth_context),
):
    """Mark a conversation as archived."""
    success = await conversation_service.archive_conversation(company_id, conv_id)
    if not success:
        raise NotFoundError("Conversation")
    return {"success": True}


@router.post(
    "/companies/{company_id}/conversations/{conv_id}/restore",
    summary="Restore an archived conversation",
)
async def restore_conversation(
    company_id: str = Path(...),
    conv_id: str = Path(...),
    ctx: AuthContext = Depends(get_auth_context),
):
    """Restore a conversation from the archive."""
    success = await conversation_service.restore_conversation(company_id, conv_id)
    if not success:
        raise NotFoundError("Conversation")
    return {"success": True}


@router.delete(
    "/companies/{company_id}/conversations/{conv_id}",
    summary="Delete a conversation",
)
async def delete_conversation(
    company_id: str = Path(...),
    conv_id: str = Path(...),
    ctx: AuthContext = Depends(get_auth_context),
):
    """Hard delete a conversation and its messages."""
    success = await conversation_service.delete_conversation(company_id, conv_id)
    if not success:
        raise NotFoundError("Conversation")
    return {"success": True}

@router.post(
    "/companies/{company_id}/conversations/{conv_id}/pin",
    summary="Pin a conversation",
)
async def pin_conversation(
    company_id: str = Path(...),
    conv_id: str = Path(...),
    ctx: AuthContext = Depends(get_auth_context),
):
    """Pin a conversation."""
    success = await conversation_service.pin_conversation(company_id, conv_id)
    if not success:
        raise NotFoundError("Conversation")
    return {"success": True}

@router.post(
    "/companies/{company_id}/conversations/{conv_id}/unpin",
    summary="Unpin a conversation",
)
async def unpin_conversation(
    company_id: str = Path(...),
    conv_id: str = Path(...),
    ctx: AuthContext = Depends(get_auth_context),
):
    """Unpin a conversation."""
    success = await conversation_service.unpin_conversation(company_id, conv_id)
    if not success:
        raise NotFoundError("Conversation")
    return {"success": True}

class BulkIdsRequest(BaseModel):
    conversation_ids: list[str]

@router.post(
    "/companies/{company_id}/conversations/bulk-archive",
    summary="Archive multiple conversations",
)
async def bulk_archive(
    req: BulkIdsRequest,
    company_id: str = Path(...),
    ctx: AuthContext = Depends(get_auth_context),
):
    """Archive multiple conversations."""
    count = await conversation_service.bulk_archive_conversations(company_id, req.conversation_ids)
    return {"success": True, "count": count}

@router.post(
    "/companies/{company_id}/conversations/bulk-delete",
    summary="Delete multiple conversations",
)
async def bulk_delete(
    req: BulkIdsRequest,
    company_id: str = Path(...),
    ctx: AuthContext = Depends(get_auth_context),
):
    """Delete multiple conversations."""
    count = await conversation_service.bulk_delete_conversations(company_id, req.conversation_ids)
    return {"success": True, "count": count}

# ── Usage ─────────────────────────────────────────────────────────────────────

@router.get(
    "/companies/{company_id}/usage",
    summary="Get usage summary",
)
async def get_usage(
    company_id: str = Path(...),
    ctx: AuthContext = Depends(get_auth_context),
):
    """
    Get current month's usage statistics and plan limits.
    Used by the dashboard to render progress bars and alerts.
    """
    return await get_usage_summary(company_id)
