import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InvoiceStatus, PaymentMethod, Prisma } from '@prisma/client';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import { ProcessPaymentHandler } from './process-payment.handler';

const mockInvoice = {
  id: 'inv-1',
  bookingId: 'booking-1',
  currency: 'SAR',
  total: 230,
  status: InvoiceStatus.ISSUED,
};

const mockPayment = {
  id: 'pay-1',
  invoiceId: 'inv-1',
  amount: 230,
  method: PaymentMethod.ONLINE_CARD,
  status: 'COMPLETED',
  idempotencyKey: 'key-1',
  processedAt: new Date(),
};

// Build a tx object that execute() will see inside $transaction. The $transaction
// mock immediately invokes its callback with this tx, simulating a real Prisma
// interactive transaction against the mock.
const buildTx = (overrides: Record<string, unknown> = {}) => ({
  invoice: {
    findFirst: jest.fn().mockResolvedValue(mockInvoice),
    update: jest.fn().mockResolvedValue({ ...mockInvoice, status: InvoiceStatus.PAID }),
  },
  payment: {
    findFirst: jest.fn().mockResolvedValue(mockPayment),
    create: jest.fn().mockResolvedValue(mockPayment),
    aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 230 } }),
  },
  // resolveInvoiceDeposit loads the booking then its service via scalar bookingId.
  // Default: a service with NO deposit, so the deposit path is inert unless a
  // test overrides these mocks.
  booking: {
    findFirst: jest.fn().mockResolvedValue({ serviceId: 'svc-1' }),
  },
  service: {
    findFirst: jest.fn().mockResolvedValue({ depositEnabled: false, depositAmount: null }),
  },
  ...overrides,
});

const buildPrisma = (tx = buildTx()) => ({
  ...tx,
  // Outside-of-transaction reads use the Proxy-scoped findFirst.
  invoice: {
    ...tx.invoice,
  },
  $transaction: jest.fn((cb: (tx: unknown) => Promise<unknown>) => cb(tx)),
});

const buildEventBus = () => ({ publish: jest.fn().mockResolvedValue(undefined) });

