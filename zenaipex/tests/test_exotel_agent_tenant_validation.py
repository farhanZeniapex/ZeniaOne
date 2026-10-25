"""Offline checks of the Exotel handler's actual agent lookup and guard."""

import ast
import json
from pathlib import Path
import unittest


def _validation_function():
    path = Path(__file__).resolve().parents[1] / "api" / "v1" / "voice_advanced.py"
    tree = ast.parse(path.read_text(encoding="utf-8"))
    handler = next(node for node in tree.body if isinstance(node, ast.AsyncFunctionDef)
                   and node.name == "exotel_media_stream")
    lookup = next(node for node in handler.body if isinstance(node, ast.Try)
                  and any(isinstance(stmt, ast.Assign)
                          and any(isinstance(target, ast.Name) and target.id == "agent_doc"
                                  for target in stmt.targets) for stmt in node.body))
    guard = next(node for node in handler.body if isinstance(node, ast.If)
                 and isinstance(node.test, ast.UnaryOp)
                 and isinstance(node.test.operand, ast.Name)
                 and node.test.operand.id == "agent_doc")
    wrapper = ast.parse("async def validate(company_id, agent_id, websocket, col_agents, ObjectId, json):\n    pass\n")
    wrapper.body[0].body = [lookup, guard, ast.parse("return agent_doc").body[0]]
    namespace = {}
    exec(compile(ast.fix_missing_locations(wrapper), str(path), "exec"), namespace)
    return namespace["validate"]


class AgentTenantValidationTest(unittest.TestCase):
    def test_matching_agent_continues_and_mismatched_agent_closes(self):
        class Socket:
            def __init__(self):
                self.events = []

            async def send_text(self, message):
                self.events.append(json.loads(message))

            async def close(self, code):
                self.events.append({"closed": code})

        class Collection:
            def __init__(self, owner):
                self.owner = owner

            async def find_one(self, query):
                if self.owner is None:
                    return None
                self_query = {"_id": "agent-1", "company_id": self.owner}
                return self_query if query == self_query else None

        def run(url_company, stored_company):
            socket = Socket()
            coroutine = _validation_function()(
                url_company, "agent-1", socket, lambda: Collection(stored_company), str, json
            )
            with self.assertRaises(StopIteration) as result:
                coroutine.send(None)
            return result.exception.value, socket.events

        agent, events = run("company-a", "company-a")
        self.assertEqual(agent["company_id"], "company-a")
        self.assertEqual(events, [])

        agent, events = run("company-b", "company-a")
        self.assertIsNone(agent)
        self.assertEqual(events, [
            {"event": "error", "message": "Agent not found for company"},
            {"closed": 1008},
        ])

        agent, events = run("company-a", None)
        self.assertIsNone(agent)
        self.assertEqual(events, [
            {"event": "error", "message": "Agent not found for company"},
            {"closed": 1008},
        ])
