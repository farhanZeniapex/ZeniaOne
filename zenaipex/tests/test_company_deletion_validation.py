import pytest
from pydantic import ValidationError

from zenaipex.api.v1.companies import CompanyDeletionRequest


def test_company_deletion_requires_explicit_confirmation_text():
    request = CompanyDeletionRequest(confirmation="DELETE abc123")
    assert request.confirmation == "DELETE abc123"


def test_company_deletion_confirmation_is_required():
    with pytest.raises(ValidationError):
        CompanyDeletionRequest()
