import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { ManualRefundPaymentHandler } from './manual-refund-payment.handler';

const dec = (n: number) => new Prisma.Decimal(n);

const basePaymentRow = {
  id: 'pay-1',
  status: PaymentStatus.COMPLETED as string,
  gatewayRef: null as string | null,
  amount: dec(20000),
  refundedAmount: dec(0),
  invoiceId: 'inv-1',
};

const baseInvoice = {
  id: 'inv-1',
  bookingId: 'booking-1',
  clientId: 'client-1',
  currency: 'SAR',
  total: dec(20000),
  vatAmt: dec(0),
  refundedAmount: dec(0),
  refundedVatAmt: dec(0),
};

function build(paymentOverrides: Partial<typeof basePaymentRow> = {}, invoiceOverrides: Partial<typeof baseInvoice> = {}) {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ ...basePaymentRow, ...paymentOverrides }]),
    refundRequest: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({ id: 'rr-1' }),
    },
    invoice: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ ...baseInvoice, ...invoiceOverrides }),
      update: jest.fn().mockResolvedValue({}),
    },
    payment: {
      findUnique: jest.fn().mockResolvedValue({ invoiceId: 'inv-1' }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ ...basePaymentRow, ...paymentOverrides }),
      update: jest.fn().mockImplementation(({ data }) => ({ id: 'pay-1', status: data.status })),
    },
    outboxEvent: {
      create: jest.fn().mockResolvedValue({ id: 'outbox-1' }),
    },
  };
  const prisma = {} as never;
  const rlsTransaction = { withTransaction: jest.fn((cb: (tx: unknown) => Promise<unknown>) => cb(tx)) };
  const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
  const handler = new ManualRefundPaymentHandler(prisma, rlsTransaction as never, eventBus as never);
  return { handler, tx, eventBus };
}

