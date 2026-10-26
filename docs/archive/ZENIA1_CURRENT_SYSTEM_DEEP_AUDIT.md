# Zenia 1 current system: deep architecture audit

**Audit date:** 12 October 2026 (Asia/Calcutta)  
**Method:** Static, read-only inspection of the current working tree. No server, carrier call, external API, database query, migration, or test was run. The checkout already contained uncommitted changes; this report describes those current files, not a tagged production release. **ACTIVE** below means reachable in the inspected code, not proven active in deployment. **UNVERIFIED** means external configuration or runtime behavior was not observed.

## 1. Executive summary and scope

The main application is `zenaipex/main.py:app`, a FastAPI SaaS API with a Next.js dashboard in `zenaipex-frontend`. It registers separate Exotel, Twilio, EnableX, browser voice, web chat, knowledge, sales, and admin routes (`zenaipex/main.py:286-299`). The Exotel route specifically uses **Deepgram Nova-2 → company Pinecone RAG → Groq `openai/gpt-oss-120b` batch completion → Sarvam Bulbul v3 or Edge TTS → 8 kHz linear PCM WebSocket media** (`zenaipex/api/v1/voice_advanced.py:790-1360`). This is materially different from the Sarvam STT/Sarvam LLM path claimed in `README.md`; the README is not runtime evidence.

The dashboard can create agents, channels, and knowledge bases and can request admin test calls. There is no verified bulk campaign engine. The `sales-calls/schedule` API immediately dials through Twilio, and its generated TwiML names a WebSocket route absent from the registered routes (`zenaipex/api/v1/sales.py:81-136,347-355`). The admin scheduled test call is an in-process APScheduler date job, not a persisted campaign (`zenaipex/api/v1/admin/channels.py:264-290`).

Critical boundaries need attention before future voice upgrades: Exotel HTTP/WebSocket URLs trust path tenant/agent IDs without a code-level provider signature check; the WebSocket loads the agent by `_id` alone; caller statistics query conversations by phone without `company_id`; and several status/recording updates use `call_sid` alone (`zenaipex/api/v1/voice_advanced.py:27-47,819-846,988-1000,1359-1397,1404-1477`). These are **confirmed code properties**; exploitability and production exposure require runtime validation.

## 2. Repository and component inventory

| Area | Primary files | Static status |
|---|---|---|
| Entry, settings, persistence | `zenaipex/main.py`, `zenaipex/core/config.py`, `zenaipex/core/database.py` | ACTIVE route registration and startup path; deployed environment UNVERIFIED |
| Authentication and tenants | `zenaipex/api/v1/auth.py`, `companies.py`, `core/dependencies.py`, `services/auth_service.py`, `tenant_service.py` | ACTIVE for dashboard APIs |
| Agents and channels | `zenaipex/api/v1/agents.py`, `channels.py`, `admin/channels.py`, `services/agent_service.py`, `channel_service.py`, `voice_channel_mapping.py` | ACTIVE APIs; carrier provisioning UNVERIFIED |
| Exotel live call | `zenaipex/api/v1/voice_advanced.py`, `zenaipex/modules/entity_normalizer.py`, `modules/query_resolver.py`, `modules/sarvam_tts.py`, `modules/audio_utils.py` | ACTIVE code path; carrier compatibility UNVERIFIED |
| Other live audio | `zenaipex/api/v1/channels_twilio.py`, `channels_enablex.py`, `agents.py:1475` | PARTIALLY ACTIVE; separate paths, not evidence about Exotel |
| Knowledge/RAG | `zenaipex/api/v1/knowledge.py`, `services/knowledge_service.py`, `document_extractor.py`, `ai/rag.py`, `ai/vector_store.py` | ACTIVE code path; index contents UNVERIFIED |
| Provider abstraction | `zenaipex/ai/llm.py`, `services/provider_service.py` | ACTIVE for chat/Twilio and some browser voice; **not used by Exotel completion** |
| Conversations and usage | `zenaipex/services/conversation_service.py`, `usage_service.py`, `api/v1/conversations.py`, `admin/conversations.py` | ACTIVE storage APIs; Exotel call usage increment absent |
| Sales/lead API | `zenaipex/api/v1/sales.py`, `models/sales.py` | PARTIALLY ACTIVE; sales audio route BROKEN in inspected routing |
| Frontend | `zenaipex-frontend/app`, `components`, `lib/api` | ACTIVE client code; deployed build UNVERIFIED |
| Scheduler/deployment | `zenaipex/tasks/daily_sync.py`, `start_app.py`, `start_backend.bat`, `README.md` | Scheduler startup reachable; deployment/process mode UNVERIFIED |
| Local artifacts | `archive`, `docs`, `logs`, `data/uploads`, `scratch`, `zenaipex/backups`, `A` | Historical/support data; not proof of current production execution |

