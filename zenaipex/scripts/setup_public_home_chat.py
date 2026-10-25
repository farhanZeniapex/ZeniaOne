"""Attach a dedicated customer-facing Gemini agent to the homepage web widget.

Run once from the zenaipex directory: python -m scripts.setup_public_home_chat
The operation is idempotent and leaves existing agents unchanged.
"""

import asyncio
from datetime import datetime, timezone

from core.database import (
    connect_db,
    disconnect_db,
    col_agents,
    col_ai_providers,
    col_channels,
)


PUBLIC_PROMPT = """You are the public ZeniaOne website assistant. Help visitors understand the product and find the right next step. Use only these publicly shown website facts and any explicitly provided customer-facing context:
- ZeniaOne offers one configurable AI agent across website chat, live voice, and phone calls.
- The agent can use business knowledge and a chosen personality across these channels.
- The website currently lists Starter at $0/month with 500 conversation minutes, Growth at $149/month with 5,000 conversation minutes, and Enterprise with custom pricing. These are website-listed prices; point visitors to the pricing page for full terms and any updates.
- Live voice is intended for natural back-and-forth conversation. The website does not publish a guaranteed response time or latency benchmark. If asked how fast it is, say that no exact speed is published and suggest trying a live demo.
- Visitors can request a personal demonstration using the Book a Demo form on this website.
Keep greetings to one short sentence and other replies to one to three concise sentences. Do not use emojis, markdown lists, or append suggested questions; the widget displays relevant suggestions separately. Respond in the visitor's language when possible. For casual Hinglish, use gender-neutral self-references. Ask one useful follow-up only when the request is unclear. Do not claim an appointment, human transfer, or callback has happened until the visitor actually submits the relevant form. Do not mention or reveal internal workspace information, private documents, provider settings, credentials, or unverified product claims. If a detail is unavailable, say so and suggest booking a demo."""


async def main():
    await connect_db()
    try:
        channel = await col_channels().find_one({
            "public_identifier": "zeniaone_public_chat",
            "type": "web_chat",
            "is_active": True,
        })
        if not channel:
            raise RuntimeError("Active ZeniaOne homepage chat channel was not found")
        gemini = await col_ai_providers().find_one({"provider": "gemini", "enabled": True})
        if not gemini:
            raise RuntimeError("Enable the Gemini provider before configuring public chat")

        company_id = channel["company_id"]
        now = datetime.now(timezone.utc)
        agent_fields = {
            "name": "ZeniaOne Assistant",
            "agent_type": "company_customer_agent",
            "system_prompt": PUBLIC_PROMPT,
            "default_language": "en-IN",
            "supported_languages": ["en-IN", "hi-IN", "gu-IN"],
            "greeting_messages": {"en-IN": "Hi! I'm the ZeniaOne assistant. Ask me about chat, live voice, phone calls, or booking a demo."},
            "llm_model": gemini["model"],
            "llm_max_tokens": 450,
            "llm_temperature": 0.3,
            "status": "active",
            "updated_at": now,
        }
        result = await col_agents().update_one(
            {"company_id": company_id, "slug": "zeniaone-public-assistant"},
            {
                "$set": agent_fields,
                "$setOnInsert": {
                    "company_id": company_id,
                    "slug": "zeniaone-public-assistant",
                    "created_at": now,
                },
            },
            upsert=True,
        )
        agent_id = result.upserted_id
        if agent_id is None:
            agent = await col_agents().find_one({"company_id": company_id, "slug": "zeniaone-public-assistant"})
            agent_id = agent["_id"]
        await col_channels().update_one(
            {"_id": channel["_id"], "company_id": company_id},
            {"$set": {"agent_id": str(agent_id), "updated_at": now}},
        )
        print("Homepage web chat now uses the dedicated ZeniaOne public agent with Gemini.")
    finally:
        await disconnect_db()


if __name__ == "__main__":
    asyncio.run(main())