describe('ManualRefundPaymentHandler', () => {
  it('serializes direct manual accounting by locking the invoice before its payment', async () => {
    const { handler, tx } = build();
    await handler.execute({ paymentId: 'pay-1', reason: 'returned' });
    const sql = tx.$queryRaw.mock.calls.map(([query]: any[]) =>
      (Array.isArray(query) ? query : query.strings).join(' '));
    expect(sql[0]).toMatch(/FROM "Invoice".*FOR UPDATE/s);
    expect(sql[1]).toMatch(/FROM "Payment".*FOR UPDATE/s);
  });

  it('fully refunds one payment while other payments keep its invoice partially refunded', async () => {
    const { handler, tx } = build({}, { total: dec(40000) });
    const result = await handler.execute({ paymentId: 'pay-1', reason: 'returned' });
    expect(result.status).toBe(PaymentStatus.REFUNDED);
    expect(tx.invoice.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'PARTIALLY_REFUNDED', refundedAmount: 20000 }),
    }));
  });

  it('settles the exact reviewed request without creating a duplicate reservation or ledger record', async () => {
    const { handler, tx } = build();
    tx.refundRequest.findUnique.mockResolvedValue({ id: 'review-1', paymentId: 'pay-1', invoiceId: 'inv-1', amount: dec(5000), status: 'PENDING_REVIEW', sourceEventId: 'source-event', idempotencyKey: 'refund:review-1' });
    await handler.execute({ paymentId: 'pay-1', reason: 'Cash returned', refundRequestId: 'review-1' } as any);
    expect(tx.refundRequest.create).not.toHaveBeenCalled();
    expect(tx.refundRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'review-1', paymentId: 'pay-1', status: 'PENDING_REVIEW' }, data: expect.objectContaining({ status: 'COMPLETED' }) }));
    expect(tx.payment.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ refundedAmount: { increment: 5000 } }) }));
    expect(tx.outboxEvent.create.mock.calls[0][0].data.payload.payload.refundRequestId).toBe('review-1');
  });

  it('replays a completed manual request without another money mutation or notification event', async () => {
    const { handler, tx } = build({ status: 'REFUNDED', refundedAmount: dec(20000) });
    tx.refundRequest.findUnique.mockResolvedValue({ id: 'review-1', paymentId: 'pay-1', invoiceId: 'inv-1', amount: dec(20000), status: 'COMPLETED' });
    await expect(handler.execute({ paymentId: 'pay-1', reason: 'retry', refundRequestId: 'review-1' } as any)).resolves.toMatchObject({ status: 'REFUNDED' });
    expect(tx.payment.update).not.toHaveBeenCalled();
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('rejects mismatched amounts and request ownership', async () => {
    const { handler, tx } = build();
    tx.refundRequest.findUnique.mockResolvedValue({ id: 'review-1', paymentId: 'pay-1', invoiceId: 'inv-1', amount: dec(5000), status: 'PENDING_REVIEW' });
    await expect(handler.execute({ paymentId: 'pay-1', reason: 'r', amount: 6000, refundRequestId: 'review-1' } as any)).rejects.toThrow();
    tx.refundRequest.findUnique.mockResolvedValue({ id: 'review-1', paymentId: 'other', invoiceId: 'inv-1', amount: dec(5000), status: 'PENDING_REVIEW' });
    await expect(handler.execute({ paymentId: 'pay-1', reason: 'r', refundRequestId: 'review-1' } as any)).rejects.toThrow();
    expect(tx.payment.update).not.toHaveBeenCalled();
  });

  it('throws when the payment is not found', async () => {
    const { handler, tx } = build();
    tx.payment.findUnique.mockResolvedValueOnce(null);
    await expect(handler.execute({ paymentId: 'x', reason: 'r' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a non-refundable payment status', async () => {
    const { handler } = build({ status: PaymentStatus.FAILED });
    await expect(handler.execute({ paymentId: 'pay-1', reason: 'r' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a gateway (card) payment — that needs the Moyasar path', async () => {
    const { handler } = build({ gatewayRef: 'moy_123' });
    await expect(handler.execute({ paymentId: 'pay-1', reason: 'r' })).rejects.toThrow(/gateway/i);
  });

  it('rejects when refund exceeds the outstanding balance', async () => {
    const { handler } = build();
    await expect(handler.execute({ paymentId: 'pay-1', reason: 'r', amount: 25000 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('full refund flips payment to REFUNDED and updates the invoice', async () => {
    const { handler, tx, eventBus } = build();
    const result = await handler.execute({ paymentId: 'pay-1', reason: 'client cancelled', performedBy: 'recep-1' });
    expect(result.status).toBe(PaymentStatus.REFUNDED);
    expect(tx.refundRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED', reason: 'client cancelled', amount: 20000, processedBy: 'recep-1' }) }),
    );
    expect(tx.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'REFUNDED', refundedAmount: 20000 }) }),
    );
    expect(tx.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'finance.refund.completed' }),
      }),
    );
  });

  it('partial refund flips payment to PARTIALLY_REFUNDED', async () => {
    const { handler, tx } = build();
    const result = await handler.execute({ paymentId: 'pay-1', reason: 'partial', amount: 5000 });
    expect(result.status).toBe(PaymentStatus.PARTIALLY_REFUNDED);
    expect(tx.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PARTIALLY_REFUNDED', refundedAmount: 5000 }) }),
    );
  });

  it('refunds only the OUTSTANDING balance when amount is omitted (already partially refunded)', async () => {
    // 20000 paid, 5000 already refunded → omitting amount must refund 15000, not 20000.
    const { handler, tx } = build(
      { refundedAmount: dec(5000) },
      { refundedAmount: dec(5000) },
    );
    const result = await handler.execute({ paymentId: 'pay-1', reason: 'full remainder' });
    expect(result.status).toBe(PaymentStatus.REFUNDED);
    expect(tx.refundRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 15000 }) }),
    );
  });

  it('accumulates refunded VAT across partial refunds instead of overwriting it', async () => {
    // Invoice 23000 = 20000 + 3000 VAT. A first partial of 11500 already
    // refunded 1500 VAT; refunding the remaining 11500 must total 3000 VAT.
    const { handler, tx } = build(
      { amount: dec(23000), refundedAmount: dec(11500) },
      { total: dec(23000), vatAmt: dec(3000), refundedAmount: dec(11500), refundedVatAmt: dec(1500) },
    );
    await handler.execute({ paymentId: 'pay-1', reason: 'second half' });
    expect(tx.invoice.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'REFUNDED', refundedAmount: 23000, refundedVatAmt: 3000 }),
    }));
  });

  it('records only this partial refund\'s VAT share on a first partial', async () => {
    const { handler, tx } = build(
      { amount: dec(23000) },
      { total: dec(23000), vatAmt: dec(3000) },
    );
    await handler.execute({ paymentId: 'pay-1', reason: 'first half', amount: 11500 });
    expect(tx.invoice.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'PARTIALLY_REFUNDED', refundedVatAmt: 1500 }),
    }));
  });

  it('rejects a second in-flight refund', async () => {
    const { handler, tx } = build();
    tx.refundRequest.findFirst.mockResolvedValueOnce({ id: 'rr-existing' });
    await expect(handler.execute({ paymentId: 'pay-1', reason: 'r' })).rejects.toThrow(/already processing/i);
  });
});