MongoDB collection accessors are declared at `zenaipex/core/database.py:87-106`: `companies`, `users`, `team_members`, `subscriptions`, `agents`, `knowledge_bases`, `documents`, `channels`, `conversations`, `messages`, `usage_records`, `scheduled_calls`, `timing_metrics`, `activity_logs`, `leads`, `sales_calls`, `ai_providers`, `platform_settings`, `llm_requests`, and `custom_voices`. Index declarations at lines 110-236 do not enforce tenant scoping on every query.

## 3. Inbound Exotel sequence and execution trace

```mermaid
sequenceDiagram
  participant C as Customer
  participant E as Exotel
  participant H as FastAPI HTTP webhook
  participant W as Exotel media WebSocket
  participant M as MongoDB
  participant D as Deepgram Nova-2
  participant P as Pinecone
  participant G as Groq HTTP
  participant T as Sarvam/Edge TTS
  C->>E: Phone call
  E->>H: GET/POST /api/v1/webhook/exotel/advanced/{company_id}/{agent_id}/voice
  H->>M: Resolve channel; asynchronously pre-create conversation
  H-->>E: XML Connect/Stream URL
  E->>W: WebSocket start, media, stop JSON
  W->>M: Get agent/company, conversation, prior messages
  W->>D: Binary linear16 audio at declared 8 kHz
  D-->>W: Interim/final transcript JSON
  W->>W: Buffer, normalize names, resolve product
  W->>P: Query company namespace if KB attached and query eligible
  P-->>W: Ranked chunks or empty result
  W->>G: Nonstreaming chat completion with prompt/history/context
  G-->>W: Complete assistant text
  W->>M: Save user and assistant messages
  W->>T: Text to streamed 24 kHz PCM or Edge MP3
  T-->>W: Audio chunks
  W-->>E: Base64 8 kHz PCM media JSON
  E-->>C: Playback (carrier behavior UNVERIFIED)
  E-->>H: Optional status/recording callbacks
  W->>M: End conversation on disconnect
```

| Step and caller | Input → output; format/state | Evidence and handling |
|---|---|---|
| `exotel_voice_webhook` (or alternate `exotel_voicebot_webhook`) | Exotel form/query `From`, `To`, `CallSid`, URL IDs → XML `<Connect><Stream>` (or JSON `{url}`) pointing at WSS; starts asynchronous Mongo pre-create | `voice_advanced.py:27-133`; route included at `main.py:293`. Which Exotel applet points to which endpoint is **UNVERIFIED**. No visible signature validation. |
| `resolve_exotel_channel` | Tenant, agent, dialed number/channel ID → active Exotel channel or `None` | `services/voice_channel_mapping.py:67-100`; constrains channel lookup by company, but does not authenticate the carrier or validate path IDs against an agent. |
| `exotel_media_stream` | WebSocket accepts immediately; path `company_id`, `agent_id` → per-call state (`stream_sid`, `call_sid`, history, product, cancellation event) | `voice_advanced.py:790-853`. Agent lookup at 823 is `_id` only; company lookup at 828 uses string `_id`. Production identity and whether company lookup succeeds are **UNVERIFIED**. |
| `receive_from_telephony` | JSON `start` → Mongo conversation, prior turns, greeting; JSON `media.payload` → base64 decode and raw binary to Deepgram; `stop` → exit | `voice_advanced.py:886-1111`; stream/query IDs and fallback `local_test_...` SID. No input codec conversion or format verification; assumes 8 kHz signed 16-bit mono. |
| Deepgram connection/receiver | Binary audio → JSON `Results`, interim/final text | URL at `voice_advanced.py:855`: `model=nova-2`, `language=hi`, `encoding=linear16`, `sample_rate=8000`, mono, interim true, `endpointing=2000`, `utterance_end_ms=3000`, `smart_format=true`, boosted `Zenia`, `Zenia One`, `Zenia HR` at 1.5. Log at 859 incorrectly says `language=multi`, `endpointing=800`. WebSocket connect/receive failures are logged at 1351-1376; no reconnect. |
| `receive_from_deepgram` → `_process_utterance` | Final transcript → accumulation, normalization, product routing; incomplete ≤3-word phrases wait 1.5 s; >3 words generally dispatch immediately | `voice_advanced.py:1113-1350`, `is_incomplete_utterance` at 240-276. Interim 2+ words can cancel AI after `greeting_protect` is true. A confidence test `conf < 0.0` at 1298 cannot reject ordinary low-confidence positive values. |
| `normalize_entities`, `resolve_product_from_utterance`, `resolve_rag_query` | STT string → canonical product name and retrieval query | `zenaipex/modules/entity_normalizer.py:17-231`, `zenaipex/modules/query_resolver.py`; invoked at `voice_advanced.py:1136-1148,296`. Variant map is deterministic, not a language model. |
| `fetch_llm_response` → `TenantRAGPipeline.retrieve` | Normalized user turn → optional Pinecone chunks in company namespace → system prompt + last 12 history messages → Groq completion text | `voice_advanced.py:278-565`; `ai/rag.py:251-423`; `ai/vector_store.py:196-246`. Greetings, casual utterances, unclear speech, and explicit goodbye bypass retrieval or the LLM; missing KB also returns no context. |
| `text_to_speech_and_stream` | Full text → Sarvam Bulbul v3 linear16 24 kHz chunks, resampled to 8 kHz; Edge fallback MP3 decoded by FFmpeg to 8 kHz PCM; base64 JSON media frames | `voice_advanced.py:567-784`; `zenaipex/modules/sarvam_tts.py:34-80,544-711`; `zenaipex/modules/audio_utils.py:46-76`. `ExotelAudioChunker` uses 3200-byte chunks (200 ms at 8 kHz/16-bit). |
| `add_message`, `end_conversation`, callbacks | Raw user final and generated assistant text → `messages`; status/duration/recording URL → `conversations` | `voice_advanced.py:1155-1211,1380-1398,1404-1477`; `services/conversation_service.py:17-159`. A callback can overwrite state; carrier callback order is **UNVERIFIED**. |

