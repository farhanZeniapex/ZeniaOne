"""Shared speech-to-text normalization for every voice surface."""

import re


"""Shared speech-to-text normalization for every voice surface."""

import re

# Non-Indic, non-Latin script patterns that indicate acoustic hallucinations (e.g. Korean Hangul, CJK, Cyrillic)
FOREIGN_SCRIPT_PATTERN = re.compile(
    r"[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f\u4e00-\u9fff\u3040-\u30ff\u0400-\u04ff]"
)

CARRIER_NOISE_PATTERNS = (
    r"^\s*(?:mucho\s+exactamente|subtitles?\s+by|thank\s+you\s+for\s+watching|amara\.org|sous-titres)\b.*$",
)

REPLACEMENTS = (
    (r"\b(?:doucmnets|documnets|documens|docments|douments)\b", "documents"),
    (r"\b(?:semia|semiya|sania|zenya|vrindavan|xenia|zenia|ganya|janya|genya)\s*(?:one|1|won)\b", "ZeniaOne"),
    (r"\b(?:ganya1|janya1|zenia1|zenya1)\b", "ZeniaOne"),
    (r"(?<!\S)(?:जन्या|जेन्या|गान्या|ज़ेन्या)\s*(?:वन|1|one)?(?=[\s.,!?]|$)", "ZeniaOne"),
    (r"(?<!\S)(?:जेनेटा|जेनिता|ज़ेनिता)(?=[\s.,!?]|$)", "ZeniaOne"),
    (r"\b(?:xenia|zenya|senia|zenia)\s*(?:hr|h\s*r|aitch\s*ar)\b", "ZeniaHR"),
    (r"\bzenia\s+pex\b", "ZeniaPex"),
    (r"\b(?:zenefits|geneta)\b", "ZeniaOne"),
    (r"\bzenya\s+ya\s+1k\b", "ZeniaOne ke"),
    (r"\bya\s+1k\b", "ya ZeniaOne ke"),
    (r"\bbest\s+akshara\b", "best features"),
    (r"\bwhat\s+is\s+1\b", "what is ZeniaOne"),
    (r"\bvai\b", "Bye"),
    (r"\bjankari\b", "jaankari"),
    (r"\btommy\b", "tamaro"),
    (r"\bjohnny\b", "jaankari"),
    (r"\bsaxo\b", "shaxo"),
    (r"\b(?:tamara|tamaro)\b", "tamari"),
    (r"\bche\b", "chhe"),
)


def normalize_voice_transcript(text: str) -> str:
    """Repair conservative, high-confidence STT variants before routing and UI display."""
    value = str(text or "").strip()
    if not value:
        return value

    # Check for known post-hangup/line noise hallucinations
    for noise_pat in CARRIER_NOISE_PATTERNS:
        if re.match(noise_pat, value, re.IGNORECASE):
            return ""

    # Strip hallucinated foreign scripts (e.g. Korean/Chinese noise from telephony barge-in)
    value = FOREIGN_SCRIPT_PATTERN.sub("", value).strip()

    # If only punctuation or whitespace remains after stripping foreign script, discard
    if not re.search(r"[\w\u0900-\u097f\u0a80-\u0aff]", value):
        return ""

    for pattern, replacement in REPLACEMENTS:
        value = re.sub(pattern, replacement, value, flags=re.IGNORECASE)

    return re.sub(r"\s+", " ", value).strip()


def normalize_voice_answer(text: str, max_chars: int = 1400) -> str:
    """Convert a model answer into concise, speakable plain text."""
    value = str(text or "").strip()
    value = re.split(r"\n\s*(?:suggested questions|follow[- ]?up questions?)\s*:?.*$", value, maxsplit=1, flags=re.IGNORECASE | re.DOTALL)[0]
    value = re.sub(r"(?m)^\s*(?:[-*•]|\d+[.)])\s+", "", value)
    value = re.sub(r"[*_~`#]", "", value)
    value = re.sub(r"[\U00010000-\U0010ffff]", "", value)
    value = re.sub(r"\s+", " ", value).strip()
    if len(value) > max_chars:
        shortened = value[:max_chars].rsplit(".", 1)[0].rstrip()
        value = (shortened + ".") if shortened else value[:max_chars].rstrip()
    return value
