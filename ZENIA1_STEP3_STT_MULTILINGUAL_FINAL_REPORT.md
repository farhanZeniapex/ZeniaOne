# Zenia 1 — Step 3 STT and multilingual review

**Verdict: PARTIAL.** Static review and focused offline tests are complete enough to retain the current calling configuration. Multilingual recognition quality, carrier audio compatibility, and provider-dependent changes remain unverified. No production code, live service, customer record, or carrier configuration was changed.

## Phase status

| Phase | Status | Result |
|---|---|---|
| 1. Preflight | COMPLETED | Preserved existing work; confirmed the Step 1 tenant guards and Step 2 test files remain present. |
| 2. Deepgram audit | COMPLETED | Traced the current Exotel media, Deepgram configuration, final transcript, and cleanup code. Provider behavior was not tested. |
| 3. Language and brand recognition | PARTIAL | Agent language fields are stored, but Exotel STT ignores them. Recognition accuracy and provider language/vocabulary support remain unverified. |
| 4. Turn-taking regression | PARTIAL | Helper cases and exact production fragment/flush AST passed with a virtual clock at 849 ms and 851 ms. Live async/carrier behavior remains unverified. |
| 5. Safe improvements | BLOCKED | No language/model/vocabulary change is justified without provider evidence, tenant data compatibility, and staging audio. No production patch was applied. |
| 6. Permanent offline tests | PARTIAL | Seven new offline tests cover helper behavior, fragment consolidation, fixed STT defaults, and static cleanup structure. Provider recognition and full disconnect execution are not covered. |
| 7. Regression review | PARTIAL | Two Step 1 tests and five synchronous Step 2 tests passed. Three existing async Step 2 cases could not complete in this local Python environment. |
| 8. Final report | COMPLETED | Findings, proposed change, limits, and staging checklist recorded here. |

## Current Exotel STT path

`zenaipex/api/v1/voice_advanced.py` accepts Exotel `media.payload`, base64-decodes it, and forwards the bytes unchanged to Deepgram. Its fixed WebSocket URL requests `linear16`, 8 kHz, one channel, Nova-2, `language=hi`, interim results, 800 ms endpointing, 1200 ms utterance end, smart formatting, and three global Zenia keyword hints. The code assumes incoming audio already matches that format; it does not verify codec or resample incoming media. Carrier payload compatibility is unverified.

Only nonempty `Results` transcripts are used. Interim text can interrupt TTS after greeting protection. Final `is_final` text passes through global entity normalization, backchannel handling, and sentence heuristics. Complete text dispatches immediately; incomplete text accumulates and flushes after 850 ms unless another final fragment cancels the timer. `UtteranceEnd` is configured but not explicitly handled. A Deepgram disconnect is logged; the code has no reconnection path. The surrounding `FIRST_COMPLETED` task wait cancels the other receive task and then runs call cleanup. The local tests verified this cleanup **structure**, not an end-to-end disconnect.

The dashboard agent model stores `default_language` and `supported_languages`, but the Exotel Deepgram URL never reads them. Separate browser/Twilio/EnableX paths use Sarvam STT; their behavior does not establish Exotel multilingual quality. Exotel TTS has a separate text-based language detector. Global entity normalization and keyword hints are not tenant-configured. No tenant vocabulary was added or read in this step.

## Confirmed facts and open questions

- **Confirmed code gap:** Exotel STT is fixed to Hindi regardless of agent language preference. There is no per-tenant vocabulary selection or Deepgram reconnect. The confidence rejection condition is `conf < 0.0`; it does not reject ordinary low positive confidence scores.
- **Confirmed timing:** current code uses 800 ms endpointing and a separate 850 ms local flush for incomplete finalized text. This supersedes older audit references to 2000/3000 ms endpointing and a 1.5-second flush.
- **Potential turn risk:** the code has no provider-result ID deduplication. Repeated identical final events could dispatch twice; whether Exotel/Deepgram produces such events in practice is unverified. A final arriving just after the flush becomes a separate turn. No turn-taking rewrite was made.
- **Unverified:** Hindi/Hinglish/English/Gujarati word error rates, proper names and technical vocabulary, Deepgram's supported multilingual modes or vocabulary options, true incoming codec, real latency, and disconnect recovery under carrier traffic. Fixed `language=hi` is a plausible limitation for Gujarati/English but does not prove failure.

## Offline tests and changes

Added `zenaipex/tests/test_exotel_stt_turn_taking.py` only, alongside this report. Its seven tests cover Hindi/Hinglish, Gujarati/English text heuristics, questions/acknowledgements, backchannels, two virtual-clock fragment cases around 850 ms, fixed STT options/absence of tenant overrides, and static audio-forwarding/disconnect-cleanup structure. Synthetic phrases test code decisions, **not speech recognition accuracy**. The earlier reported 11 helper tests and four async simulations were not found as permanent test files in the inspected test directory and were not counted here.

Final completed runs: **14 passed, 0 failed** (seven new tests, two Step 1 tests, five synchronous Step 2 tests). The full focused Step 2 run stalled on local `asyncio` execution and was interrupted; three existing async cases were **not run to completion**. A first draft of the new AST harness had two errors; those were corrected before the final passing runs. No complete repository suite, provider request, paid call, MongoDB/Pinecone access, deployment, or restart occurred. Existing `.gitignore` and all previous uncommitted changes were preserved.

## Language readiness

| Language | Offline status | Live recognition readiness |
|---|---|---|
| Hindi | Heuristic text cases pass; fixed STT language is `hi`. | Unverified without recorded staging audio. |
| Hinglish | Romanized Hindi completion/backchannel cases pass. | Unverified for code-switching and names. |
| Gujarati | Text turn heuristics cover selected Romanized phrases; STT is still fixed to `hi`. | Unverified; provider configuration decision required. |
| English | Text question/acknowledgement cases pass; STT is still fixed to `hi`. | Unverified; provider configuration decision required. |

## Proposed provider-dependent patch — NOT APPLIED

After verifying Deepgram's current supported modes and staging recordings, a small opt-in change could derive STT language from the already tenant-scoped `agent_doc`, validate it against an explicit provider-supported map, and fall back to the current `hi` configuration. Any vocabulary hints would need to come from that same tenant and be encoded into the URL; no customer-specific name should be global. Conceptually:

```python
# Proposal only; provider codes and limits require verification and approval.
language = verified_deepgram_language(agent_doc.get("default_language")) or "hi"
keywords = validated_terms_for_company(company_id, agent_doc)
deepgram_url = existing_options_with(language=language, keywords=keywords)
```

Changing the live language/model/keyword URL requires approval after provider verification. No MongoDB schema change is proposed or needed for the existing agent language fields. Legacy agents without a usable preference must retain `hi`.

## Staging checklist and next step

With separately approved provider access, replay consented synthetic/recorded samples for all four languages, mixed-language turns, names, product and technical terms; include pauses at 750/849/851/1000 ms, low confidence, repeated final events, interrupting speech, malformed media, and Deepgram disconnects. Measure transcript accuracy, turn duplication, dropped fragments, response latency, and call continuity. Verify the actual Exotel audio codec and supported Deepgram language/vocabulary parameters before any opt-in deployment.

Step 1 security blockers remain: carrier-origin authentication, channel-agent association, tenant-scoped SID/callback handling, and hardcoded credential fallbacks. Step 4 may proceed with **offline planning and tests only**; live calling changes are not ready for release on this evidence.
