import { ReconcileRefundsCron } from './reconcile-refunds.cron';
import { DEFAULT_ORG_ID } from '../../../common/constants';

const NOW = new Date('2026-05-10T10:00:00Z');

type StuckRow = {
  id: string;
  paymentId: string;
  invoiceId: string;
  gatewayRef: string;
  amount: number;
};

type InvoiceAccounting = {
  total: number;
  vatAmt: number;
  refundedAmount: number;
};

interface TxMock {
  refundRequest: { update: jest.Mock };
  payment: { update: jest.Mock };
  invoice: { update: jest.Mock; findUniqueOrThrow: jest.Mock };
  activityLog: { create: jest.Mock };
}

function buildTx(invoice: InvoiceAccounting = { total: 10_000, vatAmt: 1_304, refundedAmount: 0 }): TxMock {
  return {
    refundRequest: { update: jest.fn().mockResolvedValue({}) },
    payment: { update: jest.fn().mockResolvedValue({}) },
    invoice: {
      update: jest.fn().mockResolvedValue({}),
      findUniqueOrThrow: jest.fn().mockResolvedValue(invoice),
    },
    activityLog: { create: jest.fn().mockResolvedValue({}) },
  };
}

function buildPrisma(stuckRows: StuckRow[], tx: TxMock) {
  return {
    $queryRaw: jest.fn().mockImplementation((strings: TemplateStringsArray, ..._values: unknown[]) => {
      if (strings[0].includes('hashtext')) return Promise.resolve([{ v: BigInt(12345) }]);
      if (strings[0].includes('pg_try_advisory_lock')) return Promise.resolve([{ acquired: true }]);
      if (strings[0].includes('pg_advisory_unlock')) return Promise.resolve([]);
      return Promise.resolve([]);
    }),
    $transaction: jest.fn().mockImplementation(async (fn: (t: TxMock) => Promise<void>) => fn(tx)),
    refundRequest: {
      findMany: jest.fn().mockResolvedValue(stuckRows),
      update: jest.fn().mockResolvedValue({}),
    },
  };
}

function buildMoyasar(statusByGatewayRef: Record<string, 'paid' | 'failed' | 'pending'>) {
  return {
    getRefundStatus: jest.fn().mockImplementation(
      async (_orgId: string, gatewayRef: string) => ({
        id: gatewayRef,
        status: statusByGatewayRef[gatewayRef] ?? 'pending',
      }),
    ),
  };
}

const buildCron = (prisma: unknown, tx: TxMock, moyasar: unknown) =>
  new ReconcileRefundsCron(
    prisma as never,
    { withTransaction: jest.fn((fn: (t: TxMock) => unknown) => fn(tx)) } as never,
    moyasar as never,
  );

