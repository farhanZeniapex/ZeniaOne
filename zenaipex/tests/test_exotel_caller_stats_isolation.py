"""Offline regression for the actual Exotel caller-statistics statements."""

import ast
from pathlib import Path
import unittest


def _caller_stats_function():
    source_path = Path(__file__).resolve().parents[1] / "api" / "v1" / "voice_advanced.py"
    tree = ast.parse(source_path.read_text(encoding="utf-8"))
    names = {"past_calls", "total_calls", "total_duration_sec", "total_minutes"}
    statements = {
        node.targets[0].id: node
        for node in ast.walk(tree)
        if isinstance(node, ast.Assign)
        and len(node.targets) == 1
        and isinstance(node.targets[0], ast.Name)
        and node.targets[0].id in names
    }
    assert statements.keys() == names
    wrapper = ast.parse(
        "async def caller_stats(company_id, caller_phone, col_conversations):\n"
        "    pass\n"
    )
    function = wrapper.body[0]
    function.body = [statements[name] for name in (
        "past_calls", "total_calls", "total_duration_sec", "total_minutes"
    )]
    function.body.append(ast.parse(
        "return total_calls, total_minutes"
    ).body[0])
    namespace = {}
    exec(compile(ast.fix_missing_locations(wrapper), str(source_path), "exec"), namespace)
    return namespace["caller_stats"]


class CallerStatsIsolationTest(unittest.TestCase):
    def test_same_caller_does_not_mix_companies(self):
        phone = "same-caller"
        records = [
            {"company_id": "company-a", "caller_phone": phone, "recording_duration": 60},
            {"company_id": "company-b", "caller_phone": phone, "recording_duration": 600},
            {"company_id": "company-a", "caller_phone": "other-caller", "recording_duration": 300},
        ]

        class Cursor:
            def __init__(self, matches):
                self.matches = matches

            async def to_list(self, length):
                return self.matches[:length]

        class Collection:
            def find(self, query):
                assert set(query) == {"company_id", "caller_phone"}
                return Cursor([record for record in records if all(
                    record.get(key) == value for key, value in query.items()
                )])

        query_stats = _caller_stats_function()

        def run(company_id):
            coroutine = query_stats(company_id, phone, lambda: Collection())
            with self.assertRaises(StopIteration) as result:
                coroutine.send(None)
            return result.exception.value

        self.assertEqual(run("company-a"), (1, 1.0))
        self.assertEqual(run("company-b"), (1, 10.0))
