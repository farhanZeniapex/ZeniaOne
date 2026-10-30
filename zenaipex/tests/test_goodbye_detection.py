import re
import pytest

def _is_explicit_goodbye(txt: str) -> bool:
    c = re.sub(r"[^\w\s]", " ", txt.lower()).strip()
    w = c.split()
    if not w:
        return False
    # If greeting or inquiry words are present, it is not a hangup request
    if any(greeting_w in w for greeting_w in ["hello", "hi", "hey", "namaste", "suno", "batao", "bataiye", "bhai", "yaar", "sir", "madam"]):
        return False
    hangup_phrases = [
        "cut the call", "call cut", "hang up", "phone rakh", "rakh raha", "rakh rahi",
        "talk to you later", "badme baat", "baad me baat", "tata bye bye", "bye bye", "alvida"
    ]
    if any(hp in c for hp in hangup_phrases):
        return True
    if c in {"bye", "goodbye", "alvida", "tata"}:
        return True
    return False

@pytest.mark.parametrize("text,expected", [
    ("Hello bhai", False),
    ("Hello, bye", False),
    ("Bhai suno", False),
    ("By the way", False),
    ("Nearby store", False),
    ("bye", True),
    ("goodbye", True),
    ("alvida", True),
    ("cut the call", True),
    ("call cut kar do", True),
    ("phone rakh raha hoon", True),
    ("theek hai baad me baat karte hain bye bye", True),
])
def test_explicit_goodbye(text, expected):
    assert _is_explicit_goodbye(text) == expected
