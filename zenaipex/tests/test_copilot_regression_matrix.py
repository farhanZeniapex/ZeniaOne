from api.v1.admin.copilot import _looks_incomplete_answer, _question_intent


def test_qa_matrix_routes_16_realistic_questions_to_the_correct_source_family():
    cases = {
        "What is ZeniaOne?": "product_features",
        "What are inbound and outbound voice calls?": "platform_help",
        "Inbound call mein kya features hote hain?": "product_features",
        "How do I create a voice agent?": "voice_setup",
        "Knowledge Base mein kitne documents hain?": "document_inventory",
        "Kaunsa document processing mein hai?": "document_status",
        "What provider and model are active now?": "live_data",
        "Aaj kitni chats hui?": "live_data",
        "ZeniaOne ke benefits kya hain?": "benefits",
        "ZeniaOne aur ZeniaHR mein kya difference hai?": "comparison",
        "Documents me refund policy kya hai?": "knowledge",
        "How does PDF knowledge work?": "knowledge",
        "What is ZeniaOne pricing?": "pricing",
        "Latest call kya tha?": "live_data",
        "What is ZeniaChat?": "product_features",
        "ZeniaOne ko kaise use karna hai?": "platform_help",
    }
    for question, expected in cases.items():
        assert _question_intent(question)[0] == expected, question


def test_truncated_document_answer_is_rejected_before_reaching_chat_or_voice_ui():
    assert _looks_incomplete_answer("Inbound calls mein natural human-like") is True
    assert _looks_incomplete_answer("Inbound calls are customer-initiated calls to your business number.") is False