The WebSocket is a code-reachable production entry point because `main.py` includes its router. It is **not verified as the configured live Exotel destination**. The alternate direct WSS setup in `README.md` may skip the HTTP webhook entirely; real Exotel configuration must settle that.

## 4. Outbound paths

```mermaid
sequenceDiagram
  participant A as Admin dashboard
  participant API as FastAPI admin channels
  participant S as APScheduler
  participant E as Exotel Calls API
  participant X as Exotel applet/config
  participant W as Exotel media WebSocket
  participant M as MongoDB
  A->>API: POST /admin/channels/{id}/test-call
  opt Date scheduled test call
    A->>API: POST /admin/channels/{id}/schedule-call
    API->>S: Add in-memory date job
    S->>API: trigger_test_call later
  end
  API->>E: POST Calls/connect.json
  E-->>API: Call SID
  API->>M: Asynchronous outbound conversation pre-create
  E->>X: Url is configured Exotel applet
  X-->>W: Media WSS only if external applet routes there
  W->>M: Reuse SID conversation; greeting, turns, completion
```

`zenaipex-frontend/app/admin/channels/[id]/page.tsx:457,499,529` calls admin test, Gemini prompt generation, and scheduled test endpoints. `zenaipex/api/v1/admin/router.py:6-18` requires platform admin for these routes. `trigger_test_call` at `admin/channels.py:292-505` loads the channel by `_id`, branches Twilio/EnableX/Exotel, and for Exotel calls `Calls/connect.json` with destination, caller ID, status callback and a **fixed Exotel applet URL** at 458-467. It constructs a voice webhook URL and WSS URL at 445-451 but does not use either in that payload. The applet's configuration and its handoff to the audited WSS are **UNVERIFIED**. Success schedules `create_conversation(... direction="outbound")` without awaiting it (478-493). On a later stream `start`, `create_conversation` reuses an existing `call_sid` (`conversation_service.py:52-59`); the greeting direction comes from that document (`voice_advanced.py:1003-1024`). A race can make the greeting inbound.

The admin `schedule-call` endpoint stores a date job in the process scheduler (`admin/channels.py:264-290`, `tasks/daily_sync.py:77-95`); no persistent campaign record or bulk campaign dispatcher was found. The separate `sales.py:schedule_sales_call` stores a `sales_calls` record then dials Twilio **immediately** (`sales.py:81-136`); `generate_twiml` returns a stream URL for `/companies/{company_id}/sales-calls/{sales_call_id}/stream` (`sales.py:347-355`), but no matching WebSocket route exists in the inspected registered routers. Status callbacks and summary generation are implemented at `sales.py:236-342`. Thus this path is PARTIALLY ACTIVE/BROKEN for live audio, not evidence of an Exotel campaign.

## 5. AI, RAG, prompt and voice specifics

**Actual Exotel models.** Exotel calls `fetch_llm_response`, which posts a nonstreaming Groq chat completion with `model="openai/gpt-oss-120b"`, temperature `0.5`, max tokens `1024`, timeout 10 s (`voice_advanced.py:278-286,509-552`). Its payload has no streaming option and waits for `resp.json()`. Agent `llm_model`, `system_prompt`, temperature, max tokens, and configured greeting are **not read** by this function, despite being stored by `agent_service.create_agent` (`services/agent_service.py:53-82`). `ai/llm.py:AgentLLMClient` supports provider selection, including Gemini and Groq, but Exotel does not call it. Gemini `gemini-3.5-flash` is called for admin prompt drafting (`admin/channels.py:34-73`); the generated `system_prompt` supplied to `trigger_test_call` is not passed into `fetch_llm_response`. `core/config.py:43-67` has separate Sarvam/Gemini/Groq defaults; these do not determine Exotel's hardcoded model.

