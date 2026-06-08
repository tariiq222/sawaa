import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { ApplyInvoiceDiscountHandler } from './apply-invoice-discount.handler';

type Tx = {
  invoice: { findFirst: jest.Mock; update: jest.Mock };
  payment: { aggregate: jest.Mock };
  discountReason: { findFirst: jest.Mock };
};

function makeHandler(tx: Tx) {
  const prisma = {} as never;
  const rlsTransaction = {
    withTransaction: (cb: (tx: Tx) => unknown) => cb(tx),
  } as never;
  return new ApplyInvoiceDiscountHandler(prisma, rlsTransaction);
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
    payment: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
    discountReason: { findFirst: jest.fn().mockResolvedValue({ id: 'reason-1' }) },
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

  it('rejects a discount once a payment has been recorded', async () => {
    const tx = makeTx({
      payment: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 5000 } }) },
    });
    const handler = makeHandler(tx);
    await expect(
      handler.execute({ invoiceId: 'inv-1', appliedBy: 'u', discountAmt: 1000, discountReasonId: 'r' }),
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
});