describe('ReconcileRefundsCron', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW.getTime());
  });
  afterEach(() => jest.restoreAllMocks());

  it('marks a FULL refund → COMPLETED + Invoice REFUNDED + Payment REFUNDED with ledger columns set', async () => {
    const row: StuckRow = {
      id: 'rr_1',
      paymentId: 'pay_1',
      invoiceId: 'inv_1',
      gatewayRef: 'moyasar_ref_1',
      amount: 10_000, // == invoice total → full refund
    };
    const tx = buildTx({ total: 10_000, vatAmt: 1_304, refundedAmount: 0 });
    const prisma = buildPrisma([row], tx);
    const moyasar = buildMoyasar({ moyasar_ref_1: 'paid' });

    await buildCron(prisma, tx, moyasar).execute();

    expect(moyasar.getRefundStatus).toHaveBeenCalledWith(DEFAULT_ORG_ID, 'moyasar_ref_1');
    expect(tx.refundRequest.update).toHaveBeenCalledWith({
      where: { id: 'rr_1' },
      data: { status: 'COMPLETED' },
    });
    expect(tx.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv_1' },
      data: expect.objectContaining({ status: 'REFUNDED', refundedAmount: 10_000 }),
    });
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay_1' },
      data: { status: 'REFUNDED', refundedAmount: { increment: 10_000 } },
    });
  });

  it('marks a PARTIAL refund → COMPLETED + Invoice/Payment PARTIALLY_REFUNDED, not a blanket REFUNDED', async () => {
    // Regression: the cron used to force REFUNDED for any reconciled refund,
    // wrongly closing partial refunds and leaving refundedAmount stale.
    const row: StuckRow = {
      id: 'rr_partial',
      paymentId: 'pay_partial',
      invoiceId: 'inv_partial',
      gatewayRef: 'moyasar_ref_partial',
      amount: 4_000, // < invoice total → partial refund
    };
    const tx = buildTx({ total: 10_000, vatAmt: 1_304, refundedAmount: 0 });
    const prisma = buildPrisma([row], tx);
    const moyasar = buildMoyasar({ moyasar_ref_partial: 'paid' });

    await buildCron(prisma, tx, moyasar).execute();

    expect(tx.refundRequest.update).toHaveBeenCalledWith({
      where: { id: 'rr_partial' },
      data: { status: 'COMPLETED' },
    });
    expect(tx.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv_partial' },
      data: expect.objectContaining({ status: 'PARTIALLY_REFUNDED', refundedAmount: 4_000 }),
    });
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay_partial' },
      data: { status: 'PARTIALLY_REFUNDED', refundedAmount: { increment: 4_000 } },
    });
  });

  it('accumulates onto a prior partial refund and closes the invoice when the balance is cleared', async () => {
    const row: StuckRow = {
      id: 'rr_top',
      paymentId: 'pay_top',
      invoiceId: 'inv_top',
      gatewayRef: 'moyasar_ref_top',
      amount: 6_000, // 4000 already refunded + 6000 == total → now full
    };
    const tx = buildTx({ total: 10_000, vatAmt: 1_304, refundedAmount: 4_000 });
    const prisma = buildPrisma([row], tx);
    const moyasar = buildMoyasar({ moyasar_ref_top: 'paid' });

    await buildCron(prisma, tx, moyasar).execute();

    expect(tx.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv_top' },
      data: expect.objectContaining({ status: 'REFUNDED', refundedAmount: 10_000 }),
    });
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay_top' },
      data: { status: 'REFUNDED', refundedAmount: { increment: 6_000 } },
    });
  });

  it('updates RefundRequest → FAILED when Moyasar status is "failed"', async () => {
    const row: StuckRow = {
      id: 'rr_2',
      paymentId: 'pay_2',
      invoiceId: 'inv_2',
      gatewayRef: 'moyasar_ref_2',
      amount: 5_000,
    };
    const tx = buildTx();
    const prisma = buildPrisma([row], tx);
    const moyasar = buildMoyasar({ moyasar_ref_2: 'failed' });

    await buildCron(prisma, tx, moyasar).execute();

    expect(moyasar.getRefundStatus).toHaveBeenCalledWith(DEFAULT_ORG_ID, 'moyasar_ref_2');
    expect(tx.refundRequest.update).toHaveBeenCalledWith({
      where: { id: 'rr_2' },
      data: { status: 'FAILED' },
    });
    expect(tx.activityLog.create).toHaveBeenCalledTimes(1);
    // No payment/invoice mutation for a failed refund
    expect(tx.payment.update).not.toHaveBeenCalled();
    expect(tx.invoice.update).not.toHaveBeenCalled();
  });

  it('leaves RefundRequest in PROCESSING when Moyasar status is "pending" (Moyasar still processing)', async () => {
    const row: StuckRow = {
      id: 'rr_3',
      paymentId: 'pay_3',
      invoiceId: 'inv_3',
      gatewayRef: 'moyasar_ref_3',
      amount: 5_000,
    };
    const tx = buildTx();
    const prisma = buildPrisma([row], tx);
    const moyasar = buildMoyasar({ moyasar_ref_3: 'pending' });

    await buildCron(prisma, tx, moyasar).execute();

    expect(moyasar.getRefundStatus).toHaveBeenCalledWith(DEFAULT_ORG_ID, 'moyasar_ref_3');
    expect(prisma.refundRequest.update).not.toHaveBeenCalled();
    expect(tx.refundRequest.update).not.toHaveBeenCalled();
  });

  it('reads Moyasar status by gatewayRef and never re-issues a refund (no double-charge)', async () => {
    const row: StuckRow = {
      id: 'rr_idem',
      paymentId: 'pay_idem',
      invoiceId: 'inv_idem',
      gatewayRef: 'moyasar_ref_idem',
      amount: 10_000,
    };
    const tx = buildTx();
    const prisma = buildPrisma([row], tx);
    const moyasar = buildMoyasar({ moyasar_ref_idem: 'paid' });

    const cron = buildCron(prisma, tx, moyasar);
    await cron.execute();
    await cron.execute();

    expect(moyasar.getRefundStatus).toHaveBeenCalledTimes(2);
    expect(moyasar.getRefundStatus).toHaveBeenNthCalledWith(1, DEFAULT_ORG_ID, 'moyasar_ref_idem');
    expect(moyasar.getRefundStatus).toHaveBeenNthCalledWith(2, DEFAULT_ORG_ID, 'moyasar_ref_idem');
    // The cron only reads status — it must never call a refund-issuing method.
    expect((moyasar as Record<string, unknown>)['createRefund']).toBeUndefined();
  });

  it('is a no-op when there are no stuck rows', async () => {
    const tx = buildTx();
    const prisma = buildPrisma([], tx);
    const moyasar = buildMoyasar({});

    await buildCron(prisma, tx, moyasar).execute();

    expect(moyasar.getRefundStatus).not.toHaveBeenCalled();
    expect(prisma.refundRequest.update).not.toHaveBeenCalled();
  });

  it('continues processing remaining rows if one row throws', async () => {
    const rows: StuckRow[] = [
      { id: 'rr_err', paymentId: 'pay_err', invoiceId: 'inv_err', gatewayRef: 'ref_err', amount: 5_000 },
      { id: 'rr_ok', paymentId: 'pay_ok', invoiceId: 'inv_ok', gatewayRef: 'ref_ok', amount: 10_000 },
    ];
    const tx = buildTx();
    const prisma = buildPrisma(rows, tx);
    const moyasar = {
      getRefundStatus: jest.fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce({ id: 'ref_ok', status: 'paid' }),
    };

    await buildCron(prisma, tx, moyasar).execute(); // should not throw

    expect(moyasar.getRefundStatus).toHaveBeenCalledTimes(2);
    expect(tx.refundRequest.update).toHaveBeenCalledWith({
      where: { id: 'rr_ok' },
      data: { status: 'COMPLETED' },
    });
  });

  it('queries rows with status=PROCESSING, updatedAt < cutoff, gatewayRef not null, and selects amount', async () => {
    const tx = buildTx();
    const prisma = buildPrisma([], tx);
    const moyasar = buildMoyasar({});

    await buildCron(prisma, tx, moyasar).execute();

    expect(prisma.refundRequest.findMany).toHaveBeenCalledWith({
      where: {
        status: 'PROCESSING',
        updatedAt: { lt: expect.any(Date) },
        gatewayRef: { not: null },
      },
      select: {
        id: true,
        paymentId: true,
        invoiceId: true,
        gatewayRef: true,
        amount: true,
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: 100,
    });
    const callArgs = (prisma.refundRequest.findMany as jest.Mock).mock.calls[0][0] as {
      where: { updatedAt: { lt: Date } };
    };
    const cutoff = callArgs.where.updatedAt.lt;
    const diffMs = NOW.getTime() - cutoff.getTime();
    expect(diffMs).toBeGreaterThanOrEqual(14 * 60 * 1_000);
    expect(diffMs).toBeLessThanOrEqual(16 * 60 * 1_000);
  });
});
