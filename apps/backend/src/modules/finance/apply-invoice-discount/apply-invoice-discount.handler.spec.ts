import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { ApplyInvoiceDiscountHandler } from './apply-invoice-discount.handler';

type Tx = {
  invoice: { findFirst: jest.Mock; update: jest.Mock };
  payment: { findMany: jest.Mock; delete: jest.Mock };
  discountReason: { findFirst: jest.Mock };
  couponRedemption: { findMany: jest.Mock; deleteMany: jest.Mock };
  coupon: { updateMany: jest.Mock };
};

function makeHandler(tx: Tx, moyasar: { getPaymentStatus: jest.Mock } = { getPaymentStatus: jest.fn() }) {
  const prisma = {} as never;
  const rlsTransaction = {
    withTransaction: (cb: (tx: Tx) => unknown) => cb(tx),
  } as never;
  return new ApplyInvoiceDiscountHandler(prisma, rlsTransaction, moyasar as never);
}

const baseInvoice = {
  id: 'inv-1',
  status: InvoiceStatus.ISSUED,
  subtotal: new Prisma.Decimal(10000), // 100 SAR
  vatRate: new Prisma.Decimal('0.15'),
  vatAmt: new Prisma.Decimal(1500),
  total: new Prisma.Decimal(11500),
};

function makeTx(overrides: Partial<Tx> = {}): Tx {
  return {
    invoice: {
      findFirst: jest.fn().mockResolvedValue(baseInvoice),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'inv-1', ...data })),
    },
    payment: {
      findMany: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue({ id: 'pay-x' }),
    },
    discountReason: { findFirst: jest.fn().mockResolvedValue({ id: 'reason-1' }) },
    couponRedemption: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    coupon: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    ...overrides,
  };
}

