from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any
from core.database import (
    col_knowledge_bases,
    col_documents,
    col_companies,
    col_knowledge_document_versions,
    col_knowledge_search_events,
    col_activity_logs,
)
from bson import ObjectId

router = APIRouter(tags=["Admin - Knowledge"])


@router.get("/knowledge-insights", summary="Get platform knowledge health and usage insights")
async def get_knowledge_insights():
    """Return real, platform-wide knowledge metrics for the admin control center."""
    docs = await col_documents().find({}, {
        "_id": 1, "status": 1, "chunk_count": 1, "source_url": 1,
        "filename": 1, "company_id": 1, "version": 1, "updated_at": 1,
        "content_hash": 1, "error_message": 1,
    }).to_list(length=10000)
    total_chunks = sum(int(doc.get("chunk_count") or 0) for doc in docs)
    ready_docs = [doc for doc in docs if doc.get("status") == "ready"]
    failed_docs = [doc for doc in docs if doc.get("status") == "failed"]
    website_docs = [doc for doc in docs if doc.get("source_url")]
    hashes = [doc.get("content_hash") for doc in docs if doc.get("content_hash")]
    duplicate_hashes = len(hashes) - len(set(hashes))

    search_events = await col_knowledge_search_events().find({}).to_list(length=10000)
    successful_searches = sum(1 for event in search_events if event.get("result_count", 0) > 0)
    avg_results = round(sum(float(event.get("result_count", 0) or 0) for event in search_events) / len(search_events), 2) if search_events else 0
    retrieval_scores = [float(event.get("average_score")) for event in search_events if event.get("average_score") is not None]

    version_count = await col_knowledge_document_versions().count_documents({})
    audit_count = await col_activity_logs().count_documents({})

    return {
        "documents": {
            "total": len(docs),
            "ready": len(ready_docs),
            "failed": len(failed_docs),
            "processing": sum(1 for doc in docs if doc.get("status") in {"processing", "pending"}),
            "website_sources": len(website_docs),
            "total_chunks": total_chunks,
            "duplicate_sources": duplicate_hashes,
            "missing_content": sum(1 for doc in docs if not doc.get("chunk_count")),
        },
        "retrieval": {
            "total_searches": len(search_events),
            "successful_searches": successful_searches,
            "no_result_searches": len(search_events) - successful_searches,
            "success_rate": round(successful_searches / len(search_events) * 100, 1) if search_events else None,
            "average_results": avg_results,
            "average_score": round(sum(retrieval_scores) / len(retrieval_scores), 3) if retrieval_scores else None,
        },
        "governance": {
            "versions": version_count,
            "audit_events": audit_count,
            "access_control": "tenant-scoped",
            "source_validation": "enabled",
        },
        "failed_documents": [
            {"id": str(doc["_id"]), "filename": doc.get("filename"), "error": doc.get("error_message")}
            for doc in failed_docs[:50]
        ],
    }

@router.get("/knowledge-bases", summary="List all knowledge bases platform-wide")
async def list_all_knowledge_bases(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=100),
):
    """Admin endpoint to see all KBs across all companies."""
    kbs = await col_knowledge_bases().find().skip(skip).limit(limit).to_list(length=limit)
    
    # Fetch company names for context
    company_ids = list(set([kb["company_id"] for kb in kbs]))
    
    # Fix: convert string company_ids to ObjectIds
    object_ids = []
    for cid in company_ids:
        if ObjectId.is_valid(cid):
            object_ids.append(ObjectId(cid))
            
    companies = await col_companies().find({"_id": {"$in": object_ids}}).to_list(length=len(object_ids))
    company_map = {str(c["_id"]): c["name"] for c in companies}
    company_logo_map = {str(c["_id"]): (c.get("settings") or {}).get("logo_url") for c in companies}
    
    formatted = []
    for kb in kbs:
        kb_id_str = str(kb["_id"])
        formatted.append({
            "id": kb_id_str,
            "company_id": kb["company_id"],
            "company_name": company_map.get(kb["company_id"], "Unknown"),
            "logo_url": company_logo_map.get(kb["company_id"]),
            "name": kb["name"],
            "total_documents": kb.get("total_documents", 0),
            "total_chunks": kb.get("total_chunks", 0),
            "created_at": kb.get("created_at"),
        })
    return {"knowledge_bases": formatted, "count": len(formatted)}


