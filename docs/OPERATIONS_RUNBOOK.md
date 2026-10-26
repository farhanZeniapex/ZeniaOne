# ZeniaOne production operations

## Required runtime configuration

- `MONGODB_URI` and `MONGODB_DB_NAME` must point to the persistent production Atlas database.
- `APP_SECRET_KEY` must be a production-grade 64+ character value.
- `APP_ENV=production` must be set explicitly; production/staging will fail fast if `APP_SECRET_KEY` is missing instead of generating a restart-unstable key.
- `PLATFORM_WEBHOOK_BASE_URL` must use HTTPS.
- `EXOTEL_WEBHOOK_SECRET` must be set for production Exotel callbacks; generated callback URLs carry a short-lived tenant-bound signature because Exotel callbacks do not provide the platform's custom header.
- `REDIS_URL` is optional, but should be configured for shared rate-limit counters and provider-cache snapshots when multiple instances run.
- `BILLING_WEBHOOK_SECRET` is optional; when blank, the payment webhook fails closed with `503`.
- `SENTRY_DSN` is optional; when configured, unhandled errors and traces are sent without default PII.

## Release verification

Every push to `main` runs backend tests and the frontend build. The production smoke workflow then checks `/health`, `/ready`, and the required billing, privacy, and monitoring routes on the Render backend.

The same workflow can be dispatched manually with a staging API base URL using the `api_base_url` input. This verifies a staging service against the identical production contract before promotion.

### Isolated staging blueprint

`render.staging.yaml` defines separate backend and frontend services. Create the Blueprint in Render with this file selected explicitly, provide a separate MongoDB Atlas database/URI for `zenaipex_staging`, and fill the `sync: false` secrets in the staging environment only. After the services become healthy, dispatch **ZeniaOne Production Smoke** manually with `api_base_url=https://zeniaone-backend-staging.onrender.com`. Do not point staging at the production database.

Scheduled outbound calls are persisted in MongoDB (`scheduled_calls`) and processed by a leased worker. A worker restart recovers expired leases; failed calls retry with bounded backoff and become terminal after three attempts. The legacy in-memory scheduler is retained only to cancel jobs created by older releases.

### Database backup and restore

Enable Atlas continuous/point-in-time backups for the production cluster. For an additional operator-controlled archive, install MongoDB Database Tools and run `python scripts/mongodb_backup.py backup --output-dir backups`; retain the archive and its manifest in encrypted storage outside the repository. Restore is deliberately guarded: use `restore <archive> --confirm-restore`, and add `--allow-production` only during an approved recovery window. Use `--dry-run` first to validate the target without writing data. The helper never drops collections automatically.

## Rollback procedure

1. Stop promotion if CI or production smoke fails.
2. In Render, deploy the previous known-good commit from the service's deploy history.
3. Verify `/health`, `/ready`, and the production smoke contract before reopening traffic.
4. Do not restore or overwrite MongoDB data as part of a code rollback; database deletion is only available through the owner-confirmed privacy endpoint.
5. If a failed release created background jobs, leave the durable queue intact so pending jobs can resume after the healthy release starts.

## Monitoring signals

The protected `/api/v1/admin/monitoring-summary` endpoint exposes database persistence, failed/pending background jobs, recent AI failures, provider circuit states, and actionable alerts. Use it alongside the live `/health` and `/ready` probes.