**STT and turn detection.** Exotel uses Deepgram Nova-2, not Sarvam STT (`voice_advanced.py:853-860,1090-1106,1113-1350`). Sarvam `saarika:v2.5` is used or imported in other browser/Twilio/EnableX paths (`agents.py:1076-1119,1471-1842`; `channels_twilio.py:33,500-573`; `channels_enablex.py:28,135-275`). Deepgram emits `is_final`, then local heuristics decide whether to process or buffer; `utterance_end_ms` is configured but no explicit `UtteranceEnd` handler was found. The code does not implement an Exotel-side VAD or acoustic silence detector in this path. Hindi fixed language and three brand keyword hints do not prove Gujarati recognition. Entity normalization includes many phonetic spellings, but the literal English `Jen 1` is absent from the visible registry (`entity_normalizer.py:17-101`), and `जन्या hr` appears under both ZeniaONE and ZeniaHR (`entity_normalizer.py:52,119`), creating ambiguous replacement order.

**Knowledge.** `knowledge_service.ingest_document` extracts content, chunks/validates, calls `NamespacedVectorStore.generate_embeddings`, then upserts with `namespace=company_id` (`services/knowledge_service.py:102-176,176-351`; `ai/vector_store.py:174-194`). The configured embedding default is `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (`core/config.py:43`); the RAG log claims `all-MiniLM-L6-v2` (`ai/rag.py:311-319`), so the log is misleading. `TenantRAGPipeline.retrieve` requires an agent `knowledge_base_id` or explicit document IDs, rewrites the query, uses top 20, threshold 0.15, optional `document_id` filter, retries, reranks to context and resolves parent chunks (`ai/rag.py:81-89,251-381`). The voice call supplies **no document ID filter** (`voice_advanced.py:333-356`), so all eligible documents in the company namespace can be retrieved, irrespective of a particular agent's KB assignment. MongoDB stores KB/document metadata and the agent attachment; Pinecone stores vectors/chunk text. Query rewrite can itself use `AgentLLMClient` (`ai/rag.py:156-249`), so some Exotel turns may indirectly invoke a configured model before the final Groq answer. Whether it does for a given turn is data dependent.

**Hallucination controls.** The voice prompt includes company profile fields, product focus, caller statistics, retrieved chunks, last 12 history messages, product boundary and fallback instructions (`voice_advanced.py:366-499`). A heuristic post-retrieval text/source filter tries to reject ZeniaHR chunks during ZeniaONE turns and vice versa (`voice_advanced.py:337-355`). There is no hard factual grounding validator, citation requirement, or enforced refusal after empty retrieval; fallback is an instruction to the LLM. Casual/unclear/goodbye bypasses make RAG conditional. Query failures return `[]` (`ai/rag.py:378-379`) and the model can still respond.

**TTS and interruptions.** `SarvamRealtimeTTS` defaults to `bulbul:v3` (`zenaipex/modules/sarvam_tts.py:34-80`) and `realtime_tts_stream` requests linear16 at 24 kHz (`:544-610`). `text_to_speech_and_stream` maps a voice to Sarvam speaker and Edge voice, resamples Sarvam to 8 kHz PCM, and otherwise uses `edge_tts.Communicate` MP3 piped through FFmpeg to 8 kHz PCM (`voice_advanced.py:567-769`; `sarvam_tts.py:614-711`; `audio_utils.py:46-76`). English fallback defaults to `en-US-AriaNeural`, Hindi to `hi-IN-SwaraNeural`, Gujarati to `gu-IN-DhwaniNeural`, with persona overrides (`voice_advanced.py:588-625`). The actual remote TTS success/fallback rate is **UNVERIFIED**. Interim 2+ word speech sets a cancel event and cancels the active TTS task, but the receiver skips Exotel `clear` while the TTS function still sends `clear` if it sees the event (`voice_advanced.py:663-676,727-734,1244-1270`). Carrier queued audio cancellation is **UNVERIFIED**.

## 6. Frontend → API → storage map

The shared frontend client prepends `http://127.0.0.1:8002/api/v1` and attaches localStorage bearer token (`zenaipex-frontend/lib/api/client.ts:1-52`). This fixed default can fail away from the developer machine; deployed proxy or rewrite behavior is **UNVERIFIED**.

