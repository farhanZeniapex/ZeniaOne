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
