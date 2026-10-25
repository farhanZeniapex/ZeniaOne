import asyncio
import os
import json
import sys
from dotenv import load_dotenv

sys.path.append(r'd:\zeniaOne-Voice-Assistant\zenaipex')
load_dotenv(r'd:\zeniaOne-Voice-Assistant\zenaipex\.env')

from zenaipex.core.database import connect_db
from zenaipex.ai.rag import get_rag_pipeline

async def test_rag():
    await connect_db()
    
    # We use the agent and company from the audit
    company_id = "6a990b403e9b17bef89acf87"
    agent_doc = {
        "_id": "6a990b403e9b17bef89acf8b",
        "knowledge_base_id": "6a990b403e9b17bef89acf8a"
    }
    
    pipeline = get_rag_pipeline(namespace=company_id, agent_doc=agent_doc)
    
    queries = [
        "ZeniaONE",
        "ZeniaONE chatbot",
        "ZeniaONE integration",
        "ZeniaHR payroll",
        "ZeniaPex products",
        "HRMS",
        "Payroll"
    ]
    
    print("--- DIRECT RAG TEST ---")
    for q in queries:
        docs = await pipeline.retrieve(q)
        print(f"\n[RAG_TEST]")
        print(f"query=\"{q}\"")
        print(f"results_count={len(docs)}")
        if docs:
            top_score = docs[0].get('score', 0.0)
            sources = list(set([str(d.get('metadata', {}).get('source', '')) for d in docs]))
            meta = [d.get('metadata', {}) for d in docs]
            first_text = docs[0].get('text', '')[:200]
            
            print(f"top_score={top_score}")
            print(f"sources={sources}")
            print(f"metadata={str(meta).encode('ascii', 'ignore').decode('ascii')}")
            print(f"first_chunk_preview={str(first_text).encode('ascii', 'ignore').decode('ascii')}")
            
if __name__ == "__main__":
    asyncio.run(test_rag())
