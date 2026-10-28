from services.voice_input_normalizer import normalize_voice_answer, normalize_voice_transcript


def test_normalizes_entities_and_document_typos():
    assert normalize_voice_transcript("konsa doucmnets processing mehe") == "konsa documents processing mehe"
    assert normalize_voice_transcript("what is xenia hr") == "what is ZeniaHR"
    assert normalize_voice_transcript("zenia pex ke products") == "ZeniaPex ke products"


def test_does_not_rewrite_normal_text():
    value = "Knowledge Base me kaunsa document ready hai"
    assert normalize_voice_transcript(value) == value


def test_voice_answer_is_plain_and_bounded():
    answer = normalize_voice_answer("**Step 1:** Do this\n- Then do that\nSuggested questions: ...")
    assert answer == "Step 1: Do this Then do that"
    assert "Suggested questions" not in answer
