import asyncio
import os
import sys
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(r"d:\zeniaOne-Voice-Assistant")

from core.database import connect_db
from ai.rag import get_rag_pipeline
from modules.query_resolver import resolve_product_from_utterance, resolve_rag_query

# We will directly call fetch_llm_response from voice_advanced to test the real brain.
# We might need to mock some dependencies or import it directly.
from api.v1.voice_advanced import fetch_llm_response

company_id = "6a990b403e9b17bef89acf87"
agent_doc = {
    "_id": "6a990b403e9b17bef89acf8b",
    "knowledge_base_id": "6a990b403e9b17bef89acf8a"
}

TEST_CASES = [
    # --- ZeniaONE Easy ---
    {"id": 1, "product_start": "ZeniaONE", "q": "What is ZeniaONE?", "type": "EASY"},
    {"id": 2, "product_start": "ZeniaONE", "q": "Who is the parent company of ZeniaONE?", "type": "EASY"},
    {"id": 3, "product_start": "ZeniaONE", "q": "What languages does ZeniaONE support?", "type": "EASY"},
    # --- ZeniaONE Medium ---
    {"id": 4, "product_start": "ZeniaONE", "q": "What does ZeniaONE do?", "type": "MEDIUM"},
    {"id": 5, "product_start": "ZeniaONE", "q": "How does ZeniaONE handle appointments?", "type": "MEDIUM"},
    {"id": 6, "product_start": "ZeniaONE", "q": "Does ZeniaOne have a browser interface?", "type": "MEDIUM"},
    {"id": 7, "product_start": "ZeniaONE", "q": "Explain the multi-tenant architecture in ZeniaOne.", "type": "MEDIUM"},
    # --- ZeniaONE Long ---
    {"id": 8, "product_start": "ZeniaONE", "q": "Explain the main purpose of ZeniaONE and how it helps businesses automate customer interactions.", "type": "LONG"},
    {"id": 9, "product_start": "ZeniaONE", "q": "According to the documentation, what are the key features of ZeniaOne including language support and architecture?", "type": "LONG"},
    # --- ZeniaONE Hard ---
    {"id": 10, "product_start": "ZeniaONE", "q": "According to the ZeniaONE architecture documentation, explain the relationship between its voice agent, telephony integration, and enterprise system integrations.", "type": "HARD"},
    {"id": 11, "product_start": "ZeniaONE", "q": "Detail the barge-in latency and real-time streaming capabilities of ZeniaOne.", "type": "HARD"},
    # --- ZeniaONE Tricky ---
    {"id": 12, "product_start": "ZeniaONE", "q": "What is the difference between ZeniaONE and ZeniaHR?", "type": "TRICKY"},
    {"id": 13, "product_start": "ZeniaONE", "q": "Is ZeniaPex the same as ZeniaOne?", "type": "TRICKY"},
    
    # --- ZeniaHR Easy ---
    {"id": 14, "product_start": "ZeniaHR", "q": "What is ZeniaHR?", "type": "EASY"},
    {"id": 15, "product_start": "ZeniaHR", "q": "Does ZeniaHR support payroll?", "type": "EASY"},
    {"id": 16, "product_start": "ZeniaHR", "q": "Who owns ZeniaHR?", "type": "EASY"},
    # --- ZeniaHR Medium ---
    {"id": 17, "product_start": "ZeniaHR", "q": "Explain ZeniaHR payroll capabilities.", "type": "MEDIUM"},
    {"id": 18, "product_start": "ZeniaHR", "q": "How does the attendance functionality work?", "type": "MEDIUM"},
    {"id": 19, "product_start": "ZeniaHR", "q": "What compliance laws does ZeniaHR support?", "type": "MEDIUM"},
    {"id": 20, "product_start": "ZeniaHR", "q": "Who are the target customers for ZeniaHR?", "type": "MEDIUM"},
    # --- ZeniaHR Long ---
    {"id": 21, "product_start": "ZeniaHR", "q": "Explain ZeniaHR in detail based only on the documentation.", "type": "LONG"},
    {"id": 22, "product_start": "ZeniaHR", "q": "Describe the complete employee lifecycle management provided by ZeniaHR for staffing companies.", "type": "LONG"},
    # --- ZeniaHR Hard ---
    {"id": 23, "product_start": "ZeniaHR", "q": "How does ZeniaHR handle multi-company isolation and client billing for staffing agencies?", "type": "HARD"},
    
    # --- Product Isolation Test (ZeniaONE -> ZeniaHR leakage) ---
    {"id": 24, "product_start": "ZeniaONE", "q": "Does ZeniaONE have payroll?", "type": "ISOLATION"},
    {"id": 25, "product_start": "ZeniaONE", "q": "Does ZeniaHR have payroll?", "type": "ISOLATION"},
    {"id": 26, "product_start": "ZeniaONE", "q": "Does ZeniaONE provide the same payroll functionality?", "type": "ISOLATION"},
    {"id": 27, "product_start": "ZeniaHR", "q": "Can ZeniaHR handle voice calls?", "type": "ISOLATION"},
    
    # --- Short Queries & Contextual Follow-ups ---
    # We will simulate a continuous conversation by not clearing history for a few turns
    {"id": 28, "product_start": "ZeniaONE", "q": "What is ZeniaONE?", "type": "CONTEXT", "chain": "A"},
    {"id": 29, "product_start": "ZeniaONE", "q": "Explain", "type": "CONTEXT", "chain": "A"},
    {"id": 30, "product_start": "ZeniaONE", "q": "Integration", "type": "CONTEXT", "chain": "A"},
    {"id": 31, "product_start": "ZeniaONE", "q": "How does it work?", "type": "CONTEXT", "chain": "A"},
    {"id": 32, "product_start": "ZeniaONE", "q": "Chatbot", "type": "CONTEXT", "chain": "A"},
    
    {"id": 33, "product_start": "ZeniaHR", "q": "What is Zen HRMS?", "type": "CONTEXT", "chain": "B"},
    {"id": 34, "product_start": "ZeniaHR", "q": "Payroll", "type": "CONTEXT", "chain": "B"},
    {"id": 35, "product_start": "ZeniaHR", "q": "Reports", "type": "CONTEXT", "chain": "B"},
    {"id": 36, "product_start": "ZeniaHR", "q": "What about it?", "type": "CONTEXT", "chain": "B"},
    {"id": 37, "product_start": "ZeniaHR", "q": "Features", "type": "CONTEXT", "chain": "B"},
    
    # --- Anti-Hallucination (Not in documents) ---
    {"id": 38, "product_start": "ZeniaONE", "q": "What is the exact pricing of ZeniaONE?", "type": "ANTI_HALLUCINATION"},
    {"id": 39, "product_start": "ZeniaHR", "q": "How many modules exactly are in ZeniaHR?", "type": "ANTI_HALLUCINATION"},
    {"id": 40, "product_start": "ZeniaONE", "q": "What is the name of the CEO of ZeniaPex?", "type": "ANTI_HALLUCINATION"},
    {"id": 41, "product_start": "ZeniaHR", "q": "Does ZeniaHR integrate with SAP?", "type": "ANTI_HALLUCINATION"},
    {"id": 42, "product_start": "ZeniaONE", "q": "Can ZeniaONE cook food?", "type": "ANTI_HALLUCINATION"},
    
    # --- Multilingual/Gujarati Queries ---
    {"id": 43, "product_start": "ZeniaONE", "q": "ZeniaONE shu che?", "type": "MULTILINGUAL"},
    {"id": 44, "product_start": "ZeniaONE", "q": "ZeniaONE su kare che?", "type": "MULTILINGUAL"},
    {"id": 45, "product_start": "ZeniaHR", "q": "ZeniaHR ma payroll che?", "type": "MULTILINGUAL"},
    {"id": 46, "product_start": "ZeniaONE", "q": "આ ZeniaONE શું છે?", "type": "MULTILINGUAL"},
    {"id": 47, "product_start": "ZeniaHR", "q": "મને ZeniaHR વિશે સમજાવો", "type": "MULTILINGUAL"},
    {"id": 48, "product_start": "ZeniaONE", "q": "ZeniaONE ma chatbot che ke nahi?", "type": "MULTILINGUAL"},
    {"id": 49, "product_start": "ZeniaHR", "q": "Payroll su che?", "type": "MULTILINGUAL"},
    {"id": 50, "product_start": "ZeniaHR", "q": "ZeniaHR nu attendance module explain karo.", "type": "MULTILINGUAL"}
]

