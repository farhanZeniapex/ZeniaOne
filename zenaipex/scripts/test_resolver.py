import sys

def resolve_product_from_utterance(normalized_text: str, current_active_product: str, recent_conversation: list) -> str:
    """
    Determines if the active product should change based on the current utterance and recent context.
    Returns the new active product name (e.g., 'ZeniaONE' or 'ZeniaHR').
    """
    text_lower = normalized_text.lower()
    
    # ZeniaHR aliases
    hr_aliases = ["zen hr", "zen hrms", "zenia hrms", "zenhr", "zenia human resources", "zenia human resource", "zenia hr", "zeniahr"]
    if any(alias in text_lower for alias in hr_aliases):
        return "ZeniaHR"
        
    # Check for context-dependent HRMS alias
    if "hrms" in text_lower:
        # If they mention just HRMS and active is ONE, maybe they want to switch to ZeniaHR
        return "ZeniaHR"
        
    # ZeniaONE aliases
    one_aliases = ["zenia one", "zenia 1", "zeniaone", "one platform", "one product"]
    if any(alias in text_lower for alias in one_aliases):
        return "ZeniaONE"
        
    # Special "one" checks for ZeniaONE
    # "what is one", "explain one", "one kya hai", etc.
    if current_active_product == "ZeniaONE":
        words = set(text_lower.replace("?", "").replace(".", "").split())
        if "one" in words:
            # If they just say "one" in a generic way we don't switch, but we are already ONE.
            # If they say "what is one", we stay ONE.
            return "ZeniaONE"
            
    return current_active_product

def resolve_rag_query(current_utterance: str, active_product: str, recent_conversation: list) -> dict:
    """
    Contextually rewrites short follow-ups based on the active product and recent conversation.
    """
    text_lower = current_utterance.lower().strip()
    
    # If the query contains the product name explicitly, we might not need to rewrite much,
    # except converting "one" to "ZeniaONE".
    resolved_query = current_utterance
    words = text_lower.replace("?", "").replace(".", "").split()
    
    if active_product == "ZeniaONE":
        if "one" in words:
            # replace isolated "one" with "ZeniaONE" if it looks like a product mention
            if any(p in text_lower for p in ["what is one", "explain one", "one kya hai", "one kya he", "one kya h", "zenia one kya hai"]):
                resolved_query = resolved_query.replace("One", "ZeniaONE").replace("one", "ZeniaONE")
                # Handle "What is ZeniaONE" specifically
                if "what is zeniaone" in resolved_query.lower():
                    resolved_query = "What is ZeniaONE?"
            elif len(words) <= 3:
                resolved_query = resolved_query.replace("One", "ZeniaONE").replace("one", "ZeniaONE")

    # Short follow-ups
    if len(words) <= 2 or text_lower in ["explain", "explain.", "what", "what is it", "how does it work?", "how does it work"]:
        # We need to look at previous user utterance
        prev_user_utt = ""
        for msg in reversed(recent_conversation):
            if msg["role"] == "user":
                prev_user_utt = msg["content"].lower()
                break
                
        if text_lower in ["explain", "explain.", "explain please"]:
            if "what is" in prev_user_utt or "what are" in prev_user_utt or prev_user_utt in ["what is one?", "what is one"]:
                resolved_query = f"Explain what {active_product} is"
            else:
                resolved_query = f"Explain {active_product}"
        else:
            # If it's something like "chatbot" or "payroll", enrich it
            if active_product.lower() not in text_lower and "zenia" not in text_lower:
                if prev_user_utt:
                    # If previous was "what is zeniaone?", and this is "features", become "zeniaone features"
                    resolved_query = f"{active_product} {current_utterance.strip('.?!')}"
                else:
                    resolved_query = f"{active_product} {current_utterance.strip('.?!')}"
    
    return {
        "original_query": current_utterance,
        "resolved_query": resolved_query,
        "resolved_product": active_product
    }

def run_tests():
    print("--- RUNNING TESTS ---")
    
    # CASE 1
    rp = resolve_product_from_utterance("What is One?", "ZeniaONE", [])
    rq = resolve_rag_query("What is One?", "ZeniaONE", [])
    print(f"CASE 1: rp={rp}, rq={rq['resolved_query']}")
    
    # CASE 2
    rp = resolve_product_from_utterance("Explain.", "ZeniaONE", [{"role": "user", "content": "What is One?"}])
    rq = resolve_rag_query("Explain.", "ZeniaONE", [{"role": "user", "content": "What is One?"}])
    print(f"CASE 2: rp={rp}, rq={rq['resolved_query']}")
    
    # CASE 3
    rp = resolve_product_from_utterance("Zen HRMS.", "ZeniaONE", [])
    print(f"CASE 3: rp={rp}")
    
    # CASE 4
    rp = resolve_product_from_utterance("Explain.", "ZeniaHR", [{"role": "user", "content": "What is Zen HRMS?"}])
    rq = resolve_rag_query("Explain.", "ZeniaHR", [{"role": "user", "content": "What is Zen HRMS?"}])
    print(f"CASE 4: rp={rp}, rq={rq['resolved_query']}")
    
    # CASE 5
    rq = resolve_rag_query("Chatbot", "ZeniaONE", [{"role": "user", "content": "What are ZeniaONE modules?"}])
    print(f"CASE 5: rq={rq['resolved_query']}")

    # CASE 6
    rq = resolve_rag_query("Payroll", "ZeniaHR", [{"role": "user", "content": "What is ZeniaHR?"}])
    print(f"CASE 6: rq={rq['resolved_query']}")
    
    # CASE 7
    rq = resolve_rag_query("Integration", "ZeniaONE", [])
    print(f"CASE 7: rq={rq['resolved_query']}")
    
    # CASE 8
    rp = resolve_product_from_utterance("What is Zen HR?", "ZeniaHR", [])
    print(f"CASE 8: rp={rp}")

    # CASE 9
    rq = resolve_rag_query("One kya hai?", "ZeniaONE", [])
    print(f"CASE 9: rq={rq['resolved_query']}")

if __name__ == "__main__":
    run_tests()
