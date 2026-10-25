from bson import ObjectId
import pytest

from services import voice_channel_mapping as mapping


def test_indian_number_variants_and_query_scope():
    channel = {
        "_id": ObjectId("6ac6209ca0af97f94fe85cd3"),
        "company_id": "company-a",
        "type": "exotel_voice",
        "phone_number": "07948502295 ",
    }
    query = mapping.channel_conversation_query(channel)
    assert query["company_id"] == "company-a"
    assert "07948502295" in query["$or"][0]["caller_to"]["$in"]
    assert "+917948502295" in query["$or"][0]["caller_to"]["$in"]
    assert "08047285182" not in query["$or"][0]["caller_to"]["$in"]
    assert mapping.phone_numbers_match("07948502295 ", "+91 79485 02295")
    assert not mapping.phone_numbers_match("07948502295", "08047285182")


@pytest.mark.asyncio
async def test_exotel_resolution_uses_active_company_channel(monkeypatch):
    channels = [
        {"_id": ObjectId("6ac6209ca0af97f94fe85cd3"), "agent_id": "agent-a", "phone_number": "07948502295 "},
        {"_id": ObjectId("6ab7c0adc39381e9f59801be"), "agent_id": "agent-a", "phone_number": "08047285182"},
    ]

    class Cursor:
        async def to_list(self, length):
            return channels

    class Collection:
        def find(self, query):
            assert query == {
                "company_id": "company-a",
                "type": {"$in": mapping.EXOTEL_TYPES},
                "is_active": True,
            }
            return Cursor()

    monkeypatch.setattr(mapping, "col_channels", lambda: Collection())
    channel = await mapping.resolve_exotel_channel("company-a", "agent-a", "07948502295")
    assert channel is channels[0]
    channel = await mapping.resolve_exotel_channel("company-a", "agent-a", "", str(channels[0]["_id"]))
    assert channel is channels[0]
    channel = await mapping.resolve_exotel_channel(
        "company-a", "agent-a", "07948502295", str(channels[1]["_id"])
    )
    assert channel is channels[0]
    assert await mapping.resolve_exotel_channel("company-a", "agent-a", "07000000000") is None
