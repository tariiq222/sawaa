import { PackagePurchaseStatus, Prisma, RefundStatus } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import {
  type CompletedRequestRow,
  type ExistingEventRow,
  type LockedPurchaseRow,
  planPurchase,
} from '../../finance/package-refund-reconciliation';

export interface RefundedPackagesReportParams {
  from: Date;
  to: Date;
}

export interface RefundedPackageItem {
  eventId: string;
  purchaseId: string;
  packageId: string | null;
  clientId: string | null;
  amountPaid: number | null;
  refundAmount: number;
  refundType: 'FULL' | 'PARTIAL' | 'UNKNOWN';
  source: 'LIVE' | 'LEGACY_REQUEST' | 'LEGACY_AGGREGATE';
  occurredAt: string | null;
  notes: string | null;
}

export interface HistoryReconciliation {
  complete: boolean;
  unresolvedPurchaseCount: number;
}

export interface RefundedPackagesEventsResult {
  historyMode: 'EVENTS';
  historyReconciliation: HistoryReconciliation;
  eventCount: number;
  purchaseCount: number;
  totalRefunded: number;
  items: RefundedPackageItem[];
  undatedHistorical: {
    recordCount: number;
    purchaseCount: number;
    totalRefunded: number;
    items: RefundedPackageItem[];
  };
}

export interface RefundedPackageItemLegacy {
  purchaseId: string;
  packageId: string;
  clientId: string;
  amountPaid: number;
  refundAmount: number;
  refundedAt: string | null;
  notes: string | null;
}

export interface RefundedPackagesLegacyResult {
  historyMode: 'LEGACY';
  historyReconciliation: HistoryReconciliation;
  refundedCount: number;
  totalRefunded: number;
  items: RefundedPackageItemLegacy[];
}

export type RefundedPackagesReportResult =
  | RefundedPackagesEventsResult
  | RefundedPackagesLegacyResult;

interface EventRow {
  id: string;
  purchaseId: string;
  amount: Prisma.Decimal;
  source: string;
  refundType: string;
  occurredAt: Date | null;
  notes: string | null;
}

interface PurchaseDisplayRow {
  id: string;
  packageId: string;
  clientId: string;
  amountPaid: Prisma.Decimal;
}

type ReportReadClient = Pick<
  Prisma.TransactionClient,
  'packagePurchase' | 'packageRefundEvent' | 'refundRequest'
>;

const toHalalas = (value: Prisma.Decimal): number => Math.round(Number(value.toString()));

const sumDecimals = (values: Prisma.Decimal[]): number =>
  values.reduce((sum, value) => sum.plus(value), new Prisma.Decimal(0)).toNumber();

function toEventItem(event: EventRow, purchasesById: Map<string, PurchaseDisplayRow>): RefundedPackageItem {
  const purchase = purchasesById.get(event.purchaseId);
  return {
    eventId: event.id,
    purchaseId: event.purchaseId,
    packageId: purchase?.packageId ?? null,
    clientId: purchase?.clientId ?? null,
    amountPaid: purchase ? toHalalas(purchase.amountPaid) : null,
    refundAmount: toHalalas(event.amount),
    refundType: event.refundType as RefundedPackageItem['refundType'],
    source: event.source as RefundedPackageItem['source'],
    occurredAt: event.occurredAt ? event.occurredAt.toISOString() : null,
    notes: event.notes ?? null,
  };
}

async function loadReconciliationInputs(client: ReportReadClient) {
  const candidates = (await client.packagePurchase.findMany({
    where: {
      OR: [{ refundAmount: { gt: 0 } }, { status: PackagePurchaseStatus.REFUNDED }],
    },
    select: { id: true, status: true, refundAmount: true, refundedAt: true },
  })) as LockedPurchaseRow[];

  if (candidates.length === 0) {
    return {
      candidates,
      existingByPurchase: new Map<string, ExistingEventRow[]>(),
      requestsByPurchase: new Map<string, CompletedRequestRow[]>(),
    };
  }

  const candidateIds = candidates.map((candidate) => candidate.id);
  const [events, requests] = await Promise.all([
    client.packageRefundEvent.findMany({
      where: { purchaseId: { in: candidateIds } },
      select: { id: true, purchaseId: true, source: true, amount: true, sourceRefundRequestId: true },
    }),
    client.refundRequest.findMany({
      where: {
        status: RefundStatus.COMPLETED,
        invoice: { packagePurchaseId: { in: candidateIds } },
      },
      select: { id: true, amount: true, processedAt: true, invoice: { select: { packagePurchaseId: true } } },
    }),
  ]);

  const existingByPurchase = new Map<string, ExistingEventRow[]>();
  for (const event of events as Array<ExistingEventRow & { purchaseId: string }>) {
    const rows = existingByPurchase.get(event.purchaseId) ?? [];
    rows.push(event);
    existingByPurchase.set(event.purchaseId, rows);
  }

  const requestsByPurchase = new Map<string, CompletedRequestRow[]>();
  for (const request of requests as Array<CompletedRequestRow & { invoice: { packagePurchaseId: string } }>) {
    const rows = requestsByPurchase.get(request.invoice.packagePurchaseId) ?? [];
    rows.push({ id: request.id, amount: request.amount, processedAt: request.processedAt });
    requestsByPurchase.set(request.invoice.packagePurchaseId, rows);
  }

  return { candidates, existingByPurchase, requestsByPurchase };
}

