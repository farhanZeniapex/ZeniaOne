import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

def resolve_product_from_utterance(
    normalized_text: str,
    current_active_product: str,
    recent_conversation: List[Dict[str, str]]
) -> str:
    text_lower = normalized_text.lower()
    
    # Check for strong ZeniaHR signals
    hr_aliases = ["zeniahr", "zenia hr", "zen hr", "zen hrms", "zenia hrms", "zenhr", "zenia human resources", "zenia human resource", "hrms"]
    for alias in hr_aliases:
        # We check if alias is standalone or substring? Substring is fine for specific terms.
        # But 'hrms' should probably be bounded, but user said 'HRMS when context indicates the Zenia product', 
        # let's just check if alias in text_lower.
        if alias in text_lower:
            # Special case for HRMS
            if alias == "hrms":
                if current_active_product == "ZeniaHR":
                    return "ZeniaHR"
                for msg in reversed(recent_conversation[-5:]):
                    if "zeniahr" in msg.get("content", "").lower() or "zen hr" in msg.get("content", "").lower():
                        return "ZeniaHR"
                # if 'hrms' is mentioned alone with no context, it could just be a general question, but usually implies ZeniaHR.
                return "ZeniaHR"
            return "ZeniaHR"
            
    # Check for strong ZeniaONE signals
    one_strong_aliases = ["zeniaone", "zenia one", "zenia 1", "zeniaone", "one platform", "one product", "what is one", "what's one", "one kya hai", "one kya he", "one kya h", "explain one", "zenia one kya hai"]
    for alias in one_strong_aliases:
        if alias in text_lower:
            return "ZeniaONE"
            
    # Conditional "One" resolution
    words = text_lower.replace("?", "").replace(".", "").split()
    if "one" in words:
        if current_active_product == "ZeniaONE":
            return "ZeniaONE"
        # check if recent conversation mentions ZeniaONE
        for msg in reversed(recent_conversation[-5:]):
            content_lower = msg.get("content", "").lower()
            if "zeniaone" in content_lower or "zenia one" in content_lower:
                return "ZeniaONE"
                
    return current_active_product

def resolve_rag_query(
    current_utterance: str,
    active_product: str,
    recent_conversation: List[Dict[str, str]]
) -> Dict[str, Any]:
    text_lower = current_utterance.lower().strip().rstrip(".?")
    
    # 1. Direct product mappings as requested by user
    one_queries = ["what is one", "one kya hai", "one kya he", "one kya h", "explain one", "one platform", "zenia one kya hai"]
    if text_lower in one_queries or (text_lower == "one" and active_product == "ZeniaONE"):
        if active_product == "ZeniaONE":
            resolved_query = "What is ZeniaONE?"
            logger.info(
                f"[QUERY_RESOLVER]\n"
                f"original=\"{current_utterance}\"\n"
                f"active_product=\"{active_product}\"\n"
                f"resolved_query=\"{resolved_query}\"\n"
                f"reason=\"direct_one_mapping\""
            )
            return {
                "original_query": current_utterance,
                "resolved_query": resolved_query,
                "resolved_product": active_product
            }
            
    hr_queries = ["zen hrms", "zen hrms kya hai", "zenia hrms", "zenia hr", "zen hr", "zeniahr"]
    if text_lower in hr_queries:
        resolved_query = "What is ZeniaHR?" if "what" in text_lower or "kya" in text_lower else "ZeniaHR"
        logger.info(
            f"[QUERY_RESOLVER]\n"
            f"original=\"{current_utterance}\"\n"
            f"active_product=\"{active_product}\"\n"
            f"resolved_query=\"{resolved_query}\"\n"
            f"reason=\"direct_hr_mapping\""
        )
        return {
            "original_query": current_utterance,
            "resolved_query": resolved_query,
            "resolved_product": active_product
        }
    
    resolved_query = current_utterance
    
    # 2. Contextual rewrites for short follow-ups
    short_followups = ["explain", "tell me more", "how does it work", "what is it"]
    is_short = text_lower in short_followups or len(text_lower.split()) <= 2
    
    if is_short:
        # Check previous user turn
        prev_user = ""
        for msg in reversed(recent_conversation):
            if msg.get("role") == "user":
                prev_user = msg.get("content", "").lower()
                break
                
        if "explain" in text_lower or "what is it" in text_lower or "tell me more" in text_lower:
            if "what is one" in prev_user or "zeniaone" in prev_user or "zenia one" in prev_user:
                resolved_query = "Explain what ZeniaONE is"
            elif "zen hrms" in prev_user or "zeniahr" in prev_user or "zenia hr" in prev_user or "zen hr" in prev_user:
                resolved_query = "Explain what ZeniaHR is"
            elif active_product:
                resolved_query = f"Explain what {active_product} is"
        elif "how does it work" in text_lower:
            # Assuming prev_user has something like "Does ZeniaHR have payroll?"
            if prev_user:
                # Basic substitution
                resolved_query = f"How does {prev_user} work?"
                if active_product and active_product.lower() not in resolved_query.lower():
                    resolved_query = f"How does {active_product} {prev_user} work?"
        else:
            # Just append product name if it's a short keyword like "Integration", "Payroll", "Chatbot"
            # But only if the product name isn't already in it
            if active_product and active_product.lower() not in text_lower:
                resolved_query = f"{active_product} {current_utterance.strip(' .?')}"
                
        logger.info(
            f"[QUERY_RESOLVER]\n"
            f"original=\"{current_utterance}\"\n"
            f"active_product=\"{active_product}\"\n"
            f"resolved_query=\"{resolved_query}\"\n"
            f"reason=\"contextual_followup\""
        )
    else:
        logger.info(
            f"[QUERY_RESOLVER]\n"
            f"original=\"{current_utterance}\"\n"
            f"active_product=\"{active_product}\"\n"
            f"resolved_query=\"{resolved_query}\"\n"
            f"reason=\"pass_through\""
        )

    return {
        "original_query": current_utterance,
        "resolved_query": resolved_query,
        "resolved_product": active_product
    }
