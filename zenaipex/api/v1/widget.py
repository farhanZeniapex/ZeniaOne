"""
Zenaipex AI — Public Widget API router.

GET  /api/v1/widget/config?identifier={id}
POST /api/v1/widget/chat
"""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import logging
import json
import time
from collections import defaultdict, deque

from services.channel_service import get_channel_by_public_identifier
from services.conversation_service import create_conversation, add_message, get_conversation
from ai.rag import get_rag_pipeline
from ai.llm import AgentLLMClient
from ai.language_detector import detect_language
from core.database import col_agents, col_companies, col_conversations
from bson import ObjectId

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Widget (Public)"])
_WIDGET_RATE_WINDOW_SECONDS = 60
_WIDGET_RATE_LIMIT = 20
_WIDGET_MAX_BUCKETS = 10000
_widget_requests: dict[str, deque[float]] = defaultdict(deque)


def _sse(payload: Dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


class WidgetChatRequest(BaseModel):
    identifier: str
    message: str
    history: List[Dict[str, str]] = Field(default_factory=list)  # [{"role": "user", "content": "hello"}]
    conversation_id: Optional[str] = None


def _smart_widget_metadata(message: str) -> Dict[str, Any]:
    """Return lightweight UI actions without making the LLM response format fragile."""
    text = message.lower()
    suggestions = ["What can you help me with?", "How does pricing work?", "Talk to a human"]
    action: Optional[Dict[str, str]] = None
    detected = detect_language(message, [])
    if detected.lang == "hindi":
        suggestions = ["Aap kya kar sakte ho?", "Pricing kaise kaam karti hai?", "Human se baat karein"]
    elif detected.lang == "gujarati":
        suggestions = ["Tame shu madad kari shako?", "Pricing kevi rite kaam kare che?", "Human sathe vaat karo"]

    if any(term in text for term in ("demo", "meeting", "call me", "callback", "contact")):
        action = {"type": "lead_capture", "label": "Book a demo"}
        suggestions = (["Demo book karo", "Plans vishe jaano", "Human se baat karein"]
                       if detected.lang == "hindi" else
                       ["Demo book karo", "Plans vishe jaano", "Human sathe vaat karo"]
                       if detected.lang == "gujarati" else
                       ["Book a demo", "What are the plans?", "Talk to a human"])
    elif any(term in text for term in ("human", "person", "support team", "representative")):
        action = {"type": "handoff", "label": "Human follow-up request"}
        suggestions = (["Human se baat karein", "AI se continue karein", "Demo book karo"]
                       if detected.lang == "hindi" else
                       ["Human sathe vaat karo", "AI sathe chalu rakho", "Demo book karo"]
                       if detected.lang == "gujarati" else
                       ["Request human follow-up", "Continue with AI", "Book a demo"])
    elif any(term in text for term in ("price", "pricing", "cost", "plan", "料金")):
        suggestions = (["Plans compare karo", "Demo book karo", "Free trial hai kya?"]
                       if detected.lang == "hindi" else
                       ["Plans compare karo", "Demo book karo", "Free trial che?"]
                       if detected.lang == "gujarati" else
                       ["Compare plans", "Book a demo", "Is there a free trial?"])
    elif any(term in text for term in ("voice", "call", "phone", "audio")):
        suggestions = (["Voice response kitna fast hai?", "Kaunsi languages supported hain?", "Demo book karo"]
                       if detected.lang == "hindi" else
                       ["Voice response ketlo fast che?", "Kai languages supported che?", "Demo book karo"]
                       if detected.lang == "gujarati" else
                       ["How fast is voice response?", "Which languages are supported?", "Book a demo"])
    elif any(term in text for term in ("pdf", "document", "knowledge", "upload")):
        suggestions = ["Which files can I upload?", "How does knowledge search work?", "Book a demo"]

    return {"suggestions": suggestions, "action": action}


def _widget_runtime_metadata(
    *,
    started_at: float,
    rag_used: bool,
    rag_chunks: int,
    rag_latency_ms: float,
    llm: Optional[AgentLLMClient] = None,
) -> Dict[str, Any]:
    """Expose safe operational state to the widget without secrets or internals."""
    data: Dict[str, Any] = {
        "runtime": {
            "response_time_ms": round((time.perf_counter() - started_at) * 1000),
            "knowledge_used": rag_used,
            "knowledge_chunks": rag_chunks,
            "knowledge_latency_ms": round(rag_latency_ms),
            "route": "Google Gemini → Groq fallback",
        }
    }
    if llm and llm.last_provider:
        data["runtime"].update({
            "provider_used": llm.last_provider,
            "model_used": llm.last_model,
            "fallback_used": llm.last_fallback_used,
            "provider_latency_ms": round(llm.last_provider_latency_ms),
        })
    return data


def _widget_confidence_metadata(response: str, context_docs: Optional[List[Dict[str, Any]]]) -> Dict[str, Any]:
    """Expose a conservative confidence/handoff signal to the public widget."""
    from ai.evaluation import RAGEvaluator

    docs = context_docs or []
    scores = [float(doc.get("rerank_score", doc.get("score", 0.0)) or 0.0) for doc in docs]
    validation = RAGEvaluator.validate_grounding(response, docs)
    confidence, handoff, reason = RAGEvaluator.assess_confidence(
        max_score=max(scores) if scores else 0.0,
        retrieved_count=len(docs),
        retained_count=len(docs),
        validation_result=validation,
    )
    return {
        "confidence_score": confidence,
        "handoff_recommended": handoff,
        "handoff_reason": reason,
    }


@router.post("/widget/chat/stream")
async def widget_chat_stream(req: WidgetChatRequest):
    """Stream public chat tokens from the selected agent's configured LLM."""
    if len(req.history) > 20:
        raise HTTPException(status_code=400, detail="Conversation history too long")
    if not req.message.strip() or len(req.message) > 1000:
        raise HTTPException(status_code=400, detail="Message must be between 1 and 1000 characters")

    channel = await get_channel_by_public_identifier(req.identifier)
    if not channel or channel.get("type") != "web_chat":
        raise HTTPException(status_code=404, detail="Widget not found or inactive")
    company_id = channel["company_id"]
    agent_id = channel["agent_id"]
    agent = await col_agents().find_one({
        "_id": ObjectId(agent_id),
        "company_id": company_id,
        "status": "active",
    })
    if not agent:
        raise HTTPException(status_code=404, detail="Agent unavailable")
    company = await col_companies().find_one({"_id": ObjectId(company_id)})
    if not company or not company.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account unavailable")

    conversation = None
    if req.conversation_id and ObjectId.is_valid(req.conversation_id):
        conversation = await col_conversations().find_one({
            "company_id": company_id,
            "_id": ObjectId(req.conversation_id),
            "agent_id": agent_id,
        })
    if not conversation:
        conversation = await create_conversation(
            company_id=company_id,
            agent_id=agent_id,
            channel_id=str(channel["_id"]),
            direction="inbound",
            language=agent.get("default_language", "en-IN"),
        )
    conversation_id = str(conversation["_id"])
    await add_message(company_id, conversation_id, "user", req.message)

    async def events():
        started_at = time.perf_counter()
        llm: Optional[AgentLLMClient] = None
        try:
            rag = get_rag_pipeline(company_id, agent)
            rag_used = rag.should_retrieve(req.message)
            rag_started_at = time.perf_counter()
            context_docs = await rag.retrieve(
                req.message,
                request_id=f"WIDGET-{conversation_id[-8:]}",
                parent_deadline=time.perf_counter() + 4.0,
            ) if rag_used else None
            rag_latency_ms = (time.perf_counter() - rag_started_at) * 1000 if rag_used else 0
            rag_chunks = len(context_docs or [])
            # Public visitors should never receive raw internal knowledge
            # chunks. The model may use scoped context, but source excerpts
            # belong in authenticated workspace views only.
            sources: List[str] = []
            yield _sse({
                "type": "meta",
                "conversation_id": conversation_id,
                "sources": sources,
                **_widget_runtime_metadata(
                    started_at=started_at,
                    rag_used=rag_used,
                    rag_chunks=rag_chunks,
                    rag_latency_ms=rag_latency_ms,
                ),
                **_smart_widget_metadata(req.message),
            })

            routed_agent = dict(agent)
            routed_agent["_runtime_surface"] = "text_chat"
            llm = await AgentLLMClient.create(routed_agent)
            llm.set_budget(14.0)
            parts: List[str] = []
            async for token in llm.stream(
                user_message=req.message,
                conversation_history=req.history,
                context_docs=context_docs,
                language=agent.get("default_language", "en-IN"),
                strict_completion=True,
                public_widget=True,
            ):
                if token.startswith("⚠️ Error:"):
                    raise RuntimeError("LLM provider unavailable")
                parts.append(token)
                yield _sse({"type": "delta", "text": token})

            answer = "".join(parts).strip()
            if not answer:
                raise RuntimeError("Empty LLM response")
            await add_message(company_id, conversation_id, "assistant", answer)
            yield _sse({
                "type": "done",
                **_widget_runtime_metadata(
                    started_at=started_at,
                    rag_used=rag_used,
                    rag_chunks=rag_chunks,
                    rag_latency_ms=rag_latency_ms,
                    llm=llm,
                ),
            })
        except Exception:
            logger.exception("Widget stream failed for conversation %s", conversation_id)
            yield _sse({"type": "error", "message": "The assistant could not finish this reply. Please try again."})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/widget/config")
async def get_widget_config(identifier: str):
    """
    Get the public configuration for a chat widget.
    Never exposes API keys or internal IDs, only UI settings and agent name.
    """
    channel = await get_channel_by_public_identifier(identifier)
    if not channel or channel.get("type") != "web_chat":
        raise HTTPException(status_code=404, detail="Widget not found or inactive")

    agent = await col_agents().find_one({
        "_id": ObjectId(channel["agent_id"]),
        "company_id": channel["company_id"],
        "status": "active"
    })
    if not agent:
        raise HTTPException(status_code=404, detail="Agent inactive")

    # Get company to pass the name
    company = await col_companies().find_one({"_id": ObjectId(channel["company_id"])})
    if not company or not company.get("is_active", True):
        raise HTTPException(status_code=403, detail="Your account has been suspended. Please contact the administrator for assistance.")
    
    # Extract greeting message in default language
    lang = agent.get("default_language", "en-IN")
    greeting = agent.get("greeting_messages", {}).get(lang, "Hello! How can I help you today?")
    if company:
        greeting = greeting.format(company_name=company["name"])

    return {
        "agent_name": agent["name"],
        "greeting": greeting,
        "company_name": company["name"] if company else "Company",
        "primary_color": channel.get("config", {}).get("primary_color", "#2c3e50"),
    }


@router.post("/widget/chat")
async def widget_chat(req: WidgetChatRequest, request: Request):
    """
    Process a chat message from the public widget.
    Fully tenant isolated via the public identifier.
    """
    client_ip = request.client.host if request.client else "unknown"
    rate_key = f"{client_ip}:{req.identifier}"
    now = time.monotonic()
    bucket = _widget_requests[rate_key]
    while bucket and now - bucket[0] > _WIDGET_RATE_WINDOW_SECONDS:
        bucket.popleft()
    if len(bucket) >= _WIDGET_RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Too many messages. Please try again shortly.")
    bucket.append(now)
    if len(_widget_requests) > _WIDGET_MAX_BUCKETS:
        stale_keys = sorted(_widget_requests, key=lambda key: _widget_requests[key][-1] if _widget_requests[key] else 0)[:1000]
        for stale_key in stale_keys:
            _widget_requests.pop(stale_key, None)

    if len(req.history) > 20:
        raise HTTPException(status_code=400, detail="Conversation history too long")
    message = req.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    if len(message) > 1000:
        raise HTTPException(status_code=400, detail="Message too long")

    # 1. Resolve channel & tenant
    channel = await get_channel_by_public_identifier(req.identifier)
    if not channel or channel.get("type") != "web_chat":
        raise HTTPException(status_code=404, detail="Widget not found or inactive")

    company_id = channel["company_id"]
    agent_id = channel["agent_id"]

    # 2. Load Agent
    agent = await col_agents().find_one({
        "_id": ObjectId(agent_id),
        "company_id": company_id,
        "status": "active"
    })
    if not agent:
        raise HTTPException(status_code=404, detail="Agent unavailable")

    company = await col_companies().find_one({"_id": ObjectId(company_id)})
    if not company or not company.get("is_active", True):
        raise HTTPException(status_code=403, detail="Your account has been suspended. Please contact the administrator for assistance.")

    # 3. Handle Conversation
    recent_conv = None
    if req.conversation_id and req.conversation_id != "tmp":
        if ObjectId.is_valid(req.conversation_id):
            recent_conv = await col_conversations().find_one({
                "company_id": company_id,
                "_id": ObjectId(req.conversation_id),
                "agent_id": agent_id,
            })

    if not recent_conv:
        recent_conv = await create_conversation(
            company_id=company_id,
            agent_id=agent_id,
            channel_id=str(channel["_id"]),
            direction="inbound",
            language=agent.get("default_language", "en-IN")
        )
    
    conv_id = str(recent_conv["_id"])
    
    # Store user message
    await add_message(company_id, conv_id, "user", message)

    try:
        # 4. RAG Retrieval
        started_at = time.perf_counter()
        rag = get_rag_pipeline(company_id, agent)
        context_docs = None
        # Do not disclose raw internal document excerpts to an unauthenticated
        # website visitor. Context remains available only to the LLM.
        sources: List[str] = []
        rag_used = rag.should_retrieve(req.message)
        rag_started_at = time.perf_counter()
        if rag_used:
            context_docs = await rag.retrieve(
                req.message,
                request_id=f"WIDGET-{conv_id[-8:]}",
                parent_deadline=time.perf_counter() + 4.0,
            )
        rag_latency_ms = (time.perf_counter() - rag_started_at) * 1000 if rag_used else 0
        rag_chunks = len(context_docs or [])

        # 5. LLM Call
        try:
            routed_agent = dict(agent)
            routed_agent["_runtime_surface"] = "text_chat"
            llm = await AgentLLMClient.create(routed_agent)
            llm.set_budget(14.0)
        except RuntimeError as e:
            return {"answer": str(e), "sources": [], "conversation_id": conv_id, **_widget_runtime_metadata(started_at=started_at, rag_used=rag_used, rag_chunks=rag_chunks, rag_latency_ms=rag_latency_ms), **_smart_widget_metadata(req.message)}
            
        response_text, token_usage = await llm.generate(
            user_message=message,
            conversation_history=req.history,
            context_docs=context_docs,
            language=agent.get("default_language", "en-IN"),
            public_widget=True,
        )
        
        # Store assistant message
        await add_message(company_id, conv_id, "assistant", response_text)

        return {
            "answer": response_text,
            "sources": sources,
            "conversation_id": conv_id,
            **_widget_confidence_metadata(response_text, context_docs),
            **_widget_runtime_metadata(started_at=started_at, rag_used=rag_used, rag_chunks=rag_chunks, rag_latency_ms=rag_latency_ms, llm=llm),
            **_smart_widget_metadata(req.message),
        }
    except Exception as e:
        logger.error(f"Widget chat error: {e}")
        return {
            "answer": "I’m having trouble connecting right now. Would you like to try again or talk to a human?",
            "sources": [],
            "conversation_id": conv_id,
            **_widget_runtime_metadata(started_at=started_at, rag_used=False, rag_chunks=0, rag_latency_ms=0),
            **_smart_widget_metadata(req.message),
        }
