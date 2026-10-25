"""Provider-agnostic, signed and idempotent billing webhook boundary."""
import hashlib
import hmac
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Request
from bson import ObjectId
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from core.config import settings
from core.database import col_activity_logs, col_billing_events, col_companies, col_subscriptions

router = APIRouter(prefix="/billing", tags=["Billing"])


class BillingWebhookEvent(BaseModel):
    event_id: str = Field(min_length=1, max_length=128)
    company_id: str = Field(min_length=1, max_length=64)
    invoice_id: Optional[str] = Field(default=None, max_length=128)
    status: Literal["paid", "failed", "refunded"]
    amount_inr: float = Field(ge=0)
    occurred_at: Optional[datetime] = None


def expected_billing_signature(raw_body: bytes, secret: str) -> str:
    digest = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


@router.post("/webhook", summary="Receive signed payment status webhook")
async def receive_billing_webhook(request: Request):
    """Apply a payment event once; reject unsigned or duplicate events safely."""
    if not settings.billing_webhook_secret:
        raise HTTPException(status_code=503, detail="Billing webhook is not configured")
    raw_body = await request.body()
    supplied = request.headers.get("X-Billing-Signature", "")
    expected = expected_billing_signature(raw_body, settings.billing_webhook_secret)
    if not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="Invalid billing webhook signature")
    try:
        event = BillingWebhookEvent.model_validate_json(raw_body)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Invalid billing event payload") from exc

    company = await col_companies().find_one({"_id": ObjectId(event.company_id)}) if ObjectId.is_valid(event.company_id) else None
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    received_at = datetime.now(timezone.utc)
    stored = {
        "event_id": event.event_id,
        "company_id": event.company_id,
        "invoice_id": event.invoice_id,
        "status": event.status,
        "amount_inr": event.amount_inr,
        "occurred_at": event.occurred_at or received_at,
        "received_at": received_at,
    }
    try:
        await col_billing_events().insert_one(stored)
    except DuplicateKeyError:
        return {"accepted": True, "duplicate": True, "event_id": event.event_id}

    await col_subscriptions().update_one(
        {"company_id": event.company_id},
        {"$set": {
            "last_payment_status": event.status,
            "last_payment_amount_inr": event.amount_inr,
            "last_payment_event_id": event.event_id,
            "last_payment_at": event.occurred_at or received_at,
        }},
    )
    await col_activity_logs().insert_one({
        "action": "billing_payment_updated",
        "company_id": event.company_id,
        "details": f"Payment status updated to {event.status}.",
        "created_at": received_at,
    })
    return {"accepted": True, "duplicate": False, "event_id": event.event_id}
