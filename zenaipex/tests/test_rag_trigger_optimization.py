import pytest
from ai.rag import should_use_rag

@pytest.mark.parametrize("query,expected", [
    ("Hello, kaise ho?", False),
    ("Hello, meri aawaz aa rahi hai?", False),
    ("meri awaz aa rahi hai", False),
    ("sun rahe ho?", False),
    ("can you hear me?", False),
    ("kya haal hai?", False),
    ("Zenia One ke bare me batao", True),
    ("ZeniaOne features", True),
    ("pricing kya hai?", True),
    ("what are the plans and costs?", True),
])
def test_should_use_rag(query, expected):
    assert should_use_rag(query) == expected

