# ZeniaOne Read-only Full Code Audit

**Date:** 18 October 2026  
**Scope:** Whole workspace source scan: FastAPI backend, Next.js frontend, scripts, configuration examples, tests, and repository hygiene.  
**Mode:** Read-only audit. No application, environment, database, call, provider, or API-key configuration was changed.

## Executive result

The production frontend build succeeds, so the current application can compile. However, the project is **not ready for a clean production release**. The main blockers are a public database-writing endpoint, tracked private key material, a failing frontend lint gate, hard-coded local backend addresses in shipped page code, and a large amount of duplicate/legacy repair code.

| Severity | Count | Meaning |
|---|---:|---|
| Critical | 2 | Fix before any public deployment |
| High | 5 | Likely production failure, security, or hard-to-maintain behavior |
| Medium | 7 | UI consistency, quality, testing, or operational risk |
| Low | 4 | Cleanup and maintainability |

## Validation performed

- Inspected **219 Python** backend files and **57 Next.js route pages**.
- Inspected frontend API calls, local URLs, error UI, test files, dependency manifests, tracked files, and current working-tree state.
- Ran `npm run build`: **passed**. Next.js generated 49 routes.
- Ran `npm run lint`: **failed with 713 findings**: 459 errors and 254 warnings.
- Ran `python -m pytest --collect-only -q`: **could not run**, because the active Python environment has no `pytest` installed.
- Performed safe runtime HTTP checks against the locally running backend: `/health` returned **200** with connected database, `/openapi.json` exposed **139 paths / 170 operations**, and an invalid public widget configuration returned **404**.
- Found **0 frontend test/spec files** outside `node_modules` and `.next`; backend has 16 test files under `zenaipex/tests`.
- No call, clone, provider, database, environment variable, or UI data was altered during this audit.

## Critical findings

### C1 — Public GET endpoint writes subscription limits

**Evidence:** [zenaipex/main.py](D:/zeniaOne-Voice-Assistant/zenaipex/main.py:353) defines `GET /api/v1/patch-limits`. It finds the admin company and updates `max_kb_docs` to `9999` without authentication or authorization.

**Impact:** Anyone who can reach the backend can alter a subscription limit by opening one URL. A GET request must never perform a privileged write.

**Required resolution:** Remove this endpoint from runtime code, or convert it into an authenticated, admin-only maintenance action with CSRF-safe semantics and audit logging.

### C2 — A private key is tracked in Git

**Evidence:** `git ls-files` reports `temp_key` and `temp_key.pub`; the first line of `temp_key` identifies it as private key material. The file is not ignored. Its content is intentionally not included in this report.

**Impact:** A key committed to Git can remain accessible through history even if deleted later. It is credential exposure.

**Required resolution:** Revoke/rotate the key immediately, remove it from the repository and Git history, and add a secret-scanning gate. Do not only delete the current file.

## High findings

### H1 — Frontend lint gate is failing at large scale

**Evidence:** `npm run lint` reports **713 problems**, including **459 errors**. Examples include `no-explicit-any`, React purity failures, unused code, `require()` in TypeScript lint scope, and a binary parsing failure.

Affected examples:

- [app/admin/agents/page.tsx](D:/zeniaOne-Voice-Assistant/zenaipex-frontend/app/admin/agents/page.tsx) has multiple type and unused import errors.
- [lib/api/client.ts](D:/zeniaOne-Voice-Assistant/zenaipex-frontend/lib/api/client.ts) has multiple `any` errors and internal `window.location.assign` navigation warnings.
- [components/ui/segmented-control.tsx](D:/zeniaOne-Voice-Assistant/zenaipex-frontend/components/ui/segmented-control.tsx) is UTF-16/NUL encoded; ESLint reports it as binary.
- `find.js`, `find2.js`, `findhistory.js`, and `patch.js` are in the frontend lint scope and use forbidden CommonJS imports.

**Impact:** Type/design regressions cannot be reliably blocked in CI. The green production build does not mean the code-quality gate is healthy.

**Required resolution:** Establish a zero-error lint baseline, move maintenance scripts outside frontend source/lint scope, convert the malformed UTF-16 component to UTF-8, then address typed API contracts page by page.

### H2 — Production pages still hard-code localhost backend URLs

**Evidence:**

- [app/api/lead/route.ts](D:/zeniaOne-Voice-Assistant/zenaipex-frontend/app/api/lead/route.ts:10) uses `http://localhost:8000`.
- [sales page](D:/zeniaOne-Voice-Assistant/zenaipex-frontend/app/admin/companies/[id]/sales/page.tsx:19) uses `http://localhost:8000`.
- [sales call detail page](D:/zeniaOne-Voice-Assistant/zenaipex-frontend/app/admin/companies/[id]/sales/[call_id]/page.tsx:22) uses `http://localhost:8000`.
- [core config](D:/zeniaOne-Voice-Assistant/zenaipex/core/config.py:27) defaults platform and frontend addresses to local development hosts.

