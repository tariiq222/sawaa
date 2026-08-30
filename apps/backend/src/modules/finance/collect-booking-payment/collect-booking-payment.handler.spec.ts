import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import {
  CollectBookingPaymentHandler,
  collectRequestFingerprint,
} from './collect-booking-payment.handler';

const BOOKING_ID = '00000000-0000-4000-a000-000000000001';
const INVOICE_ID = '00000000-0000-4000-a000-000000000010';
const PAYMENT_ID = '00000000-0000-4000-a000-000000000020';
const APPLIED_BY = '00000000-0000-4000-a000-000000000099';

const baseEnsured = {
  id: INVOICE_ID,
  subtotal: 40000,
  vatRate: 0,
  total: 40000,
  outstanding: 40000,
  status: 'ISSUED',
};

const TX = { id: 'collect-tx' };

const ABORTED_TX_MESSAGE =
  'current transaction is aborted, commands ignored until end of transaction block';

function uniqueConstraintError() {
  return new Prisma.PrismaClientKnownRequestError('unique violation', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

function abortedTxError() {
  return new Error(ABORTED_TX_MESSAGE);
}

function buildIdempotencyTx(id: string) {
  return {
    id,
    paymentCollectionIdempotency: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'idem-row' }),
      update: jest.fn().mockResolvedValue({ id: 'idem-row' }),
    },
  };
}

function committedCollectionRecord(overrides: Record<string, unknown> = {}) {
  return {
    invoiceId: INVOICE_ID,
    requestFingerprint: collectRequestFingerprint({
      invoiceId: INVOICE_ID,
      method: PaymentMethod.CASH,
    }),
    paymentId: PAYMENT_ID,
    payment: {
      id: PAYMENT_ID,
      amount: 40000,
      method: PaymentMethod.CASH,
      status: PaymentStatus.COMPLETED,
    },
    ...overrides,
  };
}

// The handler reads the invoice shape: once outside the atomic tx (create/
// locate), then post-discount / pre-payment and post-payment inside it.
function build() {
  const tx = {
    id: TX.id,
    paymentCollectionIdempotency: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'idem-row' }),
      update: jest.fn().mockResolvedValue({ id: 'idem-row' }),
    },
  };
  const rlsTransaction = {
    withTransaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
  } as { withTransaction: jest.Mock };
  const ensureBookingInvoice = {
    execute: jest.fn().mockResolvedValue({ ...baseEnsured }),
  };
  const applyInvoiceDiscount = { execute: jest.fn().mockResolvedValue({ id: INVOICE_ID }) };
  const processPayment = {
    execute: jest.fn().mockImplementation((cmd: { amount: number; method: PaymentMethod }) => ({
      id: PAYMENT_ID,
      invoiceId: INVOICE_ID,
      amount: cmd.amount,
      method: cmd.method,
      status: PaymentStatus.COMPLETED,
    })),
    publishDeferredEvents: jest.fn().mockResolvedValue(undefined),
  };
  const handler = new CollectBookingPaymentHandler(
    ensureBookingInvoice as never,
    applyInvoiceDiscount as never,
    processPayment as never,
    rlsTransaction as never,
  );
  return { handler, ensureBookingInvoice, applyInvoiceDiscount, processPayment, tx, rlsTransaction };
}

