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
};

function build(paymentOverrides: Partial<typeof basePaymentRow> = {}, invoiceOverrides: Partial<typeof baseInvoice> = {}) {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ ...basePaymentRow, ...paymentOverrides }]),
    refundRequest: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'rr-1' }),
    },
    invoice: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ ...baseInvoice, ...invoiceOverrides }),
      update: jest.fn().mockResolvedValue({}),
    },
    payment: {
      update: jest.fn().mockImplementation(({ data }) => ({ id: 'pay-1', status: data.status })),
    },
  };
  const prisma = {} as never;
  const rlsTransaction = { withTransaction: jest.fn((cb: (tx: unknown) => Promise<unknown>) => cb(tx)) };
  const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
  const handler = new ManualRefundPaymentHandler(prisma, rlsTransaction as never, eventBus as never);
  return { handler, tx, eventBus };
}

describe('ManualRefundPaymentHandler', () => {
  it('throws when the payment is not found', async () => {
    const { handler, tx } = build();
    tx.$queryRaw.mockResolvedValueOnce([]);
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
    expect(eventBus.publish).toHaveBeenCalled();
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

  it('rejects a second in-flight refund', async () => {
    const { handler, tx } = build();
    tx.refundRequest.findFirst.mockResolvedValueOnce({ id: 'rr-existing' });
    await expect(handler.execute({ paymentId: 'pay-1', reason: 'r' })).rejects.toThrow(/already processing/i);
  });
});
