import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(r"d:\zeniaOne-Voice-Assistant")

from ai.rag import get_rag_pipeline
from modules.query_resolver import resolve_product_from_utterance, resolve_rag_query
from core.database import connect_db

async def run_rag_test():
    await connect_db()
    company_id = "6a990b403e9b17bef89acf87"
    agent_doc = {
        "_id": "6a990b403e9b17bef89acf8b",
        "knowledge_base_id": "6a990b403e9b17bef89acf8a"
    }
    
    pipeline = get_rag_pipeline(company_id, agent_doc)
    
    if not pipeline:
        print("Pinecone pipeline could not be initialized.")
        return
        
    queries = [
        ("What is ZeniaONE?", "ZeniaONE"),
        ("Chatbot", "ZeniaONE"), # resolves to "ZeniaONE Chatbot"
        ("Integration", "ZeniaONE"),
        ("What is ZeniaHR?", "ZeniaHR"),
        ("Payroll", "ZeniaHR"),
        ("HRMS", "ZeniaHR")
    ]
    
    for raw_query, active_prod in queries:
        resolved_product = resolve_product_from_utterance(raw_query, active_prod, [])
        resolved_query_info = resolve_rag_query(raw_query, resolved_product, [])
        resolved_query = resolved_query_info["resolved_query"]
        
        print(f"\n--- RAG TEST ---")
        print(f"Original Query: {raw_query}")
        print(f"Resolved Query: {resolved_query}")
        print(f"Resolved Product: {resolved_product}")
        
        docs = await pipeline.retrieve(resolved_query)
        print(f"Result count: {len(docs)}")
        if docs:
            top_score = docs[0].get('score', 0.0)
            print(f"Top score: {top_score}")
            sources = list(set([str(d.get("metadata", {}).get("source", "")) for d in docs]))
            print(f"Sources: {sources}")
            preview = docs[0].get("text", "")[:100].replace("\n", " ")
            print(f"First chunk preview: {preview}")
        else:
            print("No results returned.")

if __name__ == "__main__":
    asyncio.run(run_rag_test())
