# Packages Phase 2 — Refund Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every manual session-package refund visible as durable history, including partial refunds, without changing refund authority, money movement, or package-credit capacity rules.

**Architecture:** Add an append-only `PackageRefundEvent` ledger beside the existing cumulative `PackagePurchase.refundAmount` fields. The refund handler writes one event in the same transaction as its current purchase and financial updates; the report reads event rows once and never sums `RefundRequest` a second time. A controlled historical transition imports only reconstructable legacy request dates and preserves all other legacy refunded value as explicitly undated aggregate history.

**Tech Stack:** NestJS 11, Prisma 7 split schemas, Postgres, Jest, Next.js 15 dashboard, TanStack Query, RTL translations.

**Spec:** `docs/superpowers/specs/2026-09-05-safe-improvement-design.md` and the approved phase-2 refund-visibility brief.

## Global Constraints

- Scope is refund history and the refunded-packages report only. Practitioner earnings, commission, expiry windows, refund fees, permission changes, and proportional capacity reduction are excluded.
- Manual refund authority stays unrestricted, with no fee. Keep the existing non-negative amount validation, outstanding-balance clamp, purchase row lock, full/partial classification, provider behavior, and zero-amount cancellation behavior unchanged.
- A partial refund preserves the locked purchase status (`ACTIVE` or `COMPLETED`) and leaves all credit quantities unchanged. A full refund keeps the current `REFUNDED` transition and credit voiding behavior.
- Money remains integer halalas in the touched paths. Use existing `decimalToHalalas`/`Prisma.Decimal` conventions; do not introduce floating-point arithmetic.
- `RefundRequest` remains the existing financial record. The new report counts `PackageRefundEvent.amount` once and never joins or sums `RefundRequest` as an additional amount.
- Migrations are additive. Do not edit or squash existing migrations. Any endpoint/DTO contract change requires `pnpm openapi:sync` and the committed snapshot.
- Preserve Arabic/English translation keys through `apps/dashboard/lib/translations/ar.misc.ts` and `en.misc.ts`.
- Read-only historical inspection happens before any backfill write. No live counts, dates, or “phase 1 merged” claims belong in this plan. Follow [`docs/operations/deployment-policy.md`](/Users/tariq/code/sawaa/docs/operations/deployment-policy.md); this plan authorizes no commit, publication, or deployment.

## Agreed contracts and historical rules

The current handler locks `PackagePurchase`, computes `outstanding = amountPaid - refundAmount`, clamps the requested amount, updates the cumulative purchase fields, voids credits only for a full refund, and creates a completed `RefundRequest` only when a linked invoice and payment exist. A manual refund can therefore have no `RefundRequest` (zero amount, missing invoice, or missing payment) while still being a real package-refund action. The current report filters only `PackagePurchase.status = REFUNDED` and `refundedAt`, so partial refunds and repeated refund actions are absent.

Add this event shape in the finance schema without a Prisma relation to `PackagePurchase` (the purchase model is owned by the bookings schema):

```prisma
enum PackageRefundEventSource {
  LIVE
  LEGACY_REQUEST
  LEGACY_AGGREGATE
}

enum PackageRefundType {
  FULL
  PARTIAL
  UNKNOWN
}

model PackageRefundEvent {
  id                       String                   @id @default(uuid()) @db.Uuid
  purchaseId               String
  amount                   Decimal                  @db.Decimal(12, 2)
  cumulativeRefundAmount  Decimal?                 @db.Decimal(12, 2)
  source                   PackageRefundEventSource
  refundType               PackageRefundType
  occurredAt               DateTime?                @db.Timestamptz(3)
  notes                    String?
  processedBy              String?
  sourceRefundRequestId    String?                  @unique
  legacyAggregateKey       String?                  @unique
  createdAt                DateTime                 @default(now())

  @@index([purchaseId, occurredAt])
  @@index([occurredAt])
}
```

`id` is the stable event ID returned to consumers. A live event is inserted once inside the refund transaction. A historical request event is keyed by `sourceRefundRequestId`; a residual aggregate is keyed by `legacyAggregateKey = "purchase:<purchaseId>:legacy-residual"`. Legacy `cumulativeRefundAmount` stays nullable because historical rows generally cannot reconstruct the cumulative balance at that event; fill it only when the source proves that value. Existing event rows are immutable, so rerunning the transition cannot duplicate, overwrite, or relabel a live row.

