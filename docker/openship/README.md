# Sawaa OpenShip runtime

This directory is the isolated OpenShip Compose contract for the Sawaa source
checkout. It exposes backend 5100, dashboard 5103, and website 5105 through
the pre-provisioned Docker network. It publishes no host ports; ingress or a
tunnel is configured by the coordinator in OpenShip.

The Compose file uses `network_mode: ${RUNTIME_NETWORK:-sawaa-staging-internal}`
for every service. Provision that Docker internal network before starting the
stack. The PostgreSQL volume is mounted at `/var/lib/postgresql`, which is the PostgreSQL
18 volume target and is required for the restored volume layout. The
PostgreSQL and Redis volume names are external and come from `POSTGRES_VOLUME`
and `REDIS_VOLUME`; provision them independently. The MinIO data path comes
from `MINIO_DATA_PATH`. Do not point any of these at live volumes or production
Redis.

The main runtime file deliberately contains no migration service or migration
credential. `compose.migration.yml` is a separate one-shot file so an OpenShip
deployment that ignores Compose profiles cannot launch a destructive migration
automatically. It joins the same pre-provisioned network and has no
`depends_on`; PostgreSQL must already be healthy when the coordinator invokes
it.

## Deployment sequence

1. Copy `.env.example` into the OpenShip environment store and replace every
   blank required value with an isolated value. Keep provider API credentials
   empty. Use URL-encoded credentials in both database URLs, and make
   `MIGRATION_DATABASE_URL` an owner/migration URL that is never supplied to
   the backend service.
2. Restore the approved database and MinIO copy into the isolated volumes.
   Do not copy production Redis data. A cloned database can contain pending
   jobs or provider configuration; network policy must deny backend egress to
   payment, SMS, email, Authentica, Zoom, AI, and messaging providers.
3. Check the existing migration history before any migration command. The
   current main checkout records 98 migrations and the restored database
   records the same 98 names, but existing-history checksums differ for:
   `20260520150000_finalize_delivery_type_transition`,
   `20260520134448_add_delivery_type_and_bundles`, and
   `20260831120000_normalize_ai_provider_to_openrouter`. Treat this as an
   unresolved deployment gate. Do not reset, rewrite checksums, or run an
   automatic repair. The coordinator must reconcile the source/database
   provenance before invoking `compose.migration.yml`.
4. Build the four images from the repository root context selected by
   `compose.yml`. The application Dockerfiles are intentionally used unchanged.
   The custom `Postgres.Dockerfile` is based on `postgres:18` and installs
   `postgresql-18-pgvector`.
5. Start infrastructure and wait for PostgreSQL, Redis, and MinIO health.
   Run the one-shot migration explicitly only after step 3 is accepted:

   ```sh
   docker compose -f docker/openship/compose.migration.yml run --rm migrate
   ```

   The normal application start uses only `compose.yml`, starts backend with
   `node dist/src/main.js`, and never receives the migration owner URL.
6. Start the application services after the migration step succeeds. Do not
   run seeds. Verify backend readiness on 5100, dashboard on 5103, and website
   on 5105 through the configured ingress/tunnel.

## API URL details

The dashboard's `next.config.mjs` reads only `NEXT_PUBLIC_API_URL` when it
creates the `/api/proxy` rewrite. `DASHBOARD_API_URL` therefore maps to that
build argument and is set to `http://backend:5100/api/v1`; dashboard client
requests observed in source use same-origin `/api/proxy`. This is a server-side
rewrite target, not a browser public URL. If future dashboard code calls the
API directly from the browser, the application Dockerfile must first gain a
separate internal rewrite target; that change is outside this package.

The website receives the public `NEXT_PUBLIC_API_URL` at build time and
`INTERNAL_API_URL=http://backend:5100/api/v1` at runtime for SSR. Keep the
public value reachable from the browser and do not use Docker service names in
it.

## Side effects and OpenShip settings

There is no global cron disable switch in the current backend. The outbox flags
are explicitly false in the example, but local cron workers still run booking
transitions, retention, reconciliation, audits, and queue polling. Use a fresh
Redis and deny provider egress; the cloned database may still be mutated by
these local jobs. Retention remains bounded at 365 days in this template and
must not be changed to an unsupported large value.

After these files merge, configure the native OpenShip source settings to use
the repository's `docker/openship/compose.yml`, build context `../..`, and the
four service Dockerfiles/images described here. Confirm OpenShip's handling of
`network_mode`, external volumes, the standalone migration file, health-gated dependencies,
and build-argument persistence before selecting the application for a live
deployment. In particular, a custom `network_mode` value naming a pre-created
network may not provide Compose service aliases (`postgres`, `redis`, `minio`,
and `backend`) on every OpenShip runtime. The current files retain those
service-host contracts, but native integration must prove DNS/alias behavior
before deployment; this configuration is not deploy-ready until that check
passes. No deployment, remote validation, backup, or rollback claim is made by
this repository configuration.