**Impact:** Lead capture and sales views will request the server's own localhost in deployed environments, causing failed data loads or missed leads.

**Required resolution:** All frontend/backend URLs must be derived from validated environment configuration. Fail startup when a production public URL is missing.

### H3 — Duplicate runtime audio implementation creates drift risk

**Evidence:** Both [modules/audio_utils.py](D:/zeniaOne-Voice-Assistant/modules/audio_utils.py) and [zenaipex/modules/audio_utils.py](D:/zeniaOne-Voice-Assistant/zenaipex/modules/audio_utils.py) exist. They differ: 556 versus 625 lines and different SHA-256 hashes. Active backend imports resolve `modules.audio_utils` from multiple call routes, including [voice_advanced.py](D:/zeniaOne-Voice-Assistant/zenaipex/api/v1/voice_advanced.py:876).

**Impact:** A voice quality or codec fix can be applied to the inactive copy, resulting in inconsistent or unexplained call behavior.

**Required resolution:** Pick one package location, make imports explicit and consistent, add an audio-path regression suite, and archive/remove the redundant implementation after migration.

### H4 — Voice/call failures are difficult to diagnose due to broad exception handling

**Evidence:** There are **196** `except Exception` occurrences in active backend API, service, module, and AI folders. High concentration examples:

- [voice_advanced.py](D:/zeniaOne-Voice-Assistant/zenaipex/api/v1/voice_advanced.py:43)
- [voices.py](D:/zeniaOne-Voice-Assistant/zenaipex/api/v1/voices.py:105)
- [sarvam_tts.py](D:/zeniaOne-Voice-Assistant/zenaipex/modules/sarvam_tts.py:119)
- [llm.py](D:/zeniaOne-Voice-Assistant/zenaipex/ai/llm.py:43)

**Impact:** STT, Gemini/Sarvam, TTS, clone, media, or database failures can collapse into generic fallback behavior. This matches the reported symptom that a caller gets slow/wrong/no audio without a clear reason.

**Required resolution:** Catch provider-specific errors, assign a stable error code, record the selected provider/fallback/latency per turn, and surface a safe diagnostic in the admin call detail screen.

### H5 — Repository contains live legacy repair/diagnostic scripts

**Evidence:** The `zenaipex` folder contains 21 root-level `fix*.py` files (`fix_channels.py`, `fix_final.py`, `fix_db*.py`, etc.), plus numerous `check_*.py`, `query_*.py`, `recover_*.py`, and scratch scripts. The root Git status also contains many untracked helpers.

**Impact:** It is unclear which script is safe, current, or intended for production. An operator can easily run a destructive repair script against a real database.

**Required resolution:** Move one-off scripts to `tools/legacy/`, document ownership and required environment, require explicit dry-run flags, and keep supported administrative actions behind authenticated UI/API routes.

## Medium findings

### M1 — User-facing admin/customer flows still use browser `alert()` and `confirm()`

**Evidence:** Calls remain in clone voice, agents, channels, companies, chat upload, subscriptions, and call recording pages. Examples:

- [VoiceCloningStudio.tsx](D:/zeniaOne-Voice-Assistant/zenaipex-frontend/components/VoiceCloningStudio.tsx:69)
- [voice channel](D:/zeniaOne-Voice-Assistant/zenaipex-frontend/app/dashboard/channels/voice/page.tsx:74)
- [web-chat channel](D:/zeniaOne-Voice-Assistant/zenaipex-frontend/app/dashboard/channels/web-chat/page.tsx:49)

**Impact:** The UI feels old and blocking, errors are not persistent or actionable, and success messages disappear without context.

**Required resolution:** Replace with the existing toast/inline notice pattern and use branded confirmation modals for delete/archive operations.

### M2 — No frontend automated test suite

**Evidence:** Search found **0** `*.test.*` or `*.spec.*` frontend files outside dependencies. The main customer, admin, routing, widget, login, clone, and channel pages are large client components with no visible UI regression coverage.

**Impact:** Sidebar state, route transitions, modal behavior, mobile UI, provider routing, and “same agent/voice selected” behavior can regress unnoticed.

**Required resolution:** Add component tests for API error/empty/loading states and Playwright end-to-end tests for login, create-company, save-agent, channel setup, public widget, and a mocked voice-call lifecycle.

### M3 — Backend tests cannot run from the current normal Python command

**Evidence:** `python -m pytest --collect-only -q` returns `No module named pytest`; `zenaipex/.venv` does not exist. `pytest` is declared only in development extras, not as an installed tool in this environment.

**Impact:** The 16 backend tests are not a working release gate on the current machine.

**Required resolution:** Define one reproducible bootstrap command (`uv sync --all-groups`, or project virtualenv install), add a CI job that collects/runs tests, and document it in README.

### M4 — Documentation is outdated relative to product behavior