Historical transition rules are deliberately conservative:

1. Lock each candidate purchase row `FOR UPDATE` before reading its cumulative refund and existing event rows. Candidates include purchases with positive cumulative `PackagePurchase.refundAmount` and every previously visible terminal zero-money purchase (`status = REFUNDED`, whether `refundedAt` is known or null). Inspect only completed `RefundRequest` rows whose invoice has `packagePurchaseId` equal to that purchase. A request with non-null `processedAt` becomes one `LEGACY_REQUEST` event with that exact amount and `occurredAt = processedAt`; its `refundType` is `UNKNOWN` unless the source data proves a type.
2. Preserve every existing event row as immutable. Exclude requests already represented by `sourceRefundRequestId`, and subtract all represented non-aggregate event amounts from the cumulative balance, including `LIVE` events that have no linked request ID. Do not overwrite a live source with a `sourceRefundRequestId` upsert. Do not use `PackagePurchase.updatedAt`, a partial purchase’s null `refundedAt`, or a cumulative amount to invent an individual event date.
3. Validate before any write for that purchase: if represented non-aggregate amounts exceed `purchase.refundAmount`, skip the whole purchase and emit a reconciliation finding. Otherwise compute `residual = purchase.refundAmount - representedAmount`. Completed requests with no `processedAt`, requests not linked to a package invoice, and positive residual cumulative value are represented by one `LEGACY_AGGREGATE` event with `occurredAt = null`, `refundType = UNKNOWN`, and a visible “historical aggregate / date unknown” marker. If an existing aggregate is present, its amount must exactly equal the computed residual; mismatch is a finding and must not silently mutate the aggregate.
4. Preserve previously visible zero-money `REFUNDED` history. Create a zero-amount historical aggregate only when neither an existing event nor a newly reconstructed request already represents that terminal action. When the terminal `refundedAt` is known, that aggregate may use that date as terminal cancellation evidence, with notes that no individual monetary history is known; this does not invent an individual refund operation. If no terminal date is known, retain it as an undated amount-zero historical record. A zero-money full refund performed after this feature ships is still a `LIVE` event with amount `0`.
5. The report includes dated event rows in the requested range and returns every undated historical record with item details separately. Historical record/aggregate counts describe retained evidence rows, not necessarily genuine refund operations. It never silently assigns an undated aggregate to the range and never counts a linked `RefundRequest` again.

## File map

| Area | Files | Responsibility |
|---|---|---|
| Schema/history | `apps/backend/prisma/schema/finance.prisma`, new additive migration, `apps/backend/scripts/backfill-package-refund-events.ts` | Event model, idempotent historical transition, dry-run/reconciliation output |
| Refund write | `apps/backend/src/modules/finance/package-purchases/refund-package-purchase/refund-package-purchase.handler.ts` and its spec | One live event per successful manual refund, rollback and linkage coverage |
| Report contract | `apps/backend/src/modules/ops/generate-report/refunded-packages-report.builder.ts`, spec, `apps/backend/src/modules/ops/generate-report/package-reports.handler.ts` if response typing changes | Event-only query, distinct counts, undated aggregate visibility |
| Dashboard | `apps/dashboard/lib/types/package-report.ts`, `lib/api/package-reports.ts` only if needed, `components/features/reports/pages/packages-report-bodies.tsx`, `lib/translations/ar.misc.ts`, `en.misc.ts`, relevant unit/e2e specs | Render event rows, separate event/purchase counts, show unknown historical detail |

### Task 1: Add the event ledger and idempotent historical transition

**Files:**

- Create: additive Prisma migration under `apps/backend/prisma/migrations/`
- Modify: `apps/backend/prisma/schema/finance.prisma`
- Create: `apps/backend/scripts/backfill-package-refund-events.ts`
- Create or modify: focused schema/backfill tests under `apps/backend/scripts/` or the finance package-purchase test area

**Interfaces:**

