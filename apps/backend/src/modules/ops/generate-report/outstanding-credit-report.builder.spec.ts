import { buildOutstandingCreditReport } from './outstanding-credit-report.builder';

function makePrisma() {
  return {
    packagePurchase: { findMany: jest.fn().mockResolvedValue([]) },
    invoice: { findMany: jest.fn().mockResolvedValue([]) },
  } as any;
}

const credit = (overrides: Partial<{
  unitPriceSnapshot: number;
  netValue: number | null;
  totalQuantity: number;
  usedQuantity: number;
  reservedQuantity: number;
}> = {}) => ({
  unitPriceSnapshot: 40_000,
  netValue: null,
  totalQuantity: 6,
  usedQuantity: 0,
  reservedQuantity: 0,
  ...overrides,
});

describe('buildOutstandingCreditReport', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = makePrisma();
  });

  it('returns a zero state when there are no active purchases', async () => {
    const result = await buildOutstandingCreditReport(prisma, {});
    expect(result).toEqual({
      outstandingLiability: 0,
      outstandingSessions: 0,
      creditCount: 0,
      reservedSessions: 0,
    });
  });

  it('only reads ACTIVE purchases with their credits', async () => {
    await buildOutstandingCreditReport(prisma, {});
    const args = prisma.packagePurchase.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ status: 'ACTIVE' });
    expect(args.select.credits.select).toEqual(
      expect.objectContaining({
        netValue: true,
        unitPriceSnapshot: true,
        totalQuantity: true,
        usedQuantity: true,
        reservedQuantity: true,
      }),
    );
  });

  it('keeps a booked-but-undelivered session inside the liability and reports it as reserved', async () => {
    // 5 of 6 sessions are still owed; 2 of those already have appointments booked.
    prisma.packagePurchase.findMany.mockResolvedValue([
      {
        amountPaid: 175_000,
        refundAmount: 0,
        credits: [credit({ netValue: 175_000, usedQuantity: 1, reservedQuantity: 2 })],
      },
    ]);
    const result = await buildOutstandingCreditReport(prisma, {});
    expect(result.outstandingLiability).toBe(145_834); // 175,000 − 29,166 — reserved sessions still counted
    expect(result.reservedSessions).toBe(2);
  });

  it('values remaining sessions from the stored net value, not the list unit price', async () => {
    // 5 paid + 1 free at 400 SAR list, 250 SAR discount → paid 1,750; one session used.
    prisma.packagePurchase.findMany.mockResolvedValue([
      { amountPaid: 175_000, refundAmount: 0, credits: [credit({ netValue: 175_000, usedQuantity: 1 })] },
    ]);
    const result = await buildOutstandingCreditReport(prisma, {});
    expect(result.outstandingSessions).toBe(5);
    expect(result.outstandingLiability).toBe(145_834); // 175,000 − 29,166
    expect(result.creditCount).toBe(1);
  });

  it('keeps differently priced V2 session rights while capping liability after a partial refund', async () => {
    // A 10% global discount produced 27,000 + 13,500 + 18,000 halalas for
    // the three priced sessions. One priced session is consumed; the zero-net
    // session still counts as a right but contributes no liability.
    prisma.packagePurchase.findMany.mockResolvedValue([
      {
        amountPaid: 81_000,
        refundAmount: 40_000,
        credits: [
          credit({ unitPriceSnapshot: 30_000, netValue: 27_000, totalQuantity: 1 }),
          credit({ unitPriceSnapshot: 15_000, netValue: 13_500, totalQuantity: 1, usedQuantity: 1 }),
          credit({ unitPriceSnapshot: 20_000, netValue: 18_000, totalQuantity: 1 }),
          credit({ unitPriceSnapshot: 0, netValue: 0, totalQuantity: 1 }),
        ],
      },
    ]);

    const result = await buildOutstandingCreditReport(prisma, {});

    expect(result.outstandingSessions).toBe(3);
    expect(result.creditCount).toBe(3);
    expect(result.outstandingLiability).toBe(41_000); // 27,000 + 18,000 capped by 81,000 − 40,000
  });

  it('falls back to the purchase amount for credits issued before net values were stored', async () => {
    prisma.packagePurchase.findMany.mockResolvedValue([
      { amountPaid: 175_000, refundAmount: 0, credits: [credit({ usedQuantity: 1 })] },
    ]);
    const result = await buildOutstandingCreditReport(prisma, {});
    expect(result.outstandingLiability).toBe(145_834); // not 5 × 40,000 = 200,000
  });

  it('allocates a multi-credit legacy purchase across its credits by list value', async () => {
    prisma.packagePurchase.findMany.mockResolvedValue([
      {
        amountPaid: 210_000,
        refundAmount: 0,
        credits: [
          credit({ unitPriceSnapshot: 50_000, totalQuantity: 6 }),
          credit({ unitPriceSnapshot: 15_000, totalQuantity: 2 }),
        ],
      },
    ]);
    const result = await buildOutstandingCreditReport(prisma, {});
    expect(result.outstandingLiability).toBe(210_000);
    expect(result.outstandingSessions).toBe(8);
  });

  it('never reports more than the amount paid minus refunds for a purchase', async () => {
    prisma.packagePurchase.findMany.mockResolvedValue([
      { amountPaid: 175_000, refundAmount: 50_000, credits: [credit({ netValue: 175_000 })] },
    ]);
    const result = await buildOutstandingCreditReport(prisma, {});
    expect(result.outstandingLiability).toBe(125_000);
  });

  it('ignores fully-consumed credits in sessions and credit count', async () => {
    prisma.packagePurchase.findMany.mockResolvedValue([
      {
        amountPaid: 20_000,
        refundAmount: 0,
        credits: [
          credit({ netValue: 10_000, totalQuantity: 2, usedQuantity: 2 }),
          credit({ netValue: 10_000, totalQuantity: 4, usedQuantity: 1 }),
        ],
      },
    ]);
    const result = await buildOutstandingCreditReport(prisma, {});
    expect(result.outstandingSessions).toBe(3);
    expect(result.creditCount).toBe(1);
    expect(result.outstandingLiability).toBe(7_500); // 10,000 − 2,500
  });

  it('caps by paid minus the NET part of refunds when the invoice carried VAT', async () => {
    // Net 36000 (gross 41400 at 15%). A 36000 partial refund returned
    // 4696 VAT (36000 × 5400/41400), so 31304 net was refunded and 4696 net
    // remains paid for the untouched sessions.
    prisma.packagePurchase.findMany.mockResolvedValue([{
      id: 'p-1', amountPaid: 36_000, refundAmount: 36_000,
      credits: [credit({ netValue: 36_000, totalQuantity: 6, usedQuantity: 0 })],
    }]);
    prisma.invoice.findMany.mockResolvedValue([{ packagePurchaseId: 'p-1', refundedVatAmt: 4_696 }]);

    const result = await buildOutstandingCreditReport(prisma, {});

    expect(result.outstandingLiability).toBe(4_696);
  });
});
