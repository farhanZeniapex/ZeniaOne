import re
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

class RAGEvaluator:
    """
    Phase 7: Advanced RAG Evaluation & Diagnostics.
    Provides deterministic checks for answer grounding and safely calculates retrieval metrics.
    """
    
    @staticmethod
    def validate_grounding(answer: str, context_docs: Optional[List[Dict[str, Any]]]) -> Dict[str, Any]:
        """
        Deterministic validation of the LLM's answer against the provided context.
        Ensures the LLM didn't hallucinate dates or specific identifiers.
        """
        if not answer or not context_docs:
            return {"grounded": True, "warnings": []}
            
        warnings = []
        combined_context = " ".join([d.get("text", "") for d in context_docs]).lower()
        
        # 1. Date hallucination check (e.g. 2024, 30 days, etc.)
        # Extract years and simple numbers from answer
        answer_years = set(re.findall(r'\b(20\d{2})\b', answer))
        for year in answer_years:
            if year not in combined_context:
                warnings.append(f"Potential hallucination: Year {year} not found in context.")
                
        # Extract specific IDs like EMP-123
        answer_ids = set(re.findall(r'\b[A-Z]{2,4}-\d{3,5}\b', answer))
        for aid in answer_ids:
            if aid.lower() not in combined_context:
                warnings.append(f"Potential hallucination: Identifier {aid} not found in context.")
                
        is_grounded = len(warnings) == 0
        return {
            "grounded": is_grounded,
            "warnings": warnings,
            "evidence_coverage": min(1.0, len(context_docs) / 8.0) # Simple metric
        }

    @staticmethod
    def generate_diagnostics(
        queries: List[str],
        retrieved_count: int,
        retained_count: int,
        scores: List[float],
        retrieval_latency: float,
        generation_latency: float,
        validation_result: Dict[str, Any],
        request_id: str = "REQ-UNKNOWN"
    ) -> Dict[str, Any]:
        """
        Safely generate internal metrics without logging raw context.
        """
        max_score = max(scores) if scores else 0.0
        
        # Detect common failures
        failures = []
        if retained_count == 0 and retrieved_count > 0:
            failures.append("Relevance gate blocked all candidates (low relevance).")
        if max_score < 0.3 and retained_count > 0:
            failures.append("Weak ranking: top score is below 0.3.")
        if not validation_result["grounded"]:
            failures.append("Answer grounding validation failed.")
            
        confidence_score, handoff_recommended, handoff_reason = RAGEvaluator.assess_confidence(
            max_score=max_score,
            retrieved_count=retrieved_count,
            retained_count=retained_count,
            validation_result=validation_result,
        )

        diagnostics = {
            "queries": queries,
            "candidates_retrieved": retrieved_count,
            "candidates_retained": retained_count,
            "top_score": round(max_score, 3),
            "retrieval_latency_sec": round(retrieval_latency, 3),
            "generation_latency_sec": round(generation_latency, 3),
            "grounding_warnings": validation_result["warnings"],
            "failures_detected": failures
            ,"confidence_score": confidence_score
            ,"handoff_recommended": handoff_recommended
            ,"handoff_reason": handoff_reason
        }
        
        if failures:
            logger.warning(f"[{request_id}] RAG Diagnostics Failures for query '{queries[0][:20]}...': {failures}")
            
        weak_ranking = any("Weak ranking" in f for f in failures)
        reason = "top score below threshold" if weak_ranking else ""
        weak_str = f"Weak Ranking: true\nReason: {reason}" if weak_ranking else "Weak Ranking: false"
        
        logger.info(f"[{request_id}] RAG QUALITY\nTop Score: {max_score:.2f}\nCandidates: {retrieved_count}\nRetained: {retained_count}\n{weak_str}")
            
        return diagnostics

    @staticmethod
    def assess_confidence(
        *,
        max_score: float,
        retrieved_count: int,
        retained_count: int,
        validation_result: Dict[str, Any],
    ) -> tuple[float, bool, str]:
        """Return a conservative confidence signal and human-handoff reason.

        This is an operational signal, not a claim that the model knows the
        truth. It combines retrieval evidence with deterministic grounding
        checks and is intentionally exposed to callers for UI/handoff logic.
        """
        grounded = bool(validation_result.get("grounded", False))
        if retrieved_count == 0 and retained_count == 0:
            confidence = 0.35
        else:
            evidence = min(1.0, retained_count / 4.0)
            confidence = 0.20 + (0.55 * max(0.0, min(1.0, max_score))) + (0.20 * evidence)
        if not grounded:
            confidence -= 0.30
        confidence = round(max(0.0, min(0.99, confidence)), 3)

        if not grounded:
            return confidence, True, "answer_not_grounded"
        if confidence < 0.45:
            return confidence, True, "weak_or_missing_knowledge_evidence"
        return confidence, False, ""
