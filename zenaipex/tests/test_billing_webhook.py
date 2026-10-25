import hashlib
import hmac

import pytest

from zenaipex.api.v1.billing import BillingWebhookEvent, expected_billing_signature


def test_billing_signature_is_deterministic_and_prefixed():
    signature = expected_billing_signature(b'{"event_id":"evt-1"}', "secret")
    expected = hmac.new(b"secret", b'{"event_id":"evt-1"}', hashlib.sha256).hexdigest()
    assert signature == f"sha256={expected}"


def test_billing_event_rejects_negative_amount():
    with pytest.raises(ValueError):
        BillingWebhookEvent(event_id="evt-1", company_id="company-1", status="paid", amount_inr=-1)
