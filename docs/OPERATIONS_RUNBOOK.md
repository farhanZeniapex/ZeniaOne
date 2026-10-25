# ZeniaOne production operations

## Required runtime configuration

- `MONGODB_URI` and `MONGODB_DB_NAME` must point to the persistent production Atlas database.
- `APP_SECRET_KEY` must be a production-grade 64+ character value.
- `PLATFORM_WEBHOOK_BASE_URL` must use HTTPS.
- `REDIS_URL` is optional, but should be configured for shared rate-limit counters and provider-cache snapshots when multiple instances run.
- `BILLING_WEBHOOK_SECRET` is optional; when blank, the payment webhook fails closed with `503`.
- `SENTRY_DSN` is optional; when configured, unhandled errors and traces are sent without default PII.

## Release verification

Every push to `main` runs backend tests and the frontend build. The production smoke workflow then checks `/health`, `/ready`, and the required billing, privacy, and monitoring routes on the Render backend.

## Rollback procedure

1. Stop promotion if CI or production smoke fails.
2. In Render, deploy the previous known-good commit from the service's deploy history.
3. Verify `/health`, `/ready`, and the production smoke contract before reopening traffic.
4. Do not restore or overwrite MongoDB data as part of a code rollback; database deletion is only available through the owner-confirmed privacy endpoint.
5. If a failed release created background jobs, leave the durable queue intact so pending jobs can resume after the healthy release starts.

## Monitoring signals

The protected `/api/v1/admin/monitoring-summary` endpoint exposes database persistence, failed/pending background jobs, recent AI failures, provider circuit states, and actionable alerts. Use it alongside the live `/health` and `/ready` probes.
