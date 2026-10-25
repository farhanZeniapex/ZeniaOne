"""
Local tests for modules/entity_normalizer.py
Verifies ZeniaONE canonical normalization across
English, Hindi, Hinglish, and negative cases.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import logging
logging.basicConfig(level=logging.DEBUG, format="%(name)s: %(message)s")
logger = logging.getLogger("entity_test")

from modules.entity_normalizer import normalize_entities

PASS = 0
FAIL = 0

def check(label, input_text, expected_entity, expect_present=True):
    global PASS, FAIL
    result = normalize_entities(input_text)
    if expect_present:
        if expected_entity in result:
            logger.info(f"  ✅ {label}")
            logger.info(f"     input:    \"{input_text}\"")
            logger.info(f"     output:   \"{result}\"")
            PASS += 1
        else:
            logger.error(f"  ❌ {label}")
            logger.error(f"     input:    \"{input_text}\"")
            logger.error(f"     expected: \"{expected_entity}\" in output")
            logger.error(f"     got:      \"{result}\"")
            FAIL += 1
    else:
        if expected_entity not in result:
            logger.info(f"  ✅ {label} (negative)")
            logger.info(f"     input:    \"{input_text}\"")
            logger.info(f"     output:   \"{result}\" (correctly unchanged)")
            PASS += 1
        else:
            logger.error(f"  ❌ {label} (negative)")
            logger.error(f"     input:    \"{input_text}\"")
            logger.error(f"     expected: \"{expected_entity}\" NOT in output")
            logger.error(f"     got:      \"{result}\"")
            FAIL += 1


logger.info("=" * 60)
logger.info("ENTITY NORMALIZER TEST SUITE")
logger.info("=" * 60)

# ── Required test cases from specification ──

logger.info("\n── English variants ──")
check("Zenia One (spaced)",
      "Zenia One kya hai?",
      "ZeniaONE")

check("Zenya One (phonetic)",
      "Zenya One ka HRMS batao",
      "ZeniaONE")

check("Zeniaone (concatenated)",
      "Zeniaone me recruitment kaise hota hai?",
      "ZeniaONE")

check("Zenia On (truncated)",
      "Zenia On HRMS",
      "ZeniaONE")

check("Zeniya One (phonetic variant)",
      "Zeniya One ke features kya hain?",
      "ZeniaONE")

check("Zennia One (double-n)",
      "Zennia One pricing batao",
      "ZeniaONE")

check("Zenia Wan (phonetic)",
      "Zenia Wan me kya hai?",
      "ZeniaONE")

logger.info("\n── Hindi / Devanagari variants ──")
check("जेनिया वन (Devanagari)",
      "जेनिया वन के features batao",
      "ZeniaONE")

check("जेन्या वन (Devanagari alternate)",
      "जेन्या वन kya hai?",
      "ZeniaONE")

check("Zenia वन (mixed script)",
      "Zenia वन ke features batao.",
      "ZeniaONE")

logger.info("\n── Hinglish sentences ──")
check("Hinglish full sentence",
      "Zenia One kya he?",
      "ZeniaONE")

check("Hinglish HRMS query",
      "Zenya One me HRMS kaise kaam karta hai?",
      "ZeniaONE")

logger.info("\n── Case insensitivity ──")
check("ZENIA ONE (uppercase)",
      "ZENIA ONE is the best",
      "ZeniaONE")

check("zenia one (lowercase)",
      "zenia one kya hai?",
      "ZeniaONE")

logger.info("\n── Negative tests (must NOT normalize) ──")
check("Unrelated word 'xenia'",
      "Xenia is a nice name",
      "ZeniaONE", expect_present=False)

check("Unrelated word 'one'",
      "Give me one example",
      "ZeniaONE", expect_present=False)

check("Unrelated sentence",
      "How does recruitment work in your company?",
      "ZeniaONE", expect_present=False)

check("Similar but different 'Zen AI'",
      "Zen AI is a meditation app",
      "ZeniaONE", expect_present=False)

check("Empty string",
      "",
      "ZeniaONE", expect_present=False)

logger.info("\n── Edge cases ──")
check("Already canonical ZeniaONE",
      "ZeniaONE is great",
      "ZeniaONE")

check("Multiple variants in one sentence",
      "Zenia One aur Zenya One same hai?",
      "ZeniaONE")

# Summary
logger.info("\n" + "=" * 60)
if FAIL == 0:
    logger.info(f"ALL {PASS} TESTS PASSED ✅")
else:
    logger.error(f"{PASS} passed, {FAIL} FAILED ❌")
logger.info("=" * 60)

sys.exit(1 if FAIL > 0 else 0)