describe('ProcessPaymentHandler', () => {
  it('creates payment and marks invoice PAID when fully paid', async () => {
    // P1: ONLINE_CARD is no longer accepted by this endpoint (Moyasar webhook
    // is the authoritative writer). Test with CASH instead — the rest of the
    // flow (status update + event emission) is identical.
    const tx = buildTx({
      invoice: { findFirst: jest.fn().mockResolvedValue(mockInvoice), update: jest.fn() },
      payment: {
        findFirst: jest.fn().mockResolvedValue(mockPayment),
        create: jest.fn().mockResolvedValue(mockPayment),
        // Aggregate is called twice now: (1) outstanding-balance check before
        // create, (2) post-create paid-vs-total check. First call: 0 paid so
        // outstanding = 230. Second call: 230 paid → PAID status.
        aggregate: jest.fn()
          .mockResolvedValueOnce({ _sum: { amount: 0 } })
          .mockResolvedValueOnce({ _sum: { amount: 230 } }),
      },
    });
    const prisma = buildPrisma(tx);
    const eventBus = buildEventBus();
    const handler = new ProcessPaymentHandler(prisma as never, { withTransaction: jest.fn((fn: any) => fn(tx)) } as never, eventBus as never);

    const result = await handler.execute({
      invoiceId: 'inv-1',
      amount: 230,
      method: PaymentMethod.CASH,
      idempotencyKey: 'key-1',
    });

    expect(tx.payment.create).toHaveBeenCalled();
    expect(tx.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: InvoiceStatus.PAID }) }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      'finance.payment.completed',
      expect.objectContaining({ payload: expect.objectContaining({ bookingId: 'booking-1' }) }),
    );
    expect(result.id).toBe('pay-1');
  });

  it('marks invoice PARTIALLY_PAID when underpaid and does not publish event', async () => {
    const tx = buildTx({
      invoice: {
        findFirst: jest.fn().mockResolvedValue(mockInvoice),
        update: jest.fn().mockResolvedValue(mockInvoice),
      },
      payment: {
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue(mockPayment),
        // First call = outstanding-balance check (0 paid → 230 outstanding).
        // Second call = post-create total (only 100 paid → PARTIALLY_PAID).
        aggregate: jest.fn()
          .mockResolvedValueOnce({ _sum: { amount: 0 } })
          .mockResolvedValueOnce({ _sum: { amount: 100 } }),
      },
    });
    const prisma = buildPrisma(tx);
    const eventBus = buildEventBus();
    const handler = new ProcessPaymentHandler(prisma as never, { withTransaction: jest.fn((fn: any) => fn(tx)) } as never, eventBus as never);

    await handler.execute({
      invoiceId: 'inv-1',
      amount: 100,
      method: PaymentMethod.CASH,
    });

    expect(tx.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: InvoiceStatus.PARTIALLY_PAID }),
      }),
    );
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('returns existing payment when idempotencyKey unique constraint fires', async () => {
    const uniqueError = new Prisma.PrismaClientKnownRequestError('unique violation', {
      code: 'P2002',
      clientVersion: 'test',
    });
    const tx = buildTx({
      invoice: {
        findFirst: jest.fn().mockResolvedValue(mockInvoice),
        update: jest.fn(),
      },
      payment: {
        findFirst: jest.fn().mockResolvedValue(mockPayment),
        create: jest.fn().mockRejectedValue(uniqueError),
        // P1: aggregate is called once now (outstanding check) before create.
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
    });
    const prisma = buildPrisma(tx);
    const handler = new ProcessPaymentHandler(prisma as never, { withTransaction: jest.fn((fn: any) => fn(tx)) } as never, buildEventBus() as never);

    // P1: ONLINE_CARD is no longer allowed via this endpoint. Use CASH.
    const result = await handler.execute({
      invoiceId: 'inv-1',
      amount: 230,
      method: PaymentMethod.CASH,
      idempotencyKey: 'key-1',
    });

    expect(tx.payment.create).toHaveBeenCalled();
    expect(tx.payment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ idempotencyKey: 'key-1' }) }),
    );
    expect(tx.invoice.update).not.toHaveBeenCalled();
    expect(result.id).toBe('pay-1');
  });

  it('throws NotFoundException when invoice not found', async () => {
    const tx = buildTx({
      invoice: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
      payment: { findFirst: jest.fn(), create: jest.fn(), aggregate: jest.fn() },
    });
    const prisma = buildPrisma(tx);
    const handler = new ProcessPaymentHandler(prisma as never, { withTransaction: jest.fn((fn: any) => fn(tx)) } as never, buildEventBus() as never);

    await expect(
      handler.execute({
        invoiceId: 'bad-id',
        amount: 100,
        method: PaymentMethod.CASH,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when invoice is VOID', async () => {
    const tx = buildTx({
      invoice: {
        findFirst: jest.fn().mockResolvedValue({ ...mockInvoice, status: InvoiceStatus.VOID }),
        update: jest.fn(),
      },
      payment: { findFirst: jest.fn(), create: jest.fn(), aggregate: jest.fn() },
    });
    const prisma = buildPrisma(tx);
    const handler = new ProcessPaymentHandler(prisma as never, { withTransaction: jest.fn((fn: any) => fn(tx)) } as never, buildEventBus() as never);

    await expect(
      handler.execute({
        invoiceId: 'inv-1',
        amount: 100,
        method: PaymentMethod.CASH,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('publishes PaymentCompletedEvent with organizationId populated', async () => {
    const tx = buildTx({
      invoice: { findFirst: jest.fn().mockResolvedValue(mockInvoice), update: jest.fn() },
      payment: {
        findFirst: jest.fn().mockResolvedValue(mockPayment),
        create: jest.fn().mockResolvedValue(mockPayment),
        aggregate: jest.fn()
          .mockResolvedValueOnce({ _sum: { amount: 0 } })
          .mockResolvedValueOnce({ _sum: { amount: 230 } }),
      },
    });
    const prisma = buildPrisma(tx);
    const eventBus = buildEventBus();
    const handler = new ProcessPaymentHandler(prisma as never, { withTransaction: jest.fn((fn: any) => fn(tx)) } as never, eventBus as never);

    await handler.execute({
      invoiceId: 'inv-1',
      amount: 230,
      method: PaymentMethod.CASH,
      idempotencyKey: 'key-1',
    });

    expect(eventBus.publish).toHaveBeenCalledWith(
      'finance.payment.completed',
      expect.objectContaining({
        payload: expect.objectContaining({ organizationId: DEFAULT_ORG_ID }),
      }),
    );
  });

  it('throws BadRequestException when amount appears to be in SAR instead of halalas', async () => {
    const tx = buildTx({
      invoice: {
        findFirst: jest.fn().mockResolvedValue({ ...mockInvoice, total: 15000 }),
        update: jest.fn(),
      },
      payment: { findFirst: jest.fn(), create: jest.fn(), aggregate: jest.fn() },
    });
    const prisma = buildPrisma(tx);
    const handler = new ProcessPaymentHandler(prisma as never, { withTransaction: jest.fn((fn: any) => fn(tx)) } as never, buildEventBus() as never);

    await expect(
      handler.execute({
        invoiceId: 'inv-1',
        amount: 150, // 150 SAR = 15000 halalas, but sent as 150 halalas
        method: PaymentMethod.CASH,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  describe('SAR-vs-halalas tripwire (exact integer match)', () => {
    const buildTripwireTx = (total: number, paidAfter: number) =>
      buildTx({
        invoice: {
          findFirst: jest.fn().mockResolvedValue({ ...mockInvoice, total }),
          update: jest.fn(),
        },
        payment: {
          findFirst: jest.fn().mockResolvedValue(mockPayment),
          create: jest.fn().mockResolvedValue(mockPayment),
          aggregate: jest
            .fn()
            .mockResolvedValueOnce({ _sum: { amount: 0 } })
            .mockResolvedValueOnce({ _sum: { amount: paidAfter } }),
        },
      });

    it('accepts a legitimate small partial payment that the old ±1% band false-positived on', async () => {
      // Invoice 1,000,000 halalas (10,000 SAR); partial payment 9,950 halalas
      // (99.50 SAR). Old float band: |995000 − 1000000| / 1000000 = 0.005 < 0.01
      // → rejected a perfectly valid payment. Exact match: 995000 ≠ 1000000 → accepted.
      const tx = buildTripwireTx(1_000_000, 9_950);
      const prisma = buildPrisma(tx);
      const handler = new ProcessPaymentHandler(
        prisma as never,
        { withTransaction: jest.fn((fn: any) => fn(tx)) } as never,
        buildEventBus() as never,
      );

      await handler.execute({ invoiceId: 'inv-1', amount: 9_950, method: PaymentMethod.CASH });

      expect(tx.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ amount: 9_950 }) }),
      );
      expect(tx.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: InvoiceStatus.PARTIALLY_PAID }),
        }),
      );
    });

    it('accepts a near-total/100 partial payment the old band rejected (invoice 15000, amount 149)', async () => {
      // Old band: |14900 − 15000| / 15000 ≈ 0.0067 < 0.01 → false positive.
      // Exact match: 14900 ≠ 15000 → accepted.
      const tx = buildTripwireTx(15_000, 149);
      const prisma = buildPrisma(tx);
      const handler = new ProcessPaymentHandler(
        prisma as never,
        { withTransaction: jest.fn((fn: any) => fn(tx)) } as never,
        buildEventBus() as never,
      );

      await handler.execute({ invoiceId: 'inv-1', amount: 149, method: PaymentMethod.CASH });

      expect(tx.payment.create).toHaveBeenCalled();
    });

    it('rejects SAR-typed amount on a tiny invoice via exact match (invoice 500, amount 5)', async () => {
      // 5 SAR invoice: caller sends 5 (SAR) instead of 500 (halalas).
      // 5 × 100 === 500 — unmistakable SAR signature, rejected.
      const tx = buildTripwireTx(500, 0);
      const prisma = buildPrisma(tx);
      const handler = new ProcessPaymentHandler(
        prisma as never,
        { withTransaction: jest.fn((fn: any) => fn(tx)) } as never,
        buildEventBus() as never,
      );

      await expect(
        handler.execute({ invoiceId: 'inv-1', amount: 5, method: PaymentMethod.CASH }),
      ).rejects.toThrow('Payment amount appears to be in SAR');
      expect(tx.payment.create).not.toHaveBeenCalled();
    });

    it('rejects when amount × 100 equals the invoice total exactly (invoice 10000, amount 100)', async () => {
      // An amount of exactly total/100 is indistinguishable from SAR-unit
      // confusion — this is the one partial-payment shape the tripwire still
      // (intentionally) blocks. The operator must use a different split.
      const tx = buildTripwireTx(10_000, 0);
      const prisma = buildPrisma(tx);
      const handler = new ProcessPaymentHandler(
        prisma as never,
        { withTransaction: jest.fn((fn: any) => fn(tx)) } as never,
        buildEventBus() as never,
      );

      await expect(
        handler.execute({ invoiceId: 'inv-1', amount: 100, method: PaymentMethod.CASH }),
      ).rejects.toThrow('Payment amount appears to be in SAR');
      expect(tx.payment.create).not.toHaveBeenCalled();
    });
  });

  it.each([PaymentMethod.MADA, PaymentMethod.TABBY])(
    'accepts manual method %s and records the payment',
    async (method) => {
      const tx = buildTx({
        invoice: { findFirst: jest.fn().mockResolvedValue(mockInvoice), update: jest.fn() },
        payment: {
          findFirst: jest.fn().mockResolvedValue(mockPayment),
          create: jest.fn().mockResolvedValue(mockPayment),
          aggregate: jest.fn()
            .mockResolvedValueOnce({ _sum: { amount: 0 } })
            .mockResolvedValueOnce({ _sum: { amount: 230 } }),
        },
      });
      const prisma = buildPrisma(tx);
      const handler = new ProcessPaymentHandler(prisma as never, { withTransaction: jest.fn((fn: any) => fn(tx)) } as never, buildEventBus() as never);

      await handler.execute({ invoiceId: 'inv-1', amount: 230, method });
      expect(tx.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ method }) }),
      );
    },
  );

  it('rejects ONLINE_CARD (must come through the Moyasar webhook)', async () => {
    const tx = buildTx({
      invoice: { findFirst: jest.fn().mockResolvedValue(mockInvoice), update: jest.fn() },
      payment: {
        findFirst: jest.fn(),
        create: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
    });
    const prisma = buildPrisma(tx);
    const handler = new ProcessPaymentHandler(prisma as never, { withTransaction: jest.fn((fn: any) => fn(tx)) } as never, buildEventBus() as never);

    await expect(
      handler.execute({ invoiceId: 'inv-1', amount: 230, method: PaymentMethod.ONLINE_CARD }),
    ).rejects.toThrow(BadRequestException);
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  describe('deposit-enabled service', () => {
    // The service requires a 5000-halala deposit; the invoice total is 23000.
    const depositInvoice = { ...mockInvoice, total: 23000 };
    const buildDepositTx = (overrides: Record<string, unknown> = {}) =>
      buildTx({
        booking: { findFirst: jest.fn().mockResolvedValue({ serviceId: 'svc-1' }) },
        service: {
          findFirst: jest.fn().mockResolvedValue({ depositEnabled: true, depositAmount: 5000 }),
        },
        ...overrides,
      });

    it('accepts the exact deposit → PARTIALLY_PAID + DepositPaidEvent (not PaymentCompletedEvent)', async () => {
      const tx = buildDepositTx({
        invoice: { findFirst: jest.fn().mockResolvedValue(depositInvoice), update: jest.fn() },
        payment: {
          findFirst: jest.fn().mockResolvedValue(mockPayment),
          create: jest.fn().mockResolvedValue({ ...mockPayment, amount: 5000 }),
          // (1) outstanding check: 0 paid → 23000 outstanding.
          // (2) post-create total: 5000 paid → PARTIALLY_PAID.
          aggregate: jest
            .fn()
            .mockResolvedValueOnce({ _sum: { amount: 0 } })
            .mockResolvedValueOnce({ _sum: { amount: 5000 } }),
        },
      });
      const prisma = buildPrisma(tx);
      const eventBus = buildEventBus();
      const handler = new ProcessPaymentHandler(
        prisma as never,
        { withTransaction: jest.fn((fn: any) => fn(tx)) } as never,
        eventBus as never,
      );

      await handler.execute({ invoiceId: 'inv-1', amount: 5000, method: PaymentMethod.CASH });

      expect(tx.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: InvoiceStatus.PARTIALLY_PAID }),
        }),
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        'finance.payment.deposit_paid',
        expect.objectContaining({ payload: expect.objectContaining({ bookingId: 'booking-1' }) }),
      );
      expect(eventBus.publish).not.toHaveBeenCalledWith(
        'finance.payment.completed',
        expect.anything(),
      );
    });

    it('rejects a payment below the deposit', async () => {
      const tx = buildDepositTx({
        invoice: { findFirst: jest.fn().mockResolvedValue(depositInvoice), update: jest.fn() },
        payment: {
          findFirst: jest.fn(),
          create: jest.fn(),
          aggregate: jest.fn().mockResolvedValueOnce({ _sum: { amount: 0 } }),
        },
      });
      const prisma = buildPrisma(tx);
      const handler = new ProcessPaymentHandler(
        prisma as never,
        { withTransaction: jest.fn((fn: any) => fn(tx)) } as never,
        buildEventBus() as never,
      );

      await expect(
        handler.execute({ invoiceId: 'inv-1', amount: 3000, method: PaymentMethod.CASH }),
      ).rejects.toThrow(BadRequestException);
      expect(tx.payment.create).not.toHaveBeenCalled();
    });

    it('accepts the full total directly → PAID + PaymentCompletedEvent', async () => {
      const tx = buildDepositTx({
        invoice: { findFirst: jest.fn().mockResolvedValue(depositInvoice), update: jest.fn() },
        payment: {
          findFirst: jest.fn().mockResolvedValue(mockPayment),
          create: jest.fn().mockResolvedValue({ ...mockPayment, amount: 23000 }),
          aggregate: jest
            .fn()
            .mockResolvedValueOnce({ _sum: { amount: 0 } })
            .mockResolvedValueOnce({ _sum: { amount: 23000 } }),
        },
      });
      const prisma = buildPrisma(tx);
      const eventBus = buildEventBus();
      const handler = new ProcessPaymentHandler(
        prisma as never,
        { withTransaction: jest.fn((fn: any) => fn(tx)) } as never,
        eventBus as never,
      );

      await handler.execute({ invoiceId: 'inv-1', amount: 23000, method: PaymentMethod.CASH });

      expect(tx.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: InvoiceStatus.PAID }) }),
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        'finance.payment.completed',
        expect.anything(),
      );
      expect(eventBus.publish).not.toHaveBeenCalledWith(
        'finance.payment.deposit_paid',
        expect.anything(),
      );
    });

    it('settling the remaining balance from DEPOSIT_PAID → PAID + PaymentCompletedEvent', async () => {
      // 5000 deposit already collected; client pays the remaining 18000.
      const tx = buildDepositTx({
        invoice: { findFirst: jest.fn().mockResolvedValue(depositInvoice), update: jest.fn() },
        payment: {
          findFirst: jest.fn().mockResolvedValue(mockPayment),
          create: jest.fn().mockResolvedValue({ ...mockPayment, amount: 18000 }),
          // (1) outstanding check: 5000 already paid → 18000 outstanding.
          // (2) post-create total: 23000 paid → PAID.
          aggregate: jest
            .fn()
            .mockResolvedValueOnce({ _sum: { amount: 5000 } })
            .mockResolvedValueOnce({ _sum: { amount: 23000 } }),
        },
      });
      const prisma = buildPrisma(tx);
      const eventBus = buildEventBus();
      const handler = new ProcessPaymentHandler(
        prisma as never,
        { withTransaction: jest.fn((fn: any) => fn(tx)) } as never,
        eventBus as never,
      );

      await handler.execute({ invoiceId: 'inv-1', amount: 18000, method: PaymentMethod.CASH });

      expect(eventBus.publish).toHaveBeenCalledWith(
        'finance.payment.completed',
        expect.anything(),
      );
      expect(eventBus.publish).not.toHaveBeenCalledWith(
        'finance.payment.deposit_paid',
        expect.anything(),
      );
    });
  });
});
