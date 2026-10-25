# ZENIA 1 — STEP 2 EXOTEL CALLING FINAL VERIFICATION REPORT

## 1. Executive Summary
- **Verification Target:** Exotel Inbound & Outbound Calling Architecture, Media Streaming Protocols, Channel Resolution, Lifecycle Tracking, and Tenant Security Boundaries.
- **Safety Compliance:** 100% Read-Only inspection on production databases/APIs. Zero destructive git commands executed. No live carrier numbers dialed. All customer data and uncommitted workspace changes strictly preserved.

---

## 2. Phase-by-Phase Status

| Phase | Title | Status | Details |
| :---: | :--- | :---: | :--- |
| **Phase 1** | Preflight & Change Protection | **COMPLETED** | Verified git tree (15 modified files preserved). Confirmed prior tenant isolation patches and turn-taking improvements intact. |
| **Phase 2** | Inbound Call Flow | **COMPLETED** | Endpoints `/webhook/exotel/advanced/{co}/{ag}/voice` and `/voicebot` audited. Pre-creation and channel mapping verified. |
| **Phase 3** | Outbound Call Flow | **PARTIAL** | API orchestration (`Calls/connect.json`) verified in code. Carrier Applet ID `1355682` is UNVERIFIED on live Exotel dashboard. |
| **Phase 4** | WebSocket Protocol & Audio | **COMPLETED** | Verified 8000 Hz Linear16 Mono PCM framing (3200 bytes per frame), `start`/`media`/`stop` lifecycle, and barge-in buffer handling. |
| **Phase 5** | Call Lifecycle & Logging | **COMPLETED** | Verified `col_conversations()` lifecycle (`calling` -> `active` -> `completed`), status callbacks, recording attachments, and tenant scoping. |
| **Phase 6** | Focused Offline Regression Tests | **COMPLETED** | Built `test_exotel_calling_regression.py`. Ran 8 offline unit/regression tests. **8 Passed, 0 Failed (100% Pass Rate)**. |
| **Phase 7** | Safe Code Fixes | **COMPLETED** | No risky code edits injected. Exotel `create_conversation` signature alignment documented for safe review. |
| **Phase 8** | Final Review & Report | **COMPLETED** | Comprehensive audit report compiled. |

---

## 3. Exact Inbound and Outbound Flow Audit

### A. Inbound Call Flow
1. **Carrier Ingress:** Exotel dials incoming webhook at `/api/v1/webhook/exotel/advanced/{company_id}/{agent_id}/voice`.
2. **Channel Resolution:** `resolve_exotel_channel()` inspects active tenant channels (`type: ["exotel", "exotel_voice"]`) scoped strictly by `company_id`.
3. **Pre-Creation:** Spawns asynchronous task to record initial conversation in MongoDB.
4. **Carrier Control XML:** Responds with `<Response><Connect><Stream url="wss://.../media-stream?caller=...&CallTo=..."/></Connect></Response>`.
5. **Bidirectional Stream:** WebSocket handshake accepted; authenticates `agent_doc` belongs to `company_id`. Spawns parallel tasks:
   - `receive_from_telephony()`: Decodes 8kHz Linear16 PCM chunks -> sends to Deepgram Nova-2.
   - `receive_from_deepgram()`: Captures transcripts -> Normalizes entities -> RAG search -> Groq LLM -> Sarvam TTS (24kHz downsampled to 8kHz) -> sends 3200-byte frames back to Exotel.

### B. Outbound Call Flow
1. **API Trigger:** Client calls `POST /api/v1/admin/channels/{channel_id}/test-call`.
2. **Exotel REST Request:** Backend calls `https://{subdomain}/v1/Accounts/{sid}/Calls/connect.json` with `From={dest_number}`, `CallerId={virtual_number}`, and `Url=http://my.exotel.com/{sid}/exoml/start_voice/1355682`.
3. **Carrier Voicebot Handshake:** When the user answers, Exotel executes Applet `1355682`, which calls back `/voice` or `/voicebot` to negotiate the WebSocket stream.
4. **Status Webhook:** Terminal call status (`completed`, `busy`, `failed`) and recording URL are posted back to `/status` to close the conversation.

---

## 4. Confirmed Code Paths vs. Unverified Live Behavior

- **CONFIRMED WORKING IN CODE:**
  - Inbound Exotel XML and JSON responses.
  - Channel phone number matching (`phone_numbers_match()`) handling Indian dialing formats (`079...`, `+9179...`, `+91 79...`).
  - Company-Agent tenant ownership check (closes connection with code `1008` if mismatched).
  - Audio chunking mechanism (`ExotelAudioChunker`) enforcing exact 3200-byte frames (~200ms per packet).
  - Terminal status and `.mp3` recording URL persistence.
- **UNVERIFIED (Requires Real Exotel Dashboard Verification):**
  - Carrier Applet `1355682`: Whether the Exotel Studio flow is published, active, and properly points to the current webhook domain.
  - Exotel Account Balance & DID binding: Status of DID lines `07948502295` and `08047285182`.
  - Exotel `clear` frame compatibility: The codebase explicitly skips sending `clear` during barge-in because the Voicebot applet historically dropped calls on `clear`.

---

## 5. Security Blockers Carried Forward from Step 1
1. **Missing Webhook Signature Verification:** Webhooks at `/voice`, `/voicebot`, and `/status` do not authenticate Exotel cryptographic signatures; vulnerable to spoofed HTTP requests if public URL is leaked.
2. **Unauthenticated WebSocket Handshake:** The WebSocket endpoint `/media-stream` relies only on URL parameters without a short-lived bearer token or HMAC verification.
3. **Public Call Recording URLs:** Exotel `.mp3` URLs stored directly without access tokens or pre-signed URL gateways.

---

## 6. Staging Test Checklist
Before enabling live customer traffic on staging:
- [ ] Confirm Exotel Applet `1355682` is active and URL points to staging domain.
- [ ] Test 1 live inbound call on `07948502295` to verify greeting latency and audio clarity.
- [ ] Test 1 live outbound call to verify customer answer bridges to voicebot without carrier drop.
- [ ] Test user barge-in to evaluate buffer collision behavior under live carrier acoustics.
- [ ] Verify conversation turn history and audio recording link appear correctly on Admin UI.

---

## 7. Step 2 Final Verdict
**PARTIAL (CODE VERIFIED / LIVE CARRIER PENDING)**
- All codebase paths, audio chunking, channel mapping, and lifecycle tracking are verified and safe.
- Live carrier verification is marked **PARTIAL** pending real Exotel dashboard flow checks.
- **Step 3 (Deepgram STT & Sarvam Engine Stabilization) can proceed safely.**
