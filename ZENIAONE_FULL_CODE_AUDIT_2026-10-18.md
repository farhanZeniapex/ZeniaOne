# ZeniaOne Full Code Audit — 18 October 2026

**Scope:** Frontend, backend API, admin and customer dashboards, public pages, voice pipeline, configuration, duplicate files, loading states, and test coverage.  
**Mode:** Read-only audit. No production behavior was changed for this report.

## Executive result

The platform has a substantial feature set and a working frontend/backend surface, but it is **not ready to claim fully verified production reliability**. The largest risks are misleading voice-clone success states, incomplete real provider/fallback testing, oversized route components, legacy maintenance scripts, and inconsistent UI behavior on older admin pages.

## Evidence collected

| Check | Result |
|---|---|
| Source/config files scanned (excluding dependencies/media) | 509 |
| Frontend production build | Passed |
| Backend health, docs, OpenAPI | HTTP 200 |
| Public home, login, signup, admin, dashboard routes | HTTP 200 |
| OpenAPI surface | 139 paths / 170 operations |
| Frontend automated tests discovered | 0 |
| Python test/probe scripts found | 48 |
| Python test runner | `pytest` unavailable in the inspected Python environment |

## Critical findings

### 1. Clone voice can appear successful when a real clone is unavailable

`zenaipex/api/v1/voices.py` contains legacy logic around `mock_` clone identifiers and fallback speech. A rejected provider sample can lead to a built-in fallback voice being heard instead of the selected clone. This breaks the expected “FK selected means FK speaks” promise.

**Impact:** High. Users may save/select a clone that is not actually usable in voice chat or calls.  
**Required evidence before release:** clone creation result, provider clone ID, preview provider, and live-call provider must be recorded per voice.

### 2. Gemini Live / STT / TTS fallback has not been proven with a controlled failure

Routing code exists for Gemini Live, Deepgram, Sarvam and neural TTS. Current status screens and route configuration are not proof that a real call fails over correctly after quota, timeout, invalid API key, or provider outage.

**Impact:** High. A caller could experience silence, delay, or an unexpected voice during provider failure.  
**Required evidence:** a staging call matrix for primary success, provider 401, quota exhaustion, timeout, STT failure, TTS failure, and call interruption.

### 3. Large files combine unrelated responsibilities

High-risk files include:

- `zenaipex-frontend/app/admin/agents/page.tsx` — ~2,392 lines
- `zenaipex/api/v1/admin/agents.py` — ~2,057 lines
- `zenaipex/api/v1/voice_advanced.py` — ~1,937 lines
- `zenaipex-frontend/app/admin/channels/[id]/page.tsx` — ~1,934 lines
- `zenaipex/ai/llm.py` — ~1,815 lines

**Impact:** Medium-high. Small changes can cause unrelated pages to regress; loading and navigation bugs become difficult to isolate.

### 4. Duplicate/legacy utilities remain in the project

Exact duplicate helper files were found: `splice.js`, `scratch.js`, `recover.js`, `extract.js`, and `find_lines.js`. The repository also contains many old `fix_*.py`, `query_*.py`, and test/probe scripts that are not part of the verified runtime path.

**Impact:** Medium. Developers can run the wrong maintenance script or maintain two conflicting sources of truth.

### 5. Six legacy Python scripts do not compile

`python -m py_compile` reported syntax/null-byte issues in:

- `zenaipex/services/auto_kb_updater.py`
- `zenaipex/query_old_calls.py`
- `zenaipex/patch.py`
- `zenaipex/fix.py`
- `zenaipex/fetch_latest.py`
- `zenaipex/fetch_db2.py`

Search did not show them imported by the runtime entrypoint, but they should be archived or repaired before release tooling relies on them.

### 6. Admin UI has inconsistent interaction quality

Observed risks:

- Some navigation groups can leave multiple active states visible.
- Old pages have full-blank spinner loading screens rather than local skeletons or retry actions.
- Voice selection can expose raw provider IDs instead of a name, clone state, and preview status.
- Modals/drawers use inconsistent backdrop, color, and width behavior.
- Direct browser `alert`/`confirm` calls remain widely used (46 references).
- Console logging remains extensive (503 log/error/warn references).

**Impact:** Medium. The product appears less reliable even when APIs work.

### 7. Data completeness/UI readiness are not fully connected

Company readiness percentages show progress, but the associated checklist, missing fields, and exact action needed are not consistently available across the company directory, company detail view, agent setup, and customer dashboard.

**Impact:** Medium. An admin cannot always tell which information must be filled manually or whether the AI has indexed it.

### 8. Knowledge and document flows need end-to-end proof

Document upload and RAG endpoints exist, but a release check must prove that uploaded company information is chunked, scoped to the correct tenant, retrieved, cited/traceable, and then used by chat and voice without cross-company leakage.

**Impact:** High for customer trust and tenant isolation.

## Duplicate route finding

`zenaipex/api/v1/companies.py` has had more than one declaration for the company logo endpoint (`GET /{company_id}/logo`) in the inspected working tree history. Keep only one authoritative implementation and verify its authentication/cache behavior.

## Areas that need a design pass

1. **Admin sidebar/header:** use one active state, one compact account panel, and a single company-context switcher.
2. **Company setup:** turn readiness into an actionable 6-step checklist with required/optional distinction, save status, and direct links to each missing setting.
3. **Voice library:** replace raw IDs with name, provider, verified-clone state, last preview result, assigned agents, and a clear fallback disclosure.
4. **Provider routing:** show primary and backup chains per surface (phone call, browser voice, chat), current health, last failure, quota state, and test result.
5. **Knowledge:** show document source, chunk count, indexing state, errors, retry, last updated, and tenant-scoped test search.
6. **Loading/errors:** use page-local skeletons and retry panels; avoid empty white screens and generic spinners.

## Recommended order of work

1. Remove fake clone-success behavior and prove clone-to-call identity.
2. Add controlled provider failure tests with call-level STT, LLM first-token, TTS first-audio, fallback provider, and interruption telemetry.
3. Repair/retire duplicate and broken maintenance scripts; add one documented operations command set.
4. Split the largest route/page files by feature boundary.
5. Build frontend automated coverage for auth, widget, company setup, voice selection, routing and fallback display.
6. Standardize admin loading, empty, error, modal, drawer, sidebar and responsive patterns.
7. Validate public home/chat/login/signup with real backend errors, retries, and mobile viewport checks.

## Release gate

Do not mark the voice/calling product as production-ready until these are demonstrated in staging:

- A selected FK/OM/custom clone is the voice played in preview, browser voice chat, and phone call.
- Invalid/short audio fails visibly and does not create a usable-looking clone.
- Gemini Live primary failure hands the call to the configured STT → LLM → clone-TTS chain, with a visible event log.
- Tenant knowledge answers come only from the selected company’s approved documents/settings.
- Dashboard/API saves persist after refresh and show success/failure feedback.
- Desktop and mobile navigation, drawers, dropdowns, tables and auth/widget flows work without blank states.

