import os
import sys

# Add the zenaipex root directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from modules.query_resolver import resolve_product_from_utterance, resolve_rag_query

def run_test_case(case_num, active_product, current, previous=None, expected_product=None, expected_query_contains=None):
    conversation = []
    if previous:
        conversation.append({"role": "user", "content": previous})
        
    resolved_product = resolve_product_from_utterance(current, active_product, conversation)
    
    # Simulate how voice_advanced.py works
    active_product_after = resolved_product
    
    resolved_query_info = resolve_rag_query(current, active_product_after, conversation)
    resolved_query = resolved_query_info["resolved_query"]
    
    print(f"\n--- CASE {case_num} ---")
    print(f"current: '{current}', previous: '{previous}', active_product_start: '{active_product}'")
    print(f"-> resolved_product: '{resolved_product}'")
    print(f"-> resolved_query: '{resolved_query}'")
    
    if expected_product and resolved_product != expected_product:
        print(f"❌ FAIL: Expected product '{expected_product}', got '{resolved_product}'")
    elif expected_query_contains and expected_query_contains.lower() not in resolved_query.lower():
        print(f"❌ FAIL: Expected query to contain '{expected_query_contains}', got '{resolved_query}'")
    else:
        print("✅ PASS")

run_test_case(1, "ZeniaONE", "What is One?", expected_product="ZeniaONE", expected_query_contains="What is ZeniaONE?")
run_test_case(2, "ZeniaONE", "Explain.", "What is One?", expected_query_contains="Explain what ZeniaONE is")
run_test_case(3, "ZeniaONE", "Zen HRMS.", expected_product="ZeniaHR", expected_query_contains="ZeniaHR")
run_test_case(4, "ZeniaHR", "Explain.", "What is Zen HRMS?", expected_query_contains="ZeniaHR")
run_test_case(5, "ZeniaONE", "Chatbot", expected_query_contains="ZeniaONE chatbot")
run_test_case(6, "ZeniaHR", "Payroll", expected_query_contains="ZeniaHR payroll")
run_test_case(7, "ZeniaONE", "Integration", expected_query_contains="ZeniaONE integration")
run_test_case(8, "ZeniaHR", "What is Zen HR?", expected_product="ZeniaHR")
run_test_case(9, "ZeniaONE", "One kya hai?", expected_query_contains="ZeniaONE")
run_test_case(10, "ZeniaONE", "One", expected_product="ZeniaONE")

# Test generic "one" doesn't change unrelated sentence product
run_test_case(11, "ZeniaHR", "Is there one integration?", expected_product="ZeniaHR")
