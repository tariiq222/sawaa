# Legacy Booknetic Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and rehearse an additive, idempotent import of Sawaa tenant `6` Booknetic history into the current PostgreSQL schema without deleting or cancelling existing server data and without importing the 11 appointments excluded by the frozen cutover.

**Architecture:** A local-only extractor reads the isolated MariaDB restore and emits a versioned tenant-only JSON bundle. A compiled one-shot backend CLI validates that bundle, plans matches against the target PostgreSQL database, and either reports a dry run or writes additive rows directly with Prisma in small transactions. No Nest application context is started, so cron jobs, notifications, invoices, payments, Zoom jobs, and outbox events cannot be triggered by the importer.

**Tech Stack:** TypeScript 5.7, Node 20, Prisma 7, PostgreSQL 18 with pgvector, MariaDB 11.8, `mysql2`, `libphonenumber-js`, ExcelJS, Jest.

## Global Constraints

- Source scope is exactly Booknetic `tenant_id = 6`.
- Frozen cutover is exactly `2026-08-11T20:54:55Z`; appointments after it are absent from every target table.
- The expected source counts are 5,035 appointments, 11 excluded future appointments, 5,022 new historical bookings, one `LINKED_EXISTING`, and one `ARCHIVED_ONLY`.
- Never delete, cancel, deactivate, overwrite, or otherwise mutate an existing target booking, client, employee, service, invoice, payment, notification, or outbox event.
- Existing Prisma migrations are immutable; add one forward-only migration.
- Do not log client names, phones, emails, notes, or intake answers.
- Production application requires a fresh verified backup, maintenance window, stopped backend service, production dry run, and explicit apply confirmation.
- Git commits, pushes, merges, and deployment occur only when separately authorized.

---

## File Map

- `apps/backend/prisma/schema/ops.prisma`: owns the import disposition enum and idempotency record.
- `apps/backend/prisma/migrations/20260812143000_add_legacy_import_record/migration.sql`: additive enum/table/index migration only.
- `apps/backend/src/modules/ops/legacy-import/legacy-import.types.ts`: versioned bundle and plan contracts shared by extractor and importer.
- `apps/backend/src/modules/ops/legacy-import/legacy-import.normalization.ts`: pure phone, email, name, money, epoch, and status conversion.
- `apps/backend/src/modules/ops/legacy-import/legacy-import.bundle.ts`: bundle validation, stable payload hashing, and future exclusion.
- `apps/backend/src/modules/ops/legacy-import/legacy-import.planner.ts`: deterministic employee/client matching and booking dispositions.
- `apps/backend/src/modules/ops/legacy-import/legacy-import.writer.ts`: additive Prisma writes in bounded transactions.
- `apps/backend/src/modules/ops/legacy-import/legacy-import.report.ts`: aggregate non-PII JSON report and excluded-future Excel export.
- `apps/backend/src/ops/legacy-import-cli.ts`: one-shot CLI, target guards, dry-run default, and production confirmation.
- `apps/backend/scripts/legacy-import/extract-booknetic.ts`: local MariaDB extractor producing the tenant-only bundle.
- `apps/backend/src/modules/ops/legacy-import/*.spec.ts`: unit tests for each observable contract.
- `apps/backend/test/legacy-import.e2e-spec.ts`: real MariaDB/PostgreSQL rehearsal checks.
- `apps/backend/package.json`: extractor/importer commands and `mysql2` development dependency.
- `docs/operations/legacy-booknetic-import-runbook.md`: exact rehearsal, production, verification, and restore procedure.

### Task 1: Add the immutable idempotency schema

**Files:**
- Modify: `apps/backend/prisma/schema/ops.prisma`
- Create: `apps/backend/prisma/migrations/20260812143000_add_legacy_import_record/migration.sql`

**Interfaces:**
- Produces: Prisma enum `LegacyImportDisposition` and model `LegacyImportRecord` with unique source identity.
- Consumes: no task output.

- [ ] **Step 1: Add the Prisma model**

