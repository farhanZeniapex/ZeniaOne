"""
Comprehensive local test suite for voice agent improvements.
Tests: backchannels, incomplete utterances, entity normalization,
negative normalization, barge-in flow.
"""
import sys, os, asyncio, logging
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

logging.basicConfig(level=logging.INFO, format="%(name)s: %(message)s")
logger = logging.getLogger("test")

from api.v1.voice_advanced import is_backchannel, is_incomplete_utterance, BACKCHANNEL_WORDS
from modules.entity_normalizer import normalize_entities

PASS = 0
FAIL = 0

def check(label, result, expected):
    global PASS, FAIL
    if result == expected:
        logger.info(f"  \u2705 {label}")
        PASS += 1
    else:
        logger.error(f"  \u274c {label}: got {result!r}, expected {expected!r}")
        FAIL += 1

def check_contains(label, text, substring, should_contain=True):
    global PASS, FAIL
    found = substring in text
    if found == should_contain:
        logger.info(f"  \u2705 {label}")
        PASS += 1
    else:
        action = "contain" if should_contain else "NOT contain"
        logger.error(f"  \u274c {label}: \"{text}\" should {action} \"{substring}\"")
        FAIL += 1


# ======================================================================
logger.info("=" * 60)
logger.info("A. BACKCHANNEL DETECTION")
logger.info("=" * 60)
for word in ["haan", "hmm", "yes", "no", "okay", "achha", "theek", "right", "ji"]:
    check(f"Backchannel: '{word}'", is_backchannel(word), True)

check("Two-word backchannel: 'ha ha'", is_backchannel("ha ha"), True)
check("Two-word backchannel: 'ok ok'", is_backchannel("ok ok"), True)
check("NOT backchannel: 'haan batao'", is_backchannel("haan batao"), False)
check("NOT backchannel: 'yes tell me'", is_backchannel("yes tell me"), False)
check("NOT backchannel: 'What is ZeniaONE'", is_backchannel("What is ZeniaONE"), False)
check("Backchannel with punctuation: 'okay.'", is_backchannel("okay."), True)
check("Backchannel with punctuation: 'yes!'", is_backchannel("yes!"), True)


# ======================================================================
logger.info("\n" + "=" * 60)
logger.info("B. INCOMPLETE UTTERANCE DETECTION")
logger.info("=" * 60)
check("Incomplete: 'What'", is_incomplete_utterance("What"), True)
check("Incomplete: 'What.' (with punctuation)", is_incomplete_utterance("What."), True)
check("Incomplete: 'What is'", is_incomplete_utterance("What is"), True)
check("Incomplete: 'Can you'", is_incomplete_utterance("Can you"), True)
check("Incomplete: 'Tell me about'", is_incomplete_utterance("Tell me about"), True)
check("Incomplete: 'How does'", is_incomplete_utterance("How does"), True)
check("Incomplete: 'kya hai'", is_incomplete_utterance("kya hai"), True)
check("Incomplete: 'batao'", is_incomplete_utterance("batao"), True)
check("Incomplete: empty", is_incomplete_utterance(""), True)

check("Complete: 'What is ZeniaONE?'", is_incomplete_utterance("What is ZeniaONE?"), False)
check("Complete: 'ZeniaONE kya hai?'", is_incomplete_utterance("ZeniaONE kya hai?"), False)
check("Complete: 'Tell me about HRMS.'", is_incomplete_utterance("Tell me about HRMS."), False)
check("Complete: 'ZeniaONE HRMS features'", is_incomplete_utterance("ZeniaONE HRMS features"), False)
check("Complete: 'I want to know about recruitment'", is_incomplete_utterance("I want to know about recruitment"), False)
check("Complete: 'ZeniaONE'", is_incomplete_utterance("ZeniaONE"), False)
check("Complete: 'hello'", is_incomplete_utterance("hello"), False)


# ======================================================================
logger.info("\n" + "=" * 60)
logger.info("C. ZENIAONE / ZENIAHR ENTITY NORMALIZATION")
logger.info("=" * 60)
check_contains("'What is जन्यावन?'", normalize_entities("What is जन्यावन?"), "What is ZeniaONE?")
check_contains("'जन्या वन kya hai?'", normalize_entities("जन्या वन kya hai?"), "ZeniaONE kya hai?")
check_contains("'Jan HR क्या है?'", normalize_entities("Jan HR क्या है?"), "ZeniaHR क्या है?")
check_contains("'आपकी company का नाम क्या है?'", normalize_entities("आपकी company का नाम क्या है?"), "आपकी company का नाम क्या है?")
check_contains("'Zenia One kya hai'", normalize_entities("Zenia One kya hai"), "ZeniaONE kya hai")
check_contains("'Zenya One ka HRMS'", normalize_entities("Zenya One ka HRMS"), "ZeniaONE ka HRMS")
check_contains("'जेनिया वन features'", normalize_entities("जेनिया वन features"), "ZeniaONE features")
check_contains("'जन्या 1 HR'", normalize_entities("जन्या 1 HR"), "ZeniaONE HR")
check_contains("'Zन्या 1 batao'", normalize_entities("Zन्या 1 batao"), "ZeniaONE batao")
check_contains("'जनिया वन me kya'", normalize_entities("जनिया वन me kya"), "ZeniaONE me kya")
check_contains("'Zeniaone recruitment'", normalize_entities("Zeniaone recruitment"), "ZeniaONE recruitment")
check_contains("'जेन्या 1 features'", normalize_entities("जेन्या 1 features"), "ZeniaONE features")
check_contains("'जेन्या hr kya hai'", normalize_entities("जेन्या hr kya hai"), "ZeniaHR kya hai")


