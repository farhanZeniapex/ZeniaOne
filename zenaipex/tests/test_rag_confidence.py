from ai.evaluation import RAGEvaluator
from api.v1.widget import _widget_confidence_metadata


def test_grounded_retrieval_has_confidence_without_handoff():
    result = RAGEvaluator.assess_confidence(
        max_score=0.9,
        retrieved_count=8,
        retained_count=4,
        validation_result={"grounded": True},
    )
    assert result[0] > 0.8
    assert result[1] is False


def test_missing_evidence_recommends_handoff():
    confidence, handoff, reason = RAGEvaluator.assess_confidence(
        max_score=0.0,
        retrieved_count=0,
        retained_count=0,
        validation_result={"grounded": True},
    )
    assert confidence < 0.45
    assert handoff is True
    assert reason == "weak_or_missing_knowledge_evidence"


def test_ungrounded_answer_always_recommends_handoff():
    confidence, handoff, reason = RAGEvaluator.assess_confidence(
        max_score=0.9,
        retrieved_count=4,
        retained_count=2,
        validation_result={"grounded": False},
    )
    assert confidence < 0.6
    assert handoff is True
    assert reason == "answer_not_grounded"


def test_widget_exposes_handoff_signal_for_missing_evidence():
    metadata = _widget_confidence_metadata("I do not have that information.", [])
    assert metadata["confidence_score"] < 0.45
    assert metadata["handoff_recommended"] is True