| User surface | Frontend call → API function | Storage/effect |
|---|---|---|
| Signup/login/onboarding | `app/(auth)/signup/page.tsx:133`, `login/page.tsx:78` → `auth.py:register/login`; `app/onboarding/page.tsx:75-132` → `companies.py:update_company_onboarding`, `agents.py:create_agent_onboarding` | `users`, `companies`, `team_members`, `subscriptions`, `agents` (`companies.py:65-124`) |
| Agent create/config | `app/dashboard/agents/new/page.tsx:116`, `lib/api/agents.ts:39-66` → `agents.py:create_agent/update_agent` → `agent_service.py:create_agent/update_agent` | `agents`; attached `knowledge_base_id` validated. Voice Exotel currently ignores most saved model/prompt controls. |
| Voice number/channel | `app/dashboard/channels/voice/page.tsx:47-82`, `lib/api/channels.ts:35-66` → `channels.py:create_channel/update_channel` → `channel_service.py` | `channels`; line assignment is metadata, carrier webhook provisioning UNVERIFIED. |
| Knowledge upload | `app/dashboard/knowledge/page.tsx:58-73,120,171,195`, `lib/api/knowledge.ts:32-65` → `knowledge.py:create_kb/upload_document/upload_url/upload_text` → `knowledge_service.ingest_document` | `knowledge_bases`, `documents`, `activity_logs`, local uploaded file, Pinecone namespace. |
| Provider choice | `agents.ts:llm_model/tts_model`, admin `lib/api/providers.ts:26-43` → `agents.py:update_agent`, `admin/providers.py` | `agents`, `ai_providers`; choice does not reach Exotel Groq completion. |
| Test outbound/schedule | `app/admin/channels/[id]/page.tsx:457,529` → `admin/channels.py:trigger_test_call/schedule_test_call` | Provider API request, optional `conversations` pre-create; scheduled date job only in process memory. |
| Web chat/test agent | `app/dashboard/my-ai/chat/page.tsx:352-373`, `app/dashboard/channels/web-chat/[id]/page.tsx:108-137` → `agents.py:agent_test_chat`, `conversations.py:chat_in_conversation` | `conversations`, `messages`, potential RAG/provider usage. Separate from Exotel. |
| History/recordings | `app/dashboard/conversations/page.tsx:86`, `[id]/page.tsx:88-90`; admin channel detail `:574-581` → `conversations.py`, `admin/conversations.py` | Reads `conversations`, `messages`; Exotel recording URL via callbacks; admin proxy fetches carrier recording. |
| Usage/billing | `app/dashboard/usage/page.tsx:24`, `billing/page.tsx:18` → `companies.py:get_subscription`, `usage_service.py` | `subscriptions`, `usage_records`, computed conversation metrics. No payment processor flow was established. |

## 7. Isolation, errors and confirmed findings

The normal dashboard dependency path checks JWT and company membership (`core/dependencies.py:61-110` and below), and normal service queries commonly include `company_id` (`agent_service.py:101-118`; `conversation_service.py:160-204`). Pinecone queries/upserts explicitly set the namespace (`ai/vector_store.py:174-194,196-246`). These are positive controls, but several carrier/admin paths bypass them.

