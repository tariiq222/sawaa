import { ReconcileRefundsCron } from './reconcile-refunds.cron';

const NOW = new Date('2026-05-10T10:00:00Z');

type Row = {
  id: string;
  idempotencyKey: string | null;
  sourceEventId: string | null;
  gatewayRef: string | null;
  providerState: string;
};

function buildPrisma(rows: Row[]) {
  return {
    $queryRaw: jest.fn().mockImplementation((strings: TemplateStringsArray) =>
      strings[0].includes('CronLock') ? Promise.resolve([{ name: 'lock' }]) : Promise.resolve([])),
    $executeRaw: jest.fn().mockResolvedValue(1),
    refundRequest: { findMany: jest.fn().mockResolvedValue(rows) },
  };
}

describe('ReconcileRefundsCron', () => {
  beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(NOW.getTime()));
  afterEach(() => jest.restoreAllMocks());

  it('replays a response-lost PROCESSING row even when gatewayRef is null', async () => {
    const row: Row = {
      id: '11111111-1111-4111-8111-111111111111',
      idempotencyKey: 'refund:rr-1',
      sourceEventId: '22222222-2222-4222-8222-222222222222',
      gatewayRef: null,
      providerState: 'CALL_UNKNOWN',
    };
    const prisma = buildPrisma([row]);
    const refunds = { finalizeRefundFromCancellation: jest.fn().mockResolvedValue(undefined) };

    await new ReconcileRefundsCron(prisma as never, refunds as never).execute();

    expect(refunds.finalizeRefundFromCancellation).toHaveBeenCalledWith({
      refundRequestId: row.id,
      idempotencyKey: 'refund:rr-1',
      sourceEventId: row.sourceEventId,
    });
  });

  it('uses the deterministic migration fallback key for a rolling-deploy legacy row', async () => {
    const row: Row = {
      id: '11111111-1111-4111-8111-111111111111',
      idempotencyKey: null,
      sourceEventId: null,
      gatewayRef: null,
      providerState: 'NOT_CALLED',
    };
    const prisma = buildPrisma([row]);
    const refunds = { finalizeRefundFromCancellation: jest.fn().mockResolvedValue(undefined) };

    await new ReconcileRefundsCron(prisma as never, refunds as never).execute();

    expect(refunds.finalizeRefundFromCancellation).toHaveBeenCalledWith({
      refundRequestId: row.id,
      idempotencyKey: `refund:${row.id}`,
    });
  });

  it('continues to unrelated refunds when one retry fails', async () => {
    const rows: Row[] = [
      { id: 'rr-1', idempotencyKey: 'refund:1', sourceEventId: null, gatewayRef: null, providerState: 'CALL_UNKNOWN' },
      { id: 'rr-2', idempotencyKey: 'refund:2', sourceEventId: null, gatewayRef: 'provider-2', providerState: 'CONFIRMED' },
    ];
    const prisma = buildPrisma(rows);
    const refunds = {
      finalizeRefundFromCancellation: jest.fn()
        .mockRejectedValueOnce(new Error('provider unavailable'))
        .mockResolvedValueOnce(undefined),
    };

    await new ReconcileRefundsCron(prisma as never, refunds as never).execute();

    expect(refunds.finalizeRefundFromCancellation).toHaveBeenCalledTimes(2);
    expect(refunds.finalizeRefundFromCancellation).toHaveBeenLastCalledWith({
      refundRequestId: 'rr-2',
      idempotencyKey: 'refund:2',
    });
  });

  it('queries every stale PROCESSING provider phase, without excluding null gatewayRef', async () => {
    const prisma = buildPrisma([]);
    const refunds = { finalizeRefundFromCancellation: jest.fn() };

    await new ReconcileRefundsCron(prisma as never, refunds as never).execute();

    expect(prisma.refundRequest.findMany).toHaveBeenCalledWith({
      where: { status: 'PROCESSING', updatedAt: { lt: expect.any(Date) } },
      select: {
        id: true,
        idempotencyKey: true,
        sourceEventId: true,
        gatewayRef: true,
        providerState: true,
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: 100,
    });
    const cutoff = prisma.refundRequest.findMany.mock.calls[0][0].where.updatedAt.lt as Date;
    expect(NOW.getTime() - cutoff.getTime()).toBe(15 * 60 * 1_000);
    expect(refunds.finalizeRefundFromCancellation).not.toHaveBeenCalled();
  });
});
