"""Apply the Gemini + saved OM clone profile to active phone-channel agents."""

import asyncio
import argparse
from datetime import datetime, timezone
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.database import connect_db, col_agents, col_ai_providers, col_custom_voices, get_db


async def main(*, apply_changes: bool = False) -> None:
    await connect_db()
    db = get_db()

    voice = await col_custom_voices().find_one({"name": {"$regex": "^OM$", "$options": "i"}})
    if not voice or not str(voice.get("voice_id") or "").startswith("svc-"):
        raise RuntimeError("Saved OM cloned voice was not found")

    gemini = await col_ai_providers().find_one({"provider": "gemini", "enabled": True})
    if not gemini or not gemini.get("model"):
        raise RuntimeError("An enabled Gemini provider was not found")

    channels = await db.channels.find(
        {"is_active": True, "type": {"$in": ["exotel_voice", "twilio_voice"]}}
    ).to_list(length=None)
    agent_ids = {str(channel.get("agent_id")) for channel in channels if channel.get("agent_id")}
    if not agent_ids:
        raise RuntimeError("No active phone-channel agents were found")

    update = {
        "llm_model": gemini["model"],
        "llm_max_tokens": 180,
        "tts_voice": str(voice["_id"]),
        "voice_engine": "gemini_clone",
        "default_language": "hi-IN",
        "supported_languages": ["hi-IN", "en-IN", "gu-IN"],
        "stt_model": "nova-3",
        "stt_endpointing_ms": 500,
        "stt_utterance_end_ms": 850,
        "voice_delayed_flush_ms": 500,
        "silence_timeout_ms": 500,
        "updated_at": datetime.now(timezone.utc),
    }

    from bson import ObjectId

    selector = {"_id": {"$in": [ObjectId(agent_id) for agent_id in agent_ids]}}
    agents = await col_agents().find(
        selector,
        {"name": 1, "llm_model": 1, "tts_voice": 1, "voice_engine": 1},
    ).to_list(length=None)

    result = None
    if apply_changes:
        result = await col_agents().update_many(selector, {"$set": update})

    print({
        "mode": "apply" if apply_changes else "dry-run",
        "matched_agents": result.matched_count if result else len(agents),
        "modified_agents": result.modified_count if result else 0,
        "agents": [agent.get("name") for agent in agents],
        "gemini_model": gemini["model"],
        "voice": voice.get("name"),
        "voice_id_configured": True,
        "target_engine": update["voice_engine"],
    })


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply the configuration. Without this flag the script is read-only.",
    )
    args = parser.parse_args()
    asyncio.run(main(apply_changes=args.apply))
