import { Prisma } from '@prisma/client';
import {
  buildRefundedPackagesReport,
  type RefundedPackagesEventsResult,
  type RefundedPackagesReportResult,
} from './refunded-packages-report.builder';

function assertEvents(result: RefundedPackagesReportResult): asserts result is RefundedPackagesEventsResult {
  expect(result.historyMode).toBe('EVENTS');
  if (result.historyMode !== 'EVENTS') throw new Error('expected EVENTS report');
}

function event(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'evt-1',
    purchaseId: 'p1',
    amount: new Prisma.Decimal(10_000),
    cumulativeRefundAmount: new Prisma.Decimal(10_000),
    source: 'LIVE',
    refundType: 'PARTIAL',
    occurredAt: new Date('2026-01-10T00:00:00.000Z'),
    notes: null,
    ...overrides,
  };
}

function purchase(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'p1',
    packageId: 'pkg1',
    clientId: 'c1',
    amountPaid: new Prisma.Decimal(50_000),
    ...overrides,
  };
}

function candidate(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'p1',
    refundAmount: new Prisma.Decimal(0),
    ...overrides,
  };
}

/**
 * Test double that routes each call to the right fixture instead of one
 * static return value, because the builder now issues several distinctly-
 * shaped queries against the same two models:
 *  - packageRefundEvent.findMany: dated events (`where.occurredAt` is a
 *    range object), undated events (`where.occurredAt === null`), and the
 *    representedness scan (`where.purchaseId` present, no `occurredAt` key).
 *  - packagePurchase.findMany: the display-fields lookup (`where.id`) and
 *    the independent-of-range candidate scan (`where.OR`).
 */
function makePrisma(fixtures: {
  dated?: any[];
  undated?: any[];
  represented?: any[];
  requests?: any[];
  display?: any[];
  candidates?: any[];
} = {}) {
  const {
    dated = [],
    undated = [],
    represented = [],
    requests = [],
    display = [],
    candidates = [],
  } = fixtures;

  const client: any = {
    packageRefundEvent: {
        findMany: jest.fn().mockImplementation(({ where }: any) => {
          if (where?.purchaseId) return Promise.resolve(represented);
          if (where?.occurredAt === null) return Promise.resolve(undated);
          if (where?.OR) return Promise.resolve([...dated, ...undated]);
          return Promise.resolve(dated);
        }),
      },
    refundRequest: {
      findMany: jest.fn().mockResolvedValue(requests),
    },
    packagePurchase: {
      findMany: jest.fn().mockImplementation(({ where }: any) => {
        if (where?.OR) return Promise.resolve(candidates);
        return Promise.resolve(display);
      }),
    },
  };
  client.$transaction = jest.fn(async (callback: (tx: any) => Promise<unknown>) => callback(client));
  return client;
}