| # | Issue → evidence/root cause → impact | Severity | Future fix (not implemented) |
|---|---|---|---|
| 1 | **Carrier entry lacks verified tenant binding.** `voice_advanced.py:27-47,790-846` accepts URL IDs and loads agent by `_id` only; no Exotel signature/token check in handlers. A forged or misrouted request may access a mismatched agent/namespace or spend provider credit. External network exposure UNVERIFIED. | Critical | Authenticate carrier handoff; verify agent belongs to tenant and active channel before opening providers. |
| 2 | **Cross-tenant caller statistics.** `voice_advanced.py:986-1000` queries `conversations` only by `caller_phone`, then embeds counts/minutes in prompt. Same phone across companies can leak aggregate call history into another tenant's answer. | Critical | Scope the query to verified `company_id`; test shared phone cases. |
| 3 | **Unscoped SID and recording updates.** `conversation_service.py:52-59`, `voice_advanced.py:135-166,1404-1477`, `admin/channels.py:179-244` use `call_sid` alone for lookup/update. SID collision or mismatched callbacks can cross records; provider uniqueness and exploitability UNVERIFIED. | High | Use `(company_id, provider, call_sid)` identity and validated callback authentication. |
| 4 | **Credentials embedded as source defaults.** `admin/channels.py:440-443` and `admin/conversations.py:307-308,406-409` contain nonempty fallback Exotel credentials. This exposes secrets to anyone with code access and may silently use them when env is absent. Values intentionally omitted. | Critical | Rotate affected credentials; remove source defaults and fail closed. |
| 5 | **Exotel settings ignored.** `agent_service.py:53-82` stores prompt/model/latency controls; `voice_advanced.py:278-565,853-855,1005-1030` hardcodes Groq model, prompt, language, greeting and turn timing. Dashboard changes can appear saved but not affect live Exotel behavior. | High | Define explicit per-call config mapping with defaults and compatibility tests. |
| 6 | **Speech can be cut or overlapped.** `voice_advanced.py:855,240-276,1218-1350` uses Deepgram `is_final`, >3-word immediate dispatch, and 1.5 s flush; interim 2+ words may cancel AI. A mid-sentence final can start response early; timing depends on provider events. | High | Use utterance-end state and measured silence with cancellation generation IDs; replay real multilingual audio. |
| 7 | **Playback cancellation is inconsistent.** `voice_advanced.py:1251-1269` skips `clear` on barge-in, while `text_to_speech_and_stream` sends it at 670-675/732-734. Canceling local tasks does not prove queued carrier audio stopped. | High | Establish Exotel applet behavior experimentally and implement one supported cancel protocol. |
| 8 | **Sales-call audio target is missing.** `sales.py:347-355` emits `/sales-calls/{id}/stream`; route scan finds no matching `@router.websocket`. Twilio sales call may connect but not converse. | High | Wire a validated sales stream route or reuse existing Twilio media handler with scoped metadata. |
| 9 | **Scheduled outbound is not durable; outbound handoff is uncertain.** `admin/channels.py:264-290` uses in-memory APScheduler; `:445-493` creates unused webhook/WSS variables and uses a fixed Exotel applet URL; conversation pre-create is unawaited. Restart can lose jobs and race greeting direction. | High | Persist scheduled jobs, configure explicit applet routing, await/idempotently reconcile call records. |
| 10 | **RAG failures can become ungrounded answers.** `ai/rag.py:251-379` returns `[]` on failure; `voice_advanced.py:316-356,488-499` still asks Groq to answer with prompt-only guard. Wrong/empty context and hallucinations remain possible. | High | Represent retrieval failure separately from no relevant knowledge and enforce a deterministic abstention path. |
| 11 | **Brand normalization ambiguity.** `entity_normalizer.py:52,119,187-231` registers `जन्या hr` for two products; `Jen 1` is absent. This can route to wrong product or fail normalization. | Medium | Remove conflicting variants and add corpus-based multilingual regression cases. |
| 12 | **Latency chain and no recovery.** `voice_advanced.py:333-356,509-552,664-769,1351-1376` serializes query rewrite/retrieval, 10 s Groq batch wait, then TTS; Deepgram disconnect terminates call path, no reconnect. TTS partial-stream failure does not trigger fallback once a chunk was yielded. | Medium | Instrument stage timings, apply budgets, and define interruption-safe retry/fallback policies. |
| 13 | **Call accounting gap.** `voice_advanced.py:1380-1397` ends conversation but never calls `increment_usage`; `usage_service.py:39-96` exists and Twilio does call it (`channels_twilio.py:612`). Exotel monthly usage counters can undercount, although dashboards also derive some duration metrics from conversations. | High | Meter once on terminal call reconciliation with idempotency. |
| 14 | **Misleading log/config statements.** `voice_advanced.py:855` requests Hindi/2000 ms while line 859 logs multi/800 ms; `ai/rag.py:311-319` logs a different embedding model than `core/config.py:43`. Logs can misdirect operations. | Medium | Log effective runtime parameters from constructed values. |

**Hypotheses needing runtime proof:** whether Exotel supplies linear16 8 kHz versus another codec; whether `clear` is accepted by its configured applet; whether duplicated or dropped STT finals occur; whether Gujarati speech performs adequately with `language=hi`; whether the fixed Exotel applet reaches the HTTP or WSS route; actual latency distributions; production index/model availability; webhook authentication at an upstream gateway; and external data exposure through publicly reachable URLs. No claim of a live failure is made for these.

## 8. Errors, recovery and dormant integrations

`fetch_llm_response` catches HTTP/general errors and returns a spoken fallback (`voice_advanced.py:552-565`). `TenantRAGPipeline.retrieve` retries Pinecone and returns empty context after failure (`ai/rag.py:319-379`). `realtime_tts_stream` retries an empty/stale pool and marks Sarvam unavailable for five minutes after failure (`sarvam_tts.py:360-394,544-610`); Edge/FFmpeg fallback only runs when zero Sarvam chunks were yielded (`voice_advanced.py:705-769`). `exotel_media_stream` cancels pending tasks and marks conversation completed on exit (`voice_advanced.py:1359-1398`), while status callback may later set a different state (`:1404-1477`). None of these operations were run in this audit.

