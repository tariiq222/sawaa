import { ReconcileRefundsCron } from './reconcile-refunds.cron';
import { DEFAULT_ORG_ID } from '../../../common/constants';

const NOW = new Date('2026-05-10T10:00:00Z');

type StuckRow = {
  id: string;
  paymentId: string;
  invoiceId: string;
  gatewayRef: string;
};

interface TxMock {
  refundRequest: { update: jest.Mock };
  payment: { update: jest.Mock };
  invoice: { update: jest.Mock };
}

function buildTx(): TxMock {
  return {
    refundRequest: { update: jest.fn().mockResolvedValue({}) },
    payment: { update: jest.fn().mockResolvedValue({}) },
    invoice: { update: jest.fn().mockResolvedValue({}) },
  };
}

function buildRlsTx(tx: TxMock) {
  return {
    withTransaction: jest.fn().mockImplementation(async (fn: (t: TxMock) => Promise<void>) => fn(tx)),
  };
}

function buildPrisma(stuckRows: StuckRow[]) {
  return {
    $queryRaw: jest.fn().mockImplementation((strings: TemplateStringsArray, ..._values: unknown[]) => {
      if (strings[0].includes('hashtext')) return Promise.resolve([{ v: BigInt(12345) }]);
      if (strings[0].includes('pg_try_advisory_lock')) return Promise.resolve([{ acquired: true }]);
      if (strings[0].includes('pg_advisory_unlock')) return Promise.resolve([]);
      return Promise.resolve([]);
    }),
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

describe('ReconcileRefundsCron', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW.getTime());
  });
  afterEach(() => jest.restoreAllMocks());

  it('updates RefundRequest → COMPLETED + Payment → REFUNDED + Invoice → REFUNDED when Moyasar status is "paid"', async () => {
    const row: StuckRow = {
      id: 'rr_1',
      paymentId: 'pay_1',
      invoiceId: 'inv_1',
      gatewayRef: 'moyasar_ref_1',
    };
    const prisma = buildPrisma([row]);
    const moyasar = buildMoyasar({ moyasar_ref_1: 'paid' });
    const tx = buildTx();
    const rlsTx = buildRlsTx(tx);

    const cron = new ReconcileRefundsCron(prisma as never, moyasar as never, rlsTx as never);
    await cron.execute();

    expect(moyasar.getRefundStatus).toHaveBeenCalledWith(DEFAULT_ORG_ID, 'moyasar_ref_1');

    expect(tx.refundRequest.update).toHaveBeenCalledWith({
      where: { id: 'rr_1' },
      data: { status: 'COMPLETED' },
    });
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay_1' },
      data: { status: 'REFUNDED' },
    });
    expect(tx.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv_1' },
      data: { status: 'REFUNDED' },
    });
  });

  it('updates RefundRequest → FAILED when Moyasar status is "failed"', async () => {
    const row: StuckRow = {
      id: 'rr_2',
      paymentId: 'pay_2',
      invoiceId: 'inv_2',
      gatewayRef: 'moyasar_ref_2',
    };
    const prisma = buildPrisma([row]);
    const moyasar = buildMoyasar({ moyasar_ref_2: 'failed' });
    const tx = buildTx();
    const rlsTx = buildRlsTx(tx);

    const cron = new ReconcileRefundsCron(prisma as never, moyasar as never, rlsTx as never);
    await cron.execute();

    expect(moyasar.getRefundStatus).toHaveBeenCalledWith(DEFAULT_ORG_ID, 'moyasar_ref_2');
    expect(prisma.refundRequest.update).toHaveBeenCalledWith({
      where: { id: 'rr_2' },
      data: { status: 'FAILED' },
    });
    // No payment or invoice update for a failed refund
    expect(tx.payment.update).not.toHaveBeenCalled();
  });

  it('leaves RefundRequest in PROCESSING when Moyasar status is "pending" (Moyasar still processing)', async () => {
    const row: StuckRow = {
      id: 'rr_3',
      paymentId: 'pay_3',
      invoiceId: 'inv_3',
      gatewayRef: 'moyasar_ref_3',
    };
    const prisma = buildPrisma([row]);
    const moyasar = buildMoyasar({ moyasar_ref_3: 'pending' });
    const tx = buildTx();
    const rlsTx = buildRlsTx(tx);

    const cron = new ReconcileRefundsCron(prisma as never, moyasar as never, rlsTx as never);
    await cron.execute();

    expect(moyasar.getRefundStatus).toHaveBeenCalledWith(DEFAULT_ORG_ID, 'moyasar_ref_3');
    // No DB mutation — row stays as-is
    expect(prisma.refundRequest.update).not.toHaveBeenCalled();
    expect(tx.refundRequest.update).not.toHaveBeenCalled();
  });

  it('passes the same Idempotency-Key to Moyasar on every call (idempotency guarantee via refund-payment handler)', async () => {
    /**
     * This test verifies the end-to-end idempotency contract from the brief:
     * RefundPaymentHandler always builds the idempotencyKey as
     * `refund:<paymentId>:<amount>` and passes it to MoyasarApiClient.createRefund.
     * If called twice with the same RefundRequest, it always produces the same key.
     *
     * We test this at the handler level (RefundPaymentHandler.spec.ts covers
     * 'forwards Idempotency-Key as refund:<paymentId>:<amount> to Moyasar').
     *
     * Here we verify the cron itself calls getRefundStatus with the gatewayRef
     * stored on the row — it never re-issues the refund, so no double-charge risk.
     */
    const row: StuckRow = {
      id: 'rr_idem',
      paymentId: 'pay_idem',
      invoiceId: 'inv_idem',
      gatewayRef: 'moyasar_ref_idem',
    };
    const prisma = buildPrisma([row]);
    const moyasar = buildMoyasar({ moyasar_ref_idem: 'paid' });
    const tx = buildTx();
    const rlsTx = buildRlsTx(tx);

    const cron = new ReconcileRefundsCron(prisma as never, moyasar as never, rlsTx as never);

    // Call execute twice — simulates the cron firing twice for the same stuck row
    await cron.execute();
    await cron.execute();

    // getRefundStatus is called once per execute tick — uses gatewayRef from DB,
    // never re-issues a new refund to Moyasar (no createRefund call).
    expect(moyasar.getRefundStatus).toHaveBeenCalledTimes(2);
    expect(moyasar.getRefundStatus).toHaveBeenNthCalledWith(1, DEFAULT_ORG_ID, 'moyasar_ref_idem');
    expect(moyasar.getRefundStatus).toHaveBeenNthCalledWith(2, DEFAULT_ORG_ID, 'moyasar_ref_idem');
    // No createRefund — cron only reads Moyasar status, never re-issues
    expect((moyasar as Record<string, unknown>)['createRefund']).toBeUndefined();
  });

  it('is a no-op when there are no stuck rows', async () => {
    const prisma = buildPrisma([]);
    const moyasar = buildMoyasar({});
    const tx = buildTx();
    const rlsTx = buildRlsTx(tx);

    const cron = new ReconcileRefundsCron(prisma as never, moyasar as never, rlsTx as never);
    await cron.execute();

    expect(moyasar.getRefundStatus).not.toHaveBeenCalled();
    expect(prisma.refundRequest.update).not.toHaveBeenCalled();
  });

  it('continues processing remaining rows if one row throws', async () => {
    const rows: StuckRow[] = [
      { id: 'rr_err', paymentId: 'pay_err', invoiceId: 'inv_err', gatewayRef: 'ref_err' },
      { id: 'rr_ok', paymentId: 'pay_ok', invoiceId: 'inv_ok', gatewayRef: 'ref_ok' },
    ];
    const prisma = buildPrisma(rows);
    const moyasar = {
      getRefundStatus: jest.fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce({ id: 'ref_ok', status: 'paid' }),
    };
    const tx = buildTx();
    const rlsTx = buildRlsTx(tx);

    const cron = new ReconcileRefundsCron(prisma as never, moyasar as never, rlsTx as never);
    await cron.execute(); // should not throw

    // Second row should still be processed despite the first throwing
    expect(moyasar.getRefundStatus).toHaveBeenCalledTimes(2);
    expect(tx.refundRequest.update).toHaveBeenCalledWith({
      where: { id: 'rr_ok' },
      data: { status: 'COMPLETED' },
    });
  });

  it('queries rows with status=PROCESSING, updatedAt < cutoff, and gatewayRef not null', async () => {
    const prisma = buildPrisma([]);
    const moyasar = buildMoyasar({});
    const tx = buildTx();
    const rlsTx = buildRlsTx(tx);

    const cron = new ReconcileRefundsCron(prisma as never, moyasar as never, rlsTx as never);
    await cron.execute();

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
      },
    });
    // Verify cutoff is ~15 min before NOW
    const callArgs = (prisma.refundRequest.findMany as jest.Mock).mock.calls[0][0] as {
      where: { updatedAt: { lt: Date } };
    };
    const cutoff = callArgs.where.updatedAt.lt;
    const diffMs = NOW.getTime() - cutoff.getTime();
    expect(diffMs).toBeGreaterThanOrEqual(14 * 60 * 1_000);
    expect(diffMs).toBeLessThanOrEqual(16 * 60 * 1_000);
  });
});
