import { BookingStatus, InvoiceStatus, PaymentStatus } from '@prisma/client';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { VerifyPaymentHandler } from './verify-payment.handler';
import { DEFAULT_ORG_ID } from '../../../common/constants';

// ---------------------------------------------------------------------------
// VerifyPaymentHandler
//
// The "verify a bank-transfer payment" flow:
//   * `action: 'approve'` → payment COMPLETED + invoice recomputed
//     (PAID vs PARTIALLY_PAID) + emits PaymentCompletedEvent OR
//     DepositPaidEvent depending on whether the just-applied amount is the
//     exact deposit with a balance still due.
//   * `action: 'reject'` → payment FAILED with a reason.
//
// Guards:
//   * payment must exist (NotFoundException otherwise);
//   * payment.status must be PENDING_VERIFICATION — the double-approve guard
//     (P0 guard) plus the legitimate "already done" path surface as
//     BadRequestException;
//   * invoice referenced by the payment must exist on the approve path
//     (NotFoundException otherwise).
// ---------------------------------------------------------------------------

const PENDING_PAYMENT = {
  id: 'pay-1',
  invoiceId: 'inv-1',
  status: PaymentStatus.PENDING_VERIFICATION,
  amount: 23000,
  gatewayRef: null,
};

const INVOICE_FULL = {
  id: 'inv-1',
  bookingId: 'book-1',
  packagePurchaseId: null,
  currency: 'SAR',
  total: 23000,
  status: InvoiceStatus.DRAFT,
  issuedAt: null,
};

/** Build a tx + handler pair with sensible defaults for the happy approve path. */
const buildDeps = (overrides: {
  payment?: { id: string; invoiceId: string; status: PaymentStatus; amount: number; gatewayRef: string | null } | null;
  invoice?: Record<string, unknown> | null;
  totalPaid?: number;
  // Default: no deposit (so the deposit-event branch is inert unless overridden)
  depositAmount?: number | null;
} = {}) => {
  const payment = overrides.payment === null ? null : overrides.payment ?? PENDING_PAYMENT;
  const invoice = overrides.invoice === null ? null : overrides.invoice ?? INVOICE_FULL;
  const totalPaid = overrides.totalPaid ?? 23000;
  const completedBefore = Math.max(0, totalPaid - Number(payment?.amount ?? 0));
  let currentPayment = payment;
  const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };

  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'inv-1' }]),
    payment: {
      findFirst: jest.fn().mockImplementation(() => Promise.resolve(currentPayment)),
      findFirstOrThrow: jest.fn().mockImplementation(() => Promise.resolve(currentPayment)),
      updateMany: jest.fn().mockImplementation(({ where, data }: {
        where: { status: PaymentStatus };
        data: Record<string, unknown>;
      }) => {
        if (!currentPayment || currentPayment.status !== where.status) {
          return Promise.resolve({ count: 0 });
        }
        currentPayment = { ...currentPayment, ...data } as typeof currentPayment;
        return Promise.resolve({ count: 1 });
      }),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: completedBefore } }),
    },
    invoice: {
      findFirst: jest.fn().mockResolvedValue(invoice),
      update: jest.fn().mockResolvedValue({ ...INVOICE_FULL, status: InvoiceStatus.PAID }),
    },
    booking: {
      findFirst: jest.fn().mockResolvedValue({
        serviceId: 'svc-1',
        status: BookingStatus.CONFIRMED,
      }),
    },
    service: {
      findFirst: jest
        .fn()
        .mockResolvedValue({
          depositEnabled: (overrides.depositAmount ?? null) != null,
          depositAmount: overrides.depositAmount ?? null,
        }),
    },
    outboxEvent: {
      create: jest.fn().mockImplementation(({ data }: { data: { eventType: string; payload: unknown } }) => {
        void eventBus.publish(data.eventType, data.payload);
        return Promise.resolve(data);
      }),
    },
  };

  const prisma = {
    payment: {
      findFirst: jest.fn().mockResolvedValue(payment),
    },
  };

  let transactionTail = Promise.resolve<unknown>(undefined);
  const rlsTransaction = {
    withTransaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => {
      const run = transactionTail.then(() => fn(tx));
      transactionTail = run.catch(() => undefined);
      return run;
    }),
  };

  const handler = new VerifyPaymentHandler(
    prisma as never,
    rlsTransaction as never,
  );

  return { handler, prisma, tx, rlsTransaction, eventBus };
};

