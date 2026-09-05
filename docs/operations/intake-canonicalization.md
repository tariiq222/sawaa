# Intake response canonicalization runbook

This runbook is for the bounded, reviewed cleanup of duplicate current intake
responses. It is a local or protected staging operation. It must never be run
against customer data without a separately recorded owner approval for the
specific database, reviewed manifest, and batch.

The tool does not print or include raw answers in its output. A manifest carries
source IDs, answer hashes, identity fingerprints, and a candidate only when all
answers are identical. A differing group remains `requiresReview: true` and
has no automatic canonical choice. The candidate is only a review aid; it is
not an approval.

## Preconditions

1. Before apply, confirm that every old intake writer, worker, and importer is drained or
   disabled. Record the release, process list, and timestamp in the change
   record.
2. Use a protected database connection whose database name is explicitly
   confirmed. Set `DATABASE_URL` in the invoking shell; do not put credentials
   in a manifest, command transcript, or ticket.
3. Confirm that the additive intake history migration is applied and that the
   partial unique index migration is still pending. The reserved migration is
   `20260905000200_intake_current_unique`; do not create or apply it during
   canonicalization rehearsal.
4. Create a private output directory with access restricted to the operator.
   The CLI itself creates each output file with mode `0600`, refuses to
   overwrite an existing path, and disconnects after the operation.

## Dry run

The default mode is dry-run. An explicit mode is preferred in an operator
record:

```bash
source /private/path/intake.env
pnpm --filter=backend exec tsx scripts/data-integrity/intake-cli.ts \
  dry-run --output /private/path/intake-manifest-20260905.json --max-groups 100
```

The command runs one repeatable-read PostgreSQL transaction with
`SET TRANSACTION READ ONLY`. It examines at most 100 duplicate booking/form
groups. When `moreGroups` is true, review and apply the first batch, then
generate a new manifest for the next batch. Never edit a manifest to add
groups from another run.

Review the hashes and source metadata in the protected file. For every group,
record an explicit decision by setting `canonicalId` to one of its listed
source IDs and `reviewedBy` to the accountable reviewer. Keep unresolved groups
unresolved. Do not add answers, client names, or other clinical content to the
manifest or review notes.

## Apply a reviewed batch

Apply requires all four safeguards: a reviewed manifest, an exact database name
confirmation, the literal writer-drain attestation flag, and a new receipt
path. The database name in `--confirm-database` must equal both the reviewed
manifest and the connected database.

```bash
source /private/path/intake.env
pnpm --filter=backend exec tsx scripts/data-integrity/intake-cli.ts \
  apply \
  --manifest /private/path/intake-manifest-20260905.json \
  --receipt /private/path/intake-receipt-20260905.ndjson \
  --confirm-database DB \
  --old-writers-drained
```

Each group runs in its own transaction. The transaction takes the same
booking `FOR SHARE`, form `FOR SHARE`, and
`hashtextextended('intake:{bookingId}:{formId}', 0)` advisory lock order as the
ordinary submit writer. It rechecks the database identity, source fingerprints,
and current set. A changed source, new current row, unresolved group, or
unexpected database causes a `conflict` or refusal; there is no force option.

Apply only sets `supersededAt` and `supersededById` on the reviewed noncanonical
rows. It never deletes rows, rewrites answers, or creates a public endpoint.
The receipt is newline-delimited JSON: one object per committed group, with only
group IDs, canonical ID, reviewer, and status. The CLI creates this file before
the first write and flushes each line to disk after the group commits. If a
later group fails, complete earlier lines remain recoverable. Programmatic
callers can use the same behavior with the awaited `onReceipt` callback. A
retry with a new receipt path is safe and returns `alreadyApplied` when the
reviewed state is unchanged.

## Verification and rollback

After each batch, verify with a protected read-only query that every targeted
pair has one current row and that the total rows and answer hashes are unchanged.
Keep the receipt with the manifest and the operator record. Do not apply the
unique index migration until the full current-duplicate inventory is zero,
writer drain is independently evidenced, and an index-lock rehearsal has
passed on a comparable database.

The reserved migration proposes:

```sql
CREATE UNIQUE INDEX CONCURRENTLY "IntakeResponse_one_current_per_booking_form"
ON "IntakeResponse" ("bookingId", "formId")
WHERE "supersededAt" IS NULL;
```

Promotion remains pending until its release gate is approved. If index creation
fails or leaves an invalid index, stop and inspect that named index using a
schema-specific repair plan. Do not drop unrelated indexes or rerun a broad
destructive command. The compatible writer may continue with superseded rows
and the index in place. Reversing a canonical decision requires a new reviewed
manifest and evidence that no later answer depends on the decision; never clear
`supersededAt` in bulk.

## Real Postgres acceptance lane

Use only the dedicated disposable database configured in the private
`intake-tools.env` file supplied for this lane. Load it into the process
environment without copying its contents into logs, then run:

```bash
set -a
. /private/path/intake-tools.env
set +a
REAL_E2E_DATABASE_URL="$DATABASE_URL" \
  pnpm --filter=backend exec jest --config test/jest-e2e.json --runInBand \
  test/e2e/bookings/intake-integrity-tools.real-e2e-spec.ts
```

The real-DB helper rejects non-Postgres URLs and database names that are not
clearly test-only. The test uses synthetic UUID fixtures, checks read-only
manifest behavior, refusal gates, raw-answer preservation, idempotent retry,
fingerprint/current-row conflicts, and submit/apply lock ordering. A missing
`REAL_E2E_DATABASE_URL` in this explicit lane is an error, not a passing skip.