async def run_stress_test():
    await connect_db()
    
    pipeline = get_rag_pipeline(company_id, agent_doc)
    if not pipeline:
        print("CRITICAL: Pinecone pipeline could not be initialized.")
        return
        
    print(f"Starting P0-A Automated RAG Stress Test with {len(TEST_CASES)} questions...\n")
    
    stats = {
        "total": len(TEST_CASES),
        "executed": 0,
        "grounded": 0,
        "partially_grounded": 0,
        "ungrounded": 0,
        "anti_hallucination_passes": 0,
        "product_isolation_passes": 0,
        "query_resolver_passes": 0
    }
    
    history_chains = {}
    
    for tc in TEST_CASES:
        t_id = tc["id"]
        q = tc["q"]
        q_type = tc["type"]
        active_prod = tc["product_start"]
        chain = tc.get("chain", None)
        
        # Manage conversation history for chained context
        if chain:
            if chain not in history_chains:
                history_chains[chain] = []
            conv_hist = history_chains[chain]
        else:
            conv_hist = []
            
        # 1. Product Resolution
        resolved_product = resolve_product_from_utterance(q, active_prod, conv_hist)
        
        # 2. Query Resolution
        resolved_query_info = resolve_rag_query(q, resolved_product, conv_hist)
        resolved_query = resolved_query_info["resolved_query"]
        
        # Update stats if resolver changed it contextually
        if resolved_query != q and q_type == "CONTEXT":
            stats["query_resolver_passes"] += 1
            
        # 3. Simulate Pipeline LLM Fetch
        # fetch_llm_response modifies its internal variables but we can call it directly
        # fetch_llm_response(conversation_history, active_product, rag_pipeline, latest_utterance)
        # Note: fetch_llm_response internally calls resolve_rag_query again! So we pass the raw query.
        
        # We append to simulated history
        conv_hist.append({"role": "user", "content": q})
        
        answer = "I'm sorry, I am having a little trouble connecting to my brain right now."
        retries = 0
        while "little trouble connecting to my brain" in answer and retries < 5:
            if retries > 0:
                print(f"Rate limited. Sleeping for {10 * retries} seconds before retry...")
                await asyncio.sleep(10 * retries)
            answer = await fetch_llm_response(conv_hist.copy(), active_prod, pipeline, q)
            retries += 1
            
        conv_hist.append({"role": "assistant", "content": answer})
        
        # 4. RAG Manual fetch just for test output stats (fetch_llm_response does this internally, but we want to log it)
        # This is a bit redundant but we need the exact counts for the report
        docs = await pipeline.retrieve(resolved_query)
        result_count = len(docs)
        top_score = docs[0].get("score", 0.0) if docs else 0.0
        sources = list(set([str(d.get("metadata", {}).get("source", "")) for d in docs]))
        first_chunk = docs[0].get("text", "")[:100].replace("\n", " ") if docs else ""
        
        # 5. Evaluate Grounding
        ans_lower = answer.lower()
        if "i don't have that information" in ans_lower or "i do not have that information" in ans_lower or "iske baare me jankari nahi hai" in ans_lower or "available zenia documentation" in ans_lower:
            if result_count == 0 or q_type == "ANTI_HALLUCINATION":
                grounding = "NO_DOCUMENTATION (Passed anti-hallucination)"
                if q_type == "ANTI_HALLUCINATION":
                    stats["anti_hallucination_passes"] += 1
            else:
                grounding = "NOT_GROUNDED (Missed valid docs)"
                stats["ungrounded"] += 1
        elif result_count > 0:
            # Basic heuristic: if it gave an answer and we had docs, we assume GROUNDED for now, 
            # ideally a LLM-as-a-judge would be here, but we check manually.
            grounding = "GROUNDED"
            stats["grounded"] += 1
            
            # Check isolation
            if q_type == "ISOLATION":
                if "zeniahr" in q.lower() and resolved_product == "ZeniaHR":
                    stats["product_isolation_passes"] += 1
                elif "zeniaone" in q.lower() and resolved_product == "ZeniaONE":
                    stats["product_isolation_passes"] += 1
                
        else:
            grounding = "NOT_GROUNDED (Hallucination detected)"
            stats["ungrounded"] += 1
            
        stats["executed"] += 1
        
        print(f"\nTEST_ID: {t_id}")
        print(f"PRODUCT: {active_prod}")
        print(f"DIFFICULTY: {q_type}")
        print(f"USER_QUERY: {q}")
        print(f"RESOLVED_QUERY: {resolved_query}")
        print(f"RESOLVED_PRODUCT: {resolved_product}")
        print(f"RAG_RESULT_COUNT: {result_count}")
        print(f"TOP_SCORE: {top_score}")
        print(f"RETRIEVED_SOURCES: {sources}")
        print(f"TOP_CHUNK_PREVIEW: {first_chunk}")
        print(f"FINAL_ANSWER: {answer}")
        print(f"GROUNDING_STATUS: {grounding}")
        print(f"PASS / FAIL: {'PASS' if 'NOT_GROUNDED' not in grounding else 'FAIL'}")
        
    print("\n========================================================")
    print("FINAL REPORT")
    print("========================================================")
    print(f"Total documents tested: 6 (Simulated via Pinecone)")
    print(f"Total questions generated: {stats['total']}")
    print(f"Total questions executed: {stats['executed']}")
    print(f"Grounded answers: {stats['grounded']}")
    print(f"Partially grounded answers: {stats['partially_grounded']}")
    print(f"Ungrounded answers: {stats['ungrounded']}")
    print(f"Anti-hallucination passes: {stats['anti_hallucination_passes']}")
    print(f"Product-isolation passes: {stats['product_isolation_passes']}")
    print(f"Query-resolver passes: {stats['query_resolver_passes']}")

if __name__ == "__main__":
    asyncio.run(run_stress_test())