describe('VerifyPaymentHandler', () => {
  // ── Guards / failure paths ────────────────────────────────────────────────

  it('throws NotFoundException when the payment does not exist', async () => {
    const { handler } = buildDeps({ payment: null });
    await expect(
      handler.execute({ paymentId: 'missing', action: 'approve' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException on reject when the payment does not exist', async () => {
    const { handler } = buildDeps({ payment: null });
    await expect(
      handler.execute({ paymentId: 'missing', action: 'reject' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('treats a repeated approval of an already COMPLETED payment as an idempotent replay', async () => {
    const { handler, tx } = buildDeps({
      payment: { ...PENDING_PAYMENT, status: PaymentStatus.COMPLETED },
    });

    await expect(
      handler.execute({ paymentId: 'pay-1', action: 'approve' }),
    ).resolves.toMatchObject({ id: 'pay-1', status: PaymentStatus.COMPLETED });
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when the payment is PENDING (not PENDING_VERIFICATION)', async () => {
    const { handler } = buildDeps({
      payment: { ...PENDING_PAYMENT, status: PaymentStatus.PENDING },
    });
    await expect(
      handler.execute({ paymentId: 'pay-1', action: 'approve' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException on approve when the referenced invoice row is missing', async () => {
    // Payment exists, status PENDING_VERIFICATION, but the invoice row it
    // points at has been deleted. Approve path must fail loud, not silently
    // emit a PaymentCompletedEvent.
    const { handler } = buildDeps({ invoice: null });
    await expect(
      handler.execute({ paymentId: 'pay-1', action: 'approve' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects approval when the linked booking is cancelled', async () => {
    const { handler, tx, eventBus } = buildDeps();
    tx.booking.findFirst.mockResolvedValue({
      serviceId: 'svc-1',
      status: BookingStatus.CANCELLED,
    });

    await expect(
      handler.execute({ paymentId: 'pay-1', action: 'approve' }),
    ).rejects.toThrow('cannot accept payments');
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  // ── Reject path ───────────────────────────────────────────────────────────

  it('on REJECT flips the payment to FAILED with reason "Bank transfer rejected" and emits NO event', async () => {
    const { handler, tx, eventBus } = buildDeps();
    const result = await handler.execute({ paymentId: 'pay-1', action: 'reject' });

    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'pay-1', status: PaymentStatus.PENDING_VERIFICATION },
      data: { status: PaymentStatus.FAILED, failureReason: 'Bank transfer rejected' },
    });
    expect(result.status).toBe(PaymentStatus.FAILED);
    // Reject is silent on the bus: no PaymentCompletedEvent, no DepositPaidEvent.
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  // ── Approve: full settlement → PAID + PaymentCompletedEvent ──────────────

  it('on APPROVE flips the payment to COMPLETED, marks the invoice PAID, and emits PaymentCompletedEvent', async () => {
    const { handler, tx, eventBus } = buildDeps();
    const result = await handler.execute({ paymentId: 'pay-1', action: 'approve' });

    // Payment transitioned to COMPLETED with processedAt stamped.
    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'pay-1' }),
        data: expect.objectContaining({
          status: PaymentStatus.COMPLETED,
          processedAt: expect.any(Date),
        }),
      }),
    );
    // Invoice update reads the aggregate sum vs. invoice.total → PAID.
    expect(tx.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: InvoiceStatus.PAID }),
      }),
    );
    // PaymentCompletedEvent with organizationId populated.
    expect(eventBus.publish).toHaveBeenCalledWith(
      'finance.payment.completed',
      expect.objectContaining({
        payload: expect.objectContaining({
          paymentId: 'pay-1',
          invoiceId: 'inv-1',
          bookingId: 'book-1',
          amount: 23000,
          currency: 'SAR',
          organizationId: DEFAULT_ORG_ID,
        }),
      }),
    );
    expect(tx.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'finance.payment.completed',
          status: 'PENDING_V2',
          deliveryLane: 'PENDING_V2',
        }),
      }),
    );
    expect(result.status).toBe(PaymentStatus.COMPLETED);
  });

  it('uses the supplied transferRef as the new gatewayRef on approve', async () => {
    const { handler, tx } = buildDeps();
    await handler.execute({ paymentId: 'pay-1', action: 'approve', transferRef: 'BANK-TRF-789' });
    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ gatewayRef: 'BANK-TRF-789' }),
      }),
    );
  });

  it('preserves the existing gatewayRef when no transferRef is supplied on approve', async () => {
    const { handler, tx } = buildDeps({
      payment: { ...PENDING_PAYMENT, gatewayRef: 'existing-ref-42' },
    });
    await handler.execute({ paymentId: 'pay-1', action: 'approve' });
    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ gatewayRef: 'existing-ref-42' }),
      }),
    );
  });

  // ── Approve: partial → PARTIALLY_PAID + (DepositPaidEvent OR no event) ───

  it('on APPROVE of a partial payment marks the invoice PARTIALLY_PAID and does NOT emit PaymentCompletedEvent', async () => {
    // Total 23000, but only 10000 paid → strictly less than total → PARTIALLY_PAID,
    // and the deposit branch is inert (no deposit configured on the service).
    const { handler, tx, eventBus } = buildDeps({
      payment: { ...PENDING_PAYMENT, amount: 10000 },
      totalPaid: 10000,
    });
    await handler.execute({ paymentId: 'pay-1', action: 'approve' });

    expect(tx.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: InvoiceStatus.PARTIALLY_PAID }),
      }),
    );
    // PARTIALLY_PAID + no deposit → no event at all.
    expect(eventBus.publish).not.toHaveBeenCalledWith(
      'finance.payment.completed',
      expect.anything(),
    );
    expect(eventBus.publish).not.toHaveBeenCalledWith(
      'finance.payment.deposit_paid',
      expect.anything(),
    );
  });

  it('on APPROVE of the exact deposit → PARTIALLY_PAID + emits DepositPaidEvent (not PaymentCompletedEvent)', async () => {
    // Service has a 5000-halala deposit; the bank-transfer payment's amount
    // happens to equal the deposit. totalPaid (Σ COMPLETED) is 5000 → strictly
    // less than invoice.total 23000 → PARTIALLY_PAID. Deposit branch fires
    // (paidAfter === depositAmount) and emits DepositPaidEvent.
    const { handler, tx, eventBus } = buildDeps({
      payment: { ...PENDING_PAYMENT, amount: 5000 },
      totalPaid: 5000,
      depositAmount: 5000,
    });
    await handler.execute({ paymentId: 'pay-1', action: 'approve' });

    expect(tx.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: InvoiceStatus.PARTIALLY_PAID }),
      }),
    );
    // The event payload carries the payment's amount (the one being verified),
    // not the deposit amount — the deposit only governs the *rule* that picks
    // which event to emit.
    expect(eventBus.publish).toHaveBeenCalledWith(
      'finance.payment.deposit_paid',
      expect.objectContaining({
        payload: expect.objectContaining({
          paymentId: 'pay-1',
          invoiceId: 'inv-1',
          bookingId: 'book-1',
          amount: 5000,
          currency: 'SAR',
          organizationId: DEFAULT_ORG_ID,
        }),
      }),
    );
    // Critical: do NOT emit PaymentCompletedEvent on a deposit payment.
    expect(eventBus.publish).not.toHaveBeenCalledWith(
      'finance.payment.completed',
      expect.anything(),
    );
  });

  it('stamps paidAt on the invoice when it transitions to PAID; omits it on PARTIALLY_PAID', async () => {
    const { handler: paidHandler, tx: tx1 } = buildDeps();
    await paidHandler.execute({ paymentId: 'pay-1', action: 'approve' });
    const paidCallData = tx1.invoice.update.mock.calls[0][0].data;
    expect(paidCallData.paidAt).toBeInstanceOf(Date);

    const { handler: partialHandler, tx: tx2 } = buildDeps({
      payment: { ...PENDING_PAYMENT, amount: 10000 },
      totalPaid: 10000,
    });
    await partialHandler.execute({ paymentId: 'pay-1', action: 'approve' });
    const partialCallData = tx2.invoice.update.mock.calls[0][0].data;
    expect(partialCallData.paidAt).toBeUndefined();
  });

  it('P1-7: stamps issuedAt on a DRAFT invoice when approval lifts it to PAID', async () => {
    // INVOICE_FULL has no issuedAt (a DRAFT bank-transfer invoice). On approve
    // the handler must stamp it — mirroring process-payment + moyasar-webhook —
    // so bank-transfer invoices are not left with a NULL issuedAt.
    const { handler, tx } = buildDeps();
    await handler.execute({ paymentId: 'pay-1', action: 'approve' });
    const callData = tx.invoice.update.mock.calls[0][0].data;
    expect(callData.issuedAt).toBeInstanceOf(Date);
  });

  it('P1-7: preserves an existing issuedAt instead of overwriting it on approve', async () => {
    const existing = new Date('2026-01-01T00:00:00.000Z');
    const { handler, tx } = buildDeps({
      invoice: { ...INVOICE_FULL, issuedAt: existing },
    });
    await handler.execute({ paymentId: 'pay-1', action: 'approve' });
    const callData = tx.invoice.update.mock.calls[0][0].data;
    expect(callData.issuedAt).toBe(existing);
  });

  it('serializes concurrent duplicate approvals and stages exactly one event', async () => {
    const { handler, tx } = buildDeps();

    const [first, second] = await Promise.all([
      handler.execute({ paymentId: 'pay-1', action: 'approve' }),
      handler.execute({ paymentId: 'pay-1', action: 'approve' }),
    ]);

    expect(first.status).toBe(PaymentStatus.COMPLETED);
    expect(second.status).toBe(PaymentStatus.COMPLETED);
    expect(tx.payment.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.outboxEvent.create).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('rejects an approval that would exceed the outstanding invoice balance', async () => {
    const { handler, tx } = buildDeps({
      payment: { ...PENDING_PAYMENT, amount: 5000 },
      totalPaid: 25000,
    });

    await expect(
      handler.execute({ paymentId: 'pay-1', action: 'approve' }),
    ).rejects.toThrow('exceeds outstanding balance');
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });
});
