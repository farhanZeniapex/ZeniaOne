# Zenia 1 — Step 1 security hardening status

**Scope:** Current working tree, reviewed 12 October 2026. Static inspection and offline mocked tests only. No production traffic or data was inspected. This report does not certify production behavior.

## Executive summary

Step 1 is **PARTIAL**. Two independently safe controls are present: the Exotel caller-statistics query includes `company_id`, and the media WebSocket looks up the agent using both agent ID and route `company_id`, rejecting a missing or mismatched agent before Deepgram or RAG setup. Both focused offline tests pass. Channel ownership enforcement, call SID/callback scoping, Exotel-origin authentication, and removal of credential fallbacks remain blocked by unverified legacy data, carrier configuration, or deployment configuration. No blocked item is counted as complete.

| Phase | Status | Result / reason |
|---|---|---|
| 1. Verify Patch 1 | **COMPLETED** | Confirmed `{"company_id": company_id, "caller_phone": caller_phone}` in `zenaipex/api/v1/voice_advanced.py:993`; isolation test passed. |
| 2. Agent/tenant validation | **COMPLETED** | Existing WebSocket lookup uses `_id` plus string `company_id`; accepted socket sends an error and closes with code 1008 when no scoped agent is found (`voice_advanced.py:823-834`). Matching, wrong-company and missing-agent mock cases passed. |
| 3. Channel/agent association | **BLOCKED** | `services/channel_service.py:create_channel` stores a single `agent_id`, but `services/voice_channel_mapping.py:resolve_exotel_channel` can select a line by number or explicit ID without checking that agent. Enforcing a mismatch would reject calls if deployed applet IDs and channel assignment differ; current assignments and legacy calls are unverified. Optional channel attribution remains optional. |
| 4. Call SID/conversation isolation | **BLOCKED** | `services/conversation_service.py:create_conversation` reuses by SID alone; Exotel recording/status callbacks and admin SID endpoints also query by SID alone. Scoping them may orphan callbacks or split history for legacy records with missing/differently stored tenant fields. Callback URL tenant IDs are unauthenticated, so they alone do not prove origin. No query was changed in this phase. |
| 5. Exotel callback/WebSocket authentication | **BLOCKED** | No verified provider signature, shared-secret handoff, authenticated proxy, or IP allowlist contract exists in the inspected code/project docs. No protocol was invented. |
| 6. Credential safety | **BLOCKED** | Hardcoded Exotel credential fallbacks exist in `api/v1/admin/channels.py` and `api/v1/admin/conversations.py`. Local `.env` names are present, but the intended deployment's variable names are unverified. Values are omitted. Any exposed real credentials should be rotated out of band after a compatible rollout plan. |
| 7. Offline regression tests | **COMPLETED** | Two focused tests passed; channel, SID, and production calling tests were not run because those changes are blocked. |
| 8. Final review/report | **COMPLETED** | This status report records fixes, blockers, tests, safety and next actions. |

## Exact fixes and files

Previously implemented in this working tree: `zenaipex/api/v1/voice_advanced.py:993` scopes caller statistics; `:823-834` scopes the agent lookup and rejects mismatch before provider setup. `zenaipex/tests/test_exotel_caller_stats_isolation.py` tests two tenants sharing a caller number. `zenaipex/tests/test_exotel_agent_tenant_validation.py` tests matching and mismatched agents. **This execution** added the missing-agent case to the latter test and created this report. It made no new application-code change. All pre-existing uncommitted work was preserved; no Git reset, stash, checkout, clean or commit was used.

## Tests and limits

Executed offline: `Python 3.12 -m unittest discover -s zenaipex/tests -p 'test_exotel_*.py' -v` — **2 passed, 0 failed**. The tests execute the exact inspected query/guard statements with mocked collection and socket behavior. They do not open a live WebSocket, verify Exotel delivery, exercise Deepgram, run a paid call, or establish production compatibility. Channel association, SID isolation, and legacy compatibility: **NOT RUN/BLOCKED** beyond code inspection. No full test suite was run.

## Unchanged behavior and data safety

No Exotel applet URL, webhook route, WebSocket payload, audio format, STT, RAG, Groq, Sarvam, frontend, scheduler, or deployment setting changed in this execution. No MongoDB or Pinecone operation, migration, seed, restore, paid API call, service restart, or deployment occurred. A local MongoDB JSON snapshot and per-collection files were observed in the read-only preflight, but their completeness and successful restoration are **UNKNOWN**. Pinecone backup/export and restoration status are **UNKNOWN**. The available Mongo restore script replaces matching records and was not executed.

## Remaining vulnerabilities and calling compatibility risks

The Exotel HTTP routes and media WebSocket still lack verified carrier-origin authentication. A tenant/agent path pair can be supplied by an unauthenticated caller; the new agent lookup validates their relationship, not carrier identity. A resolved company channel may belong to a different agent. Conversation reuse, Exotel callbacks and some admin views/actions remain SID-only. Embedded fallback credentials remain in source. Existing calls with legacy agent `company_id` values outside the current string convention may be rejected by the earlier Patch 2; their existence is unverified. Enforcing channel mismatch or scoped callbacks without checking live applet mappings and legacy records could interrupt calls or history updates. Offline success is not evidence of successful production calling.

## Exotel dashboard and deployment requirements

Before unblocking authentication and channel enforcement, verify the configured applet type/ID and its actual destination (`/voice`, `/voicebot`, or direct media WSS); the path agent ID for each business number; whether `CallTo`, channel ID and call SID are delivered in the WebSocket handshake/start event; all status and recording callback URLs; and any documented signature, authentication-header, shared-secret, proxy or IP-allowlist capability. Before removing credential fallbacks, verify that `EXOTEL_ACCOUNT_SID`, `EXOTEL_API_KEY`, and `EXOTEL_API_TOKEN` are configured in the intended deployment environment **by name only**. Do not copy secret values into reports.

## Deployment prerequisites, rollback and next actions

Do not deploy this working tree on the basis of these tests. First verify a restorable MongoDB backup and Pinecone export/backup status without altering live data, record the intended deployment revision and existing uncommitted changes, confirm Exotel and credential configuration, then stage carrier-compatible changes with mock and sandbox tests. For a failed future rollout, redeploy the prior known-good build and revert only the newly introduced security hunks; preserve existing user changes and do not restore or overwrite databases as a routine code rollback.

Next, manually confirm Exotel applet/channel assignments and callback authentication capability, audit legacy tenant/SID field shapes through an approved read-only process, verify deployment credential names, then implement blocked fixes one at a time with isolated tests. **Step 1 is partially complete. Step 2 (Exotel Calling Flow) is safe only for read-only planning; live calling changes are not ready to start or deploy.**
