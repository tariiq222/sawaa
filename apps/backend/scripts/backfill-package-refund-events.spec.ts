import { Prisma, PackagePurchaseStatus, PackageRefundEventSource } from '@prisma/client';
import {
  BackfillCliHelpRequested,
  type CompletedRequestRow,
  type ExistingEventRow,
  type LockedPurchaseRow,
  type TransitionPrismaClient,
  type TransitionTxClient,
  parseBackfillCliArgs,
  planPurchase,
  resolveDatabaseUrl,
  runBackfill,
} from './backfill-package-refund-events';

const d = (value: number) => new Prisma.Decimal(value);

function purchase(overrides: Partial<LockedPurchaseRow> = {}): LockedPurchaseRow {
  return {
    id: 'purchase-1',
    status: PackagePurchaseStatus.ACTIVE,
    refundAmount: d(0),
    refundedAt: null,
    ...overrides,
  };
}

function liveEvent(overrides: Partial<ExistingEventRow> = {}): ExistingEventRow {
  return {
    id: 'event-1',
    source: PackageRefundEventSource.LIVE,
    amount: d(0),
    sourceRefundRequestId: null,
    ...overrides,
  };
}

function request(overrides: Partial<CompletedRequestRow> = {}): CompletedRequestRow {
  return {
    id: 'request-1',
    amount: d(0),
    processedAt: null,
    ...overrides,
  };
}

