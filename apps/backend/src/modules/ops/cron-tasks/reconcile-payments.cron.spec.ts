import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { ReconcilePaymentsCron } from './reconcile-payments.cron';
import { DEFAULT_ORG_ID } from '../../../common/constants';

const NOW = new Date('2026-05-10T10:00:00Z');

type StuckRow = {
  id: string;
  invoiceId: string;
  amount: number;
  currency: string;
  gatewayRef: string;
};

type InvoiceRow = {
  id: string;
  total: number;
  currency: string;
  bookingId: string | null;
  packagePurchaseId: string | null;
  clientId: string;
};

interface TxMock {
  payment: { findUnique: jest.Mock; update: jest.Mock; aggregate: jest.Mock };
  invoice: { update: jest.Mock };
  activityLog: { create: jest.Mock };
}

const defaultInvoice: InvoiceRow = {
  id: 'inv_1',
  total: 10_000,
  currency: 'SAR',
  bookingId: 'bk_1',
  packagePurchaseId: null,
  clientId: 'cl_1',
};

function buildTx(opts: { currentStatus?: PaymentStatus; paidAfter?: number } = {}): TxMock {
  return {
    payment: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ status: opts.currentStatus ?? PaymentStatus.PENDING }),
      update: jest.fn().mockResolvedValue({}),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: opts.paidAfter ?? 10_000 } }),
    },
    invoice: { update: jest.fn().mockResolvedValue({}) },
    activityLog: { create: jest.fn().mockResolvedValue({}) },
  };
}

function buildPrisma(args: {
  stuckRows: StuckRow[];
  invoice?: InvoiceRow | null;
  deposit?: { depositEnabled: boolean; depositAmount: number } | null;
}) {
  const { stuckRows, invoice = defaultInvoice, deposit = null } = args;
  return {
    $queryRaw: jest.fn().mockImplementation((strings: TemplateStringsArray) => {
      if (strings[0].includes('hashtext')) return Promise.resolve([{ v: BigInt(12345) }]);
      if (strings[0].includes('pg_try_advisory_lock')) return Promise.resolve([{ acquired: true }]);
      if (strings[0].includes('pg_advisory_unlock')) return Promise.resolve([]);
      return Promise.resolve([]);
    }),
    payment: {
      findMany: jest.fn().mockResolvedValue(stuckRows),
    },
    invoice: {
      findUnique: jest.fn().mockResolvedValue(invoice),
    },
    // Consumed by resolveInvoiceDeposit (deposit.helper)
    booking: {
      findFirst: jest.fn().mockResolvedValue(invoice?.bookingId ? { serviceId: 'svc_1' } : null),
    },
    service: {
      findFirst: jest.fn().mockResolvedValue(deposit),
    },
  };
}

function buildMoyasar(statusByRef: Record<string, { status: string; amount: number; currency?: string }>) {
  return {
    getPaymentStatus: jest.fn().mockImplementation(async (_org: string, ref: string) => {
      const s = statusByRef[ref];
      if (!s) return { id: ref, status: 'initiated', amount: 0, currency: 'SAR' };
      return { id: ref, status: s.status, amount: s.amount, currency: s.currency ?? 'SAR' };
    }),
  };
}

const buildCron = (prisma: unknown, tx: TxMock, moyasar: unknown, eventBus: { publish: jest.Mock }) =>
  new ReconcilePaymentsCron(
    prisma as never,
    { withTransaction: jest.fn((fn: (t: TxMock) => unknown) => fn(tx)) } as never,
    moyasar as never,
    eventBus as never,
    null,
  );

const row = (over: Partial<StuckRow> = {}): StuckRow => ({
  id: 'pay_1',
  invoiceId: 'inv_1',
  amount: 10_000,
  currency: 'SAR',
  gatewayRef: 'm_1',
  ...over,
});

