import { buildOutstandingCreditReport } from './outstanding-credit-report.builder';

function makePrisma() {
  return {
    packagePurchase: { findMany: jest.fn().mockResolvedValue([]) },
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
});