**Evidence:** [README.md](D:/zeniaOne-Voice-Assistant/README.md:1) describes an Exotel → Sarvam-only architecture. The live code and UI also contain Gemini Live, Deepgram, clone voices, multi-provider routing, customer/admin dashboards, and different ports.

**Impact:** New developers and operators will configure the wrong provider flow and misdiagnose fallbacks.

**Required resolution:** Replace the README architecture with a current routing diagram: channel → STT → model → clone/built-in TTS → fallback chain, plus local/staging/production setup.

### M5 — API configuration is inconsistent

**Evidence:** Some code uses [lib/api/client.ts](D:/zeniaOne-Voice-Assistant/zenaipex-frontend/lib/api/client.ts:3) and `NEXT_PUBLIC_API_URL`, while other pages use direct `fetch()` to hard-coded hosts. There are also stale artifacts such as `replacement.txt`, `func_dump.txt`, `page.tsx.bak`, and local development logs inside the frontend tree.

**Impact:** Different pages can call different backend ports or environments. Old code makes audits and debugging unreliable.

**Required resolution:** Use the shared API client for every request; remove/archive stale artifacts and exclude diagnostic scripts/logs from source and lint.

### M6 — Maintenance guard has a fail-open dependency behavior

**Evidence:** [zenaipex/main.py](D:/zeniaOne-Voice-Assistant/zenaipex/main.py:283) checks maintenance state from MongoDB, but on a database exception it retains the previous cached state ([line 300](D:/zeniaOne-Voice-Assistant/zenaipex/main.py:300)).

**Impact:** If maintenance is enabled but the database becomes unavailable before cache refresh, customer traffic might still be accepted.

**Required resolution:** Decide and document explicit fail-open/fail-closed policy per route. For telephony/webhooks, return an intentional provider-safe response and log the degraded mode.

### M7 — The tracking change set is too broad to safely review as one release

**Evidence:** Current root diff is 32 backend files with **2,641 additions / 729 deletions**. The frontend subproject also has many modified route files and new UI files. Existing untracked reports/scripts are mixed with product code.

**Impact:** A single regression is difficult to isolate, review, roll back, or attribute.

**Required resolution:** Split into reviewable commits: security, voice runtime, backend routing, admin UI, customer UI, website/auth, and cleanup. Add a release note and test evidence to each.

## Low findings

### L1 — Invalid file encoding in a UI component

[segmented-control.tsx](D:/zeniaOne-Voice-Assistant/zenaipex-frontend/components/ui/segmented-control.tsx) contains NUL bytes and UTF-16 content, so ESLint treats it as binary. Convert it to UTF-8 source.

### L2 — Backup source file remains inside active frontend path

[page.tsx.bak](D:/zeniaOne-Voice-Assistant/zenaipex-frontend/app/admin/agents/page.tsx.bak) is 98,889 bytes and contains stale API/UI code. It creates search noise and can cause accidental restoration of obsolete behavior.

### L3 — Dependency manifests are not fully aligned

`pyproject.toml` and `requirements.txt` overlap but differ in libraries and versions. The project currently exposes both pip and uv style setup without a single authoritative install path.

### L4 — Unused lint scope files reduce signal

Utility scripts such as `find.js`, `find2.js`, `findhistory.js`, and `patch.js` are linted like application code even though they are repair/debug artifacts.

## What currently works

- `npm run build` succeeds and generates the full Next.js route set.
- CORS uses a configured production frontend URL outside development in [main.py](D:/zeniaOne-Voice-Assistant/zenaipex/main.py:270).
- `.env` is ignored by Git.
- Backend has a meaningful test directory covering call, RAG tenant isolation, Gemini adapter, latency, billing, and voice channel concerns. The issue is execution setup, not absence of all backend tests.
- A global backend exception handler returns a safe generic 500 response rather than exposing exception text to visitors ([main.py](D:/zeniaOne-Voice-Assistant/zenaipex/main.py:310)).

## Recommended order of work

1. **Immediately:** Remove/protect `patch-limits`; rotate and purge the tracked private key.
2. **Before staging:** Centralize all API base URLs; repair lint so it has zero errors; make backend tests runnable in a reproducible environment.
3. **Voice reliability:** Consolidate audio utility implementation; implement structured provider/fallback/latency records and a no-credit mocked voice pipeline test.
4. **UI polish:** Replace native alerts/confirms; remove stale backups and scripts from the frontend; add empty/loading/error mobile checks.
5. **Release process:** Split the large mixed working tree into focused commits, then run build, lint, backend tests, and an authenticated staging call test.

## Audit limitations

This audit intentionally did not call Gemini, Sarvam, Deepgram, Exotel, clone voice endpoints, or mutate MongoDB records, so live provider quality, credits, real phone latency, and clone sound fidelity were not measured. Those require a separate staged test plan with a designated test tenant and approved provider budget.
