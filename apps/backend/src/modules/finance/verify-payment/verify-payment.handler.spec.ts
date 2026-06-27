import { InvoiceStatus, PaymentStatus } from '@prisma/client';
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
  currency: 'SAR',
  total: 23000,
};

/** Build a tx + handler pair with sensible defaults for the happy approve path. */
const buildDeps = (overrides: {
  payment?: { id: string; invoiceId: string; status: PaymentStatus; amount: number; gatewayRef: string | null } | null;
  invoice?: Record<string, unknown> | null;
  totalPaid?: number;
  // Default: no deposit (so the deposit-event branch is inert unless overridden)
  depositAmount?: number | null;
  // The handler reads the invoice again OUTSIDE the transaction to build the
  // event payload. Default: a minimal booking+currency snapshot.
  postTxInvoice?: Record<string, unknown> | null;
} = {}) => {
  const payment = overrides.payment === null ? null : overrides.payment ?? PENDING_PAYMENT;
  const invoice = overrides.invoice === null ? null : overrides.invoice ?? INVOICE_FULL;
  const totalPaid = overrides.totalPaid ?? 23000;
  const postTxInvoice =
    overrides.postTxInvoice === null
      ? null
      : overrides.postTxInvoice ?? { id: 'inv-1', bookingId: 'book-1', currency: 'SAR' };

  const tx = {
    payment: {
      findFirst: jest.fn().mockResolvedValue(payment),
      update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...payment, ...data }),
      ),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: totalPaid } }),
    },
    invoice: {
      findFirst: jest
        .fn()
        .mockImplementation((args?: { select?: Record<string, boolean> }) => {
          // Two calls: one inside the tx (no select → full row), one outside
          // (with select → snapshot used for the event payload).
          if (args?.select) return Promise.resolve(postTxInvoice);
          return Promise.resolve(invoice);
        }),
      update: jest.fn().mockResolvedValue({ ...INVOICE_FULL, status: InvoiceStatus.PAID }),
    },
    booking: {
      findFirst: jest.fn().mockResolvedValue({ serviceId: 'svc-1' }),
    },
    service: {
      findFirst: jest
        .fn()
        .mockResolvedValue({
          depositEnabled: (overrides.depositAmount ?? null) != null,
          depositAmount: overrides.depositAmount ?? null,
        }),
    },
  };

  const prisma = {
    payment: {
      findFirst: jest.fn().mockResolvedValue(payment),
      update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...payment, ...data }),
      ),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: totalPaid } }),
    },
    invoice: {
      findFirst: jest
        .fn()
        .mockImplementation((args?: { select?: Record<string, boolean> }) => {
          if (args?.select) return Promise.resolve(postTxInvoice);
          return Promise.resolve(invoice);
        }),
    },
  };

  const rlsTransaction = {
    withTransaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
  };
  const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new VerifyPaymentHandler(
    prisma as never,
    rlsTransaction as never,
    eventBus as never,
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

  it('throws BadRequestException when the payment is not in PENDING_VERIFICATION (P0 double-approve guard)', async () => {
    // Approving a payment that is already COMPLETED, FAILED, REFUNDED, or
    // PENDING (not pending-verification) is rejected without mutation.
    const { handler, prisma } = buildDeps({
      payment: { ...PENDING_PAYMENT, status: PaymentStatus.COMPLETED },
    });

    await expect(
      handler.execute({ paymentId: 'pay-1', action: 'approve' }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.payment.update).not.toHaveBeenCalled();
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

  // ── Reject path ───────────────────────────────────────────────────────────

  it('on REJECT flips the payment to FAILED with reason "Bank transfer rejected" and emits NO event', async () => {
    const { handler, prisma, eventBus } = buildDeps();
    const result = await handler.execute({ paymentId: 'pay-1', action: 'reject' });

    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay-1' },
      data: { status: PaymentStatus.FAILED, failureReason: 'Bank transfer rejected' },
    });
    expect(result.status).toBe(PaymentStatus.FAILED);
    // Reject is silent on the bus: no PaymentCompletedEvent, no DepositPaidEvent.
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  // ── Approve: full settlement → PAID + PaymentCompletedEvent ──────────────

  it('on APPROVE flips the payment to COMPLETED, marks the invoice PAID, and emits PaymentCompletedEvent', async () => {
    const { handler, prisma, tx, eventBus } = buildDeps();
    const result = await handler.execute({ paymentId: 'pay-1', action: 'approve' });

    // Payment transitioned to COMPLETED with processedAt stamped.
    expect(tx.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay-1' },
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
    expect(result.status).toBe(PaymentStatus.COMPLETED);
  });

  it('uses the supplied transferRef as the new gatewayRef on approve', async () => {
    const { handler, tx } = buildDeps();
    await handler.execute({ paymentId: 'pay-1', action: 'approve', transferRef: 'BANK-TRF-789' });
    expect(tx.payment.update).toHaveBeenCalledWith(
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
    expect(tx.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ gatewayRef: 'existing-ref-42' }),
      }),
    );
  });

  // ── Approve: partial → PARTIALLY_PAID + (DepositPaidEvent OR no event) ───

  it('on APPROVE of a partial payment marks the invoice PARTIALLY_PAID and does NOT emit PaymentCompletedEvent', async () => {
    // Total 23000, but only 10000 paid → strictly less than total → PARTIALLY_PAID,
    // and the deposit branch is inert (no deposit configured on the service).
    const { handler, tx, eventBus } = buildDeps({ totalPaid: 10000 });
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
          amount: 23000, // payment.amount
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
    // PAID case
    const { tx: tx1 } = buildDeps();
    await new VerifyPaymentHandler(
      { payment: { findFirst: jest.fn().mockResolvedValue(PENDING_PAYMENT), update: jest.fn(), aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 23000 } }) },
        invoice: { findFirst: jest.fn() },
      } as never,
      { withTransaction: (fn: (tx: unknown) => Promise<unknown>) => fn(tx1) } as never,
      { publish: jest.fn() } as never,
    ).execute({ paymentId: 'pay-1', action: 'approve' });
    const paidCallData = tx1.invoice.update.mock.calls[0][0].data;
    expect(paidCallData.paidAt).toBeInstanceOf(Date);

    // PARTIALLY_PAID case
    const { tx: tx2 } = buildDeps({ totalPaid: 10000 });
    await new VerifyPaymentHandler(
      { payment: { findFirst: jest.fn().mockResolvedValue(PENDING_PAYMENT), update: jest.fn(), aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 10000 } }) },
        invoice: { findFirst: jest.fn() },
      } as never,
      { withTransaction: (fn: (tx: unknown) => Promise<unknown>) => fn(tx2) } as never,
      { publish: jest.fn() } as never,
    ).execute({ paymentId: 'pay-1', action: 'approve' });
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

  it('does NOT emit PaymentCompletedEvent when the post-tx invoice snapshot is missing (defensive)', async () => {
    // Edge case: the invoice was deleted between the tx finalize and the
    // event-emit read. The handler must not throw, must not emit a half-formed
    // PaymentCompletedEvent.
    const { handler, eventBus } = buildDeps({ postTxInvoice: null });
    await handler.execute({ paymentId: 'pay-1', action: 'approve' });
    expect(eventBus.publish).not.toHaveBeenCalled();
  });
});