- Produces `PackageRefundEvent` with `id`, `purchaseId`, `amount`, nullable `cumulativeRefundAmount`, `source`, `refundType`, nullable `occurredAt`, optional actor/note, and idempotency keys as defined above.
- Produces a dry-run summary with imported request count, aggregate count, residual halalas, undated purchase count, and reconciliation findings. The write mode accepts an explicitly named protected database environment and refuses a shared/production database unless the owner’s deployment procedure separately authorizes it.

- [ ] Add the two enums and model exactly once in `finance.prisma`; keep `purchaseId` and `sourceRefundRequestId` as plain strings because the source models belong to separate schema domains.
- [ ] Create the additive migration and verify its unique constraints cover `sourceRefundRequestId` and `legacyAggregateKey` while allowing both to be null for live events without a linked financial row.
- [ ] Implement a read-only inventory query joining `RefundRequest` to `Invoice.packagePurchaseId`, grouping completed rows by purchase, and comparing exact dated amounts with `PackagePurchase.refundAmount`.
- [ ] Implement the locked, immutable backfill and residual rules. For each purchase, lock the row `FOR UPDATE`, load existing events, exclude requests already represented by `sourceRefundRequestId`, and subtract every represented non-aggregate amount, including `LIVE` events without a request link. Validate over-cumulative data before any write; skip the whole purchase with a finding on mismatch. Preserve existing aggregate rows and flag an amount mismatch instead of mutating them.
- [ ] Keep legacy `cumulativeRefundAmount` nullable and populate it only when source data proves the value. Use the source request ID or aggregate key only for idempotency; never use `updatedAt` as an event date or upsert over an existing live event.
- [ ] Cover the residual/idempotency core with a small implementation/test shape:

  ```ts
  // Inside the per-purchase transaction, after SELECT ... FOR UPDATE.
  // existing and completedRequests are read after acquiring that same lock.
  const representedRequests = new Set(
    existing.map((event) => event.sourceRefundRequestId).filter(Boolean),
  )
  const exactRequests = completedRequests.filter(
    (request) => request.processedAt && !representedRequests.has(request.id),
  )
  const sumAmounts = (rows: Array<{ amount: Prisma.Decimal }>) =>
    rows.reduce((sum, row) => sum.plus(row.amount), new Prisma.Decimal(0))
  const representedAmount = sumAmounts(
    existing.filter((event) => event.source !== 'LEGACY_AGGREGATE'),
  ).plus(sumAmounts(exactRequests))
  if (representedAmount.gt(purchase.refundAmount)) {
    return { kind: 'finding', purchaseId: purchase.id, reason: 'over-cumulative' }
  }
  const residual = purchase.refundAmount.minus(representedAmount)
  const aggregate = existing.find((event) => event.source === 'LEGACY_AGGREGATE')
  if (aggregate && !aggregate.amount.eq(residual)) {
    return { kind: 'finding', purchaseId: purchase.id, reason: 'aggregate-mismatch' }
  }
  const terminalZeroNotRepresented = purchase.status === 'REFUNDED'
    && purchase.refundAmount.eq(0) && existing.length === 0 && exactRequests.length === 0
  const createAggregate = !aggregate && (residual.gt(0) || terminalZeroNotRepresented)
  // This validated decision is computed before inserting exactRequests or an aggregate.
  return { kind: 'ready', purchaseId: purchase.id, exactRequests, residual, createAggregate }
  ```

  The focused test fixture must include a live event without a request ID, an already represented zero-money terminal cancellation, and a rerun with an already represented request, asserting no duplicate and no source overwrite; it must also assert over-cumulative and aggregate-mismatch cases perform no writes.
- [ ] Add a dry-run fixture covering: one exact dated request, two requests for one purchase, an undated request, a payment-less cumulative refund, a zero-refund purchase, and a request-total-over-cumulative mismatch. Assert no writes in dry-run and explicit findings for unknown dates/mismatches.
- [ ] Keep the old report source available until historical reconstruction has completed and been reconciled. Switch the report to events only after every candidate purchase is represented and there are zero unresolved reconciliation findings. A flagged purchase is a blocked cutover, not permission to hide its old record.
- [ ] Verify the implemented transition with exact commands: `pnpm --filter=backend test -- scripts/backfill-package-refund-events.spec.ts`, `pnpm --filter=backend exec tsx scripts/backfill-package-refund-events.ts --dry-run --database-url-env=HISTORICAL_AUDIT_DATABASE_URL`, and the coordinator’s protected dry-run/reconciliation workflow before any write mode.
- [ ] Run the migration/backfill only through the coordinator’s protected validation workflow after the plan is implemented; this task does not claim historical data has been migrated.

