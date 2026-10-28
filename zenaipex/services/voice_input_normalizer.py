"""Shared speech-to-text normalization for every voice surface."""

import re


def normalize_voice_transcript(text: str) -> str:
    """Repair conservative, high-confidence STT variants before routing."""
    value = str(text or "").strip()
    if not value:
        return value
    replacements = (
        (r"\b(?:doucmnets|documnets|documens|docments|douments)\b", "documents"),
        (r"\b(?:semia|semiya|sania|zenya|vrindavan|xenia|zenia)\s*(?:one|1|won)\b", "ZeniaOne"),
        (r"\b(?:xenia|zenya|senia|zenia)\s*(?:hr|h\s*r|aitch\s*ar)\b", "ZeniaHR"),
        (r"\bzenia\s+pex\b", "ZeniaPex"),
        (r"\bbest\s+akshara\b", "best features"),
        (r"\bwhat\s+is\s+1\b", "what is ZeniaOne"),
        (r"\bjankari\b", "jaankari"),
        (r"\btommy\b", "tamaro"),
        (r"\bjohnny\b", "jaankari"),
        (r"\bsaxo\b", "shaxo"),
        (r"\b(?:tamara|tamaro)\b", "tamari"),
        (r"\bche\b", "chhe"),
    )
    for pattern, replacement in replacements:
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
