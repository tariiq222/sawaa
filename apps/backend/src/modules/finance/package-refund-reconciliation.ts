import { PackagePurchaseStatus, PackageRefundEventSource, Prisma } from '@prisma/client';

/** A candidate purchase re-read inside the report/backfill snapshot. */
export interface LockedPurchaseRow {
  id: string;
  status: PackagePurchaseStatus;
  refundAmount: Prisma.Decimal;
  refundedAt: Date | null;
}

export interface ExistingEventRow {
  id: string;
  source: PackageRefundEventSource;
  amount: Prisma.Decimal;
  sourceRefundRequestId: string | null;
}

export interface CompletedRequestRow {
  id: string;
  amount: Prisma.Decimal;
  processedAt: Date | null;
}

export type PurchasePlan =
  | {
      kind: 'finding';
      purchaseId: string;
      reason: 'over-cumulative' | 'aggregate-mismatch' | 'request-mismatch';
    }
  | {
      kind: 'ready';
      purchaseId: string;
      /** Completed requests with a provable date, not already represented by an event. */
      exactRequests: CompletedRequestRow[];
      /** Cumulative refund amount left unexplained after existing + exact events. */
      residual: Prisma.Decimal;
      /** Whether a new `LEGACY_AGGREGATE` row must be inserted. */
      createAggregate: boolean;
      aggregateOccurredAt: Date | null;
      aggregateNotes: string;
    };

export interface BackfillFinding {
  purchaseId: string;
  reason: 'over-cumulative' | 'aggregate-mismatch' | 'request-mismatch';
}

const AGGREGATE_RESIDUAL_NOTES =
  'Historical aggregate — legacy refunded value with no reconstructable per-event date.';
const AGGREGATE_TERMINAL_DATED_NOTES =
  "Historical aggregate — zero-money terminal cancellation; date reflects the purchase's terminal refundedAt as cancellation evidence only, no individual refund amount is known.";
const AGGREGATE_TERMINAL_UNDATED_NOTES =
  'Historical aggregate — zero-money terminal cancellation; no date is known.';

const sumAmounts = (rows: Array<{ amount: Prisma.Decimal }>): Prisma.Decimal =>
  rows.reduce((sum, row) => sum.plus(row.amount), new Prisma.Decimal(0));

/**
 * Decide the immutable historical representation for one purchase. This is
 * deliberately pure so the backfill and the report cutover gate cannot drift.
 */
export function planPurchase(
  purchase: LockedPurchaseRow,
  existing: ExistingEventRow[],
  completedRequests: CompletedRequestRow[],
): PurchasePlan {
  const representedRequestIds = new Set(
    existing
      .map((event) => event.sourceRefundRequestId)
      .filter((id): id is string => Boolean(id)),
  );
  const exactRequests = completedRequests.filter(
    (request) => request.processedAt && !representedRequestIds.has(request.id),
  );

  // A linked source request is traceability evidence. If both rows are
  // present, their amounts must agree; missing/deleted source requests remain
  // valid orphan history and are intentionally not rejected.
  const completedRequestsById = new Map(completedRequests.map((request) => [request.id, request]));
  for (const event of existing) {
    if (!event.sourceRefundRequestId) continue;
    const request = completedRequestsById.get(event.sourceRefundRequestId);
    if (request && !event.amount.eq(request.amount)) {
      return { kind: 'finding', purchaseId: purchase.id, reason: 'request-mismatch' };
    }
  }

  const aggregateCount = existing.filter(
    (event) => event.source === PackageRefundEventSource.LEGACY_AGGREGATE,
  ).length;
  if (aggregateCount > 1) {
    return { kind: 'finding', purchaseId: purchase.id, reason: 'aggregate-mismatch' };
  }

  const representedAmount = sumAmounts(
    existing.filter((event) => event.source !== PackageRefundEventSource.LEGACY_AGGREGATE),
  ).plus(sumAmounts(exactRequests));

  if (representedAmount.gt(purchase.refundAmount)) {
    return { kind: 'finding', purchaseId: purchase.id, reason: 'over-cumulative' };
  }

  const residual = purchase.refundAmount.minus(representedAmount);
  const aggregate = existing.find(
    (event) => event.source === PackageRefundEventSource.LEGACY_AGGREGATE,
  );
  if (aggregate && !aggregate.amount.eq(residual)) {
    return { kind: 'finding', purchaseId: purchase.id, reason: 'aggregate-mismatch' };
  }

  const terminalZeroNotRepresented =
    purchase.status === PackagePurchaseStatus.REFUNDED &&
    purchase.refundAmount.eq(0) &&
    existing.length === 0 &&
    exactRequests.length === 0;

  const createAggregate = !aggregate && (residual.gt(0) || terminalZeroNotRepresented);

  let aggregateOccurredAt: Date | null = null;
  let aggregateNotes = AGGREGATE_RESIDUAL_NOTES;
  if (createAggregate && residual.eq(0) && terminalZeroNotRepresented) {
    aggregateOccurredAt = purchase.refundedAt;
    aggregateNotes = purchase.refundedAt
      ? AGGREGATE_TERMINAL_DATED_NOTES
      : AGGREGATE_TERMINAL_UNDATED_NOTES;
  }

  return {
    kind: 'ready',
    purchaseId: purchase.id,
    exactRequests,
    residual,
    createAggregate,
    aggregateOccurredAt,
    aggregateNotes,
  };
}
