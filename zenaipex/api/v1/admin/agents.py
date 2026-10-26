from fastapi import APIRouter, HTTPException, Depends, Query
from core.database import col_agents, col_companies, col_knowledge_bases
from bson import ObjectId
from pydantic import BaseModel, Field
from typing import Optional

router = APIRouter(prefix="/agents")

class AdminVoiceUpdateRequest(BaseModel):
    tts_voice: str

class AdminVoicePreviewRequest(BaseModel):
    voice: str
    text: Optional[str] = None
    language: Optional[str] = "en-IN"
    speed: Optional[float] = None
    volume: Optional[float] = None
    agent_id: Optional[str] = None

def _fmt_agent(doc: dict, company_name: str = "Unknown Company", company_logo_url: str = None) -> dict:
    return {
        "id": str(doc["_id"]),
        "company_id": str(doc.get("company_id", "")),
        "company_name": company_name,
        "company_logo_url": company_logo_url,
        "name": doc.get("name", "Untitled Agent"),
        "description": doc.get("description", ""),
        "tts_voice": doc.get("tts_voice") or "ritu",
        "voice_engine": doc.get("voice_engine") or "pipeline",
        "voice_speed": doc.get("voice_speed", 1.15),
        "voice_volume": doc.get("voice_volume", 1.35),
        "voice_clarity": doc.get("voice_clarity", 94),
        "voice_stability": doc.get("voice_stability", 85),
        "default_language": doc.get("default_language", "en-IN"),
        "status": doc.get("status", "draft"),
        "knowledge_base_id": doc.get("knowledge_base_id"),
        "llm_model": doc.get("llm_model", "sarvam-105b"),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }

@router.get("")
async def list_agents(skip: int = Query(default=0, ge=0), limit: int = Query(default=100, ge=1, le=200)):
    """List agents across companies with bounded pagination."""
    total = await col_agents().count_documents({})
    cursor = col_agents().find({}).sort("created_at", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    company_ids = {str(doc.get("company_id", "")) for doc in docs if ObjectId.is_valid(str(doc.get("company_id", "")))}
    comp_cursor = col_companies().find({"_id": {"$in": [ObjectId(cid) for cid in company_ids]}})
    comp_map = {}
    async for c in comp_cursor:
        comp_map[str(c["_id"])] = {
            "name": c.get("name", "Unknown Company"),
            "logo_url": (c.get("settings") or {}).get("logo_url"),
        }

    agents = []
    for doc in docs:
        c_id = str(doc.get("company_id", ""))
        company = comp_map.get(c_id, {"name": "Unknown Company", "logo_url": None})
        agents.append(_fmt_agent(doc, company["name"], company["logo_url"]))
    return {"agents": agents, "pagination": {"skip": skip, "limit": limit, "total": total}}

@router.patch("/{agent_id}/voice")
async def admin_update_agent_voice(agent_id: str, body: AdminVoiceUpdateRequest):
    """Platform admin directly updates any agent's TTS voice persona."""
    try:
        oid = ObjectId(agent_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid agent_id")

    res = await col_agents().update_one(
        {"_id": oid},
        {"$set": {"tts_voice": body.tts_voice.lower()}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"status": "success", "agent_id": agent_id, "tts_voice": body.tts_voice.lower()}

@router.post("/preview-voice")
async def admin_preview_voice(body: AdminVoicePreviewRequest):
    """Platform admin voice preview synthesis with calibrated speed and volume."""
    import base64
    import logging
    from modules.sarvam_tts import realtime_tts, fallback_neural_tts, resolve_speaker
    from core.database import col_custom_voices

    voice_id = body.voice
    text = body.text or f"Hello! I am {voice_id.capitalize()}. This is your voice sample."
    lang = body.language or "en-IN"
    speed = body.speed
    volume = body.volume

    # 1. Resolve speed/volume from agent or custom voice doc if not supplied
    if (speed is None or volume is None) and body.agent_id:
        try:
            ag_doc = await col_agents().find_one({"_id": ObjectId(body.agent_id)})
            if ag_doc:
                if speed is None and ag_doc.get("voice_speed") is not None:
                    speed = float(ag_doc["voice_speed"])
                if volume is None and ag_doc.get("voice_volume") is not None:
                    volume = float(ag_doc["voice_volume"])
        except Exception:
            pass

    if (speed is None or volume is None) and ObjectId.is_valid(voice_id):
        try:
            c_doc = await col_custom_voices().find_one({"_id": ObjectId(voice_id)})
            if c_doc:
                if speed is None and c_doc.get("speed") is not None:
                    speed = float(c_doc["speed"])
                if volume is None and c_doc.get("volume") is not None:
                    volume = float(c_doc["volume"])
        except Exception:
            pass

    speed = float(speed if speed is not None else 1.15)
    volume = float(volume if volume is not None else 1.35)

    # 2. Resolve speaker from ObjectId to svc-... clone ID or prebuilt name
    resolved_speaker = await resolve_speaker(voice_id)
    logging.info(f"[ADMIN_VOICE_PREVIEW] speaker={resolved_speaker} (orig={voice_id}) speed={speed} volume={volume}")

    try:
        if resolved_speaker.startswith("svc-") or ObjectId.is_valid(voice_id):
            audio_bytes = await fallback_neural_tts(text, resolved_speaker, speed=speed, volume=volume)
        else:
            audio_bytes = await realtime_tts(
                text=text,
                language=lang,
                speaker=resolved_speaker
            )
            if audio_bytes and (speed != 1.0 or volume != 1.0):
                try:
                    from zenaipex.modules.audio_utils import apply_audio_tuning
                except ImportError:
                    from modules.audio_utils import apply_audio_tuning
                audio_bytes = apply_audio_tuning(audio_bytes, spd=speed, vol=volume)

        if audio_bytes and len(audio_bytes) > 200:
            audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
            return {
                "audio_base64": audio_b64, 
                "fallback_tts": False, 
                "voice": voice_id,
                "speed": speed,
                "volume": volume
            }
        else:
            return {"audio_base64": "", "fallback_tts": True, "voice": voice_id}
    except Exception as e:
        logging.warning(f"[ADMIN_VOICE_PREVIEW] Error: {e}")
        return {"audio_base64": "", "fallback_tts": True, "voice": voice_id}

class AdminAgentUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tts_voice: Optional[str] = None
    llm_model: Optional[str] = None
    voice_engine: Optional[str] = None
    status: Optional[str] = None
    default_language: Optional[str] = None
    voice_speed: Optional[float] = None
    voice_volume: Optional[float] = None
    voice_clarity: Optional[int] = None
    voice_stability: Optional[int] = None

@router.patch("/{agent_id}")
async def admin_update_agent(agent_id: str, body: AdminAgentUpdateRequest):
    """Platform admin updates agent configurations."""
    try:
        oid = ObjectId(agent_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid agent_id")

    update_dict = {k: v for k, v in body.dict(exclude_unset=True).items() if v is not None}
    if not update_dict:
        return {"status": "no_change"}

    from datetime import datetime, timezone
    update_dict["updated_at"] = datetime.now(timezone.utc)
    if "tts_voice" in update_dict:
        update_dict["tts_voice"] = update_dict["tts_voice"].lower()
    if "voice_engine" in update_dict and update_dict["voice_engine"] not in {
        "pipeline", "gemini_live", "gemini_clone"
    }:
        raise HTTPException(status_code=422, detail="Unsupported voice_engine")

    res = await col_agents().update_one({"_id": oid}, {"$set": update_dict})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"status": "success", "agent_id": agent_id, "updated": update_dict}