describe('ReconcilePaymentsCron', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW.getTime());
  });
  afterEach(() => jest.restoreAllMocks());

  it('finalizes a fully-paid card payment → COMPLETED + invoice PAID + PaymentCompletedEvent', async () => {
    const tx = buildTx({ paidAfter: 10_000 });
    const prisma = buildPrisma({ stuckRows: [row()] });
    const moyasar = buildMoyasar({ m_1: { status: 'paid', amount: 10_000 } });
    const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };

    await buildCron(prisma, tx, moyasar, eventBus).execute();

    expect(moyasar.getPaymentStatus).toHaveBeenCalledWith(DEFAULT_ORG_ID, 'm_1');
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay_1' },
      data: expect.objectContaining({ status: PaymentStatus.COMPLETED }),
    });
    expect(tx.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv_1' },
      data: expect.objectContaining({ status: 'PAID' }),
    });
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).toHaveBeenCalledWith('finance.payment.completed', expect.anything());
  });

  it('lands PARTIALLY_PAID and emits no completion event for a non-deposit partial top-up', async () => {
    const tx = buildTx({ paidAfter: 6_000 }); // only part of the 10000 total collected
    const prisma = buildPrisma({ stuckRows: [row({ amount: 6_000 })] });
    const moyasar = buildMoyasar({ m_1: { status: 'paid', amount: 6_000 } });
    const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };

    await buildCron(prisma, tx, moyasar, eventBus).execute();

    expect(tx.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv_1' },
      data: expect.objectContaining({ status: 'PARTIALLY_PAID' }),
    });
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('emits DepositPaidEvent when a deposit-sized payment lands PARTIALLY_PAID', async () => {
    const tx = buildTx({ paidAfter: 3_000 });
    const prisma = buildPrisma({
      stuckRows: [row({ amount: 3_000 })],
      deposit: { depositEnabled: true, depositAmount: 3_000 },
    });
    const moyasar = buildMoyasar({ m_1: { status: 'paid', amount: 3_000 } });
    const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };

    await buildCron(prisma, tx, moyasar, eventBus).execute();

    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).toHaveBeenCalledWith('finance.payment.deposit_paid', expect.anything());
  });

  it('finalizes a failed/voided payment → FAILED + PaymentFailedEvent', async () => {
    const tx = buildTx();
    const prisma = buildPrisma({ stuckRows: [row()] });
    const moyasar = buildMoyasar({ m_1: { status: 'failed', amount: 10_000 } });
    const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };

    await buildCron(prisma, tx, moyasar, eventBus).execute();

    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay_1' },
      data: expect.objectContaining({ status: PaymentStatus.FAILED }),
    });
    expect(tx.invoice.update).not.toHaveBeenCalled();
    expect(eventBus.publish).toHaveBeenCalledWith('finance.payment.failed', expect.anything());
  });

  it('leaves a still-initiated payment untouched (client may be mid-3DS)', async () => {
    const tx = buildTx();
    const prisma = buildPrisma({ stuckRows: [row()] });
    const moyasar = buildMoyasar({ m_1: { status: 'initiated', amount: 10_000 } });
    const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };

    await buildCron(prisma, tx, moyasar, eventBus).execute();

    expect(tx.payment.update).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('refuses to finalize when Moyasar amount does not match the row amount', async () => {
    const tx = buildTx();
    const prisma = buildPrisma({ stuckRows: [row({ amount: 10_000 })] });
    const moyasar = buildMoyasar({ m_1: { status: 'paid', amount: 9_999 } });
    const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };

    await buildCron(prisma, tx, moyasar, eventBus).execute();

    expect(tx.payment.update).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('no-ops (no event) when a webhook already finalized the row inside the tx', async () => {
    const tx = buildTx({ currentStatus: PaymentStatus.COMPLETED });
    const prisma = buildPrisma({ stuckRows: [row()] });
    const moyasar = buildMoyasar({ m_1: { status: 'paid', amount: 10_000 } });
    const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };

    await buildCron(prisma, tx, moyasar, eventBus).execute();

    expect(tx.payment.update).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('is a no-op when there are no stuck rows', async () => {
    const tx = buildTx();
    const prisma = buildPrisma({ stuckRows: [] });
    const moyasar = buildMoyasar({});
    const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };

    await buildCron(prisma, tx, moyasar, eventBus).execute();

    expect(moyasar.getPaymentStatus).not.toHaveBeenCalled();
  });

  it('continues processing remaining rows when one throws', async () => {
    const tx = buildTx();
    const prisma = buildPrisma({ stuckRows: [row({ id: 'pay_err', gatewayRef: 'm_err' }), row({ id: 'pay_ok', gatewayRef: 'm_ok' })] });
    const moyasar = {
      getPaymentStatus: jest
        .fn()
        .mockRejectedValueOnce(new Error('network'))
        .mockResolvedValueOnce({ id: 'm_ok', status: 'paid', amount: 10_000, currency: 'SAR' }),
    };
    const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };

    await buildCron(prisma, tx, moyasar, eventBus).execute();

    expect(moyasar.getPaymentStatus).toHaveBeenCalledTimes(2);
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay_ok' },
      data: expect.objectContaining({ status: PaymentStatus.COMPLETED }),
    });
  });

  it('queries only PENDING ONLINE_CARD rows older than the grace window with a gatewayRef', async () => {
    const tx = buildTx();
    const prisma = buildPrisma({ stuckRows: [] });
    const moyasar = buildMoyasar({});
    const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };

    await buildCron(prisma, tx, moyasar, eventBus).execute();

    const call = (prisma.payment.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where).toEqual(
      expect.objectContaining({
        status: PaymentStatus.PENDING,
        method: PaymentMethod.ONLINE_CARD,
        gatewayRef: { not: null },
        updatedAt: { lt: expect.any(Date) },
      }),
    );
    const diffMs = NOW.getTime() - call.where.updatedAt.lt.getTime();
    expect(diffMs).toBeGreaterThanOrEqual(29 * 60 * 1_000);
    expect(diffMs).toBeLessThanOrEqual(31 * 60 * 1_000);
  });
});
