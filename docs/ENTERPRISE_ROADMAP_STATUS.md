# ZeniaOne Enterprise Roadmap Status

This is the implementation ledger for the seven-phase enterprise upgrade. A feature is marked **verified** only when the repository contains the implementation and a focused test, CI check, or live check supports it.

## 1. Database architecture and correctness

- **Verified:** MongoDB indexes, tenant-scoped queries, bounded pagination, canonical usage/billing collections, readiness checks, and durable scheduled-call storage.
- **Verified:** Guarded `scripts/mongodb_backup.py` backup/restore helper with checksum manifest, dry-run restore, and production confirmation gates.
- **External remaining:** Atlas continuous/PITR backup must be enabled and a real restore drill must be completed before setting `ATLAS_BACKUP_VERIFIED=true`.

## 2. Validation and enterprise security

- **Verified:** Request validation, duplicate channel prevention, upload safety checks, tenant/role authorization, rate limiting, login lockout, CORS/security headers, session revocation, optional TOTP, signed callbacks, encrypted provider settings, audit logging, and owner-controlled export/deletion.
- **Verified:** Focused security and validation tests are included in the backend suite.
- **External remaining:** Production secret rotation and an independent security review are operational tasks.

## 3. AI intelligence

- **Verified:** Provider fallback/circuit breaking, conversation memory, tenant-isolated RAG, prompt-injection defenses, retrieval sanitization, confidence scoring, and human-handoff metadata.
- **Verified:** RAG confidence and fallback behavior have focused tests.
- **External remaining:** Quality thresholds still depend on each tenant's knowledge content and configured provider keys; a full human-evaluated benchmark is not yet available.

## 4. Performance and deployment

- **Verified:** Optional Redis cache, safe frontend GET caching/deduplication/retry, background document and call jobs, connection pooling, bounded API pagination, and Render staging blueprint.
- **Verified:** Frontend production build and backend CI pass.
- **External remaining:** Redis, CDN/object storage, and a stronger/always-on Render plan require account-level provisioning.

## 5. Reliability and monitoring

- **Verified:** `/health`, `/ready`, queue failure telemetry, retries, failure recovery, production-readiness gaps in the admin System page, CI smoke checks, and hourly GitHub production monitor.
- **Verified:** Latest production smoke passed for commit `47678f7`.
- **External remaining:** Sentry, external uptime service, and an actual Render staging service still require deployment configuration.

## 6. Business intelligence, billing, and analytics

- **Verified:** Provider/company usage, token and voice-minute accounting, cost calculation, subscription limits, invoice preview, CSV/PDF usage reports, and signed idempotent billing webhook boundary.
- **Verified:** Billing, cost, and idempotency tests are included in the backend suite.
- **External remaining:** Payment-provider credentials, live plan pricing, and reconciliation with a real payment account are not configured.

## 7. Automated testing and delivery

- **Verified:** Backend suite: 172 passed locally; frontend production build passed; latest GitHub CI and production smoke passed; both configured GitHub repositories contain the latest commit.
- **Verified:** Scheduled monitor is present at `.github/workflows/production-monitor.yml`.
- **External remaining:** GitHub/Render notification routing and staged promotion require account-level setup.

## Current verification commands

```text
python -m pytest -q                         # 172 passed locally
npm run build                               # frontend build passed
GET https://zeniaone-backend.onrender.com/health
GET https://zeniaone-backend.onrender.com/ready
GET https://zeniaone-web.onrender.com/
```

The application is not marked enterprise-complete until the external items above have been provisioned and verified with evidence.
