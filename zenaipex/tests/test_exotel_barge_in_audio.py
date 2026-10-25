"""Offline checks of Exotel interruption and local audio behavior."""

import ast
import base64
import copy
import logging
from pathlib import Path
import unittest


SOURCE = Path(__file__).resolve().parents[1] / "api" / "v1" / "voice_advanced.py"
TREE = ast.parse(SOURCE.read_text(encoding="utf-8"))
LOGGER = logging.getLogger(__name__)


def function(name):
    return next(n for n in ast.walk(TREE) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name == name)


def finish(coroutine):
    try:
        coroutine.send(None)
    except StopIteration:
        return
    raise AssertionError("Unexpected external await in offline test")


class Event:
    def __init__(self):
        self.value = False

    def set(self):
        self.value = True

    def clear(self):
        self.value = False

    def is_set(self):
        return self.value


class Task:
    def __init__(self):
        self.cancel_count = 0

    def done(self):
        return self.cancel_count > 0

    def cancel(self):
        self.cancel_count += 1


class Socket:
    def __init__(self, event=None, interrupt_on_first=False, disconnect=False):
        self.frames = []
        self.event = event
        self.interrupt_on_first = interrupt_on_first
        self.disconnect = disconnect

    async def send_json(self, frame):
        if self.disconnect:
            raise ConnectionError("mock socket disconnected")
        self.frames.append(frame)
        if self.interrupt_on_first and len(self.frames) == 1:
            self.event.set()


def sender_harness(socket, event):
    """Compile the nested production send_chunk with mocked socket and event."""
    sender = copy.deepcopy(function("send_chunk"))
    factory = ast.FunctionDef(
        name="factory",
        args=ast.arguments(posonlyargs=[], args=[], vararg=None, kwonlyargs=[], kw_defaults=[], kwarg=None, defaults=[]),
        body=[ast.Assign(targets=[ast.Name(id="chunks_sent", ctx=ast.Store())], value=ast.Constant(value=0)), sender,
              ast.Return(value=ast.Name(id="send_chunk", ctx=ast.Load()))],
        decorator_list=[],
    )
    ns = {"base64": base64, "logger": LOGGER, "exotel_ws": socket, "stream_sid": "mock-stream", "cancel_event": event, "metrics": None}
    exec(compile(ast.fix_missing_locations(ast.Module(body=[factory], type_ignores=[])), str(SOURCE), "exec"), ns)
    return ns["factory"]()


def interim_harness(greeting_finished=True):
    branch = next(n for n in ast.walk(function("receive_from_deepgram")) if isinstance(n, ast.If) and ast.unparse(n.test) == "not is_final")
    handler = ast.AsyncFunctionDef(
        name="handle_interim",
        args=ast.arguments(posonlyargs=[], args=[ast.arg(arg="transcript")], vararg=None, kwonlyargs=[], kw_defaults=[], kwarg=None, defaults=[]),
        body=copy.deepcopy(branch.body), decorator_list=[],
    )
    event, llm_task, tts_task = Event(), Task(), Task()
    socket = Socket()
    from api.v1.voice_advanced import is_backchannel
    ns = {"cancel_event": event, "greeting_protect": [greeting_finished], "process_task": [llm_task],
          "current_ai_task": tts_task, "stream_sid": "mock-stream", "websocket": socket, "logger": LOGGER,
          "is_backchannel": is_backchannel}
    exec(compile(ast.fix_missing_locations(ast.Module(body=[handler], type_ignores=[])), str(SOURCE), "exec"), ns)
    return ns["handle_interim"], event, llm_task, tts_task, socket