describe('planPurchase (pure residual/idempotency core)', () => {
  it('subtracts a LIVE event that has no linked request id from the represented amount', () => {
    const plan = planPurchase(
      purchase({ refundAmount: d(1000) }),
      [liveEvent({ amount: d(1000), sourceRefundRequestId: null })],
      [],
    );
    expect(plan).toMatchObject({ kind: 'ready', createAggregate: false, residual: d(0) });
  });

  it('does not duplicate an already-represented zero-money terminal cancellation', () => {
    const plan = planPurchase(
      purchase({ status: PackagePurchaseStatus.REFUNDED, refundAmount: d(0), refundedAt: null }),
      [liveEvent({ amount: d(0), sourceRefundRequestId: null })],
      [],
    );
    expect(plan).toMatchObject({ kind: 'ready', createAggregate: false });
  });

  it('creates an undated zero-money aggregate for a terminal cancellation with no representation and no known date', () => {
    const plan = planPurchase(
      purchase({ status: PackagePurchaseStatus.REFUNDED, refundAmount: d(0), refundedAt: null }),
      [],
      [],
    );
    expect(plan).toMatchObject({
      kind: 'ready',
      createAggregate: true,
      residual: d(0),
      aggregateOccurredAt: null,
    });
  });

  it('dates a zero-money terminal aggregate using refundedAt as cancellation evidence when known', () => {
    const refundedAt = new Date('2026-01-05T00:00:00.000Z');
    const plan = planPurchase(
      purchase({ status: PackagePurchaseStatus.REFUNDED, refundAmount: d(0), refundedAt }),
      [],
      [],
    );
    expect(plan).toMatchObject({ kind: 'ready', createAggregate: true, aggregateOccurredAt: refundedAt });
  });

  it('rerun with an already-represented request creates no duplicate and does not touch the existing source', () => {
    const plan = planPurchase(
      purchase({ refundAmount: d(500) }),
      [
        {
          id: 'event-req-1',
          source: PackageRefundEventSource.LEGACY_REQUEST,
          amount: d(500),
          sourceRefundRequestId: 'request-already-represented',
        },
      ],
      [request({ id: 'request-already-represented', amount: d(500), processedAt: new Date('2025-01-01') })],
    );
    expect(plan).toMatchObject({ kind: 'ready', exactRequests: [], createAggregate: false, residual: d(0) });
  });

  it('flags over-cumulative represented amounts and writes nothing', () => {
    const plan = planPurchase(
      purchase({ refundAmount: d(100) }),
      [],
      [request({ id: 'r1', amount: d(80), processedAt: new Date('2025-01-01') }), request({ id: 'r2', amount: d(50), processedAt: new Date('2025-01-02') })],
    );
    expect(plan).toEqual({ kind: 'finding', purchaseId: 'purchase-1', reason: 'over-cumulative' });
  });

  it('flags an aggregate whose stored amount no longer matches the computed residual and writes nothing', () => {
    const plan = planPurchase(
      purchase({ refundAmount: d(300) }),
      [
        {
          id: 'agg-1',
          source: PackageRefundEventSource.LEGACY_AGGREGATE,
          amount: d(999),
          sourceRefundRequestId: null,
        },
      ],
      [],
    );
    expect(plan).toEqual({ kind: 'finding', purchaseId: 'purchase-1', reason: 'aggregate-mismatch' });
  });

  it('flags duplicate legacy aggregates before considering any writes', () => {
    const plan = planPurchase(
      purchase({ refundAmount: d(300) }),
      [
        { id: 'agg-1', source: PackageRefundEventSource.LEGACY_AGGREGATE, amount: d(300), sourceRefundRequestId: null },
        { id: 'agg-2', source: PackageRefundEventSource.LEGACY_AGGREGATE, amount: d(300), sourceRefundRequestId: null },
      ],
      [],
    );
    expect(plan).toEqual({ kind: 'finding', purchaseId: 'purchase-1', reason: 'aggregate-mismatch' });
  });

  it('flags a linked completed request amount mismatch without requiring source request presence', () => {
    const plan = planPurchase(
      purchase({ refundAmount: d(500) }),
      [{ id: 'event-req', source: PackageRefundEventSource.LEGACY_REQUEST, amount: d(400), sourceRefundRequestId: 'request-1' }],
      [request({ id: 'request-1', amount: d(500), processedAt: new Date('2025-01-01') })],
    );
    expect(plan).toEqual({ kind: 'finding', purchaseId: 'purchase-1', reason: 'request-mismatch' });
  });

  it('allows immutable orphan history when the linked source request was deleted', () => {
    const plan = planPurchase(
      purchase({ refundAmount: d(500) }),
      [{ id: 'event-orphan', source: PackageRefundEventSource.LEGACY_REQUEST, amount: d(500), sourceRefundRequestId: 'deleted-request' }],
      [],
    );
    expect(plan).toMatchObject({ kind: 'ready', createAggregate: false, residual: d(0) });
  });

  it('imports exactly one dated request with no aggregate when it fully accounts for the cumulative amount', () => {
    const plan = planPurchase(
      purchase({ refundAmount: d(500) }),
      [],
      [request({ id: 'r1', amount: d(500), processedAt: new Date('2025-06-01') })],
    );
    expect(plan).toMatchObject({ kind: 'ready', createAggregate: false, residual: d(0) });
    expect((plan as Extract<typeof plan, { kind: 'ready' }>).exactRequests.map((r) => r.id)).toEqual(['r1']);
  });

  it('imports two dated requests for one purchase, both represented individually', () => {
    const plan = planPurchase(
      purchase({ refundAmount: d(3000) }),
      [],
      [
        request({ id: 'r1', amount: d(1000), processedAt: new Date('2025-06-01') }),
        request({ id: 'r2', amount: d(2000), processedAt: new Date('2025-06-05') }),
      ],
    );
    expect(plan).toMatchObject({ kind: 'ready', createAggregate: false, residual: d(0) });
    expect((plan as Extract<typeof plan, { kind: 'ready' }>).exactRequests).toHaveLength(2);
  });

  it('folds an undated completed request into an undated aggregate rather than an individual event', () => {
    const plan = planPurchase(
      purchase({ refundAmount: d(700) }),
      [],
      [request({ id: 'r1', amount: d(700), processedAt: null })],
    );
    expect(plan).toMatchObject({ kind: 'ready', createAggregate: true, aggregateOccurredAt: null, residual: d(700) });
    expect((plan as Extract<typeof plan, { kind: 'ready' }>).exactRequests).toHaveLength(0);
  });

  it('folds a payment-less cumulative refund (no requests at all) into an undated aggregate', () => {
    const plan = planPurchase(purchase({ refundAmount: d(1200) }), [], []);
    expect(plan).toMatchObject({ kind: 'ready', createAggregate: true, aggregateOccurredAt: null, residual: d(1200) });
  });
});

// ─── Orchestration: runBackfill against a mocked Prisma client ──────────

interface FakeTx extends TransitionTxClient {
  queryRawMock: jest.Mock;
  findManyEvents: jest.Mock;
  createEvent: jest.Mock;
  findManyRequests: jest.Mock;
}

function makeTx(): FakeTx {
  const queryRawMock = jest.fn();
  const findManyEvents = jest.fn();
  const createEvent = jest.fn().mockResolvedValue(undefined);
  const findManyRequests = jest.fn();
  return {
    $queryRaw: queryRawMock as unknown as FakeTx['$queryRaw'],
    packageRefundEvent: { findMany: findManyEvents, create: createEvent },
    refundRequest: { findMany: findManyRequests },
    queryRawMock,
    findManyEvents,
    createEvent,
    findManyRequests,
  };
}