describe('CollectBookingPaymentHandler', () => {
  it('ensures the invoice, then records the full outstanding when amount is omitted', async () => {
    const { handler, ensureBookingInvoice, applyInvoiceDiscount, processPayment, tx } = build();
    ensureBookingInvoice.execute
      .mockResolvedValueOnce({ ...baseEnsured })
      .mockResolvedValueOnce({ ...baseEnsured })
      .mockResolvedValueOnce({ ...baseEnsured, outstanding: 0, status: 'PAID' });

    const result = await handler.execute({
      bookingId: BOOKING_ID,
      appliedBy: APPLIED_BY,
      method: PaymentMethod.CASH,
    });

    expect(ensureBookingInvoice.execute).toHaveBeenCalledTimes(3);
    expect(ensureBookingInvoice.execute).toHaveBeenNthCalledWith(1, { bookingId: BOOKING_ID });
    expect(ensureBookingInvoice.execute).toHaveBeenNthCalledWith(2, {
      bookingId: BOOKING_ID,
      transaction: tx,
    });
    expect(ensureBookingInvoice.execute).toHaveBeenNthCalledWith(3, {
      bookingId: BOOKING_ID,
      transaction: tx,
    });
    expect(applyInvoiceDiscount.execute).not.toHaveBeenCalled();
    expect(processPayment.execute).toHaveBeenCalledWith({
      invoiceId: INVOICE_ID,
      amount: 40000,
      method: PaymentMethod.CASH,
      idempotencyKey: undefined,
      transaction: tx,
    });
    expect(result.payment).toEqual({
      id: PAYMENT_ID,
      amount: 40000,
      method: PaymentMethod.CASH,
      status: 'COMPLETED',
    });
    expect(result.invoice.outstanding).toBe(0);
    expect(result.invoice.status).toBe('PAID');
    expect(result.payment).not.toBeNull();
  });

  it('forwards an explicit amount when the caller asked for a partial collection', async () => {
    const { handler, ensureBookingInvoice, processPayment, applyInvoiceDiscount, tx } = build();
    ensureBookingInvoice.execute
      .mockResolvedValueOnce({ ...baseEnsured })
      .mockResolvedValueOnce({ ...baseEnsured })
      .mockResolvedValueOnce({ ...baseEnsured, outstanding: 25000 });

    const result = await handler.execute({
      bookingId: BOOKING_ID,
      appliedBy: APPLIED_BY,
      method: PaymentMethod.BANK_TRANSFER,
      amount: 15000,
      idempotencyKey: 'idem-1',
    });

    expect(ensureBookingInvoice.execute).toHaveBeenCalledTimes(3);
    expect(applyInvoiceDiscount.execute).not.toHaveBeenCalled();
    expect(tx.paymentCollectionIdempotency.findUnique).toHaveBeenCalledWith({
      where: { idempotencyKey: 'idem-1' },
      include: { payment: true },
    });
    expect(tx.paymentCollectionIdempotency.create).toHaveBeenCalledWith({
      data: {
        idempotencyKey: 'idem-1',
        invoiceId: INVOICE_ID,
        requestFingerprint: collectRequestFingerprint({
          invoiceId: INVOICE_ID,
          method: PaymentMethod.BANK_TRANSFER,
          amount: 15000,
        }),
      },
    });
    expect(processPayment.execute).toHaveBeenCalledWith({
      invoiceId: INVOICE_ID,
      amount: 15000,
      method: PaymentMethod.BANK_TRANSFER,
      idempotencyKey: 'idem-1',
      transaction: tx,
    });
    expect(tx.paymentCollectionIdempotency.update).toHaveBeenCalledWith({
      where: { idempotencyKey: 'idem-1' },
      data: { paymentId: PAYMENT_ID },
    });
    expect(result.payment?.amount).toBe(15000);
    expect(result.invoice.outstanding).toBe(25000);
    expect(result.invoice.status).toBe('ISSUED');
  });

  it('applies the manual discount BEFORE recording the payment when discountAmt > 0', async () => {
    const { handler, ensureBookingInvoice, applyInvoiceDiscount, processPayment, tx } = build();
    ensureBookingInvoice.execute
      .mockResolvedValueOnce({ ...baseEnsured })
      .mockResolvedValueOnce({ ...baseEnsured, outstanding: 30000, total: 30000 })
      .mockResolvedValueOnce({ ...baseEnsured, outstanding: 0, total: 0, status: 'PAID' });

    const result = await handler.execute({
      bookingId: BOOKING_ID,
      appliedBy: APPLIED_BY,
      method: PaymentMethod.MADA,
      discountAmt: 10000,
      discountReasonId: 'reason-1',
      note: 'approved by manager',
    });

    expect(ensureBookingInvoice.execute).toHaveBeenCalledTimes(3);
    expect(applyInvoiceDiscount.execute).toHaveBeenCalledWith({
      invoiceId: INVOICE_ID,
      appliedBy: APPLIED_BY,
      discountAmt: 10000,
      discountReasonId: 'reason-1',
      note: 'approved by manager',
      transaction: tx,
    });
    expect(processPayment.execute).toHaveBeenCalledWith({
      invoiceId: INVOICE_ID,
      amount: 30000,
      method: PaymentMethod.MADA,
      idempotencyKey: undefined,
      transaction: tx,
    });
    expect(result.invoice.outstanding).toBe(0);
    expect(result.invoice.status).toBe('PAID');
  });

  it('skips applyInvoiceDiscount when discountAmt is 0 (no-op clear)', async () => {
    const { handler, ensureBookingInvoice, applyInvoiceDiscount, processPayment } = build();
    ensureBookingInvoice.execute
      .mockResolvedValueOnce({ ...baseEnsured })
      .mockResolvedValueOnce({ ...baseEnsured })
      .mockResolvedValueOnce({ ...baseEnsured, outstanding: 0, status: 'PAID' });

    await handler.execute({
      bookingId: BOOKING_ID,
      appliedBy: APPLIED_BY,
      method: PaymentMethod.CASH,
      discountAmt: 0,
    });

    expect(ensureBookingInvoice.execute).toHaveBeenCalledTimes(3);
    expect(applyInvoiceDiscount.execute).not.toHaveBeenCalled();
    expect(processPayment.execute).toHaveBeenCalled();
  });

  it('skips processPayment and returns payment:null when outstanding is 0 after the discount (AC-PAY-005)', async () => {
    const { handler, ensureBookingInvoice, applyInvoiceDiscount, processPayment, tx, rlsTransaction } =
      build();
    ensureBookingInvoice.execute
      .mockResolvedValueOnce({ ...baseEnsured })
      .mockResolvedValueOnce({ ...baseEnsured, outstanding: 0, total: 0, status: 'PAID' });

    const result = await handler.execute({
      bookingId: BOOKING_ID,
      appliedBy: APPLIED_BY,
      method: PaymentMethod.CASH,
      discountAmt: 40000,
      discountReasonId: 'reason-1',
    });

    expect(rlsTransaction.withTransaction).toHaveBeenCalledTimes(1);
    expect(ensureBookingInvoice.execute).toHaveBeenCalledTimes(2);
    expect(applyInvoiceDiscount.execute).toHaveBeenCalledWith(
      expect.objectContaining({ transaction: tx, discountAmt: 40000 }),
    );
    expect(processPayment.execute).not.toHaveBeenCalled();
    expect(result.payment).toBeNull();
    expect(result.invoice.outstanding).toBe(0);
  });

  it('rejects ONLINE_CARD before invoking any composed handler (AC-PAY-007)', async () => {
    const { handler, ensureBookingInvoice, applyInvoiceDiscount, processPayment, rlsTransaction } =
      build();

    await expect(
      handler.execute({
        bookingId: BOOKING_ID,
        appliedBy: APPLIED_BY,
        method: PaymentMethod.ONLINE_CARD,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(rlsTransaction.withTransaction).not.toHaveBeenCalled();
    expect(ensureBookingInvoice.execute).not.toHaveBeenCalled();
    expect(applyInvoiceDiscount.execute).not.toHaveBeenCalled();
    expect(processPayment.execute).not.toHaveBeenCalled();
  });

  it('rejects COUPON before invoking any composed handler', async () => {
    const { handler, ensureBookingInvoice, applyInvoiceDiscount, processPayment, rlsTransaction } =
      build();

    await expect(
      handler.execute({
        bookingId: BOOKING_ID,
        appliedBy: APPLIED_BY,
        method: PaymentMethod.COUPON,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(rlsTransaction.withTransaction).not.toHaveBeenCalled();
    expect(ensureBookingInvoice.execute).not.toHaveBeenCalled();
    expect(applyInvoiceDiscount.execute).not.toHaveBeenCalled();
    expect(processPayment.execute).not.toHaveBeenCalled();
  });

  it('propagates ensureBookingInvoice NotFoundException without calling the rest of the pipeline', async () => {
    const { handler, ensureBookingInvoice, applyInvoiceDiscount, processPayment, rlsTransaction } =
      build();
    ensureBookingInvoice.execute.mockRejectedValueOnce(new NotFoundException('Booking missing not found'));

    await expect(
      handler.execute({
        bookingId: BOOKING_ID,
        appliedBy: APPLIED_BY,
        method: PaymentMethod.CASH,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(rlsTransaction.withTransaction).not.toHaveBeenCalled();
    expect(applyInvoiceDiscount.execute).not.toHaveBeenCalled();
    expect(processPayment.execute).not.toHaveBeenCalled();
  });

  it('propagates ensureBookingInvoice historical-import rejection without calling the rest of the pipeline', async () => {
    const { handler, ensureBookingInvoice, applyInvoiceDiscount, processPayment, rlsTransaction } =
      build();
    ensureBookingInvoice.execute.mockRejectedValueOnce(
      new BadRequestException('Historical bookings are read-only and cannot be invoiced'),
    );

    await expect(
      handler.execute({
        bookingId: BOOKING_ID,
        appliedBy: APPLIED_BY,
        method: PaymentMethod.CASH,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(rlsTransaction.withTransaction).not.toHaveBeenCalled();
    expect(applyInvoiceDiscount.execute).not.toHaveBeenCalled();
    expect(processPayment.execute).not.toHaveBeenCalled();
  });

  it('rolls back the discount when recording the payment fails (AC-PAY-008)', async () => {
    const mutations: string[] = [];
    const { handler, ensureBookingInvoice, applyInvoiceDiscount, processPayment, tx, rlsTransaction } =
      build();
    rlsTransaction.withTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => {
      try {
        return await fn(tx);
      } catch (err) {
        mutations.length = 0;
        throw err;
      }
    });
    ensureBookingInvoice.execute
      .mockResolvedValueOnce({ ...baseEnsured })
      .mockResolvedValueOnce({ ...baseEnsured, outstanding: 30000, total: 30000 });
    applyInvoiceDiscount.execute.mockImplementation(async () => {
      mutations.push('discount');
    });
    processPayment.execute.mockImplementation(async () => {
      mutations.push('payment');
      throw new Error('payment write failed');
    });

    await expect(
      handler.execute({
        bookingId: BOOKING_ID,
        appliedBy: APPLIED_BY,
        method: PaymentMethod.CASH,
        discountAmt: 10000,
        discountReasonId: 'reason-1',
      }),
    ).rejects.toThrow('payment write failed');

    expect(mutations).toEqual([]);
    expect(applyInvoiceDiscount.execute).toHaveBeenCalledWith(expect.objectContaining({ transaction: tx }));
    expect(processPayment.execute).toHaveBeenCalledWith(expect.objectContaining({ transaction: tx }));
  });

  it('replays the same idempotencyKey without a second payment or discount (AC-PAY-004)', async () => {
    const { handler, ensureBookingInvoice, applyInvoiceDiscount, processPayment, tx } = build();
    tx.paymentCollectionIdempotency.findUnique.mockResolvedValue({
      invoiceId: INVOICE_ID,
      requestFingerprint: collectRequestFingerprint({
        invoiceId: INVOICE_ID,
        method: PaymentMethod.CASH,
        discountAmt: 10000,
        discountReasonId: 'reason-1',
      }),
      paymentId: PAYMENT_ID,
      payment: {
        id: PAYMENT_ID,
        amount: 40000,
        method: PaymentMethod.CASH,
        status: PaymentStatus.COMPLETED,
      },
    });
    ensureBookingInvoice.execute
      .mockResolvedValueOnce({ ...baseEnsured })
      .mockResolvedValueOnce({ ...baseEnsured, outstanding: 0, status: 'PAID' });

    const result = await handler.execute({
      bookingId: BOOKING_ID,
      appliedBy: APPLIED_BY,
      method: PaymentMethod.CASH,
      discountAmt: 10000,
      discountReasonId: 'reason-1',
      idempotencyKey: 'idem-retry',
    });

    expect(applyInvoiceDiscount.execute).not.toHaveBeenCalled();
    expect(processPayment.execute).not.toHaveBeenCalled();
    expect(tx.paymentCollectionIdempotency.create).not.toHaveBeenCalled();
    expect(result.payment).toEqual({
      id: PAYMENT_ID,
      amount: 40000,
      method: PaymentMethod.CASH,
      status: PaymentStatus.COMPLETED,
    });
    expect(result.invoice.outstanding).toBe(0);
    expect(result.invoice.status).toBe('PAID');
    expect(processPayment.publishDeferredEvents).toHaveBeenCalledWith([]);
  });

  it('joins discount, payment, and rereads on one transaction client', async () => {
    const { handler, ensureBookingInvoice, applyInvoiceDiscount, processPayment, tx, rlsTransaction } =
      build();
    ensureBookingInvoice.execute
      .mockResolvedValueOnce({ ...baseEnsured })
      .mockResolvedValueOnce({ ...baseEnsured, outstanding: 30000, total: 30000 })
      .mockResolvedValueOnce({ ...baseEnsured, outstanding: 0, status: 'PAID' });

    await handler.execute({
      bookingId: BOOKING_ID,
      appliedBy: APPLIED_BY,
      method: PaymentMethod.CASH,
      discountAmt: 10000,
      discountReasonId: 'reason-1',
    });

    expect(rlsTransaction.withTransaction).toHaveBeenCalledTimes(1);
    expect(applyInvoiceDiscount.execute.mock.calls[0][0].transaction).toBe(tx);
    expect(processPayment.execute.mock.calls[0][0].transaction).toBe(tx);
    expect(ensureBookingInvoice.execute.mock.calls[1][0].transaction).toBe(tx);
    expect(ensureBookingInvoice.execute.mock.calls[2][0].transaction).toBe(tx);
  });

  it('replays an identical 100% discount retry without a payment row (AC-PAY-004/005)', async () => {
    const { handler, ensureBookingInvoice, applyInvoiceDiscount, processPayment, tx } = build();
    tx.paymentCollectionIdempotency.findUnique.mockResolvedValue({
      invoiceId: INVOICE_ID,
      requestFingerprint: collectRequestFingerprint({
        invoiceId: INVOICE_ID,
        method: PaymentMethod.CASH,
        discountAmt: 40000,
        discountReasonId: 'reason-1',
      }),
      paymentId: null,
      payment: null,
    });
    ensureBookingInvoice.execute
      .mockResolvedValueOnce({ ...baseEnsured })
      .mockResolvedValueOnce({ ...baseEnsured, outstanding: 0, total: 0, status: 'PAID' });

    const result = await handler.execute({
      bookingId: BOOKING_ID,
      appliedBy: APPLIED_BY,
      method: PaymentMethod.CASH,
      discountAmt: 40000,
      discountReasonId: 'reason-1',
      idempotencyKey: 'idem-full-discount',
    });

    expect(applyInvoiceDiscount.execute).not.toHaveBeenCalled();
    expect(processPayment.execute).not.toHaveBeenCalled();
    expect(tx.paymentCollectionIdempotency.create).not.toHaveBeenCalled();
    expect(result.payment).toBeNull();
    expect(result.invoice.outstanding).toBe(0);
    expect(processPayment.publishDeferredEvents).toHaveBeenCalledWith([]);
  });

  it('rejects the same key when the note changed because note is part of the fingerprint', async () => {
    const storedFingerprint = collectRequestFingerprint({
      invoiceId: INVOICE_ID,
      method: PaymentMethod.CASH,
      discountAmt: 10000,
      discountReasonId: 'reason-1',
      note: 'approved by manager',
    });
    const changedNoteFingerprint = collectRequestFingerprint({
      invoiceId: INVOICE_ID,
      method: PaymentMethod.CASH,
      discountAmt: 10000,
      discountReasonId: 'reason-1',
      note: 'different approval',
    });
    const omittedNoteFingerprint = collectRequestFingerprint({
      invoiceId: INVOICE_ID,
      method: PaymentMethod.CASH,
      discountAmt: 10000,
      discountReasonId: 'reason-1',
    });
    expect(storedFingerprint).not.toBe(changedNoteFingerprint);
    expect(storedFingerprint).not.toBe(omittedNoteFingerprint);
    expect(omittedNoteFingerprint).toBe(
      collectRequestFingerprint({
        invoiceId: INVOICE_ID,
        method: PaymentMethod.CASH,
        discountAmt: 10000,
        discountReasonId: 'reason-1',
        note: undefined,
      }),
    );

    const { handler, applyInvoiceDiscount, processPayment, tx } = build();
    tx.paymentCollectionIdempotency.findUnique.mockResolvedValue({
      invoiceId: INVOICE_ID,
      requestFingerprint: storedFingerprint,
      paymentId: PAYMENT_ID,
      payment: {
        id: PAYMENT_ID,
        amount: 30000,
        method: PaymentMethod.CASH,
        status: PaymentStatus.COMPLETED,
      },
    });

    await expect(
      handler.execute({
        bookingId: BOOKING_ID,
        appliedBy: APPLIED_BY,
        method: PaymentMethod.CASH,
        discountAmt: 10000,
        discountReasonId: 'reason-1',
        note: 'different approval',
        idempotencyKey: 'idem-note-conflict',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(applyInvoiceDiscount.execute).not.toHaveBeenCalled();
    expect(processPayment.execute).not.toHaveBeenCalled();
    expect(tx.paymentCollectionIdempotency.create).not.toHaveBeenCalled();
    expect(processPayment.publishDeferredEvents).not.toHaveBeenCalled();
  });

  it('rejects a conflicting retry against a fully discounted invoice without mutating', async () => {
    const { handler, applyInvoiceDiscount, processPayment, tx } = build();
    tx.paymentCollectionIdempotency.findUnique.mockResolvedValue({
      invoiceId: INVOICE_ID,
      requestFingerprint: collectRequestFingerprint({
        invoiceId: INVOICE_ID,
        method: PaymentMethod.CASH,
        discountAmt: 40000,
        discountReasonId: 'reason-1',
      }),
      paymentId: null,
      payment: null,
    });

    await expect(
      handler.execute({
        bookingId: BOOKING_ID,
        appliedBy: APPLIED_BY,
        method: PaymentMethod.CASH,
        discountAmt: 10000,
        discountReasonId: 'reason-2',
        amount: 5000,
        idempotencyKey: 'idem-conflict',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(applyInvoiceDiscount.execute).not.toHaveBeenCalled();
    expect(processPayment.execute).not.toHaveBeenCalled();
    expect(tx.paymentCollectionIdempotency.create).not.toHaveBeenCalled();
    expect(processPayment.publishDeferredEvents).not.toHaveBeenCalled();
  });

  it('rejects cross-invoice idempotencyKey reuse before applying a discount', async () => {
    const { handler, applyInvoiceDiscount, processPayment, tx } = build();
    tx.paymentCollectionIdempotency.findUnique.mockResolvedValue({
      invoiceId: '00000000-0000-4000-a000-000000000099',
      requestFingerprint: collectRequestFingerprint({
        invoiceId: '00000000-0000-4000-a000-000000000099',
        method: PaymentMethod.CASH,
        discountAmt: 10000,
        discountReasonId: 'reason-1',
      }),
      paymentId: PAYMENT_ID,
      payment: {
        id: PAYMENT_ID,
        amount: 40000,
        method: PaymentMethod.CASH,
        status: PaymentStatus.COMPLETED,
      },
    });

    await expect(
      handler.execute({
        bookingId: BOOKING_ID,
        appliedBy: APPLIED_BY,
        method: PaymentMethod.CASH,
        discountAmt: 10000,
        discountReasonId: 'reason-1',
        idempotencyKey: 'idem-stolen',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(applyInvoiceDiscount.execute).not.toHaveBeenCalled();
    expect(processPayment.execute).not.toHaveBeenCalled();
    expect(processPayment.publishDeferredEvents).not.toHaveBeenCalled();
  });

  it('rejects the same key on another invoice after a payment:null full discount', async () => {
    const { handler, applyInvoiceDiscount, processPayment, tx } = build();
    tx.paymentCollectionIdempotency.findUnique.mockResolvedValue({
      invoiceId: '00000000-0000-4000-a000-000000000088',
      requestFingerprint: collectRequestFingerprint({
        invoiceId: '00000000-0000-4000-a000-000000000088',
        method: PaymentMethod.CASH,
        discountAmt: 40000,
        discountReasonId: 'reason-1',
      }),
      paymentId: null,
      payment: null,
    });

    await expect(
      handler.execute({
        bookingId: BOOKING_ID,
        appliedBy: APPLIED_BY,
        method: PaymentMethod.CASH,
        discountAmt: 40000,
        discountReasonId: 'reason-1',
        idempotencyKey: 'idem-full-cross-invoice',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(applyInvoiceDiscount.execute).not.toHaveBeenCalled();
    expect(processPayment.execute).not.toHaveBeenCalled();
    expect(tx.paymentCollectionIdempotency.create).not.toHaveBeenCalled();
    expect(processPayment.publishDeferredEvents).not.toHaveBeenCalled();
  });

  it('persists a full-discount collection against the key without a Payment row (AC-PAY-005)', async () => {
    const { handler, ensureBookingInvoice, applyInvoiceDiscount, processPayment, tx } = build();
    ensureBookingInvoice.execute
      .mockResolvedValueOnce({ ...baseEnsured })
      .mockResolvedValueOnce({ ...baseEnsured, outstanding: 0, total: 0, status: 'PAID' });

    const result = await handler.execute({
      bookingId: BOOKING_ID,
      appliedBy: APPLIED_BY,
      method: PaymentMethod.CASH,
      discountAmt: 40000,
      discountReasonId: 'reason-1',
      idempotencyKey: 'idem-full-first',
    });

    expect(applyInvoiceDiscount.execute).toHaveBeenCalled();
    expect(processPayment.execute).not.toHaveBeenCalled();
    expect(tx.paymentCollectionIdempotency.create).toHaveBeenCalledWith({
      data: {
        idempotencyKey: 'idem-full-first',
        invoiceId: INVOICE_ID,
        requestFingerprint: collectRequestFingerprint({
          invoiceId: INVOICE_ID,
          method: PaymentMethod.CASH,
          discountAmt: 40000,
          discountReasonId: 'reason-1',
        }),
      },
    });
    expect(tx.paymentCollectionIdempotency.update).not.toHaveBeenCalled();
    expect(result.payment).toBeNull();
  });

  it('recovers a collection reservation P2002 race via a fresh tx, never reading the aborted tx', async () => {
    const { handler, ensureBookingInvoice, applyInvoiceDiscount, processPayment, rlsTransaction } =
      build();
    let aborted = false;
    const throwIfAborted = () => {
      if (aborted) throw abortedTxError();
    };
    const failedTx = buildIdempotencyTx('collect-tx-aborted');
    failedTx.paymentCollectionIdempotency.findUnique.mockImplementation(async () => {
      throwIfAborted();
      return null;
    });
    failedTx.paymentCollectionIdempotency.create.mockImplementation(async () => {
      throwIfAborted();
      aborted = true;
      throw uniqueConstraintError();
    });
    failedTx.paymentCollectionIdempotency.update.mockImplementation(async () => {
      throwIfAborted();
    });
    const recoveryTx = buildIdempotencyTx('collect-tx-recovery');
    recoveryTx.paymentCollectionIdempotency.findUnique.mockResolvedValue(committedCollectionRecord());
    rlsTransaction.withTransaction
      .mockImplementationOnce(async (fn: (t: typeof failedTx) => Promise<unknown>) => {
        try {
          return await fn(failedTx);
        } catch (err) {
          aborted = true;
          throw err;
        }
      })
      .mockImplementationOnce(async (fn: (t: typeof recoveryTx) => Promise<unknown>) => fn(recoveryTx));
    ensureBookingInvoice.execute
      .mockResolvedValueOnce({ ...baseEnsured })
      .mockResolvedValueOnce({ ...baseEnsured, outstanding: 0, status: 'PAID' });

    const result = await handler.execute({
      bookingId: BOOKING_ID,
      appliedBy: APPLIED_BY,
      method: PaymentMethod.CASH,
      idempotencyKey: 'idem-race',
    });

    expect(rlsTransaction.withTransaction).toHaveBeenCalledTimes(2);
    expect(failedTx.paymentCollectionIdempotency.findUnique).toHaveBeenCalledTimes(1);
    expect(failedTx.paymentCollectionIdempotency.create).toHaveBeenCalledTimes(1);
    expect(recoveryTx.paymentCollectionIdempotency.findUnique).toHaveBeenCalledTimes(1);
    expect(recoveryTx.paymentCollectionIdempotency.create).not.toHaveBeenCalled();
    expect(applyInvoiceDiscount.execute).not.toHaveBeenCalled();
    expect(processPayment.execute).not.toHaveBeenCalled();
    expect(result.payment).toEqual({
      id: PAYMENT_ID,
      amount: 40000,
      method: PaymentMethod.CASH,
      status: 'COMPLETED',
    });
    expect(processPayment.publishDeferredEvents).toHaveBeenCalledWith([]);
    await expect(failedTx.paymentCollectionIdempotency.findUnique()).rejects.toThrow(ABORTED_TX_MESSAGE);
  });

  it('rejects a P2002 recovery when the committed key belongs to a different invoice', async () => {
    const { handler, applyInvoiceDiscount, processPayment, rlsTransaction } = build();
    let aborted = false;
    const throwIfAborted = () => {
      if (aborted) throw abortedTxError();
    };
    const failedTx = buildIdempotencyTx('collect-tx-aborted');
    failedTx.paymentCollectionIdempotency.findUnique.mockImplementation(async () => {
      throwIfAborted();
      return null;
    });
    failedTx.paymentCollectionIdempotency.create.mockImplementation(async () => {
      aborted = true;
      throw uniqueConstraintError();
    });
    const recoveryTx = buildIdempotencyTx('collect-tx-recovery');
    recoveryTx.paymentCollectionIdempotency.findUnique.mockResolvedValue(
      committedCollectionRecord({ invoiceId: '00000000-0000-4000-a000-000000000099' }),
    );
    rlsTransaction.withTransaction
      .mockImplementationOnce(async (fn: (t: typeof failedTx) => Promise<unknown>) => {
        try {
          return await fn(failedTx);
        } catch (err) {
          aborted = true;
          throw err;
        }
      })
      .mockImplementationOnce(async (fn: (t: typeof recoveryTx) => Promise<unknown>) => fn(recoveryTx));

    await expect(
      handler.execute({
        bookingId: BOOKING_ID,
        appliedBy: APPLIED_BY,
        method: PaymentMethod.CASH,
        idempotencyKey: 'idem-race-conflict',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(rlsTransaction.withTransaction).toHaveBeenCalledTimes(2);
    expect(applyInvoiceDiscount.execute).not.toHaveBeenCalled();
    expect(processPayment.execute).not.toHaveBeenCalled();
    expect(processPayment.publishDeferredEvents).not.toHaveBeenCalled();
  });

  it('rejects a P2002 recovery when the committed key has a different request fingerprint', async () => {
    const { handler, applyInvoiceDiscount, processPayment, rlsTransaction } = build();
    let aborted = false;
    const failedTx = buildIdempotencyTx('collect-tx-aborted');
    failedTx.paymentCollectionIdempotency.findUnique.mockImplementation(async () => {
      if (aborted) throw abortedTxError();
      return null;
    });
    failedTx.paymentCollectionIdempotency.create.mockImplementation(async () => {
      aborted = true;
      throw uniqueConstraintError();
    });
    const recoveryTx = buildIdempotencyTx('collect-tx-recovery');
    recoveryTx.paymentCollectionIdempotency.findUnique.mockResolvedValue(
      committedCollectionRecord({
        requestFingerprint: collectRequestFingerprint({
          invoiceId: INVOICE_ID,
          method: PaymentMethod.CASH,
          amount: 15000,
        }),
      }),
    );
    rlsTransaction.withTransaction
      .mockImplementationOnce(async (fn: (t: typeof failedTx) => Promise<unknown>) => {
        try {
          return await fn(failedTx);
        } catch (err) {
          aborted = true;
          throw err;
        }
      })
      .mockImplementationOnce(async (fn: (t: typeof recoveryTx) => Promise<unknown>) => fn(recoveryTx));

    await expect(
      handler.execute({
        bookingId: BOOKING_ID,
        appliedBy: APPLIED_BY,
        method: PaymentMethod.CASH,
        idempotencyKey: 'idem-race-fingerprint',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(applyInvoiceDiscount.execute).not.toHaveBeenCalled();
    expect(processPayment.execute).not.toHaveBeenCalled();
    expect(processPayment.publishDeferredEvents).not.toHaveBeenCalled();
  });

  it('rolls back the idempotency reservation when payment fails so retry can proceed (AC-PAY-008)', async () => {
    const mutations: string[] = [];
    const { handler, ensureBookingInvoice, applyInvoiceDiscount, processPayment, tx, rlsTransaction } =
      build();
    rlsTransaction.withTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => {
      try {
        return await fn(tx);
      } catch (err) {
        mutations.length = 0;
        throw err;
      }
    });
    tx.paymentCollectionIdempotency.create.mockImplementation(async () => {
      mutations.push('idempotency');
    });
    ensureBookingInvoice.execute
      .mockResolvedValueOnce({ ...baseEnsured })
      .mockResolvedValueOnce({ ...baseEnsured, outstanding: 30000, total: 30000 });
    applyInvoiceDiscount.execute.mockImplementation(async () => {
      mutations.push('discount');
    });
    processPayment.execute.mockImplementation(async () => {
      mutations.push('payment');
      throw new Error('payment write failed');
    });

    await expect(
      handler.execute({
        bookingId: BOOKING_ID,
        appliedBy: APPLIED_BY,
        method: PaymentMethod.CASH,
        discountAmt: 10000,
        discountReasonId: 'reason-1',
        idempotencyKey: 'idem-rollback',
      }),
    ).rejects.toThrow('payment write failed');

    expect(mutations).toEqual([]);
    expect(tx.paymentCollectionIdempotency.create).toHaveBeenCalled();
  });

  it('does not publish payment events when the post-payment reread fails', async () => {
    const { handler, ensureBookingInvoice, processPayment } = build();
    const deferredEvents = [
      { eventName: 'finance.payment.completed', envelope: { payload: { paymentId: PAYMENT_ID } } },
    ];
    processPayment.execute.mockImplementation(async (cmd: { amount: number; method: PaymentMethod }) => ({
      id: PAYMENT_ID,
      invoiceId: INVOICE_ID,
      amount: cmd.amount,
      method: cmd.method,
      status: PaymentStatus.COMPLETED,
      deferredEvents,
    }));
    ensureBookingInvoice.execute
      .mockResolvedValueOnce({ ...baseEnsured })
      .mockResolvedValueOnce({ ...baseEnsured })
      .mockRejectedValueOnce(new Error('post-payment reread failed'));

    await expect(
      handler.execute({
        bookingId: BOOKING_ID,
        appliedBy: APPLIED_BY,
        method: PaymentMethod.CASH,
      }),
    ).rejects.toThrow('post-payment reread failed');

    expect(processPayment.execute).toHaveBeenCalled();
    expect(processPayment.publishDeferredEvents).not.toHaveBeenCalled();
  });

  it('does not publish payment events when the outer commit fails', async () => {
    const { handler, ensureBookingInvoice, processPayment, tx, rlsTransaction } = build();
    const deferredEvents = [
      { eventName: 'finance.payment.completed', envelope: { payload: { paymentId: PAYMENT_ID } } },
    ];
    processPayment.execute.mockImplementation(async (cmd: { amount: number; method: PaymentMethod }) => ({
      id: PAYMENT_ID,
      invoiceId: INVOICE_ID,
      amount: cmd.amount,
      method: cmd.method,
      status: PaymentStatus.COMPLETED,
      deferredEvents,
    }));
    ensureBookingInvoice.execute
      .mockResolvedValueOnce({ ...baseEnsured })
      .mockResolvedValueOnce({ ...baseEnsured })
      .mockResolvedValueOnce({ ...baseEnsured, outstanding: 0, status: 'PAID' });
    rlsTransaction.withTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => {
      await fn(tx);
      throw new Error('commit failed');
    });

    await expect(
      handler.execute({
        bookingId: BOOKING_ID,
        appliedBy: APPLIED_BY,
        method: PaymentMethod.CASH,
      }),
    ).rejects.toThrow('commit failed');

    expect(processPayment.execute).toHaveBeenCalled();
    expect(processPayment.publishDeferredEvents).not.toHaveBeenCalled();
  });

  it('publishes deferred payment events only after the outer transaction commits', async () => {
    const { handler, ensureBookingInvoice, processPayment } = build();
    const deferredEvents = [
      { eventName: 'finance.payment.completed', envelope: { payload: { paymentId: PAYMENT_ID } } },
    ];
    processPayment.execute.mockImplementation(async (cmd: { amount: number; method: PaymentMethod }) => ({
      id: PAYMENT_ID,
      invoiceId: INVOICE_ID,
      amount: cmd.amount,
      method: cmd.method,
      status: PaymentStatus.COMPLETED,
      deferredEvents,
    }));
    ensureBookingInvoice.execute
      .mockResolvedValueOnce({ ...baseEnsured })
      .mockResolvedValueOnce({ ...baseEnsured })
      .mockResolvedValueOnce({ ...baseEnsured, outstanding: 0, status: 'PAID' });

    await handler.execute({
      bookingId: BOOKING_ID,
      appliedBy: APPLIED_BY,
      method: PaymentMethod.CASH,
    });

    expect(processPayment.publishDeferredEvents).toHaveBeenCalledWith(deferredEvents);
  });
});