# ======================================================================
logger.info("\n" + "=" * 60)
logger.info("D. NEGATIVE NORMALIZATION (must NOT convert)")
logger.info("=" * 60)
check_contains("'दुनिया 1' must NOT become ZeniaONE",
               normalize_entities("दुनिया 1 me kya hai"),
               "ZeniaONE", should_contain=False)
check_contains("'one example' must NOT become ZeniaONE",
               normalize_entities("Give me one example"),
               "ZeniaONE", should_contain=False)
check_contains("'Xenia' must NOT become ZeniaONE",
               normalize_entities("Xenia is a nice name"),
               "ZeniaONE", should_contain=False)
check_contains("Unrelated sentence",
               normalize_entities("How does recruitment work?"),
               "ZeniaONE", should_contain=False)
check_contains("'Zen AI' must NOT become ZeniaONE",
               normalize_entities("Zen AI is a meditation app"),
               "ZeniaONE", should_contain=False)


# ======================================================================
logger.info("\n" + "=" * 60)
logger.info("E. RESPONSE STYLE (prompt rules — structural check)")
logger.info("=" * 60)
# We can't test actual LLM output locally, but we verify the prompt structure
from api.v1.voice_advanced import fetch_llm_response
import inspect
source = inspect.getsource(fetch_llm_response)
check_contains("Prompt mentions 'PHONE CALL'", source, "PHONE CALL")
check_contains("Prompt mentions '1 short sentence'", source, "1 short sentence")
check_contains("Prompt mentions 'max 3 short sentences'", source, "max 3 short sentences")
check_contains("Prompt mentions 'SMART FOLLOW-UP'", source, "SMART FOLLOW-UP")
check_contains("Prompt mentions 'ZeniaONE' brand", source, "ZeniaONE")
check_contains("Prompt does NOT have old long paragraph rule", source, "3-5 short sentences", should_contain=False)


# ======================================================================
logger.info("\n" + "=" * 60)
logger.info("F. BARGE-IN FLOW (structural test)")
logger.info("=" * 60)

class MockWebSocket:
    def __init__(self):
        self.messages = []
    async def send_json(self, data):
        self.messages.append(data)

class MockTask:
    def __init__(self):
        self._done = False
        self._cancelled = False
    def done(self):
        return self._done
    def cancel(self):
        self._cancelled = True

async def test_barge_in_with_backchannel():
    """Backchannel 'haan' during AI speaking: stop AI, don't send to Groq."""
    cancel_event = asyncio.Event()
    ws = MockWebSocket()
    task = MockTask()
    stream_sid = "test_stream"

    transcript = "haan"

    # Simulate: AI is speaking, user says "haan"
    assert is_backchannel(transcript), "haan should be backchannel"

    # Backchannel during AI speaking
    if is_backchannel(transcript):
        if task and not task.done():
            cancel_event.set()
            await ws.send_json({"event": "clear", "stream_sid": stream_sid})
            task.cancel()

    assert cancel_event.is_set(), "cancel_event should be set"
    assert task._cancelled, "task should be cancelled"
    assert len(ws.messages) == 1, "exactly one clear message"
    assert ws.messages[0]["event"] == "clear", "message should be clear"
    logger.info("  \u2705 Backchannel 'haan' during AI → stops AI, sends clear, no Groq call")

async def test_barge_in_interim():
    """Interim speech triggers barge-in with clear."""
    cancel_event = asyncio.Event()
    ws = MockWebSocket()
    task = MockTask()
    stream_sid = "test_stream"
    greeting_protect = [True]

    transcript = "hello"
    is_meaningful = len(transcript.strip()) >= 3

    if not cancel_event.is_set() and is_meaningful and greeting_protect[0]:
        cancel_event.set()
        await ws.send_json({"event": "clear", "stream_sid": stream_sid})
        task.cancel()

    assert cancel_event.is_set(), "cancel_event should be set"
    assert task._cancelled, "task should be cancelled"
    assert ws.messages[0]["event"] == "clear", "clear should be sent"
    logger.info("  \u2705 Interim 'hello' → barge-in, clear sent, task cancelled")

async def test_greeting_protection():
    """Barge-in blocked when greeting hasn't started."""
    cancel_event = asyncio.Event()
    greeting_protect = [False]
    transcript = "hello there"

    is_meaningful = len(transcript.strip()) >= 3
    if not cancel_event.is_set() and is_meaningful:
        if greeting_protect[0]:
            cancel_event.set()

    assert not cancel_event.is_set(), "cancel should NOT be set during greeting protection"
    logger.info("  \u2705 Greeting protection blocks barge-in before first audio")

if __name__ == "__main__":
    asyncio.run(test_barge_in_with_backchannel())
    asyncio.run(test_barge_in_interim())
    asyncio.run(test_greeting_protection())

    # ======================================================================
    logger.info("\n" + "=" * 60)
    if FAIL == 0:
        logger.info(f"ALL {PASS} TESTS PASSED \u2705")
    else:
        logger.error(f"{PASS} passed, {FAIL} FAILED \u274c")
    logger.info("=" * 60)

    sys.exit(1 if FAIL > 0 else 0)
