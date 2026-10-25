"""Runtime provider inventory and routing controls for the platform admin.

Secrets remain in environment variables or the encrypted provider collection.
This module deliberately returns only a configured boolean to the browser.
"""
from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

from core.config import settings
from core.database import col_activity_logs, col_platform_settings


DEFAULT_ROUTING: dict[str, Any] = {
    "phone_voice": {
        "stt": ["gemini_live", "deepgram"],
        "llm": ["gemini", "groq"],
        "tts": ["sarvam_clone", "neural_tts"],
    },
    "browser_voice": {
        "stt": ["gemini_live", "sarvam_stt"],
        "llm": ["gemini", "groq"],
        "tts": ["sarvam_clone", "neural_tts"],
    },
    "text_chat": {"llm": ["gemini", "groq"]},
}

# Prevent malformed dashboard requests from assigning a voice provider to an
# LLM stage (or any other invalid runtime route).
STAGE_PROVIDER_IDS = {
    "stt": {"gemini_live", "deepgram", "sarvam_stt"},
    "llm": {"gemini", "groq"},
    "tts": {"sarvam_clone", "neural_tts"},
}


def _configured(value: Any) -> bool:
    return bool(str(value or "").strip())


def runtime_provider_inventory() -> list[dict[str, Any]]:
    """Safe provider inventory. Never add keys, tokens, or endpoint secrets here."""
    import os

    return [
        {"id": "gemini_live", "name": "Gemini Live", "category": "Speech recognition", "roles": ["STT"], "configured": _configured(settings.gemini_api_key), "source": "Environment", "model": "gemini-3.5-transcribe-live"},
        {"id": "deepgram", "name": "Deepgram", "category": "Speech recognition", "roles": ["STT fallback"], "configured": _configured(os.getenv("DEEPGRAM_API_KEY")), "source": "Environment", "model": "Streaming STT"},
        {"id": "sarvam_stt", "name": "Sarvam STT", "category": "Speech recognition", "roles": ["STT fallback"], "configured": _configured(settings.sarvam_api_key), "source": "Environment", "model": settings.sarvam_stt_model},
        {"id": "gemini", "name": "Google Gemini", "category": "Reasoning", "roles": ["LLM"], "configured": _configured(settings.gemini_api_key), "source": "Environment / encrypted provider", "model": settings.gemini_model},
        {"id": "groq", "name": "Groq", "category": "Reasoning", "roles": ["LLM fallback"], "configured": _configured(settings.groq_api_key), "source": "Environment / encrypted provider", "model": settings.groq_model},
        {"id": "sarvam_clone", "name": "Sarvam Clone TTS", "category": "Speech output", "roles": ["Selected clone voice"], "configured": _configured(settings.sarvam_api_key), "source": "Environment", "model": settings.sarvam_tts_model},
        {"id": "neural_tts", "name": "Neural TTS", "category": "Speech output", "roles": ["Fallback voice"], "configured": True, "source": "Application runtime", "model": "Neural fallback"},
        {"id": "pinecone", "name": "Pinecone", "category": "Knowledge", "roles": ["RAG retrieval"], "configured": _configured(settings.pinecone_api_key), "source": "Environment", "model": settings.pinecone_index_name},
        {"id": "exotel", "name": "Exotel", "category": "Telephony", "roles": ["Phone calls"], "configured": _configured(os.getenv("EXOTEL_API_KEY")), "source": "Environment / channel", "model": "Voice API"},
    ]


async def get_provider_routing() -> dict[str, Any]:
    try:
        document = await col_platform_settings().find_one({"type": "global"}) or {}
    except RuntimeError:
        # Unit tests and isolated workers may not initialize MongoDB; retain
        # the safe built-in routing rather than failing the voice pipeline.
        document = {}
    saved = document.get("provider_routing") or {}
    routing = deepcopy(DEFAULT_ROUTING)
    for surface, stages in saved.items():
        if surface not in routing or not isinstance(stages, dict):
            continue
        for stage, providers in stages.items():
            if stage in routing[surface] and isinstance(providers, list):
                routing[surface][stage] = providers
    return routing


async def update_provider_routing(routing: dict[str, Any], actor: str) -> dict[str, Any]:
    allowed = {item["id"] for item in runtime_provider_inventory()}
    normalized = deepcopy(DEFAULT_ROUTING)
    for surface, stages in routing.items():
        if surface not in normalized or not isinstance(stages, dict):
            continue
        for stage, providers in stages.items():
            if stage not in normalized[surface] or not isinstance(providers, list):
                continue
            selected = [provider for provider in providers if provider in allowed and provider in STAGE_PROVIDER_IDS[stage]]
            if not selected:
                raise ValueError(f"{surface}.{stage} needs at least one provider")
            normalized[surface][stage] = list(dict.fromkeys(selected))

    now = datetime.now(timezone.utc)
    await col_platform_settings().update_one(
        {"type": "global"},
        {"$set": {"provider_routing": normalized, "updated_at": now}},
        upsert=True,
    )
    await col_activity_logs().insert_one({
        "actor_name": "Platform Admin", "actor_email": actor,
        "action": "provider_routing_updated", "target": "Provider routing",
        "details": "Updated active provider and fallback routing.", "created_at": now,
    })
    return normalized


async def stage_providers(surface: str, stage: str) -> list[str]:
    routing = await get_provider_routing()
    return list(routing.get(surface, {}).get(stage, []))


async def is_provider_enabled(surface: str, stage: str, provider_id: str) -> bool:
    return provider_id in await stage_providers(surface, stage)