```prisma
enum LegacyImportDisposition {
  IMPORTED
  LINKED_EXISTING
  ARCHIVED_ONLY
  SKIPPED
}

model LegacyImportRecord {
  id           String                  @id @default(uuid()) @db.Uuid
  sourceSystem String
  sourceTenant String
  entityType   String
  legacyId     String
  targetType   String?
  targetId     String?
  disposition  LegacyImportDisposition
  payloadHash  String
  metadata     Json?
  importedAt   DateTime                @default(now()) @db.Timestamptz(3)
  updatedAt    DateTime                @updatedAt @db.Timestamptz(3)

  @@unique([sourceSystem, sourceTenant, entityType, legacyId])
  @@index([targetType, targetId])
  @@index([disposition])
}
```

- [ ] **Step 2: Add an additive SQL migration**

The migration creates only the enum, table, unique constraint, and indexes represented above. It contains no `DROP`, `DELETE`, `TRUNCATE`, `UPDATE`, or alteration of existing columns.

- [ ] **Step 3: Validate the schema and migration**

Run:

```bash
pnpm --filter=backend prisma:format
pnpm --filter=backend prisma:validate
rg -n 'DROP|DELETE|TRUNCATE|UPDATE' apps/backend/prisma/migrations/20260812143000_add_legacy_import_record/migration.sql
```

Expected: Prisma validation passes and `rg` returns no match.

### Task 2: Define and validate the tenant-only bundle

**Files:**
- Create: `apps/backend/src/modules/ops/legacy-import/legacy-import.types.ts`
- Create: `apps/backend/src/modules/ops/legacy-import/legacy-import.bundle.ts`
- Create: `apps/backend/src/modules/ops/legacy-import/legacy-import.bundle.spec.ts`
- Create: `apps/backend/scripts/legacy-import/extract-booknetic.ts`
- Modify: `apps/backend/package.json`

**Interfaces:**
- Produces: `LegacyBundleV1`, `validateLegacyBundle(value)`, `hashLegacyPayload(value)`, and CLI `legacy:extract`.
- Consumes: frozen source tenant and cutover from Global Constraints.

- [ ] **Step 1: Write failing bundle tests**

```ts
it('rejects a bundle from any tenant except 6', () => {
  expect(() => validateLegacyBundle({ ...validBundle, sourceTenant: 7 }))
    .toThrow('sourceTenant must be 6');
});

it('excludes appointment 15886 before any target plan is built', () => {
  const result = partitionAppointments(validBundle.appointments, new Date('2026-08-11T20:54:55Z'));
  expect(result.excluded.map((row) => row.id)).toContain(15886);
  expect(result.historical.map((row) => row.id)).not.toContain(15886);
});

it('produces the same sha256 for object keys in a different order', () => {
  expect(hashLegacyPayload({ b: 2, a: 1 })).toBe(hashLegacyPayload({ a: 1, b: 2 }));
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `pnpm --filter=backend exec jest src/modules/ops/legacy-import/legacy-import.bundle.spec.ts --runInBand`

Expected: fail because the bundle functions do not exist.

- [ ] **Step 3: Implement the bundle contract and stable hash**

`LegacyBundleV1` contains arrays for appointments, referenced customers, referenced staff, referenced services, referenced locations, service categories, forms, form inputs, choices, and appointment custom data. Validation rejects a wrong version, tenant, missing relation, duplicate legacy ID, non-finite epoch, or source count mismatch. Hashing recursively sorts object keys before SHA-256.

- [ ] **Step 4: Implement the local extractor**

The extractor uses parameterized `mysql2/promise` queries with `tenant_id = ?`, derives referenced IDs from the appointment set, fetches only referenced entities, and writes the JSON bundle with mode `0600`. It prints only table counts and the bundle SHA-256.

- [ ] **Step 5: Verify GREEN and extract the real bundle**

Run:

```bash
pnpm --filter=backend exec jest src/modules/ops/legacy-import/legacy-import.bundle.spec.ts --runInBand
LEGACY_DATABASE_URL='mysql://root:sawaa_legacy_local_only@127.0.0.1:53306/legacy' pnpm --filter=backend legacy:extract -- --tenant 6 --output /Users/tariq/Downloads/sawaa-booknetic-tenant-6.json
chmod 600 /Users/tariq/Downloads/sawaa-booknetic-tenant-6.json
```

Expected report literals: 5,035 appointments, 2,268 referenced customers, 49 referenced staff, 18 services, 3 locations, 23,795 custom-data rows.

### Task 3: Normalize and map legacy values with pure functions

**Files:**
- Create: `apps/backend/src/modules/ops/legacy-import/legacy-import.normalization.ts`
- Create: `apps/backend/src/modules/ops/legacy-import/legacy-import.normalization.spec.ts`

**Interfaces:**
- Produces: `normalizeSaudiPhone`, `normalizeEmail`, `canonicalName`, `sarToHalalas`, `epochSecondsToDate`, `mapHistoricalStatus`, and `mapDeliveryType`.
- Consumes: source row types from Task 2.

- [ ] **Step 1: Write failing table-driven tests**

```ts
it.each([
  ['0501234567', '+966501234567'],
  ['966501234567', '+966501234567'],
  ['⁦96650641461403⁩', null],
  ['', null],
])('normalizes Saudi phone %p', (input, expected) => {
  expect(normalizeSaudiPhone(input)).toBe(expected);
});