function makePrisma(candidateIds: string[], tx: FakeTx): TransitionPrismaClient {
  return {
    packagePurchase: { findMany: jest.fn().mockResolvedValue(candidateIds.map((id) => ({ id }))) },
    $transaction: jest.fn(async (fn: (tx: TransitionTxClient) => Promise<unknown>) => fn(tx)),
  };
}

describe('runBackfill orchestration', () => {
  it('dry-run mode computes the summary and writes nothing', async () => {
    const tx = makeTx();
    tx.queryRawMock.mockResolvedValueOnce([purchase({ id: 'p1', refundAmount: d(700) })]);
    tx.findManyEvents.mockResolvedValueOnce([]);
    tx.findManyRequests.mockResolvedValueOnce([]);
    const prisma = makePrisma(['p1'], tx);

    const summary = await runBackfill(prisma, { dryRun: true });

    expect(tx.createEvent).not.toHaveBeenCalled();
    expect(String(tx.queryRawMock.mock.calls[0][0].join(''))).not.toContain('FOR UPDATE');
    expect(summary).toMatchObject({
      purchasesConsidered: 1,
      importedRequestCount: 0,
      aggregateCount: 1,
      residualHalalas: 700,
      undatedPurchaseCount: 1,
      findings: [],
    });
  });

  it('write mode inserts one LEGACY_REQUEST event per exact request and no aggregate when fully explained', async () => {
    const tx = makeTx();
    tx.queryRawMock.mockResolvedValueOnce([purchase({ id: 'p1', refundAmount: d(500) })]);
    tx.findManyEvents.mockResolvedValueOnce([]);
    tx.findManyRequests.mockResolvedValueOnce([
      request({ id: 'r1', amount: d(500), processedAt: new Date('2025-06-01T00:00:00.000Z') }),
    ]);
    const prisma = makePrisma(['p1'], tx);

    const summary = await runBackfill(prisma, { dryRun: false });

    expect(tx.createEvent).toHaveBeenCalledTimes(1);
    expect(tx.createEvent).toHaveBeenCalledWith({
      data: expect.objectContaining({
        purchaseId: 'p1',
        amount: d(500),
        source: 'LEGACY_REQUEST',
        refundType: 'UNKNOWN',
        occurredAt: new Date('2025-06-01T00:00:00.000Z'),
        sourceRefundRequestId: 'r1',
      }),
    });
    expect(summary.importedRequestCount).toBe(1);
    expect(summary.aggregateCount).toBe(0);
  });

  it('write mode inserts a LEGACY_AGGREGATE row keyed by legacyAggregateKey for an unexplained residual', async () => {
    const tx = makeTx();
    tx.queryRawMock.mockResolvedValueOnce([purchase({ id: 'p1', refundAmount: d(1200) })]);
    tx.findManyEvents.mockResolvedValueOnce([]);
    tx.findManyRequests.mockResolvedValueOnce([]);
    const prisma = makePrisma(['p1'], tx);

    await runBackfill(prisma, { dryRun: false });

    expect(tx.createEvent).toHaveBeenCalledWith({
      data: expect.objectContaining({
        purchaseId: 'p1',
        amount: d(1200),
        source: 'LEGACY_AGGREGATE',
        refundType: 'UNKNOWN',
        occurredAt: null,
        legacyAggregateKey: 'purchase:p1:legacy-residual',
      }),
    });
    expect(String(tx.queryRawMock.mock.calls[0][0].join(''))).toContain('FOR UPDATE');
  });

  it('rerun against an already-represented request creates no duplicate and never overwrites a LIVE row', async () => {
    const tx = makeTx();
    tx.queryRawMock.mockResolvedValueOnce([purchase({ id: 'p1', refundAmount: d(500) })]);
    tx.findManyEvents.mockResolvedValueOnce([
      {
        id: 'existing-live',
        source: PackageRefundEventSource.LIVE,
        amount: d(500),
        sourceRefundRequestId: 'r1',
      },
    ]);
    tx.findManyRequests.mockResolvedValueOnce([
      request({ id: 'r1', amount: d(500), processedAt: new Date('2025-06-01') }),
    ]);
    const prisma = makePrisma(['p1'], tx);

    const summary = await runBackfill(prisma, { dryRun: false });

    expect(tx.createEvent).not.toHaveBeenCalled();
    expect(summary.importedRequestCount).toBe(0);
    expect(summary.aggregateCount).toBe(0);
    expect(summary.findings).toEqual([]);
  });

  it('an over-cumulative purchase performs no writes and is reported as a finding', async () => {
    const tx = makeTx();
    tx.queryRawMock.mockResolvedValueOnce([purchase({ id: 'p1', refundAmount: d(100) })]);
    tx.findManyEvents.mockResolvedValueOnce([]);
    tx.findManyRequests.mockResolvedValueOnce([
      request({ id: 'r1', amount: d(80), processedAt: new Date('2025-01-01') }),
      request({ id: 'r2', amount: d(50), processedAt: new Date('2025-01-02') }),
    ]);
    const prisma = makePrisma(['p1'], tx);

    const summary = await runBackfill(prisma, { dryRun: false });

    expect(tx.createEvent).not.toHaveBeenCalled();
    expect(summary.findings).toEqual([{ purchaseId: 'p1', reason: 'over-cumulative' }]);
  });

  it('an aggregate-mismatch purchase performs no writes and is reported as a finding', async () => {
    const tx = makeTx();
    tx.queryRawMock.mockResolvedValueOnce([purchase({ id: 'p1', refundAmount: d(300) })]);
    tx.findManyEvents.mockResolvedValueOnce([
      { id: 'agg-1', source: PackageRefundEventSource.LEGACY_AGGREGATE, amount: d(999), sourceRefundRequestId: null },
    ]);
    tx.findManyRequests.mockResolvedValueOnce([]);
    const prisma = makePrisma(['p1'], tx);

    const summary = await runBackfill(prisma, { dryRun: false });

    expect(tx.createEvent).not.toHaveBeenCalled();
    expect(summary.findings).toEqual([{ purchaseId: 'p1', reason: 'aggregate-mismatch' }]);
  });

  it('a duplicate aggregate performs no writes and is reported as a finding', async () => {
    const tx = makeTx();
    tx.queryRawMock.mockResolvedValueOnce([purchase({ id: 'p1', refundAmount: d(300) })]);
    tx.findManyEvents.mockResolvedValueOnce([
      { id: 'agg-1', source: PackageRefundEventSource.LEGACY_AGGREGATE, amount: d(300), sourceRefundRequestId: null },
      { id: 'agg-2', source: PackageRefundEventSource.LEGACY_AGGREGATE, amount: d(300), sourceRefundRequestId: null },
    ]);
    tx.findManyRequests.mockResolvedValueOnce([]);
    const prisma = makePrisma(['p1'], tx);

    const summary = await runBackfill(prisma, { dryRun: false });

    expect(tx.createEvent).not.toHaveBeenCalled();
    expect(summary.findings).toEqual([{ purchaseId: 'p1', reason: 'aggregate-mismatch' }]);
  });

  it('a linked request amount mismatch performs no writes and is reported as a finding', async () => {
    const tx = makeTx();
    tx.queryRawMock.mockResolvedValueOnce([purchase({ id: 'p1', refundAmount: d(500) })]);
    tx.findManyEvents.mockResolvedValueOnce([
      { id: 'event-req', source: PackageRefundEventSource.LEGACY_REQUEST, amount: d(400), sourceRefundRequestId: 'r1' },
    ]);
    tx.findManyRequests.mockResolvedValueOnce([
      request({ id: 'r1', amount: d(500), processedAt: new Date('2025-01-01') }),
    ]);
    const prisma = makePrisma(['p1'], tx);

    const summary = await runBackfill(prisma, { dryRun: false });

    expect(tx.createEvent).not.toHaveBeenCalled();
    expect(summary.findings).toEqual([{ purchaseId: 'p1', reason: 'request-mismatch' }]);
  });

  it('candidate selection excludes a zero-refund, non-REFUNDED purchase entirely', async () => {
    const tx = makeTx();
    const prisma = makePrisma([], tx); // the candidate query itself returns nothing for such a purchase

    const summary = await runBackfill(prisma, { dryRun: true });

    expect(tx.queryRawMock).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ purchasesConsidered: 0, importedRequestCount: 0, aggregateCount: 0 });
  });
});

