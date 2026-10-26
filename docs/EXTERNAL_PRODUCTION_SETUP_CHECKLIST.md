# External Production Setup Checklist

These steps require access to the Render, MongoDB Atlas, and provider accounts. Do not commit any secret or paste secret values into GitHub issues, pull requests, or source files.

## Render production backend

Set these values in the backend service environment. Keep the existing production database and secret values unchanged unless rotating them deliberately:

```text
APP_ENV=production
APP_BASE_URL=https://zeniaone-backend.onrender.com
FRONTEND_URL=https://zeniaone-web.onrender.com
PLATFORM_WEBHOOK_BASE_URL=https://zeniaone-backend.onrender.com
MONGODB_URI=<existing Atlas production URI>
MONGODB_DB_NAME=zenaipex
APP_SECRET_KEY=<64+ character random secret>
```

After saving, wait for the deploy and verify:

```text
GET https://zeniaone-backend.onrender.com/health
GET https://zeniaone-backend.onrender.com/ready
```

Both responses must report a healthy/ready service and a connected database.

## Atlas backup and restore drill

1. Enable Atlas continuous cloud backup/PITR for the production cluster.
2. Record the retention policy and approved recovery owner.
3. Run a restore drill into a separate non-production cluster.
4. Validate collection counts, indexes, tenant boundaries, and application readiness.
5. Only then set `ATLAS_BACKUP_VERIFIED=true` in Render.

The repository helper supports a guarded archive backup and a dry-run restore:

```text
python scripts/mongodb_backup.py backup --output-dir backups
python scripts/mongodb_backup.py restore <archive> --confirm-restore --dry-run
```

## Redis, Sentry, and uptime monitoring

Provision managed services and set only their connection/configuration values in Render:

```text
REDIS_URL=<TLS Redis connection URL>
SENTRY_DSN=<server-side Sentry DSN>
UPTIME_MONITOR_URL=<external monitor URL or identifier>
```

The built-in hourly GitHub monitor remains enabled even when an external monitor is configured. Never expose `REDIS_URL` or `SENTRY_DSN` to the frontend.

## Staging

Create a separate Render backend and frontend from `render.staging.yaml`, using a separate MongoDB database/cluster and separate secrets. Set `STAGING_BASE_URL` on the production backend only after the staging health, readiness, login, upload, and smoke checks pass.

## Billing and provider operations

Before enabling paid billing, configure provider pricing and the signed billing webhook secret, then test duplicate webhook delivery. Verify one real invoice against the payment provider before enabling customer-facing charges.

## Completion evidence

Record the deploy ID, health/readiness responses, Atlas restore-drill result, staging smoke result, and billing test event ID in the deployment log. Do not mark a gate complete based only on an environment variable being present.