describe('buildRefundedPackagesReport', () => {
  it('returns a zero state when nothing was refunded in the range', async () => {
    const prisma = makePrisma();
    const result = await buildRefundedPackagesReport(prisma, {
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
    });
    assertEvents(result);
    expect(result.eventCount).toBe(0);
    expect(result.purchaseCount).toBe(0);
    expect(result.totalRefunded).toBe(0);
    expect(result.items).toEqual([]);
    expect(result.undatedHistorical).toEqual({
      recordCount: 0,
      purchaseCount: 0,
      totalRefunded: 0,
      items: [],
    });
    expect(result.historyMode).toBe('EVENTS');
    expect(result.historyReconciliation).toEqual({
      unresolvedPurchaseCount: 0,
      complete: true,
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'RepeatableRead' },
    );
  });

  it('makes a partial refund visible — it could not appear under the old status/refundedAt filter', async () => {
    const prisma = makePrisma({
      dated: [event({ id: 'evt-1', purchaseId: 'p1', amount: new Prisma.Decimal(10_000), refundType: 'PARTIAL' })],
      display: [purchase()],
    });

    const result = await buildRefundedPackagesReport(prisma, {
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
    });
    assertEvents(result);

    expect(result.eventCount).toBe(1);
    expect(result.purchaseCount).toBe(1);
    expect(result.totalRefunded).toBe(10_000);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual({
      eventId: 'evt-1',
      purchaseId: 'p1',
      packageId: 'pkg1',
      clientId: 'c1',
      amountPaid: 50_000,
      refundAmount: 10_000,
      refundType: 'PARTIAL',
      source: 'LIVE',
      occurredAt: new Date('2026-01-10T00:00:00.000Z').toISOString(),
      notes: null,
    });
  });

  it('shows two partial refunds on the same purchase as two distinct event rows, not one collapsed purchase row', async () => {
    const prisma = makePrisma({
      dated: [
        event({
          id: 'evt-1',
          purchaseId: 'p1',
          amount: new Prisma.Decimal(10_000),
          occurredAt: new Date('2026-01-05T00:00:00.000Z'),
        }),
        event({
          id: 'evt-2',
          purchaseId: 'p1',
          amount: new Prisma.Decimal(5_000),
          occurredAt: new Date('2026-01-20T00:00:00.000Z'),
        }),
      ],
      display: [purchase()],
    });

    const result = await buildRefundedPackagesReport(prisma, {
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
    });
    assertEvents(result);

    expect(result.eventCount).toBe(2);
    expect(result.purchaseCount).toBe(1);
    expect(result.totalRefunded).toBe(15_000);
    expect(result.items.map((i) => i.eventId)).toEqual(['evt-1', 'evt-2']);
  });

  it('counts a full refund once from its single LIVE event, never adding a linked RefundRequest amount on top', async () => {
    const prisma = makePrisma({
      dated: [
        event({
          id: 'evt-1',
          purchaseId: 'p1',
          amount: new Prisma.Decimal(50_000),
          refundType: 'FULL',
          // A live event may be linked to a RefundRequest for traceability;
          // the report must never re-query/sum RefundRequest on top of this.
          sourceRefundRequestId: 'rr-1',
        }),
      ],
      display: [purchase({ amountPaid: new Prisma.Decimal(50_000) })],
    });

    const result = await buildRefundedPackagesReport(prisma, {
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
    });
    assertEvents(result);

    expect(result.eventCount).toBe(1);
    expect(result.totalRefunded).toBe(50_000);
    // A linked RefundRequest is intentionally absent from the report source;
    // only the event amount contributes to the total.
  });

  it('never double counts a purchase with a full refund following an earlier partial', async () => {
    const prisma = makePrisma({
      dated: [
        event({
          id: 'evt-1',
          purchaseId: 'p1',
          amount: new Prisma.Decimal(10_000),
          refundType: 'PARTIAL',
          occurredAt: new Date('2026-01-05T00:00:00.000Z'),
        }),
        event({
          id: 'evt-2',
          purchaseId: 'p1',
          amount: new Prisma.Decimal(40_000),
          refundType: 'FULL',
          occurredAt: new Date('2026-01-20T00:00:00.000Z'),
        }),
      ],
      display: [purchase({ amountPaid: new Prisma.Decimal(50_000) })],
    });

    const result = await buildRefundedPackagesReport(prisma, {
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
    });
    assertEvents(result);

    expect(result.eventCount).toBe(2);
    expect(result.purchaseCount).toBe(1);
    expect(result.totalRefunded).toBe(50_000);
  });

  it('keeps an undated legacy aggregate visible as history, separate from the dated range and never date-fabricated', async () => {
    const prisma = makePrisma({
      undated: [
        event({
          id: 'evt-agg',
          purchaseId: 'p2',
          amount: new Prisma.Decimal(7_000),
          source: 'LEGACY_AGGREGATE',
          refundType: 'UNKNOWN',
          occurredAt: null,
          notes: 'historical aggregate / date unknown',
        }),
      ],
      display: [purchase({ id: 'p2', packageId: 'pkg2', clientId: 'c2' })],
    });

    const result = await buildRefundedPackagesReport(prisma, {
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
    });
    assertEvents(result);

    // Not in the dated block at all.
    expect(result.eventCount).toBe(0);
    expect(result.purchaseCount).toBe(0);
    expect(result.totalRefunded).toBe(0);
    expect(result.items).toEqual([]);

    // But fully visible in undatedHistorical.
    expect(result.undatedHistorical.recordCount).toBe(1);
    expect(result.undatedHistorical.purchaseCount).toBe(1);
    expect(result.undatedHistorical.totalRefunded).toBe(7_000);
    expect(result.undatedHistorical.items[0]).toEqual({
      eventId: 'evt-agg',
      purchaseId: 'p2',
      packageId: 'pkg2',
      clientId: 'c2',
      amountPaid: 50_000,
      refundAmount: 7_000,
      refundType: 'UNKNOWN',
      source: 'LEGACY_AGGREGATE',
      occurredAt: null,
      notes: 'historical aggregate / date unknown',
    });
  });

  it('excludes LEGACY_AGGREGATE rows from eventCount even when dated (a zero-money terminal aggregate using its refundedAt)', async () => {
    const prisma = makePrisma({
      dated: [
        event({
          id: 'evt-live',
          purchaseId: 'p1',
          amount: new Prisma.Decimal(10_000),
          refundType: 'PARTIAL',
          source: 'LIVE',
          occurredAt: new Date('2026-01-05T00:00:00.000Z'),
        }),
        event({
          id: 'evt-agg-dated',
          purchaseId: 'p3',
          amount: new Prisma.Decimal(0),
          refundType: 'UNKNOWN',
          source: 'LEGACY_AGGREGATE',
          occurredAt: new Date('2026-01-06T00:00:00.000Z'),
        }),
      ],
      display: [
        purchase({ id: 'p1' }),
        purchase({ id: 'p3', packageId: 'pkg3', clientId: 'c3', amountPaid: new Prisma.Decimal(0) }),
      ],
    });

    const result = await buildRefundedPackagesReport(prisma, {
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
    });
    assertEvents(result);

    // items includes both rows, but eventCount counts only the LIVE one.
    expect(result.items).toHaveLength(2);
    expect(result.eventCount).toBe(1);
    // purchaseCount still counts distinct purchases across all dated items.
    expect(result.purchaseCount).toBe(2);
    expect(result.totalRefunded).toBe(10_000);
  });

  it('preserves an event row with null display fields when its historical purchase is missing', async () => {
    const prisma = makePrisma({
      dated: [event({ id: 'evt-orphan', purchaseId: 'gone', amount: new Prisma.Decimal(1_000) })],
      display: [],
    });

    const result = await buildRefundedPackagesReport(prisma, {
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
    });
    assertEvents(result);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      eventId: 'evt-orphan',
      purchaseId: 'gone',
      packageId: null,
      clientId: null,
      amountPaid: null,
      refundAmount: 1_000,
    });
  });

  it('sums totals exactly in integer halalas across many events with no float drift', async () => {
    const prisma = makePrisma({
      dated: [
        event({ id: 'evt-1', purchaseId: 'p1', amount: new Prisma.Decimal(333) }),
        event({ id: 'evt-2', purchaseId: 'p1', amount: new Prisma.Decimal(333) }),
        event({ id: 'evt-3', purchaseId: 'p1', amount: new Prisma.Decimal(334) }),
      ],
      display: [purchase()],
    });

    const result = await buildRefundedPackagesReport(prisma, {
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
    });
    assertEvents(result);

    expect(result.totalRefunded).toBe(1_000);
  });

  describe('history reconciliation gate', () => {
    it('falls back to the legacy report when a cumulative refund has no event history', async () => {
      const prisma = makePrisma({
        // No dated/undated/represented events at all — nothing has been backfilled yet.
        candidates: [candidate({ id: 'p9', refundAmount: new Prisma.Decimal(20_000) })],
      });

      const result = await buildRefundedPackagesReport(prisma, {
        from: new Date('2026-01-01'),
        to: new Date('2026-01-31'),
      });

      expect(result.historyMode).toBe('LEGACY');
      expect(result.historyReconciliation).toEqual({
        unresolvedPurchaseCount: 1,
        complete: false,
      });
      expect(result.totalRefunded).toBe(0);
    });

    it('keeps the fallback gate independent of the requested date range', async () => {
      const prisma = makePrisma({
        candidates: [candidate({ id: 'p9', refundAmount: new Prisma.Decimal(20_000) })],
      });

      // A range nowhere near any plausible refund date.
      const result = await buildRefundedPackagesReport(prisma, {
        from: new Date('2000-01-01'),
        to: new Date('2000-01-31'),
      });

      expect(result.historyMode).toBe('LEGACY');
      expect(result.historyReconciliation).toEqual({
        unresolvedPurchaseCount: 1,
        complete: false,
      });
    });

    it('uses EVENTS only after a candidate is fully represented by the shared plan', async () => {
      const prisma = makePrisma({
        dated: [event({ id: 'evt-1', purchaseId: 'p9', amount: new Prisma.Decimal(20_000) })],
        display: [purchase({ id: 'p9' })],
        represented: [event({ id: 'evt-1', purchaseId: 'p9', amount: new Prisma.Decimal(20_000) })],
        candidates: [candidate({ id: 'p9', refundAmount: new Prisma.Decimal(20_000), status: 'ACTIVE' })],
      });

      const result = await buildRefundedPackagesReport(prisma, {
        from: new Date('2026-01-01'),
        to: new Date('2026-01-31'),
      });

      expect(result.historyMode).toBe('EVENTS');
      expect(result.historyReconciliation).toEqual({
        unresolvedPurchaseCount: 0,
        complete: true,
      });
    });

    it('falls back for a zero-money terminal REFUNDED purchase with no events', async () => {
      const prisma = makePrisma({
        candidates: [candidate({ id: 'p10', status: 'REFUNDED', refundAmount: new Prisma.Decimal(0) })],
      });

      const result = await buildRefundedPackagesReport(prisma, {
        from: new Date('2026-01-01'),
        to: new Date('2026-01-31'),
      });

      expect(result.historyMode).toBe('LEGACY');
      expect(result.historyReconciliation).toEqual({
        unresolvedPurchaseCount: 1,
        complete: false,
      });
    });

    it('falls back when represented event amounts exceed the purchase cumulative refund', async () => {
      const prisma = makePrisma({
        represented: [event({ id: 'evt-over', purchaseId: 'p11', amount: new Prisma.Decimal(200) })],
        candidates: [candidate({ id: 'p11', refundAmount: new Prisma.Decimal(100), status: 'ACTIVE' })],
      });

      const result = await buildRefundedPackagesReport(prisma, {
        from: new Date('2026-01-01'),
        to: new Date('2026-01-31'),
      });

      expect(result.historyMode).toBe('LEGACY');
      expect(result.historyReconciliation).toEqual({
        unresolvedPurchaseCount: 1,
        complete: false,
      });
    });

    it('falls back when an existing legacy aggregate does not match the residual', async () => {
      const prisma = makePrisma({
        represented: [event({
          id: 'evt-aggregate',
          purchaseId: 'p12',
          amount: new Prisma.Decimal(999),
          source: 'LEGACY_AGGREGATE',
        })],
        candidates: [candidate({ id: 'p12', refundAmount: new Prisma.Decimal(300), status: 'ACTIVE' })],
      });

      const result = await buildRefundedPackagesReport(prisma, {
        from: new Date('2026-01-01'),
        to: new Date('2026-01-31'),
      });

      expect(result.historyMode).toBe('LEGACY');
      expect(result.historyReconciliation).toEqual({
        unresolvedPurchaseCount: 1,
        complete: false,
      });
    });

    it('falls back when duplicate legacy aggregates exist for one purchase', async () => {
      const prisma = makePrisma({
        represented: [
          event({ id: 'evt-aggregate-1', purchaseId: 'p14', amount: new Prisma.Decimal(300), source: 'LEGACY_AGGREGATE' }),
          event({ id: 'evt-aggregate-2', purchaseId: 'p14', amount: new Prisma.Decimal(300), source: 'LEGACY_AGGREGATE' }),
        ],
        candidates: [candidate({ id: 'p14', refundAmount: new Prisma.Decimal(300), status: 'ACTIVE' })],
      });

      const result = await buildRefundedPackagesReport(prisma, {
        from: new Date('2026-01-01'),
        to: new Date('2026-01-31'),
      });

      expect(result.historyMode).toBe('LEGACY');
      expect(result.historyReconciliation).toEqual({
        unresolvedPurchaseCount: 1,
        complete: false,
      });
    });

    it('falls back when an existing event disagrees with its loaded completed request amount', async () => {
      const prisma = makePrisma({
        represented: [event({
          id: 'evt-request-mismatch',
          purchaseId: 'p15',
          amount: new Prisma.Decimal(400),
          source: 'LEGACY_REQUEST',
          sourceRefundRequestId: 'rr-mismatch',
        })],
        requests: [{
          id: 'rr-mismatch',
          amount: new Prisma.Decimal(500),
          processedAt: new Date('2026-01-01'),
          invoice: { packagePurchaseId: 'p15' },
        }],
        candidates: [candidate({ id: 'p15', refundAmount: new Prisma.Decimal(400), status: 'ACTIVE' })],
      });

      const result = await buildRefundedPackagesReport(prisma, {
        from: new Date('2026-01-01'),
        to: new Date('2026-01-31'),
      });

      expect(result.historyMode).toBe('LEGACY');
      expect(result.historyReconciliation).toEqual({
        unresolvedPurchaseCount: 1,
        complete: false,
      });
    });

    it('uses EVENTS only when a LIVE event fully accounts for its candidate purchase', async () => {
      const live = event({ id: 'evt-live-complete', purchaseId: 'p13', amount: new Prisma.Decimal(700) });
      const prisma = makePrisma({
        dated: [live],
        represented: [live],
        display: [purchase({ id: 'p13' })],
        candidates: [candidate({ id: 'p13', refundAmount: new Prisma.Decimal(700), status: 'ACTIVE' })],
      });

      const result = await buildRefundedPackagesReport(prisma, {
        from: new Date('2026-01-01'),
        to: new Date('2026-01-31'),
      });

      expect(result.historyMode).toBe('EVENTS');
      expect(result.historyReconciliation).toEqual({
        unresolvedPurchaseCount: 0,
        complete: true,
      });
      expect(result.totalRefunded).toBe(700);
    });
  });
});
