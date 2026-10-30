import pytest
from unittest.mock import AsyncMock, patch
from services.conversation_service import create_conversation

@pytest.mark.asyncio
async def test_create_conversation_lead_matching():
    fake_lead = {"name": "Saurav Rajput", "phone": "+917600858654"}
    with patch("services.conversation_service.col_conversations") as mock_convs, \
         patch("core.database.col_leads") as mock_leads:
        
        mock_leads.return_value.find_one = AsyncMock(return_value=fake_lead)
        mock_convs.return_value.find_one = AsyncMock(return_value=None)
        mock_convs.return_value.insert_one = AsyncMock(return_value=AsyncMock(inserted_id="fake_id"))

        doc = await create_conversation(
            company_id="comp123",
            agent_id="agent123",
            caller_phone="07600858654",
            direction="inbound"
        )
        assert doc["contact_name"] == "Saurav Rajput"
        call_args = mock_leads.return_value.find_one.call_args[0][0]
        assert hasattr(call_args["phone"], "pattern")
        assert "7600858654" in call_args["phone"].pattern