| Integration | Classification | Reason |
|---|---|---|
| Exotel, Deepgram Nova-2, Groq completion, Pinecone, Sarvam Bulbul/Edge fallback, Mongo | ACTIVE in Exotel code path; deployment UNVERIFIED | Direct call chain above. |
| Sarvam STT, Gemini/Sarvam/provider abstraction | PARTIALLY ACTIVE | Used in browser/Twilio/EnableX/chat or admin prompt generation, not Exotel's final response path. |
| Twilio voice | PARTIALLY ACTIVE | Registered inbound/outbound handlers in `channels_twilio.py`; live credentials/carrier setup UNVERIFIED. |
| EnableX voice | PARTIALLY ACTIVE/BROKEN risk | Registered in `channels_enablex.py`; `get_rag_pipeline` is called with reversed arguments and `await` at line 166 even though factory is synchronous (`ai/rag.py:412-423`). |
| SMS/WhatsApp, CRM, bulk campaign engine, payments | DORMANT or UNVERIFIED | Channel types/models and sales lead records exist; no confirmed send/receive job or billing processor path was traced. |
| Browser voice stream | PARTIALLY ACTIVE | `agents.py:1475-1842` has Sarvam STT and browser fallback; distinct from telephony. |

## 9. Safe extension points and verification gates

The cleanest future seam is a **new, separately registered voice router and session adapter** beside `api/v1/voice_advanced.py`, using existing tenant-scoped agent/channel validation, `services/conversation_service.py`, and `ai/rag.py` only after their tenant and lifecycle issues are corrected. Preserve the existing Exotel route while adding a provider switch behind an explicit channel/agent setting. For Gemini Live or OpenAI Realtime, likely changes include `main.py` route registration, a new route/transport module under `api/v1`, `services/channel_service.py` and `models/channel.py` for provider selection, `services/agent_service.py`/`models/agent.py` and frontend `lib/api/agents.ts` plus agent settings UI for configuration, `modules/audio_utils.py` for codec conversion, `services/conversation_service.py` for idempotent persistence, `services/usage_service.py` for metering, and `api/v1/admin/channels.py` for outbound handoff. `ai/rag.py` can remain a retrieval service if a realtime session supplies validated tenant/document scope. This is a planning seam, not an implementation recommendation to modify all these files unconditionally.

Before implementation, verify carrier applet webhook/WSS configuration, a real inbound/outbound call with consent and masked logs, event payload/codec, production env/provider selection, Mongo schema/index contents, Pinecone namespace/document IDs, callback authenticity, playback clear behavior, latency at every stage, multilingual audio fixtures, concurrent calls, and failover. Use isolated test tenants and carrier sandbox traffic. Existing `zenaipex/tests` and `zenaipex/test_*` scripts were inspected as files, **not executed**.

## 10. Fifteen direct answers