def fallback_flush_harness(socket, event):
    """Run the actual fallback buffer-flush branch against a two-frame mock."""
    flush_loop = next(n for n in ast.walk(function("text_to_speech_and_stream"))
                      if isinstance(n, ast.For) and ast.unparse(n.iter) == "fb_chunker.flush()")
    branch = next(n for n in ast.walk(function("text_to_speech_and_stream"))
                  if isinstance(n, ast.If) and flush_loop in n.body)
    sender = ast.AsyncFunctionDef(
        name="flush_fallback",
        args=ast.arguments(posonlyargs=[], args=[], vararg=None, kwonlyargs=[], kw_defaults=[], kwarg=None, defaults=[]),
        body=[ast.Nonlocal(names=["fb_chunks_sent"]), copy.deepcopy(branch)], decorator_list=[],
    )
    factory = ast.FunctionDef(
        name="factory",
        args=ast.arguments(posonlyargs=[], args=[], vararg=None, kwonlyargs=[], kw_defaults=[], kwarg=None, defaults=[]),
        body=[ast.Assign(targets=[ast.Name(id="fb_chunks_sent", ctx=ast.Store())], value=ast.Constant(value=0)),
              sender, ast.Return(value=ast.Name(id="flush_fallback", ctx=ast.Load()))], decorator_list=[],
    )

    class Chunker:
        def flush(self):
            yield b"a" * 3200
            yield b"b" * 3200

    async def pace_audio(_chunk):
        return None

    ns = {"base64": base64, "exotel_ws": socket, "stream_sid": "mock-stream",
          "cancel_event": event, "fb_chunker": Chunker(), "pace_audio": pace_audio}
    exec(compile(ast.fix_missing_locations(ast.Module(body=[factory], type_ignores=[])), str(SOURCE), "exec"), ns)
    return ns["factory"]()()


def pace_harness():
    pace = copy.deepcopy(function("pace_audio"))
    factory = ast.FunctionDef(
        name="factory",
        args=ast.arguments(posonlyargs=[], args=[], vararg=None, kwonlyargs=[], kw_defaults=[], kwarg=None, defaults=[]),
        body=[ast.Assign(targets=[ast.Name(id="next_audio_send_at", ctx=ast.Store())], value=ast.Constant(value=0.0)),
              pace, ast.Return(value=ast.Name(id="pace_audio", ctx=ast.Load()))], decorator_list=[],
    )

    class Clock:
        now = 1.0
        sleeps = []

        def time(self):
            return self.now

    class Asyncio:
        def __init__(self, clock):
            self.clock = clock

        def get_running_loop(self):
            return self.clock

        async def sleep(self, seconds):
            self.clock.sleeps.append(seconds)
            self.clock.now += seconds

    clock = Clock()
    clock.sleeps = []
    ns = {"asyncio": Asyncio(clock)}
    exec(compile(ast.fix_missing_locations(ast.Module(body=[factory], type_ignores=[])), str(SOURCE), "exec"), ns)
    return ns["factory"](), clock


