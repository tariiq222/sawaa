# Sawaa Prisma migration charter — approved 2026-09-22

This charter defines how every AI tool and contributor creates, reviews, and deploys Prisma
schema changes for Sawaa. It expands the golden rule in the root CLAUDE/AGENTS instructions
("Migrations are immutable") into an enforceable protocol, and complements
[the deployment policy](deployment-policy.md) and [the restore runbook](restore-runbook.md).
Higher-priority platform instructions still apply.

## 1. Invariants (never break)

1. **Migrations are append-only.** Once a migration is committed, it is immutable: never edit,
   rename, reorder, squash, or delete it — even to fix a typo. Add a new migration instead.
   Enforced by `scripts/check-prisma-migration-immutability.mjs`, which accepts **additions
   only** (`A`) under `apps/backend/prisma/migrations/` versus the base ref, and runs in
   `ci.yml` and `merge-gate.yml`.
2. **`prisma migrate deploy` is the only production command** (wired as `pnpm db:migrate`).
   Never `db push` against any shared database. `migrate reset` and `db push` are local-dev
   tools against disposable data only.
3. **Schema is split per domain cluster** under `prisma/schema/`. `main.prisma` solely owns
   `datasource`/`generator` (including the `pgvector` extension). Known deviations are
   intentional: `org-config` + `org-experience` share `organization.prisma`, and
   `integrations` owns no tables. Keep model ownership aligned with cluster boundaries
   (see `apps/backend/CLAUDE.md`).
4. **`_prisma_migrations` is production state.** Do not delete or hand-edit its rows on a
   shared database without explicit owner authorization.

## 2. Authoring a new migration

Naming follows the existing convention: `<timestamp>_<verb_noun_description>`
(e.g. `20260913090000_add_package_refund_event`).

**Additive by default (normal flow):** new tables, nullable columns, new indexes, new
constraints, new enums/enum values.

**Owner-confirmation required (High tier — same bar as destructive DB operations):**

- `DROP TABLE` / `DROP COLUMN`, `RENAME *`, column type changes
- `NOT NULL` conversions with backfill on live tables
- Any `DELETE` / `TRUNCATE` / bulk data rewrite inside a migration

**Deprecate before you delete.** Column/table removal is a two-phase change:
phase 1 stops writes and makes the field optional; phase 2 drops it in a later release after
the owner confirms no consumer remains. Never combine both phases in one release.

**Review the generated SQL by hand before merging.** Passing tests and green CI verify
history immutability, not that a *new* migration is safe to run against live data.

**Custom SQL is allowed in a *new* migration** (Prisma wraps migrations in a transaction by
default; when a statement cannot run inside one, create the migration with
`--create-only`, hand-write the SQL — e.g. `CREATE INDEX CONCURRENTLY` — and review it before
first apply). This is authoring, not editing history.

## 3. Hot-table and locking discipline

Hot tables (frequently written, customer-facing) currently include the `bookings` domain,
the `finance` domain (payments, refunds, package purchases), `clients`, and high-volume
`comms` tables. For any `CREATE INDEX` or backfill touching them:

1. Assess table size and expected lock duration before merging.
2. Prefer a non-blocking path (hand-written `CONCURRENTLY` index creation, or application-side
   batched backfill via a queue/ops task) over a single long-locking migration.
3. Schedule heavy backfills away from peak hours and coordinate the deploy window through the
   deployment policy's staging/manual-acceptance flow.

## 4. Deployment discipline (production)

Before any production promotion that includes migrations:

1. **Expand → deploy → contract.** Ship additive schema first; the currently running release
   must keep working against the new schema; destructive/contracting changes wait for a later
   release (see §2 deprecation rule).
2. **Verify backup readiness** per [restore-runbook.md](restore-runbook.md) — the deployment
   policy requires this check before production promotion.
3. Apply with `pnpm db:migrate`, then record the migration revision and evidence alongside the
   deployment record per [deployment-policy.md](deployment-policy.md).
4. If a gate fails, stop at that gate and report the evidence. A green CI never justifies
   forcing a migration through.

## 5. Anti-patterns (each of these has caused production incidents elsewhere)

- Squashing or "cleaning up" old migrations for tidiness.
- Editing an applied migration because its SQL was wrong — write a corrective migration.
- Regenerating the database from models with `db push` on a shared environment.
- Bundling a destructive migration silently inside an unrelated feature release.
- Assuming the split schema's absence of cross-cluster foreign keys is a bug — referential
  integrity across contexts is enforced at the application level by design.

## 6. Enforcement status

Automated today: the immutability check (additions-only diff) runs in `ci.yml` and
`merge-gate.yml`; the OpenShip deployment flow is governed by the deployment policy.
Not automated — procedural and mandatory: hot-table lock review (§3), owner confirmation for
destructive statements (§2), and backup verification (§4). This charter records approved
process; it does not itself configure any automation.