### Task 2: Record one live event inside the existing refund transaction

**Files:**

- Modify: `apps/backend/src/modules/finance/package-purchases/refund-package-purchase/refund-package-purchase.handler.ts`
- Modify: `apps/backend/src/modules/finance/package-purchases/refund-package-purchase/refund-package-purchase.handler.spec.ts`

**Interfaces:**

- Consumes the handler’s existing `refundedAt`, `refundAmount`, `newCumulativeRefund`, `isFullRefund`, `cmd.notes`, and `cmd.userId` values.
- Produces one `PackageRefundEvent` row per committed manual refund, with `source = LIVE`, `refundType = FULL|PARTIAL`, `occurredAt = refundedAt`, and `sourceRefundRequestId` set only when this transaction creates a `RefundRequest`.

- [ ] Capture the generated `RefundRequest` ID in the existing `refundRequest.create` branch; do not create a second financial request or change provider behavior.
- [ ] Insert `packageRefundEvent.create` as the final mutation inside the existing transaction. Use `amount = refundAmount`, `cumulativeRefundAmount = newCumulativeRefund`, the current notes/actor, and the computed full/partial type. Insert amount `0` events for zero-money full refunds.
- [ ] Leave purchase locking, clamp, full/partial classification, credit voiding, payment/invoice updates, and post-commit `RefundCompletedEvent` publication unchanged. A partial refund preserves the locked purchase status (`ACTIVE` or `COMPLETED`) rather than forcing a status transition.
- [ ] Add tests for a partial refund, a second partial followed by full refund, a zero-money full refund without an invoice/payment, and a linked payment where the event stores the created `RefundRequest` ID.
- [ ] Add a transaction-failure test that makes event insertion or a later existing mutation fail and asserts the purchase, financial records, and event are all rolled back. Add a retry/concurrency assertion that a rejected second refund creates no second event.

### Task 3: Build the refunded-packages report from events without double counting

**Files:**

- Modify: `apps/backend/src/modules/ops/generate-report/refunded-packages-report.builder.ts`
- Modify: `apps/backend/src/modules/ops/generate-report/refunded-packages-report.builder.spec.ts`
- Modify: `apps/backend/src/modules/ops/generate-report/package-reports.handler.ts` only if the response contract needs explicit typing
- Modify: endpoint/OpenAPI files only if the existing response decorator/snapshot requires regeneration

**Interfaces:**

```ts
interface RefundedPackageItem {
  eventId: string
  purchaseId: string
  packageId: string | null
  clientId: string | null
  amountPaid: number | null
  refundAmount: number
  refundType: 'FULL' | 'PARTIAL' | 'UNKNOWN'
  source: 'LIVE' | 'LEGACY_REQUEST' | 'LEGACY_AGGREGATE'
  occurredAt: string | null
  notes: string | null
}

interface RefundedPackagesReportResult {
  eventCount: number
  purchaseCount: number
  totalRefunded: number
  items: RefundedPackageItem[]
  undatedHistorical: {
    recordCount: number
    purchaseCount: number
    totalRefunded: number
    items: RefundedPackageItem[]
  }
}
```

- [ ] Query `packageRefundEvent` as the only monetary source for this report. Filter dated rows using the endpoint’s existing normalized range; keep `occurredAt = null` rows in `undatedHistorical` instead of dropping or date-fabricating them.
- [ ] Load purchase display fields by the event `purchaseId` in a separate bounded query, preserving an event row with null display fields if its historical purchase is missing. Never join/sum `RefundRequest` in the report path.
- [ ] Set `eventCount = items.filter(item => item.source !== "LEGACY_AGGREGATE").length`, `purchaseCount = new Set(items.map(item => item.purchaseId)).size`, and total as the Decimal sum of event amounts. The undated block returns every undated item, uses `recordCount` for retained historical records/aggregates, and keeps a distinct purchase count; do not describe all historical rows as genuine refund operations.
- [ ] Keep event rows separate when one purchase has two partial refunds; do not collapse them into one purchase row. Sort dated events by `occurredAt`, then stable `eventId`.
- [ ] Replace the current `status = REFUNDED`/`refundedAt` query and update unit fixtures for: partial visibility, two events for one purchase, linked `RefundRequest` no-double-counting, full-after-partial, undated aggregate preservation, missing purchase display data, and empty results.
- [ ] Keep the existing report source as a fallback until Task 1 reconciliation is complete. Verify the event-only builder with `pnpm --filter=backend test -- src/modules/ops/generate-report/refunded-packages-report.builder.spec.ts` and its undated-item fixtures before removing the fallback.

