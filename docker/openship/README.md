# Sawaa OpenShip runtime

This directory is the isolated OpenShip Compose contract for the Sawaa source
checkout. It exposes backend 5100, dashboard 5103, and website 5105 through
the pre-provisioned Docker network. It publishes no host ports; ingress or a
tunnel is configured by the coordinator in OpenShip.

The Compose files deliberately omit `network_mode`. They attach services to an
external default network named by `RUNTIME_NETWORK` (default:
`openship-sawaa-staging`), which preserves service-name DNS in local Compose and
lets native OpenShip reuse the same project network. Provision this network as
an internal Docker network and verify `Internal=true` before every native
deploy; OpenShip may create a missing project network as a normal bridge.

PostgreSQL and Redis use required absolute host bind paths from
`POSTGRES_DATA_PATH` and `REDIS_DATA_PATH`. MinIO uses `MINIO_DATA_PATH`. The
coordinator must create the separate protected directories under
`/var/lib/webvue-apps/sawaa/openship-staging/`, set ownership for the image
runtime users, and restore approved data before launch. Do not point any of
these paths at live data or old rehearsal directories. PostgreSQL is mounted at
`/var/lib/postgresql`, the PostgreSQL 18 volume target.

Native OpenShip reads each mount's `source` but does not resolve the top-level
Compose volume `name`/`external` declaration. Keep these data mounts as direct
absolute binds so the native deployment cannot silently select a different
volume. The mounts intentionally use short bind syntax because the native
parser interpolates short-form sources; long-form `source:` values can remain
literal `${...}` expressions.

The main runtime file deliberately contains no migration service or migration
credential. `compose.migration.yml` is a separate one-shot file so an OpenShip
deployment that ignores Compose profiles cannot launch a destructive migration
automatically. It joins the same pre-provisioned external network and has no
`depends_on`; PostgreSQL must already be healthy when the coordinator invokes
it.

The backend command runs `migration-guard.cjs` before starting the application.
The guard opens a finite-timeout PostgreSQL connection as the restricted runtime
user, performs only a read-only transaction over `_prisma_migrations`, and
compares every active record with the SHA-256 hash of its source
`migration.sql`. It never applies migrations, repairs checksums, reads customer
data, or logs connection details. A failed or incomplete comparison aborts
startup before the application can serve traffic.

## Deployment sequence

1. Before creating or redeploying the native application, pre-provision the
   exact project network and confirm it is internal. For the default staging
   slug, the expected name is `openship-sawaa-staging`:

   ```sh
   docker network inspect openship-sawaa-staging >/dev/null 2>&1 || \
     docker network create --driver bridge --internal openship-sawaa-staging
   test "$(docker network inspect --format '{{.Internal}}' openship-sawaa-staging)" = true
   ```

   If the check fails, stop. Do not let OpenShip recreate the network because
   its fallback network is not guaranteed to be internal. Keep a host backup of
   the OpenShip app configuration (redacted of secret values) before saving
   changes, and after saving and after each redeploy prove that the compose
   path, build context, environment keys, bind paths, and network name still
   match this contract.
2. Copy the non-secret values from `.env.example` into the OpenShip project or
   global environment, then configure credentials and encryption values in the
   owning service scopes. OpenShip can inject project environment into every
   service, so `POSTGRES_PASSWORD`, `APP_DB_PASSWORD`, `REDIS_PASSWORD`, MinIO
   keys, JWT/encryption keys, provider credentials, and `SUPER_ADMIN_PASSWORD`
   must never be project-wide. Keep provider API credentials empty. Use
   URL-encoded credentials in both database URLs. `MIGRATION_DATABASE_URL` is
   scoped only to the one-shot `migrate` service when explicitly run and is
   never stored in the runtime project or passed to backend. A static prepare
   scan may report these required variables missing from project scope; that is
   expected because native deployment resolves service-scoped values at deploy.
   Scope the database owner and app-role values to `postgres`, the Redis
   password to `redis` and `backend`, MinIO keys to `minio` and `backend`, and
   the JWT/encryption/provider/admin secrets to `backend`. Scope
   `MIGRATION_DATABASE_URL` only to the separate `migrate` service for its
   explicit run.
3. Create the three protected host directories named by
   `POSTGRES_DATA_PATH`, `REDIS_DATA_PATH`, and `MINIO_DATA_PATH`, with
   ownership matching the corresponding container image. Restore the approved
   database and MinIO copy into the isolated directories. Do not copy
   production Redis data. Provision the restricted `APP_DB_USER` role manually
   in PostgreSQL before starting the backend; the image performs no role
   creation during initialization.
4. A cloned database can contain pending jobs or provider configuration;
   network policy must deny backend egress to payment, SMS, email, Authentica,
   Zoom, AI, and messaging providers.
5. Check the existing migration history before any migration command. The
   current main checkout records 98 migrations and the restored database
   records the same 98 names, but existing-history checksums differ for:
   `20260520150000_finalize_delivery_type_transition`,
   `20260520134448_add_delivery_type_and_bundles`, and
   `20260831120000_normalize_ai_provider_to_openrouter`. Treat this as an
   unresolved deployment gate. Do not reset, rewrite checksums, or run an
   automatic repair. The coordinator must reconcile the source/database
   provenance before invoking `compose.migration.yml`.
6. Build the four images from the repository root context selected by
   `compose.yml`. The application Dockerfiles are intentionally used unchanged.
   The custom `Postgres.Dockerfile` is based on `postgres:18` and installs
   `postgresql-18-pgvector`.
7. Start infrastructure and wait for PostgreSQL, Redis, and MinIO health.
   Run the one-shot migration explicitly only after step 5 is accepted:

   ```sh
   docker compose -f docker/openship/compose.migration.yml run --rm migrate
   ```

   The normal application start uses only `compose.yml`, starts backend with
   `node dist/src/main.js`, and never receives the migration owner URL.
8. Start the application services after the migration step succeeds. Do not
   run seeds. Verify backend readiness on 5100, dashboard on 5103, and website
   on 5105 through the configured ingress/tunnel.

The three approved restored-history checksum differences are exempted only
when `NODE_ENV=staging` and only for their exact name, database checksum, and
source hash pairs. This is a staging compatibility baseline, not a history
repair. Any source/schema migration change, pending migration, source-only
record, applied-only record, duplicate active name, unfinished record, or
checksum mismatch blocks automatic startup until the coordinator explicitly
reconciles and runs the separate migration step. Production cutover remains
open until that evidence and the other service gates are complete.

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

The native OpenShip 0.7.1 source confirms the constraints this contract follows:
`packages/core/src/compose-namespace.ts` rejects arbitrary named
`network_mode` values, and `packages/adapters/src/runtime/docker.ts` computes
the project network as `openship-${slug}`, reuses an exact existing network,
and creates a missing one as a normal bridge. The Compose parser's mount fold in
`packages/core/src/compose-spec.ts` consumes the mount `source`; it does not
resolve top-level volume `name`/`external` declarations. This is why the files
use an external default network and absolute bind sources.

After these files merge, configure the native OpenShip source settings to use
the repository's `docker/openship/compose.yml`, build context `../..`, and the
four service Dockerfiles/images described here. Confirm health-gated
dependencies, the standalone migration file, service-name DNS, and
build-argument persistence. Repeat the configuration backup and redeploy proof
from step 1 after any settings change. No deployment, remote validation, backup,
or rollback claim is made by this repository configuration; it remains a
staging contract until those checks pass.