async function reconciliationGate(client: ReportReadClient): Promise<HistoryReconciliation> {
  const { candidates, existingByPurchase, requestsByPurchase } = await loadReconciliationInputs(client);
  let unresolvedPurchaseCount = 0;

  for (const candidate of candidates) {
    const plan = planPurchase(
      candidate,
      existingByPurchase.get(candidate.id) ?? [],
      requestsByPurchase.get(candidate.id) ?? [],
    );
    if (plan.kind === 'finding' || plan.exactRequests.length > 0 || plan.createAggregate) {
      unresolvedPurchaseCount += 1;
    }
  }

  return { complete: unresolvedPurchaseCount === 0, unresolvedPurchaseCount };
}

async function buildEventsReport(
  client: ReportReadClient,
  params: RefundedPackagesReportParams,
  historyReconciliation: HistoryReconciliation,
): Promise<RefundedPackagesEventsResult> {
  const eventRows = (await client.packageRefundEvent.findMany({
    where: {
      OR: [
        { occurredAt: { not: null, gte: params.from, lte: params.to } },
        { occurredAt: null },
      ],
    },
    orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    select: { id: true, purchaseId: true, amount: true, source: true, refundType: true, occurredAt: true, notes: true },
  })) as EventRow[];

  const purchaseIds = Array.from(new Set(eventRows.map((event) => event.purchaseId)));
  const purchases = purchaseIds.length
    ? ((await client.packagePurchase.findMany({
        where: { id: { in: purchaseIds } },
        select: { id: true, packageId: true, clientId: true, amountPaid: true },
      })) as PurchaseDisplayRow[])
    : [];
  const purchasesById = new Map(purchases.map((purchase) => [purchase.id, purchase]));
  const datedEvents = eventRows.filter((event) => event.occurredAt !== null);
  const undatedEvents = eventRows.filter((event) => event.occurredAt === null);
  const items = datedEvents.map((event) => toEventItem(event, purchasesById));
  const undatedItems = undatedEvents.map((event) => toEventItem(event, purchasesById));

  return {
    historyMode: 'EVENTS',
    historyReconciliation,
    eventCount: items.filter((item) => item.source !== 'LEGACY_AGGREGATE').length,
    purchaseCount: new Set(items.map((item) => item.purchaseId)).size,
    totalRefunded: sumDecimals(items.map((item) => new Prisma.Decimal(item.refundAmount))),
    items,
    undatedHistorical: {
      recordCount: undatedItems.length,
      purchaseCount: new Set(undatedItems.map((item) => item.purchaseId)).size,
      totalRefunded: sumDecimals(undatedItems.map((item) => new Prisma.Decimal(item.refundAmount))),
      items: undatedItems,
    },
  };
}

async function buildLegacyReport(
  client: ReportReadClient,
  params: RefundedPackagesReportParams,
  historyReconciliation: HistoryReconciliation,
): Promise<RefundedPackagesLegacyResult> {
  const purchases = (await client.packagePurchase.findMany({
    where: {
      status: PackagePurchaseStatus.REFUNDED,
      refundedAt: { gte: params.from, lte: params.to },
    },
    orderBy: { refundedAt: 'asc' },
    select: { id: true, packageId: true, clientId: true, amountPaid: true, refundAmount: true, refundedAt: true, notes: true },
  })) as Array<{
    id: string;
    packageId: string;
    clientId: string;
    amountPaid: Prisma.Decimal;
    refundAmount: Prisma.Decimal;
    refundedAt: Date | null;
    notes: string | null;
  }>;
  const items = purchases.map((purchase) => ({
    purchaseId: purchase.id,
    packageId: purchase.packageId,
    clientId: purchase.clientId,
    amountPaid: toHalalas(purchase.amountPaid),
    refundAmount: toHalalas(purchase.refundAmount),
    refundedAt: purchase.refundedAt?.toISOString() ?? null,
    notes: purchase.notes ?? null,
  }));
  return {
    historyMode: 'LEGACY',
    historyReconciliation,
    refundedCount: items.length,
    totalRefunded: sumDecimals(items.map((item) => new Prisma.Decimal(item.refundAmount))),
    items,
  };
}

async function buildFromSnapshot(
  client: ReportReadClient,
  params: RefundedPackagesReportParams,
): Promise<RefundedPackagesReportResult> {
  const historyReconciliation = await reconciliationGate(client);
  if (!historyReconciliation.complete) {
    return buildLegacyReport(client, params, historyReconciliation);
  }
  return buildEventsReport(client, params, historyReconciliation);
}

/** Build the gate and report from one repeatable-read snapshot. */
export async function buildRefundedPackagesReport(
  prisma: PrismaService,
  params: RefundedPackagesReportParams,
): Promise<RefundedPackagesReportResult> {
  const transaction = new RlsTransactionService(prisma);
  return transaction.withTransaction(
    (tx) => buildFromSnapshot(tx, params),
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