class ExotelBargeInAudioTests(unittest.TestCase):
    def test_greeting_starts_before_history_and_statistics_queries(self):
        calls = [n for n in ast.walk(function("receive_from_telephony")) if isinstance(n, ast.Call)]
        greeting_start = next(n for n in calls if ast.unparse(n.func) == "text_to_speech_and_stream" and n.args
                              and isinstance(n.args[0], ast.Name) and n.args[0].id == "greeting")
        history_load = next(n for n in calls if ast.unparse(n.func) == "get_recent_messages_for_caller")
        stats_load = next(n for n in calls if ast.unparse(n.func) == "col_conversations().find")
        self.assertLess(greeting_start.lineno, history_load.lineno)
        self.assertLess(greeting_start.lineno, stats_load.lineno)

    def test_greeting_can_be_interrupted_after_first_audio_chunk(self):
        sender = function("text_to_speech_and_stream")
        first_fallback_chunk = next(n for n in ast.walk(sender) if isinstance(n, ast.If)
                                    and ast.unparse(n.test) == "fb_chunks_sent == 1")
        self.assertTrue(any(isinstance(n, ast.Assign) and ast.unparse(n.targets[0]) == "greeting_protect[0]"
                            and isinstance(n.value, ast.Constant) and n.value.value is True
                            for n in ast.walk(first_fallback_chunk)))

    def test_normal_response_sends_media_without_clear(self):
        event, socket = Event(), Socket()
        send = sender_harness(socket, event)
        finish(send(b"a" * 3200))
        finish(send(b"b" * 3200))
        self.assertEqual([frame["event"] for frame in socket.frames], ["media", "media"])

    def test_fast_audio_is_paced_without_delaying_slow_audio(self):
        pace, clock = pace_harness()
        finish(pace(b"a" * 3200))
        self.assertEqual(clock.sleeps, [])
        finish(pace(b"b" * 3200))
        self.assertAlmostEqual(clock.sleeps[0], 0.2)
        clock.now += 1.0
        finish(pace(b"c" * 3200))
        self.assertEqual(len(clock.sleeps), 1)

    def test_stale_audio_is_suppressed_after_interruption(self):
        event, socket = Event(), Socket()
        send = sender_harness(socket, event)
        event.set()
        finish(send(b"a" * 3200))
        self.assertEqual(len(socket.frames), 0)

    def test_interruption_between_chunks_stops_next_local_send(self):
        event = Event()
        socket = Socket(event, interrupt_on_first=True)
        send = sender_harness(socket, event)
        finish(send(b"a" * 3200))
        finish(send(b"b" * 3200))
        self.assertEqual(len(socket.frames), 1)

    def test_fallback_flush_stops_after_interruption(self):
        event = Event()
        socket = Socket(event, interrupt_on_first=True)
        finish(fallback_flush_harness(socket, event))
        self.assertEqual(len(socket.frames), 1)

    def test_repeated_interruption_and_new_response(self):
        handle, event, llm_task, tts_task, socket = interim_harness()
        finish(handle("please stop"))
        finish(handle("please stop"))
        self.assertTrue(event.is_set())
        self.assertEqual((llm_task.cancel_count, tts_task.cancel_count), (1, 1))
        self.assertEqual(socket.frames, [])
        event.clear()
        finish(handle("another question"))
        self.assertTrue(event.is_set())
        self.assertEqual(socket.frames, [])

    def test_short_backchannel_and_noise_do_not_interrupt(self):
        handle, event, llm_task, tts_task, socket = interim_harness()
        for text in ("", "haan", "hmm", "yes", "right"):
            finish(handle(text))
        self.assertFalse(event.is_set())
        self.assertEqual((llm_task.cancel_count, tts_task.cancel_count), (0, 0))
        self.assertEqual(socket.frames, [])

    def test_greeting_protection_blocks_interim_barge_in(self):
        handle, event, llm_task, tts_task, socket = interim_harness(greeting_finished=False)
        finish(handle("please stop"))
        self.assertFalse(event.is_set())
        self.assertEqual((llm_task.cancel_count, tts_task.cancel_count), (0, 0))
        self.assertEqual(socket.frames, [])

    def test_disconnect_during_local_send_propagates(self):
        event, socket = Event(), Socket(disconnect=True)
        send = sender_harness(socket, event)
        with self.assertRaises(ConnectionError):
            finish(send(b"a" * 3200))

    def test_local_audio_buffer_flushes_once(self):
        audio_tree = ast.parse((SOURCE.parents[2] / "modules" / "audio_utils.py").read_text(encoding="utf-8"))
        chunker_class = next(n for n in audio_tree.body if isinstance(n, ast.ClassDef) and n.name == "ExotelAudioChunker")
        ns = {}
        exec(compile(ast.fix_missing_locations(ast.Module(body=[copy.deepcopy(chunker_class)], type_ignores=[])), "audio_utils.py", "exec"), ns)
        chunker = ns["ExotelAudioChunker"]()
        self.assertEqual(len(list(chunker.add_data(b"a" * 7000))), 2)
        self.assertEqual([len(c) for c in chunker.flush()], [600])
        self.assertEqual(chunker.buffer, b"")

    def test_repeated_final_events_currently_schedule_two_responses(self):
        """Document the current duplicate-final risk; provider behavior is unverified."""
        from tests.test_exotel_stt_turn_taking import turn_harness
        handle, clock, _ = turn_harness()
        handle("What is the price?")
        handle("What is the price?")
        self.assertEqual(len(clock.processed), 2)

    def test_cleanup_and_final_turn_structure(self):
        media_handler = function("exotel_media_stream")
        self.assertTrue(any(isinstance(n, ast.Call) and ast.unparse(n.func) == "cancel_event.set" for n in ast.walk(media_handler)))
        self.assertTrue(any(isinstance(n, ast.Call) and ast.unparse(n.func) == "current_ai_task.cancel" for n in ast.walk(media_handler)))
        self.assertTrue(any(isinstance(n, ast.Call) and ast.unparse(n.func) == "cancel_event.clear" for n in ast.walk(function("_process_utterance"))))

    def test_tts_does_not_send_unverified_carrier_clear(self):
        """This flow has historically dropped calls on a carrier clear event."""
        clear_frames = [n for n in ast.walk(function("text_to_speech_and_stream")) if isinstance(n, ast.Dict)
                        and any(isinstance(k, ast.Constant) and k.value == "event" and isinstance(v, ast.Constant) and v.value == "clear"
                                for k, v in zip(n.keys, n.values))]
        self.assertEqual(clear_frames, [])


if __name__ == "__main__":
    unittest.main()
