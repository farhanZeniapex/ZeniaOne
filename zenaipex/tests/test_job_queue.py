from types import SimpleNamespace

import pytest

from zenaipex.services import job_queue


class _FakeJobs:
    def __init__(self):
        self.inserted = None

    async def insert_one(self, document):
        self.inserted = document
        return SimpleNamespace(inserted_id="job-1")


@pytest.mark.asyncio
async def test_document_processing_job_is_persisted(monkeypatch):
    fake = _FakeJobs()
    monkeypatch.setattr(job_queue, "col_background_jobs", lambda: fake)

    job_id = await job_queue.enqueue_document_processing(
        company_id="company-1", kb_id="kb-1", doc_id="doc-1",
        storage_path="uploads/doc.txt", filename="doc.txt",
        content_type="text/plain", target_version=2,
    )

    assert job_id == "job-1"
    assert fake.inserted["status"] == "pending"
    assert fake.inserted["job_type"] == "document_process"
    assert fake.inserted["payload"]["target_version"] == 2


@pytest.mark.asyncio
async def test_unknown_job_type_is_rejected():
    with pytest.raises(ValueError, match="Unsupported background job type"):
        await job_queue._run_job({"job_type": "unknown", "payload": {}})