### Task 4: Render refund history and complete focused acceptance

**Files:**

- Modify: `apps/dashboard/lib/types/package-report.ts`
- Modify: `apps/dashboard/components/features/reports/pages/packages-report-bodies.tsx`
- Modify: `apps/dashboard/lib/translations/ar.misc.ts`, `apps/dashboard/lib/translations/en.misc.ts`
- Modify: relevant dashboard unit/e2e specs for package reports
- Verify: `apps/dashboard/lib/api/package-reports.ts` and `apps/dashboard/hooks/use-package-reports.ts` remain compatible, or update only if the response contract requires it

**Interfaces:**

- Consumes the Task 3 discriminated `REFUNDED` payload without changing the report URL or query discriminator.
- Displays event count, distinct purchase count, total dated refunds, and every explicitly labeled undated historical record when present. The table row key is `eventId`, never `purchaseId`.

- [ ] Update the dashboard type union to carry `eventId`, nullable `occurredAt`, `refundType`, `source`, and the separate count fields.
- [ ] Add Arabic/English labels for “refund events,” “distinct purchases,” “historical records,” “historical aggregate,” and “date unknown”; keep existing package report navigation and date controls.
- [ ] Render every event row, including repeated rows for one purchase, and render every `undatedHistorical.items` row outside the dated table with its own amount/counts. An amount-zero terminal row remains visible as historical cancellation evidence.
- [ ] Update dashboard fixtures to prove a two-refund same-purchase response renders two rows and that an undated aggregate is visible without pretending it belongs to the selected date range.
- [ ] Verify the final contract with `pnpm --filter=dashboard test -- test/unit/lib/package-reports-api.spec.ts`, `pnpm --filter=dashboard test -- test/unit/hooks/use-package-reports.spec.tsx`, and `pnpm openapi:sync` when the endpoint contract changes; add and run a focused `packages-report-bodies` spec if the rendered event table needs direct coverage, then complete the required local dashboard browser exercise.
- [ ] After implementation, run the focused backend/report/dashboard checks, `pnpm openapi:sync` if the endpoint contract changes, and the required local dashboard browser exercise. Exercise this sequence: partial refund on an active purchase, second partial, full refund, a zero-money full refund, a failed transaction, and a linked `RefundRequest`; verify credit capacity remains unchanged after partials and that each committed event appears once.
- [ ] Record implementation and validation evidence separately from this plan. Do not claim historical backfill, staging, production, commit, or publication until those actions have their own authorization and evidence.

## Final acceptance checklist

- [ ] Exactly one live event is committed for every successful manual refund call, including zero-money full refunds.
- [ ] Partial refunds preserve the locked purchase status (`ACTIVE` or `COMPLETED`), do not alter credit quantities, and appear as event rows.
- [ ] Full-after-partial sequences preserve each event while retaining current full-refund voiding behavior.
- [ ] Reports distinguish event count from distinct purchase count and sum event amounts once.
- [ ] Linked `RefundRequest` rows are linked for traceability but never double counted.
- [ ] Historical rows with exact `processedAt` retain that date; unreconstructable history remains explicitly undated aggregate value with reconciliation findings where source totals disagree.
- [ ] Existing live and historical event rows remain immutable; over-cumulative purchases and aggregate mismatches are skipped as findings before any write, and previously visible zero-money `REFUNDED` history remains represented.
- [ ] Historical reconstruction is completed and reconciled before switching the live report away from its old source; undated output includes item detail and calls counts historical records/aggregates.
- [ ] Transaction rollback removes the event and all related refund mutations together.
- [ ] Dashboard Arabic/English presentation, repeated-event keys, and undated-history labeling are covered.