it.each([
  ['approved', 'CONFIRMED'],
  ['canceled', 'CANCELLED'],
  ['pending', 'EXPIRED'],
  ['rejected', 'CANCELLED'],
])('maps historical status %s', (source, expected) => {
  expect(mapHistoricalStatus(source)).toBe(expected);
});

it('keeps epoch as UTC without adding three hours', () => {
  expect(epochSecondsToDate(1692201600).toISOString()).toBe('2023-08-16T16:00:00.000Z');
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter=backend exec jest src/modules/ops/legacy-import/legacy-import.normalization.spec.ts --runInBand`

- [ ] **Step 3: Implement minimal pure conversions**

Use `parsePhoneNumberFromString(input, 'SA')`; return E.164 only when valid. Normalize email with trim and lowercase. Convert SAR decimal strings to integer halalas without binary floating-point arithmetic. Map service IDs `103, 141, 272, 273, 286` to `ONLINE` and all others to `IN_PERSON`.

- [ ] **Step 4: Verify GREEN**

Run: `pnpm --filter=backend exec jest src/modules/ops/legacy-import/legacy-import.normalization.spec.ts --runInBand`

### Task 4: Plan deterministic matches without writing

**Files:**
- Create: `apps/backend/src/modules/ops/legacy-import/legacy-import.planner.ts`
- Create: `apps/backend/src/modules/ops/legacy-import/legacy-import.planner.spec.ts`

**Interfaces:**
- Produces: `buildLegacyImportPlan(bundle, targetSnapshot, cutoverAt): LegacyImportPlan`.
- Consumes: bundle and normalization functions from Tasks 2-3.

- [ ] **Step 1: Write failing planner tests**

The test fixtures assert these observable results:

```ts
expect(plan.excludedAppointments).toHaveLength(11);
expect(plan.newBookings).toHaveLength(5022);
expect(plan.appointmentDispositions.get(15834)).toEqual({ kind: 'LINKED_EXISTING', targetBookingId: 'existing-no-show' });
expect(plan.appointmentDispositions.get(15747)).toEqual({ kind: 'ARCHIVED_ONLY', reason: 'EMPLOYEE_TIME_OVERLAP' });
expect(plan.appointmentDispositions.has(15886)).toBe(false);
expect(plan.historicalServices).toHaveLength(18);
expect(plan.newHistoricalEmployees).toHaveLength(18);
expect(plan.matchedCurrentEmployeeIds).toHaveLength(27);
```

Additional tests prove ambiguous phone/email matches fail, two Dr Majed source rows collapse into one historical employee, current employee flags are not present in any update plan, and existing client non-empty fields are preserved.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter=backend exec jest src/modules/ops/legacy-import/legacy-import.planner.spec.ts --runInBand`

- [ ] **Step 3: Implement target snapshot and deterministic planner**

The planner uses strong phone then email matching, canonical selection by appointment count/completeness/legacy ID, booking number `1_000_000 + legacyAppointmentId`, the current main branch, archived service names ending ` — نظام قديم`, and no update operation for an existing target row. It fails before write on ambiguous matches, booking-number collision, missing relation, unexpected overlap, or unexpected count.

- [ ] **Step 4: Verify GREEN against fixtures and the restored production snapshot**

Run the unit test, then run the CLI dry-run introduced in Task 6 against PostgreSQL on the dynamically assigned local port. Expected target baseline is 25 clients, 31 employees, 12 services, and 40 bookings.

### Task 5: Apply additive rows with bounded transactions

**Files:**
- Create: `apps/backend/src/modules/ops/legacy-import/legacy-import.writer.ts`
- Create: `apps/backend/src/modules/ops/legacy-import/legacy-import.writer.spec.ts`

**Interfaces:**
- Produces: `applyLegacyImportPlan(prisma, plan, batch): Promise<ApplyReport>`.
- Consumes: `LegacyImportPlan` from Task 4 and `LegacyImportRecord` from Task 1.

- [ ] **Step 1: Write failing writer tests**

Tests run against an isolated PostgreSQL database and assert:

```ts
expect(after.Booking - before.Booking).toBe(5022);
expect(after.Invoice - before.Invoice).toBe(0);
expect(after.Payment - before.Payment).toBe(0);
expect(after.Notification - before.Notification).toBe(0);
expect(after.OutboxEvent - before.OutboxEvent).toBe(0);
expect(after.excludedFutureRowsInBooking).toBe(0);
expect(after.excludedFutureRowsInLegacyImportRecord).toBe(0);
```

A second apply must return `inserted = 0`, and a changed payload hash must fail without updating the target.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter=backend exec jest src/modules/ops/legacy-import/legacy-import.writer.spec.ts --runInBand`

- [ ] **Step 3: Implement additive-only writer**

Create the inactive category and 18 inactive archived services, 18 inactive non-public historical employees, missing clients, 5,022 bookings plus one status log each, the linked/archive dispositions, the inactive intake form/fields, and historical-only intake responses. Every source entity gets its idempotency record in the same transaction as its target row. The writer exposes no delete/update method; existing matched rows are referenced only.

- [ ] **Step 4: Verify GREEN and idempotency**

Run the writer test twice. Inspect generated SQL logs in tests to confirm there is no `DELETE`, `TRUNCATE`, or update of existing business rows.

### Task 6: Add the guarded one-shot CLI and non-PII reports

**Files:**
- Create: `apps/backend/src/modules/ops/legacy-import/legacy-import.report.ts`
- Create: `apps/backend/src/modules/ops/legacy-import/legacy-import.report.spec.ts`
- Create: `apps/backend/src/ops/legacy-import-cli.ts`
- Create: `apps/backend/src/ops/legacy-import-cli.spec.ts`
- Modify: `apps/backend/package.json`

**Interfaces:**
- Produces: development command `legacy:import` and compiled entry `dist/ops/legacy-import-cli.js`.
- Consumes: Tasks 1-5.

- [ ] **Step 1: Write failing guard and redaction tests**

Tests assert dry-run is the default, `--apply` requires exact target database name, remote apply requires `--environment production` plus an exact confirmation token, cutover mismatch fails, and serialized reports do not contain fixture phone/email/name/answer strings.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter=backend exec jest src/ops/legacy-import-cli.spec.ts src/modules/ops/legacy-import/legacy-import.report.spec.ts --runInBand`

- [ ] **Step 3: Implement CLI guards**

Required apply arguments are:

```text
--apply
--bundle <absolute-json-path>
--cutover-at 2026-08-11T20:54:55Z
--expected-database <database-from-DATABASE_URL>
--environment local|production
--confirmation LEGACY-BOOKNETIC-TENANT-6-20260811
```

The CLI refuses unknown flags, wrong source checksum, wrong target database, production without confirmation, any cutover other than the frozen value, and any plan count different from the expected literals. It connects directly through Prisma and never imports `AppModule`.

- [ ] **Step 4: Implement reports**

Write aggregate JSON with counts, IDs only for technical exceptions, source/bundle hashes, target fingerprint, and timestamps. Produce Excel for the 11 excluded appointments outside the target database. Apply mode writes no future appointment tracking row.

- [ ] **Step 5: Verify GREEN and production build inclusion**

Run:

```bash
pnpm --filter=backend exec jest src/ops/legacy-import-cli.spec.ts src/modules/ops/legacy-import/legacy-import.report.spec.ts --runInBand
pnpm --filter=backend build
test -f apps/backend/dist/ops/legacy-import-cli.js
```

### Task 7: Rehearse twice on the fresh production clone

**Files:**
- Create: `apps/backend/test/legacy-import.e2e-spec.ts`
- Create: `docs/operations/legacy-booknetic-import-runbook.md`

**Interfaces:**
- Produces: verified rehearsal report and executable production runbook.
- Consumes: all prior tasks and `/Users/tariq/Downloads/sawaa_pre_legacy_import_20260812T105914Z.dump`.

- [ ] **Step 1: Apply the new schema migration to the restored clone**

Set `DATABASE_URL` to the isolated `sawaa-migration-target` container and run `pnpm --filter=backend prisma:migrate:deploy`.

- [ ] **Step 2: Run dry-run and assert zero writes**

Capture counts before and after. Every target table count must be identical.

- [ ] **Step 3: Run apply and assert exact deltas**

Assert 5,022 new bookings, 18 historical services, 18 historical employees, one linked appointment record, one archived-only record, zero target rows for the 11 future IDs, 4,967 intake responses containing 23,734 answers, and four archived answers stored only in the restricted metadata for appointment `15747`.

- [ ] **Step 4: Run apply a second time**

Assert zero inserts and unchanged target table counts.

- [ ] **Step 5: Verify negative side effects**

Assert no increase in Invoice, Payment, Notification, OutboxEvent, SMS delivery, Zoom fields/jobs, EmployeeService, EmployeeBranch, EmployeeAvailability, or ServiceBookingConfig attributable to imported entities.

- [ ] **Step 6: Write the production runbook**

The runbook fixes the live service names discovered on `deqah`, requires a fresh `pg_dump` plus `pg_restore --list`, records baseline counts and image digest, scales the backend to zero, runs production dry-run in a one-shot container, compares the report hash to rehearsal, runs apply, reruns for idempotency, verifies health, and documents full pre-import restore as the rollback. It contains no selective delete rollback.

### Task 8: Final verification gate before any production write

**Files:**
- Verify all modified files.

**Interfaces:**
- Produces: a go/no-go evidence report.
- Consumes: all tasks.

- [ ] **Step 1: Run focused tests**

Run all `legacy-import*.spec.ts` files in-band.

- [ ] **Step 2: Run Prisma and TypeScript gates**

Run `prisma:validate`, backend `typecheck`, and backend build.

- [ ] **Step 3: Run backend regression tests with complete test environment variables**

Run the full backend Jest suite with valid local-only values for every required configuration key so `app.module.spec.ts` loads successfully.

- [ ] **Step 4: Inspect the final diff**

Run `git diff --check`, confirm the migration and importer contain no destructive statement, and confirm no bundle, dump, report with PII, or secret is tracked by Git.

- [ ] **Step 5: Stop before production apply if any gate differs**

Production remains untouched unless every expected count and checksum matches the rehearsed report and the fresh server backup has passed its restore-list check.
