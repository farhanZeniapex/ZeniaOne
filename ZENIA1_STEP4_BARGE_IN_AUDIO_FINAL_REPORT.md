# Zenia 1 — Step 4 barge-in and audio review

**Verdict: PARTIAL.** Two local stale-audio paths were fixed after mocked regressions failed. Carrier-side playback and `clear` behavior remain unverified. No live call, paid provider request, database access, deployment, restart, or customer-data change occurred.

## Phase status

| Phase | Status | Result |
|---|---|---|
| 1. Preflight | COMPLETED | Preserved the existing working tree; Step 1 tenant guards, Step 3 tests, and backup JSON ignore rule remain present. |
| 2. Audio-state audit | COMPLETED | Traced Exotel media, Deepgram interim/final handling, task cancellation, Sarvam/Edge TTS sends, and call cleanup. |
| 3. Interruption analysis | PARTIAL | Mocked interim speech, greeting protection, repeated interruption, local send/disconnect, and duplicate final scenarios; carrier playback races remain unverified. |
| 4. Exotel buffer/clear review | BLOCKED | No verified repository protocol document or playback acknowledgement contract was found. Existing TTS branches still emit `clear`; carrier effect is unknown. |
| 5. Safe bug fixes | PARTIAL | Fixed two proven local stale-send paths only. Larger task-lifecycle and duplicate-final changes need stronger evidence. |
| 6. Mocked tests | PARTIAL | Twelve focused cases added, including production AST slices; one known carrier-dependent assertion is an expected failure. Full handler/provider simulation remains unverified. |
| 7. Regression verification | PARTIAL | Completed offline runs passed, but three existing async Step 2 tests stalled under bounded timeouts. |
| 8. Final report | COMPLETED | Findings, limits, staging checklist, and Step 5 readiness recorded here. |

## Current flow and state ownership

The Exotel media WebSocket decodes inbound `media.payload` and forwards it to Deepgram. A nonempty, two-or-more-word interim transcript can set `cancel_event` and cancel the current LLM and TTS tasks after `greeting_protect[0]` becomes true. During the initial greeting, that interim cancellation is intentionally blocked. A finalized transcript passes normalization/backchannel checks, then immediate or 850 ms delayed turn dispatch. `_process_utterance` clears the cancellation event before generating a new response. Backchannels during a running AI task are ignored; one-word interim text does not trigger the barge-in branch.

`current_ai_task`, `process_task`, `flush_task`, `cancel_event`, and `greeting_protect` hold local state. Sarvam and Edge emit 3200-byte PCM media frames. The chunkers buffer bytes **locally**; Exotel may buffer already-sent frames **remotely**. The code has no verified playback marker/acknowledgement handler, so a completed local send or finished TTS task does not prove the caller has heard all audio. The main receiver cancels its peer after `FIRST_COMPLETED`; call cleanup sets cancellation and cancels `current_ai_task`. Delayed flush/process and greeting-prewarm task ownership is not comprehensively tracked or awaited. Actual orphan activity is unverified.

## Confirmed defects, fixes, and limits

1. **Fixed — Sarvam local stale frame:** the nested `send_chunk` previously sent media even when `cancel_event` was already set. A mocked production-AST test failed before the change. It now returns for empty audio **or** a set cancellation event (`zenaipex/api/v1/voice_advanced.py:661`). An in-flight WebSocket send cannot be retracted.
2. **Fixed — Edge fallback buffered flush:** the fallback flush checked cancellation only before entering the loop. If interruption arrived after its first frame, a second frame could be sent. A two-frame mocked regression failed before the change. The loop now checks cancellation before each send (`voice_advanced.py:768-770`). Encoding, packet shape, chunk size, and routes are unchanged.
3. **Open carrier-dependent contradiction:** the interim branch comments/logs that Exotel `clear` is skipped, yet both Sarvam and Edge TTS interruption branches can send `{"event": "clear"}` (`voice_advanced.py:688-691,750`). The Step 2 report's blanket statement that clear is skipped is therefore inaccurate. Whether this disrupts the deployed applet is unverified. No clear behavior was changed; the new no-clear assertion is marked **expected failure** pending carrier evidence and separate approval.
4. **Potential turn/lifecycle risks:** repeated identical final events can schedule two responses in the mocked turn harness; whether the provider emits such duplicates is unknown. An interim of two words can set cancellation even when no TTS task is active. The timing of cancellation, new `_process_utterance` clearing the event, and remotely buffered audio can create races. No deduplication or state-machine rewrite was made without a provider-backed failing regression.

## Files and test results

This step changed only `zenaipex/api/v1/voice_advanced.py` (two cancellation guards), added `zenaipex/tests/test_exotel_barge_in_audio.py`, and created this report. Previous uncommitted changes, `.gitignore`, tenant isolation, hardcoded credential code, STT defaults, Groq/Sarvam providers, MongoDB schema/data, audio format, Exotel URLs, and webhook routes were not changed by this step.

Final completed runs: **25 passed, 0 unexpected failed, 1 expected failure, 0 skipped**. Breakdown: Step 1 (2), Step 2 synchronous (5), Step 3 (7), Step 4 (11 passing plus one expected failure). The Step 4 tests exercise exact nested production AST for local sends, fallback flush, and interim cancellation with mocked sockets/tasks; other checks are helper or static. They do not prove real async scheduling or remote carrier playback. Three existing Step 2 async tests **stalled** under separate seven-second offline timeouts: `ExotelChannelMappingTest.test_exotel_resolution_uses_active_company_channel`, `ExotelLifecycleAndSecurityMockTest.test_agent_company_isolation_rejection`, and `test_voice_channel_mapping.test_exotel_resolution_uses_active_company_channel`. They were not counted as passed. No full suite was run.

## Carrier decision and staging checklist

Before changing `clear`, obtain the exact Exotel applet type/version and provider documentation for media, `clear`, playback markers, and acknowledgements. A repository comment is not a verified carrier contract. With separate approval, run one controlled staging call and check normal playback, greeting interruption, short backchannels, background noise, repeated interruption, interruption just as TTS ends, delayed STT final, and disconnect during playback. Record whether already-sent audio remains queued, whether `clear` is accepted, dropped, or disconnects the call, and whether any final turn or recording is duplicated. Do not use customer data or production numbers for these tests.

Step 1 still has carrier-origin authentication, channel-agent binding, SID/callback scoping, and credential fallback blockers. Step 2 live applet/codec/clear behavior is unverified; Step 3 multilingual accuracy and its three stalled async regressions remain open. **Step 5 may proceed with offline review and tests only; live calling changes are not release-ready on this evidence.**