describe('ApplyInvoiceDiscountHandler', () => {
  it('recomputes VAT and total on a 2000-halala discount', async () => {
    const tx = makeTx();
    const handler = makeHandler(tx);

    await handler.execute({
      invoiceId: 'inv-1',
      appliedBy: 'user-1',
      discountAmt: 2000,
      discountReasonId: 'reason-1',
    });

    // vatBase = 10000 - 2000 = 8000; vat = round(8000 * 0.15) = 1200; total = 9200
    const data = tx.invoice.update.mock.calls[0][0].data;
    expect(Number(data.discountAmt)).toBe(2000);
    expect(Number(data.vatAmt)).toBe(1200);
    expect(Number(data.total)).toBe(9200);
    expect(data.discountReasonId).toBe('reason-1');
    expect(data.discountAppliedBy).toBe('user-1');
    expect(data.discountAppliedAt).toBeInstanceOf(Date);
  });

  it('requires a reason when discount is positive', async () => {
    const handler = makeHandler(makeTx());
    await expect(
      handler.execute({ invoiceId: 'inv-1', appliedBy: 'u', discountAmt: 1000 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('clears the discount and audit fields when amount is 0', async () => {
    const tx = makeTx();
    const handler = makeHandler(tx);

    await handler.execute({ invoiceId: 'inv-1', appliedBy: 'user-1', discountAmt: 0 });

    const data = tx.invoice.update.mock.calls[0][0].data;
    expect(Number(data.discountAmt)).toBe(0);
    expect(Number(data.vatAmt)).toBe(1500); // back to full VAT
    expect(Number(data.total)).toBe(11500);
    expect(data.discountReasonId).toBeNull();
    expect(data.discountAppliedBy).toBeNull();
    expect(data.discountAppliedAt).toBeNull();
  });

  it('throws 404 when invoice is missing', async () => {
    const tx = makeTx({ invoice: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() } });
    const handler = makeHandler(tx);
    await expect(
      handler.execute({ invoiceId: 'x', appliedBy: 'u', discountAmt: 0 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects a discount on a paid invoice', async () => {
    const tx = makeTx({
      invoice: {
        findFirst: jest.fn().mockResolvedValue({ ...baseInvoice, status: InvoiceStatus.PAID }),
        update: jest.fn(),
      },
    });
    const handler = makeHandler(tx);
    await expect(
      handler.execute({ invoiceId: 'inv-1', appliedBy: 'u', discountAmt: 1000, discountReasonId: 'r' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a discount once a COMPLETED payment exists', async () => {
    const tx = makeTx({
      payment: {
        findMany: jest.fn().mockResolvedValue([{ id: 'p1', status: 'COMPLETED', gatewayRef: 'g1' }]),
        delete: jest.fn(),
      },
    });
    const handler = makeHandler(tx);
    await expect(
      handler.execute({ invoiceId: 'inv-1', appliedBy: 'u', discountAmt: 1000, discountReasonId: 'r' }),
    ).rejects.toThrow(BadRequestException);
  });

  // ─── Z3: discount while a card payment is in flight (silent-overcharge guard) ──

  it('Z3: rejects a discount while a bank transfer is awaiting verification', async () => {
    const tx = makeTx({
      payment: {
        findMany: jest.fn().mockResolvedValue([{ id: 'p1', status: 'PENDING_VERIFICATION', gatewayRef: null }]),
        delete: jest.fn(),
      },
    });
    const handler = makeHandler(tx);
    await expect(
      handler.execute({ invoiceId: 'inv-1', appliedBy: 'u', discountAmt: 1000, discountReasonId: 'r' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('Z3: rejects a discount when a PENDING card session has already settled (paid)', async () => {
    const tx = makeTx({
      payment: {
        findMany: jest.fn().mockResolvedValue([{ id: 'p1', status: 'PENDING', gatewayRef: 'g1' }]),
        delete: jest.fn(),
      },
    });
    const moyasar = { getPaymentStatus: jest.fn().mockResolvedValue({ status: 'paid' }) };
    const handler = makeHandler(tx, moyasar);
    await expect(
      handler.execute({ invoiceId: 'inv-1', appliedBy: 'u', discountAmt: 1000, discountReasonId: 'reason-1' }),
    ).rejects.toThrow(BadRequestException);
    expect(tx.payment.delete).not.toHaveBeenCalled();
  });

  it('Z3: discards an abandoned (initiated) card session, then applies the discount — no permanent lock', async () => {
    const tx = makeTx({
      payment: {
        findMany: jest.fn().mockResolvedValue([{ id: 'p1', status: 'PENDING', gatewayRef: 'g1' }]),
        delete: jest.fn().mockResolvedValue({ id: 'p1' }),
      },
    });
    const moyasar = { getPaymentStatus: jest.fn().mockResolvedValue({ status: 'initiated' }) };
    const handler = makeHandler(tx, moyasar);

    await handler.execute({ invoiceId: 'inv-1', appliedBy: 'user-1', discountAmt: 2000, discountReasonId: 'reason-1' });

    expect(tx.payment.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    const data = tx.invoice.update.mock.calls[0][0].data;
    expect(Number(data.discountAmt)).toBe(2000);
    expect(Number(data.total)).toBe(9200);
  });

  it('Z3: fails closed when the gateway status of a PENDING card row cannot be fetched', async () => {
    const tx = makeTx({
      payment: {
        findMany: jest.fn().mockResolvedValue([{ id: 'p1', status: 'PENDING', gatewayRef: 'g1' }]),
        delete: jest.fn(),
      },
    });
    const moyasar = { getPaymentStatus: jest.fn().mockRejectedValue(new Error('Moyasar 500')) };
    const handler = makeHandler(tx, moyasar);
    await expect(
      handler.execute({ invoiceId: 'inv-1', appliedBy: 'u', discountAmt: 1000, discountReasonId: 'reason-1' }),
    ).rejects.toThrow(BadRequestException);
    expect(tx.payment.delete).not.toHaveBeenCalled();
  });

  it('Z3: rejects a discount when a PENDING row has no gateway session yet', async () => {
    const tx = makeTx({
      payment: {
        findMany: jest.fn().mockResolvedValue([{ id: 'p1', status: 'PENDING', gatewayRef: null }]),
        delete: jest.fn(),
      },
    });
    const handler = makeHandler(tx);
    await expect(
      handler.execute({ invoiceId: 'inv-1', appliedBy: 'u', discountAmt: 1000, discountReasonId: 'reason-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a discount larger than the subtotal', async () => {
    const handler = makeHandler(makeTx());
    await expect(
      handler.execute({ invoiceId: 'inv-1', appliedBy: 'u', discountAmt: 99999, discountReasonId: 'reason-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an inactive or unknown reason', async () => {
    const tx = makeTx({ discountReason: { findFirst: jest.fn().mockResolvedValue(null) } });
    const handler = makeHandler(tx);
    await expect(
      handler.execute({ invoiceId: 'inv-1', appliedBy: 'u', discountAmt: 1000, discountReasonId: 'gone' }),
    ).rejects.toThrow(BadRequestException);
  });

  // ─── P1-6: a manual discount must reverse any coupon redemptions ──────────────

  it('P1-6: reverses orphaned coupon redemptions and decrements usedCount when a manual discount overwrites them', async () => {
    const tx = makeTx({
      couponRedemption: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'red-1', couponId: 'coupon-A' },
            { id: 'red-2', couponId: 'coupon-A' },
            { id: 'red-3', couponId: 'coupon-B' },
          ]),
        deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
    });
    const handler = makeHandler(tx);

    await handler.execute({
      invoiceId: 'inv-1',
      appliedBy: 'user-1',
      discountAmt: 2000,
      discountReasonId: 'reason-1',
    });

    // All redemption rows for this invoice are dropped.
    expect(tx.couponRedemption.deleteMany).toHaveBeenCalledWith({ where: { invoiceId: 'inv-1' } });
    // usedCount is decremented per coupon by the number of rows removed (A: 2, B: 1).
    expect(tx.coupon.updateMany).toHaveBeenCalledWith({
      where: { id: 'coupon-A', usedCount: { gte: 2 } },
      data: { usedCount: { decrement: 2 } },
    });
    expect(tx.coupon.updateMany).toHaveBeenCalledWith({
      where: { id: 'coupon-B', usedCount: { gte: 1 } },
      data: { usedCount: { decrement: 1 } },
    });
    // The manual discount still lands.
    const data = tx.invoice.update.mock.calls[0][0].data;
    expect(Number(data.discountAmt)).toBe(2000);
    expect(Number(data.total)).toBe(9200);
  });

  it('P1-6: does not touch coupons when the invoice has no redemptions', async () => {
    const tx = makeTx();
    const handler = makeHandler(tx);

    await handler.execute({
      invoiceId: 'inv-1',
      appliedBy: 'user-1',
      discountAmt: 1000,
      discountReasonId: 'reason-1',
    });

    expect(tx.couponRedemption.deleteMany).not.toHaveBeenCalled();
    expect(tx.coupon.updateMany).not.toHaveBeenCalled();
  });

  it('P1-6: clears a coupon discount (manual amount 0) by reversing redemptions', async () => {
    const tx = makeTx({
      couponRedemption: {
        findMany: jest.fn().mockResolvedValue([{ id: 'red-1', couponId: 'coupon-A' }]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    });
    const handler = makeHandler(tx);

    await handler.execute({ invoiceId: 'inv-1', appliedBy: 'user-1', discountAmt: 0 });

    expect(tx.couponRedemption.deleteMany).toHaveBeenCalledWith({ where: { invoiceId: 'inv-1' } });
    expect(tx.coupon.updateMany).toHaveBeenCalledWith({
      where: { id: 'coupon-A', usedCount: { gte: 1 } },
      data: { usedCount: { decrement: 1 } },
    });
    const data = tx.invoice.update.mock.calls[0][0].data;
    expect(Number(data.discountAmt)).toBe(0);
    expect(Number(data.total)).toBe(11500); // full VAT restored
  });
});
