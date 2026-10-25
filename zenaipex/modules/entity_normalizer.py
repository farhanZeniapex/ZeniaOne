"""
Entity Normalizer — canonical-term normalization for STT transcripts.

Normalizes phonetic/spelling variations of known brand/product names
back to their canonical form before sending to LLM.

Designed for extensibility: add new entities to CANONICAL_ENTITIES.
"""
import re
import logging
from typing import Optional, List, Dict

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────
# CANONICAL ENTITY REGISTRY
# Each entry: canonical name → list of known STT/phonetic variants
# All variants are stored lowercase for case-insensitive matching.
# ──────────────────────────────────────────────────────────────

CANONICAL_ENTITIES: List[Dict] = [
    {
        "canonical": "ZeniaONE",
        "variants": [
            # English variations
            "zenia one",
            "zeniaone",
            "zenya one",
            "zenyaone",
            "zenia on",
            "zenya on",
            "zeniya one",
            "zennia one",
            "zenia wan",
            "zenya wan",
            "zeniya wan",
            "zenia 1",
            "zenya 1",
            "zenia won",
            "zenya won",
            "zeniaon",
            "zenyaon",
            "virginia one",
            "danielle one",
            # Real-call STT variants (observed from Deepgram production)
            "one one",
            "जन्या 1",
            "जन्या वन",
            "जन्या one",
            "जनिया वन",
            "जनिया 1",
            "जनिया one",
            "zन्या 1",
            "zन्या वन",
            "zन्या one",
            "zेनिया वन",
            "zेनिया 1",
            "zेन्या वन",
            "zेन्या 1",
            "जन्या hr",
            "धन्यया one",
            "धन्यया 1",
            # Hindi / Devanagari variations
            "zenia वन",
            "zenya वन",
            "जेनिया वन",
            "जेन्या वन",
            "ज़ेनिया वन",
            "ज़ेन्या वन",
            "जेनिया one",
            "जेन्या one",
            "जेनिआ वन",
            "ज़ीनिया वन",
            "जेनिया 1",
            "जेन्या 1",
            "जन्यावन",
            "जेन्यावन",
            "जनियावन",
            "ज़ेन्यावन",
            "geneva वन",
            "genevaवन",
            "geneva one",
            "geneva 1",
            "geneva1",
            "geniva 1",
            "geniva one",
            "जिनेवा वन",
            "जेनेवा वन",
            "जिनेवा 1",
            "जेनेवा 1",
        ],
    },
    {
        "canonical": "ZeniaHR",
        "variants": [
            "nehr",
            "jenny eesther",
            "jenny esther",
            "zenia hr",
            "zeniahr",
            "zenya hr",
            "zenyahr",
            "jन्या sr",
            "jnia sr",
            "zenia sr",
            "zenia hr",
            "jnia hr",
            "jan hr",
            "jini hr",
            "जन्या hr",
            "जेन्या hr",
            "जनिया hr",
            "zenia h r",
            "zen hr",
            "zen hrms",
            "zenia hrms",
            "zenhr",
            "zenia human resources",
            "zenia human resource",
            "virginia hr",
            "ज़ैनन्या hr",
            "zainanya hr"
        ],
    },
    {
        "canonical": "Zenia Fleets",
        "variants": [
            "zenia fleets",
            "jnia fleets",
            "zenya fleets",
            "zenia fleet",
            "jnia fleet"
        ]
    },
    {
        "canonical": "ZeniaChat",
        "variants": [
            "zenia chat",
            "zeniachat",
            "zenya chat",
            "jnia chat"
        ]
    },
    {
        "canonical": "ZeniaPex",
        "variants": [
            "zeniapex",
            "zenia pex",
            "zenyapex",
            "zenya pex",
            "zen apex",
            "zinia pex",
            "zini apex",
            "zene packs",
            "zene pack",
            "zenia packs",
            "उजनिया pack",
            "उजनिया पैक",
            "उजनिया pex",
            "zeniapax",
            "zenia flat",
            "the n yaan tax",
            "जैन px",
            "zena packs"
        ]
    },
    {
        "canonical": "Gujarati",
        "variants": [
            "guzzerati",
            "gujrathi",
            "gujarathi",
            "gujarāti",
            "gujarati",
            "gujrati"
        ]
    }
]


# ──────────────────────────────────────────────────────────────
# Build a compiled lookup: variant → (canonical, regex pattern)
# Sorted longest-first so "zenia one" matches before "zenia on".
# ──────────────────────────────────────────────────────────────

_VARIANT_MAP: List[tuple] = []  # [(compiled_regex, canonical)]

def _build_variant_map():
    """Build sorted regex patterns from CANONICAL_ENTITIES."""
    global _VARIANT_MAP
    pairs = []
    for entity in CANONICAL_ENTITIES:
        canonical = entity["canonical"]
        for variant in entity["variants"]:
            pairs.append((variant, canonical))
    # Sort longest variant first to prevent partial matches
    pairs.sort(key=lambda p: len(p[0]), reverse=True)

    _VARIANT_MAP.clear()
    for variant, canonical in pairs:
        # Regex pattern using non-word character lookarounds to support Devanagari safely.
        # \w includes Devanagari if re.UNICODE is used, but we use a robust pattern.
        escaped = re.escape(variant)
        pattern = re.compile(
            r'(?<![^\W_])' + escaped + r'(?![^\W_])',
            re.IGNORECASE | re.UNICODE
        )
        _VARIANT_MAP.append((pattern, canonical, variant))

_build_variant_map()


# ──────────────────────────────────────────────────────────────
# PUBLIC API
# ──────────────────────────────────────────────────────────────

def normalize_entities(text: str) -> str:
    """
    Replace known STT variants of canonical entities in the transcript.

    Args:
        text: Raw transcript from STT (Deepgram).

    Returns:
        Transcript with recognized variants replaced by canonical names.
        If no variants matched, returns the original text unchanged.
    """
    if not text or not text.strip():
        return text

    result = text
    for pattern, canonical, variant in _VARIANT_MAP:
        match = pattern.search(result)
        if match:
            original_match = match.group(0)
            result = pattern.sub(canonical, result)
            logger.info(f"[STT_ENTITY_REPAIRED] original_phrase=\"{original_match}\" new_canonical=\"{canonical}\"")
            logger.info(f"[STT_REPAIR_REASON] Matches known domain variant: {variant}")
            logger.info(f"[STT_REPAIR_CONFIDENCE] HIGH (regex bounded match)")

    if result != text:
        logger.info(f"[STT_NORMALIZED] {result}")
    else:
        logger.info(f"[STT_NORMALIZED] {text}")

    return result

