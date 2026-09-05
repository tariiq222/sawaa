# Finance and booking data integrity inventory

The R1 inventory is a read-only evidence pass. It reports historical
differences for human review and does not select a canonical record, refund a
customer, recreate a person, change a booking state, publish an outbox event,
or call a provider. A finding is evidence of a data difference; it does not
prove customer impact.

The inventory covers these categories:

- invoice net settled amount above the historical invoice total;
- `Payment.refundedAmount` different from the sum of `RefundRequest` rows whose
  status is `COMPLETED`;
- an invoice in `PAID` paired with a booking in `DEPOSIT_PAID`;
- missing `Client` or `Employee` references on bookings and invoices;
- more than one current intake response for a booking/form pair;
- unpublished `PENDING` or `FAILED` outbox events older than the configured
  threshold.

All monetary output is integer halalas. Settled payment principal includes
`COMPLETED`, `PARTIALLY_REFUNDED`, and `REFUNDED` payments. Completed refunds
are subtracted once from that principal. Pending or failed payments and
non-completed refunds are not treated as settled money.

## Run a bounded page

Use a mode-0600 environment file held outside the repository. Do not put a
password, connection URL, answers, names, or provider identifier in shell
history, CI output, or a report. The CLI writes an exclusive mode-0600 JSON
file and refuses to overwrite an existing path.

```bash
set -a
source /path/to/protected/audit.env
set +a
pnpm --filter=backend exec tsx scripts/data-integrity/audit-finance-cli.ts \
  --output /path/to/protected/r1-audit-page.json \
  --batch-size 100 --stalled-hours 24
```

The command requires `DATABASE_URL`, validates that it is a PostgreSQL URL,
and supports dry-run inventory only. `--apply`, `apply`, and repair flags are
rejected. Use the returned `nextCursors` and
`nextCompletedCategories` when requesting the next page. Only
`completion: FULL_FRESH_PASS` with `complete: true` is a verified full pass;
caller-provided cursors or completed categories never establish that claim.
Each page is a repeatable-read snapshot; pages started later can observe
concurrent data changes and must not be described as one global snapshot.

The output includes a SHA-256 checksum over the page findings, per-category
finding counts, per-category scanned counts, and protected internal evidence
IDs. It never includes intake answers, person names, or provider credentials.
Every finding has `REVIEW_REQUIRED` severity. `completion: FULL_FRESH_PASS` and
`complete: true` are emitted only when a fresh invocation itself exhausts every
source family. A bounded first page is `PAGE_ONLY`; any invocation supplied
with cursors or completed categories is `RESUMED_UNVERIFIED`, even when its
caller-supplied sequence appears exhausted. Keep unresolved findings visible
until a separately approved repair design supplies a reviewed manifest and a
compare-and-set proof.

## Verification boundary

The real database test must receive a separately validated
`REAL_E2E_DATABASE_URL` whose database name identifies a disposable test
database. It creates and removes only IDs with the test fixture prefix. The
test proves all six categories, pagination beyond 100 source rows, stable
checksums, no duplicate evidence IDs across resumed pages, and no
`INSERT`/`UPDATE`/`DELETE` issued by the audit transaction. It does not prove
production cleanliness, customer impact, provider state, or authorization to
repair any finding.