@router.get("/documents", summary="List all documents platform-wide")
async def list_all_documents(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=100),
):
    """Admin endpoint to see all document metadata across all companies."""
    docs = await col_documents().find().sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    
    # Fetch company names
    company_ids = list(set([doc["company_id"] for doc in docs]))
    
    # Fix: convert string company_ids to ObjectIds
    object_ids = []
    for cid in company_ids:
        if ObjectId.is_valid(cid):
            object_ids.append(ObjectId(cid))
            
    companies = await col_companies().find({"_id": {"$in": object_ids}}).to_list(length=len(object_ids))
    company_map = {str(c["_id"]): c["name"] for c in companies}
    company_logo_map = {str(c["_id"]): (c.get("settings") or {}).get("logo_url") for c in companies}
    
    formatted = []
    for doc in docs:
        doc_id_str = str(doc["_id"])
        formatted.append({
            "id": doc_id_str,
            "company_id": doc["company_id"],
            "company_name": company_map.get(doc["company_id"], "Unknown"),
            "company_logo_url": company_logo_map.get(doc["company_id"]),
            "knowledge_base_id": doc["knowledge_base_id"],
            "filename": doc["filename"],
            "status": doc.get("status", "unknown"),
            "file_size_bytes": doc.get("file_size_bytes", 0),
            "chunk_count": doc.get("chunk_count", 0),
            "created_at": doc.get("created_at"),
            "updated_at": doc.get("updated_at"),
            "content_type": doc.get("content_type", "text/plain"),
            "file_size_bytes": doc.get("file_size_bytes", 0),
            "source_url": doc.get("source_url"),
            "auto_sync": doc.get("auto_sync", False),
            "crawl_options": doc.get("crawl_options"),
            "crawl_report": doc.get("crawl_report"),
            "error_message": doc.get("error_message"),
            "version": doc.get("version", 1),
        })
    return {"documents": formatted, "count": len(formatted)}


@router.get("/documents/{doc_id}/chunks", summary="Get document chunks platform-wide")
async def get_document_chunks(doc_id: str):
    doc = await col_documents().find_one({"_id": ObjectId(doc_id)})
    if not doc:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Document not found")
        
    from services.knowledge_service import get_document_chunks
    chunks = await get_document_chunks(doc["company_id"], doc["knowledge_base_id"], doc_id)
    
    return {"chunks": chunks, "count": len(chunks)}


class BulkDocumentRequest(BaseModel):
    document_ids: List[str] = Field(default_factory=list, max_length=100)


@router.post("/documents/bulk-reprocess", summary="Reprocess selected platform documents")
async def bulk_reprocess_documents(body: BulkDocumentRequest):
    from services.knowledge_service import reprocess_document
    queued, failed = [], []
    for doc_id in body.document_ids:
        try:
            doc = await col_documents().find_one({"_id": ObjectId(doc_id)})
            if not doc:
                failed.append({"id": doc_id, "reason": "Document not found"})
                continue
            await reprocess_document(doc["company_id"], doc_id)
            queued.append(doc_id)
        except Exception as exc:
            failed.append({"id": doc_id, "reason": str(exc)[:180]})
    return {"queued": queued, "failed": failed, "count": len(queued)}


@router.post("/documents/bulk-delete", summary="Delete selected platform documents")
async def bulk_delete_documents(body: BulkDocumentRequest):
    from services.knowledge_service import delete_document
    deleted, failed = [], []
    for doc_id in body.document_ids:
        try:
            doc = await col_documents().find_one({"_id": ObjectId(doc_id)})
            if not doc:
                failed.append({"id": doc_id, "reason": "Document not found"})
                continue
            await delete_document(doc["company_id"], doc_id)
            deleted.append(doc_id)
        except Exception as exc:
            failed.append({"id": doc_id, "reason": str(exc)[:180]})
    return {"deleted": deleted, "failed": failed, "count": len(deleted)}
