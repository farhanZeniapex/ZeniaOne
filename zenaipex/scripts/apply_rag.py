import re
import os

file_path = r'd:\zeniaOne-Voice-Assistant\zenaipex\api\v1\voice_advanced.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update fetch_llm_response signature and system prompt
fetch_pattern = re.compile(r'(async def fetch_llm_response\(conversation_history)(.*?)(payload = \{)', re.DOTALL)

def fetch_replacement(match):
    prefix = match.group(1)
    return """async def fetch_llm_response(conversation_history, active_product="ZeniaONE", rag_pipeline=None, latest_utterance=""):
    \"\"\"
    STEP 2: Brain - Groq LLM inference with Product-Aware RAG.
    \"\"\"
    url = "https://api.groq.com/openai/v1/chat/completions"
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    
    context_text = ""
    if rag_pipeline and rag_pipeline.should_retrieve(latest_utterance):
        docs = await rag_pipeline.retrieve(latest_utterance)
        accepted_chunks = []
        rejected = 0
        for doc in docs:
            text = doc.get("text", "").lower()
            source = str(doc.get("metadata", {}).get("source", "")).lower()
            if active_product == "ZeniaONE":
                if ("zeniahr" in text or "zenia hr" in text or "zeniahr" in source or "zenia hr" in source) and \
                   ("zeniaone" not in text and "zenia one" not in text):
                    rejected += 1
                    continue
            elif active_product == "ZeniaHR":
                if ("zeniaone" in text or "zenia one" in text or "zeniaone" in source or "zenia one" in source) and \
                   ("zeniahr" not in text and "zenia hr" not in text):
                    rejected += 1
                    continue
            accepted_chunks.append(doc)
            
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"[KNOWLEDGE_FILTER] requested_product=\"{active_product}\" accepted_chunks={len(accepted_chunks)} rejected_cross_product_chunks={rejected}")
        
        context_text = rag_pipeline.format_context(accepted_chunks)
        top_score = docs[0].get('score', 0.0) if docs else 0.0
        
        retrieved_products = set()
        retrieved_sources = set()
        for doc in accepted_chunks:
            text = doc.get("text", "").lower()
            source = str(doc.get("metadata", {}).get("source", ""))
            retrieved_sources.add(source)
            if "zeniahr" in text or "zenia hr" in text:
                retrieved_products.add("ZeniaHR")
            if "zeniaone" in text or "zenia one" in text:
                retrieved_products.add("ZeniaONE")
                
        logger.info(f"[KNOWLEDGE] query=\"{latest_utterance}\" active_product=\"{active_product}\" results_count={len(docs)} top_score={top_score} retrieved_products={list(retrieved_products)} retrieved_sources={list(retrieved_sources)} retrieved_sections=[]")
        logger.info(f"[VOICE_PIPELINE] KNOWLEDGE_CONTEXT_SENT_TO_LLM={bool(context_text)}")
    
    system_prompt_content = f\"\"\"You are Zenia, a product-aware AI Voice assistant for the ZeniaPex ecosystem.

ZeniaPex is the parent/main ecosystem.
ZeniaONE and ZeniaHR are separate products.
Never assume that a feature documented for one product exists in another product.
Use the retrieved product-specific documentation as the source of truth.
If the user asks about ZeniaHR, use ZeniaHR knowledge.
If the user asks about ZeniaONE, use ZeniaONE knowledge.
Never transfer features between products.
If the requested feature is not documented for the requested product, clearly say that the available documentation does not specify that feature.
Never invent product capabilities.
Currently, the user is talking about: {active_product}

CRITICAL VOICE RULES:
1. LANGUAGE POLICY:
   - If user speaks English -> Reply in English.
   - If user speaks Hindi -> Reply in Hindi.
   - If user speaks Gujarati -> Reply in Gujarati.
   - If user speaks Hinglish -> Reply in natural Hinglish.
   - If user speaks Gujarati-English -> Reply in natural Gujarati-English.
   - NEVER switch to English merely because previous conversation was in English.
2. LENGTH: You are on a PHONE CALL. Be extremely concise. Simple question -> 1 short sentence. Normal -> 1-2 short sentences. Complex -> max 3 short sentences. NEVER give long paragraphs.
3. GREETINGS: For greetings like 'Hello', give a short polite response. Never return empty.
4. SMART FOLLOW-UP: After answering, optionally add ONE short relevant suggestion. Suggestions MUST relate to the current product ({active_product}) and retrieved knowledge. Do NOT mix products in suggestions. Do NOT repeat the same follow-up.
5. NO REPETITION: Do not repeat the user's question. Answer directly.
6. NO FORMATTING: No emojis, no markdown, no bullet points. Plain conversational text only.
7. NATURAL: Speak like a real human on a phone. Be concise, warm, helpful.
8. BRAND: Always spell the product as 'ZeniaONE' or 'ZeniaHR'. Never misspell it.\"\"\"

    if context_text:
        system_prompt_content += f\"\\n\\n--- RETRIEVED KNOWLEDGE FOR {active_product} ---\\n{context_text}\\n-------------------\"

    system_prompt = {
        "role": "system",
        "content": system_prompt_content
    }
    
    messages = [system_prompt] + conversation_history

    payload = {"""

new_content = fetch_pattern.sub(fetch_replacement, content)

# 2. Add imports, state and rag init to exotel_media_stream
stream_pattern = re.compile(r'(conversation_history = \[\]\s*)(# Barge-in event.*?cancel_event = asyncio\.Event\(\))', re.DOTALL)

def stream_replacement(match):
    return """conversation_history = []
    active_product = "ZeniaONE"
    
    from core.database import col_agents
    from bson import ObjectId
    from ai.rag import get_rag_pipeline
    try:
        agent_doc = await col_agents().find_one({"_id": ObjectId(agent_id)})
    except:
        agent_doc = {}
    rag_pipeline = get_rag_pipeline(company_id, agent_doc)
    
    """ + match.group(2)

new_content = stream_pattern.sub(stream_replacement, new_content)

# 3. Add context injection to _process_utterance
process_pattern = re.compile(r'(conversation_history\.append\(\{"role": "user", "content": final_text\}\).*?)(ai_response = await fetch_llm_response\(conversation_history\))', re.DOTALL)

def process_replacement(match):
    return """
                    nonlocal active_product
                    normalized_text = normalize_entities(final_text)
                    
                    if "ZeniaHR" in normalized_text or "Zenia HR" in normalized_text:
                        active_product = "ZeniaHR"
                    elif "ZeniaONE" in normalized_text or "Zenia One" in normalized_text:
                        active_product = "ZeniaONE"
                        
                    logger.info(f"[VOICE_PIPELINE] PRODUCT_CONTEXT={active_product}")
                    logger.info(f"[VOICE_PIPELINE] PRODUCT_RESOLVED={normalized_text}")

                    conversation_history.append({"role": "user", "content": normalized_text})
                    if conversation_id:
                        await add_message(company_id, conversation_id, "user", final_text)
                        
                    ai_response = await fetch_llm_response(conversation_history, active_product, rag_pipeline, normalized_text)"""

new_content = process_pattern.sub(process_replacement, new_content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)
print("Updated successfully")
