import re
import pytest

def _is_explicit_goodbye(txt: str) -> bool:
    c = re.sub(r"[^\w\s]", " ", txt.lower()).strip()
    words = c.split()
    if not words:
        return False
    inquiry_words = {"suno", "batao", "bataiye", "kya", "kaise", "kyu", "kaha", "how", "what", "where", "why"}
    if any(iw in words for iw in inquiry_words):
        return False
    greeting_words = {"hello", "hi", "hey", "namaste", "bhai", "yaar"}
    if any(gw in words for gw in greeting_words):
        explicit_phrases = ["cut the call", "call cut", "hang up", "phone rakh", "rakh raha", "rakh rahi"]
        return any(ep in c for ep in explicit_phrases)

    hangup_phrases = [
        "cut the call", "call cut", "hang up", "phone rakh", "rakh raha", "rakh rahi",
        "talk to you later", "badme baat", "baad me baat", "tata bye bye", "bye bye",
        "thank you bye", "thanks bye", "theek hai bye", "thik hai bye", "chalo bye"
    ]
    if any(hp in c for hp in hangup_phrases):
        return True
        
    farewell_words = {"bye", "goodbye", "alvida", "tata"}
    if any(fw in words for fw in farewell_words):
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
    ("Thank you. Bye. Goodbye.", True),
    ("Thank you bye", True),
    ("Theek hai bye", True),
    ("chalo bye", True),
    ("What is ZeniaONE?", False),
])
def test_explicit_goodbye(text, expected):
    assert _is_explicit_goodbye(text) == expected
