from api.v1.admin.copilot import _question_intent


def test_small_talk_is_not_live_data():
    for question in ("hi", "hello how are you", "Good morning", "Kem cho?", "Aaj mood kaisa hai?"):
        assert _question_intent(question)[0] == "small_talk"


def test_product_questions_use_product_sources():
    cases = {
        "ZeniaOne ke main features kya hain?": "product_features",
        "ZeniaOne mere kis kaam aa sakta hai?": "benefits",
        "ZeniaOne aur ZeniaHR me kya difference hai?": "comparison",
        "Calling ke liye AI agent kaise banate hain?": "voice_setup",
    }
    for question, expected in cases.items():
        assert _question_intent(question)[0] == expected


def test_live_questions_remain_live_data():
    for question in ("aaj kitni chats hui?", "Aaje ketla calls aavya?", "latest call kya hai?"):
        assert _question_intent(question)[0] == "live_data"