1. **Customer calls Exotel number:** Exotel must be externally configured to call `exotel_voice_webhook` or `exotel_voicebot_webhook`, or directly open `exotel_media_stream`. The HTTP webhook returns stream instructions; WSS receives media, opens Deepgram, saves turns and sends TTS (`voice_advanced.py:27-133,790-1398`). Actual Exotel configuration **UNVERIFIED**.
2. **Incoming endpoint:** `/api/v1/webhook/exotel/advanced/{company_id}/{agent_id}/voice` → `exotel_voice_webhook` (`voice_advanced.py:27-93`); alternate `/voicebot` → `exotel_voicebot_webhook` (`:97-133`). Which is deployed **UNVERIFIED**.
3. **Live audio WebSocket:** `/api/v1/webhook/exotel/advanced/{company_id}/{agent_id}/media-stream` → `exotel_media_stream` (`voice_advanced.py:790-791`; `main.py:293`).
4. **Customer STT:** Deepgram `nova-2`, fixed `language=hi`, linear16/8 kHz/mono, in `exotel_media_stream` (`voice_advanced.py:853-860,1090-1106,1113-1350`). Sarvam STT is separate.
5. **End of speech:** Deepgram `is_final` plus local `is_incomplete_utterance` and 1.5 s buffer flush (`voice_advanced.py:240-276,1218-1350`). No explicit Exotel VAD in this path.
6. **Brand normalization:** `normalize_entities` regex variant registry then `resolve_product_from_utterance` (`entity_normalizer.py:17-231`; `voice_advanced.py:1136-1148`; `modules/query_resolver.py`). Known gaps/overlap above.
7. **Company knowledge source:** `get_rag_pipeline(company_id, agent_doc)` → `TenantRAGPipeline.retrieve` → `NamespacedVectorStore.similarity_search` in the company Pinecone namespace (`voice_advanced.py:846,333-356`; `ai/rag.py:251-423`; `ai/vector_store.py:196-246`).
8. **Pinecone and Mongo:** Mongo holds KB/document/agent metadata and conversations; ingestion embeds/upload chunks to Pinecone using `company_id` namespace (`knowledge_service.py:102-351`; `ai/vector_store.py:174-194`). Retrieval checks agent KB attachment and may use Mongo `documents` for context/parent resolution (`ai/rag.py:81-89,251-381`; `ai/vector_store.py:295+`).
9. **Live response LLM:** Groq HTTP chat completions `openai/gpt-oss-120b` in `fetch_llm_response` (`voice_advanced.py:278-286,509-552`). Query rewrite may indirectly invoke `AgentLLMClient` (`ai/rag.py:156-249`).
10. **TTS:** Sarvam `bulbul:v3` via `realtime_tts_stream`; Edge neural fallback when zero chunks, with voice mapped by language/persona (`voice_advanced.py:567-769`; `sarvam_tts.py:34-80,544-711`).
11. **Playback format:** `sarvam_to_exotel_pcm` resamples 24 kHz linear16 to 8 kHz mono; Edge MP3 is FFmpeg decoded to 8 kHz PCM; 3200-byte chunks are base64 `media.payload` JSON sent over Exotel WSS (`audio_utils.py:46-76`; `sarvam_tts.py:614-711`; `voice_advanced.py:637-649,678-681,720-757`).
12. **Interruption:** 2+ word Deepgram interim after greeting protection sets `cancel_event`, cancels processing/current TTS, but skips `clear` at receiver; TTS may send it on observing cancel (`voice_advanced.py:1244-1270,663-676,727-734`). Remote buffer cancellation **UNVERIFIED**.
13. **Outbound campaign:** No complete campaign found. Admin test/scheduled call → `trigger_test_call` → Exotel Calls API and fixed applet, with async pre-created conversation (`admin/channels.py:264-505`); applet-to-WSS link **UNVERIFIED**. Separate Twilio sales API has missing audio route (`sales.py:81-136,347-355`).
14. **Logs/transcripts/history:** `create_conversation`, `add_message`, `end_conversation` write `conversations`/`messages` (`conversation_service.py:17-159`; `voice_advanced.py:921-972,1155-1211,1380-1398`); recording/status callback updates `conversations` (`voice_advanced.py:135-166,1404-1477`). Python logging is configured in `main.py:46-52`; production log sink **UNVERIFIED**.
15. **Future realtime files:** New route and adapter adjacent to `voice_advanced.py`, registered in `main.py`; channel/agent config in `services/channel_service.py`, `services/agent_service.py` and respective models/frontend settings; audio in `modules/audio_utils.py`; persistence/metering in `services/conversation_service.py`, `services/usage_service.py`; outbound setup in `api/v1/admin/channels.py`; reuse scoped `ai/rag.py` only after boundary checks. See section 9.

## 11. Final audit assessment

**A. Architecture understanding score: 78%.** This is a coverage estimate, not a quality or safety score: approximately 78 of 100 planned evidence points for registered routes, Exotel STT→RAG→LLM→TTS call chain, data writes, alternate providers, frontend mappings, and outbound logic were traceable statically. The remaining 22 depend mainly on Exotel applet/webhook configuration, real payloads/codecs, production environment and database contents, live latencies, deployment topology, and behavior under concurrency. The percentage is judgmental, not an automated test result.

**B. Verified components:** Route registration; Exotel code path and model IDs; prompt assembly and conditional RAG; Pinecone namespace parameter; document ingestion code; Mongo collection helpers and writes; frontend calls; admin outbound request construction; alternate route presence; scheduled-job implementation.

**C. Unverified components:** Actual deployed commit/configuration, Exotel applet destination and JSON/XML contract, carrier audio codec/playback clear support, live provider credentials/quota, database/index contents, model downloads, latency/failure rates, production callback authentication at an upstream layer, and live billing/payment integrations.

**D. Top 10 current risks, ranked:** (1) unverified carrier/tenant binding; (2) embedded credential fallbacks; (3) cross-tenant caller statistics; (4) unscoped call SID updates; (5) misleading saved agent settings in Exotel; (6) missing sales-call audio route; (7) barge-in and queued audio mismatch; (8) early/incomplete turn dispatch; (9) ungrounded answer on RAG failure; (10) outbound scheduler/handoff race and persistence.

**E. Safe future upgrade readiness:** The existing FastAPI router boundary and per-company Pinecone namespace make a parallel adapter feasible. Correct and test tenant identity, call lifecycle, audio contract, and accounting first. Preserve the old route during staged validation.

**F. Complete audit report:** This file is `docs/archive/ZENIA1_CURRENT_SYSTEM_DEEP_AUDIT.md`. It is the only artifact created by this audit.

**G. Verdict: PARTIALLY.** The inspected code is understood well enough to **plan** future upgrades and identify integration seams, based on the concrete route and function chains above. It is not yet understood deeply enough to guarantee a safe implementation because the external Exotel route, production state, audio contract, and cross-tenant behavior remain unverified. Understanding alone does not guarantee safe implementation.