// ─── CLI: database source gating ─────────────────────────────────────────

describe('parseBackfillCliArgs', () => {
  it('requires --database-url-env and rejects the app default', () => {
    expect(() => parseBackfillCliArgs([])).toThrow('--database-url-env');
    expect(() => parseBackfillCliArgs(['--database-url-env=DATABASE_URL'])).toThrow('must not be DATABASE_URL');
  });

  it('parses dry-run and a named env var', () => {
    expect(parseBackfillCliArgs(['--database-url-env=HISTORICAL_AUDIT_DATABASE_URL', '--dry-run'])).toEqual({
      dryRun: true,
      databaseUrlEnv: 'HISTORICAL_AUDIT_DATABASE_URL',
      confirmDatabase: undefined,
    });
  });

  it('defaults to dry-run and requires an explicit apply confirmation for writes', () => {
    expect(parseBackfillCliArgs(['--database-url-env=HISTORICAL_AUDIT_DATABASE_URL'])).toEqual({
      dryRun: true,
      databaseUrlEnv: 'HISTORICAL_AUDIT_DATABASE_URL',
      confirmDatabase: undefined,
    });
    expect(parseBackfillCliArgs([
      '--database-url-env=HISTORICAL_AUDIT_DATABASE_URL',
      '--apply',
      '--confirm-database=sawaa_transition',
    ])).toEqual({
      dryRun: false,
      databaseUrlEnv: 'HISTORICAL_AUDIT_DATABASE_URL',
      confirmDatabase: 'sawaa_transition',
    });
    expect(() => parseBackfillCliArgs([
      '--database-url-env=HISTORICAL_AUDIT_DATABASE_URL',
      '--apply',
    ])).toThrow('--confirm-database');
    expect(() => parseBackfillCliArgs([
      '--database-url-env=HISTORICAL_AUDIT_DATABASE_URL',
      '--dry-run',
      '--apply',
      '--confirm-database=sawaa_transition',
    ])).toThrow('--apply cannot be specified with --dry-run');
    expect(() => parseBackfillCliArgs([
      '--database-url-env=HISTORICAL_AUDIT_DATABASE_URL',
      '--apply',
      '--confirm-database=sawaa_transition',
      '--dry-run',
    ])).toThrow('--dry-run cannot be specified with --apply');
  });

  it('shows usage on --help without requiring a database', () => {
    expect(() => parseBackfillCliArgs(['--help'])).toThrow(BackfillCliHelpRequested);
  });

  it('rejects unknown arguments', () => {
    expect(() => parseBackfillCliArgs(['--wat'])).toThrow('Unknown argument');
  });
});

