"""Offline checks of the current Exotel STT and turn-taking code."""

import ast
import copy
import logging
from pathlib import Path
import unittest
from urllib.parse import parse_qs, urlparse
from types import SimpleNamespace


SOURCE = Path(__file__).resolve().parents[1] / "api" / "v1" / "voice_advanced.py"
TREE = ast.parse(SOURCE.read_text(encoding="utf-8"))


def named_function(name):
    return next(n for n in ast.walk(TREE) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name == name)


def turn_namespace():
    names = {"BACKCHANNEL_WORDS", "CONNECTIVE_ENDINGS", "QUESTION_STARTERS"}
    nodes = [n for n in TREE.body if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id in names for t in n.targets)]
    nodes += [named_function("is_backchannel"), named_function("is_incomplete_utterance")]
    namespace = {}
    exec(compile(ast.fix_missing_locations(ast.Module(body=copy.deepcopy(nodes), type_ignores=[])), str(SOURCE), "exec"), namespace)
    return namespace


class FakeTask:
    def __init__(self, coroutine=None):
        self.coroutine = coroutine
        self.wake = None
        self.finished = coroutine is None
        self.cancelled = False

    def done(self):
        return self.finished

    def cancel(self):
        self.cancelled = True
        self.finished = True
        if self.coroutine:
            self.coroutine.close()


class Pause:
    def __init__(self, duration):
        self.duration = duration

    def __await__(self):
        yield self.duration


class FakeAsyncio:
    CancelledError = type("CancelledError", (Exception,), {})

    def __init__(self):
        self.now = 0.0
        self.tasks = []
        self.processed = []

    async def sleep(self, duration):
        await Pause(duration)

    def create_task(self, value):
        task = FakeTask(value if hasattr(value, "send") else None)
        if task.coroutine:
            task.wake = self.now + task.coroutine.send(None)
            self.tasks.append(task)
        else:
            self.processed.append(value)
        return task

    def advance(self, seconds):
        self.now += seconds
        for task in list(self.tasks):
            if not task.done() and task.wake <= self.now:
                try:
                    task.coroutine.send(None)
                except StopIteration:
                    task.finished = True


def turn_harness():
    """Execute the actual final-fragment and delayed-flush AST with a virtual clock."""
    namespace = turn_namespace()
    parent_body = next(
        body for node in ast.walk(TREE) for body in (getattr(node, "body", []), getattr(node, "orelse", []))
        if isinstance(body, list) and any(isinstance(item, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "old_buffer" for t in item.targets) for item in body)
    )
    start = next(i for i, item in enumerate(parent_body) if isinstance(item, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "old_buffer" for t in item.targets))
    handler = ast.FunctionDef(
        name="handle_final", args=ast.arguments(posonlyargs=[], args=[ast.arg(arg="normalized_transcript")], vararg=None, kwonlyargs=[], kw_defaults=[], kwarg=None, defaults=[]),
        body=copy.deepcopy(parent_body[start:]), decorator_list=[],
    )
    nodes = [copy.deepcopy(named_function("_delayed_flush")), handler]
    clock = FakeAsyncio()
    namespace.update({
        "asyncio": clock, "logger": logging.getLogger(__name__),
        "utterance_buffer": [], "flush_task": [None], "process_task": [None],
        "_process_utterance": lambda text: text,
        "voice_config": SimpleNamespace(delayed_flush_ms=500),
    })
    exec(compile(ast.fix_missing_locations(ast.Module(body=nodes, type_ignores=[])), str(SOURCE), "exec"), namespace)
    return namespace["handle_final"], clock, namespace


class ExotelSttTurnTakingTests(unittest.TestCase):
    def test_hindi_hinglish_sentence_boundaries(self):
        incomplete = turn_namespace()["is_incomplete_utterance"]
        self.assertTrue(incomplete("Mujhe pricing aur"))
        self.assertFalse(incomplete("Mujhe pricing chahiye"))
        self.assertFalse(incomplete("हाँ"))

    def test_gujarati_english_and_questions(self):
        incomplete = turn_namespace()["is_incomplete_utterance"]
        self.assertFalse(incomplete("kem cho"))
        self.assertFalse(incomplete("Aa product che"))
        self.assertTrue(incomplete("What is"))
        self.assertFalse(incomplete("What is the price?"))

    def test_short_acknowledgements_and_backchannels(self):
        ns = turn_namespace()
        self.assertTrue(ns["is_backchannel"]("haan ji"))
        self.assertTrue(ns["is_backchannel"]("okay"))
        self.assertFalse(ns["is_backchannel"]("yes please explain"))
        self.assertFalse(ns["is_incomplete_utterance"]("thanks"))

    def test_fragment_consolidation_before_configured_timeout(self):
        handle, clock, ns = turn_harness()
        handle("Mujhe pricing aur")
        clock.advance(0.499)
        self.assertEqual(clock.processed, [])
        handle("bataiye.")
        clock.advance(0.002)
        self.assertEqual(clock.processed, ["Mujhe pricing aur bataiye."])
        self.assertEqual(ns["utterance_buffer"], [])

    def test_incomplete_fragment_flushes_after_configured_timeout(self):
        handle, clock, ns = turn_harness()
        handle("Mujhe pricing aur")
        clock.advance(0.501)
        self.assertEqual(clock.processed, ["Mujhe pricing aur"])
        self.assertEqual(ns["utterance_buffer"], [])

    def test_deepgram_settings_come_from_agent_runtime(self):
        from modules.voice_runtime import VoiceRuntimeConfig
        cfg = VoiceRuntimeConfig.from_agent({
            "default_language": "hi-IN",
            "supported_languages": ["hi-IN", "en-IN"],
            "stt_model": "nova-3",
            "silence_timeout_ms": 450,
        })
        self.assertEqual(cfg.stt_model, "nova-3")
        self.assertEqual(cfg.stt_language, "multi")
        self.assertEqual(cfg.endpointing_ms, 450)
        self.assertGreater(cfg.utterance_end_ms, cfg.endpointing_ms)

    def test_audio_forwarding_and_disconnect_cleanup_structure(self):
        receiver = named_function("receive_from_telephony")
        transcript_receiver = named_function("receive_from_deepgram")
        self.assertTrue(any(isinstance(n, ast.Await) and isinstance(n.value, ast.Call) and ast.unparse(n.value.func) == "deepgram_ws.send" for n in ast.walk(receiver)))
        self.assertTrue(any(isinstance(n, ast.ExceptHandler) and n.type and ast.unparse(n.type) == "websockets.exceptions.ConnectionClosed" for n in ast.walk(transcript_receiver)))
        self.assertTrue(any(isinstance(n, ast.Call) and ast.unparse(n.func) == "asyncio.wait" and any(k.arg == "return_when" and ast.unparse(k.value) == "asyncio.FIRST_COMPLETED" for k in n.keywords) for n in ast.walk(TREE)))
        self.assertTrue(any(isinstance(n, ast.Call) and ast.unparse(n.func) == "task.cancel" for n in ast.walk(named_function("exotel_media_stream"))))


if __name__ == "__main__":
    unittest.main()