describe('resolveDatabaseUrl', () => {
  it('reads the connection string from the named env var, never a default', () => {
    const url = resolveDatabaseUrl(
      { dryRun: true, databaseUrlEnv: 'HISTORICAL_AUDIT_DATABASE_URL' },
      { HISTORICAL_AUDIT_DATABASE_URL: 'postgresql://sawaa:pw@localhost:3453/sawaa_e2e' },
    );
    expect(url).toBe('postgresql://sawaa:pw@localhost:3453/sawaa_e2e');
  });

  it('fails when the named env var is unset', () => {
    expect(() => resolveDatabaseUrl({ dryRun: true, databaseUrlEnv: 'MISSING_ENV' }, {})).toThrow(
      'MISSING_ENV is not set',
    );
  });

  it('allows a protected-looking database name in dry-run mode', () => {
    const url = resolveDatabaseUrl(
      { dryRun: true, databaseUrlEnv: 'X' },
      { X: 'postgresql://sawaa:pw@localhost:3453/sawaa_dev' },
    );
    expect(url).toContain('sawaa_dev');
  });

  it('refuses write mode against a shared/production-shaped database name', () => {
    expect(() =>
      resolveDatabaseUrl(
        { dryRun: false, databaseUrlEnv: 'X', confirmDatabase: 'sawaa_dev' },
        { X: 'postgresql://sawaa:pw@localhost:3453/sawaa_dev' },
      ),
    ).toThrow('Refusing to write');
  });

  it('refuses production-shaped database aliases, not only exact fixture names', () => {
    expect(() => resolveDatabaseUrl(
      { dryRun: false, databaseUrlEnv: 'X', confirmDatabase: 'sawaa_production' },
      { X: 'postgresql://sawaa:pw@localhost:3453/sawaa_production' },
    )).toThrow('Refusing to write');
    expect(() => resolveDatabaseUrl(
      { dryRun: false, databaseUrlEnv: 'X', confirmDatabase: 'sawaa_staging' },
      { X: 'postgresql://sawaa:pw@localhost:3453/sawaa_staging' },
    )).toThrow('Refusing to write');
  });

  it('permits write mode against the dedicated transition database', () => {
    const url = resolveDatabaseUrl(
      { dryRun: false, databaseUrlEnv: 'X', confirmDatabase: 'sawaa_e2e' },
      { X: 'postgresql://sawaa:pw@localhost:3453/sawaa_e2e' },
    );
    expect(url).toContain('sawaa_e2e');
  });
});
