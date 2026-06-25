import { buildOutstandingCreditReport } from './outstanding-credit-report.builder';

function makePrisma() {
  return {
    packageCredit: {
      findMany: jest.fn().mockResolvedValue([]),
      // Mirror Prisma's field-reference API used for the usedQuantity < totalQuantity filter.
      fields: { totalQuantity: 'totalQuantity' },
    },
  } as any;
}

describe('buildOutstandingCreditReport', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = makePrisma();
  });

  it('returns a zero state when there are no active credits', async () => {
    const result = await buildOutstandingCreditReport(prisma, {});
    expect(result.outstandingLiability).toBe(0);
    expect(result.outstandingSessions).toBe(0);
    expect(result.creditCount).toBe(0);
  });

  it('only considers credits of ACTIVE purchases with remaining > 0', async () => {
    prisma.packageCredit.findMany.mockResolvedValue([]);
    await buildOutstandingCreditReport(prisma, {});
    const where = prisma.packageCredit.findMany.mock.calls[0][0].where;
    expect(where.purchase).toEqual({ is: { status: 'ACTIVE' } });
    // remaining > 0 expressed as a column-to-column comparison usedQuantity < totalQuantity
    expect(where.usedQuantity).toBeDefined();
  });

  it('sums remaining sessions and liability = Σ(remaining × unitPriceSnapshot)', async () => {
    prisma.packageCredit.findMany.mockResolvedValue([
      // remaining 3 × 10000 = 30000
      { totalQuantity: 5, usedQuantity: 2, unitPriceSnapshot: 10_000 },
      // remaining 4 × 25000 = 100000
      { totalQuantity: 4, usedQuantity: 0, unitPriceSnapshot: 25_000 },
    ]);
    const result = await buildOutstandingCreditReport(prisma, {});
    expect(result.outstandingSessions).toBe(7); // 3 + 4
    expect(result.outstandingLiability).toBe(130_000); // 30000 + 100000
    expect(result.creditCount).toBe(2);
  });

  it('ignores fully-consumed credits even if returned in the result set (defensive)', async () => {
    prisma.packageCredit.findMany.mockResolvedValue([
      { totalQuantity: 2, usedQuantity: 2, unitPriceSnapshot: 5_000 }, // remaining 0
      { totalQuantity: 3, usedQuantity: 1, unitPriceSnapshot: 4_000 }, // remaining 2 → 8000
    ]);
    const result = await buildOutstandingCreditReport(prisma, {});
    expect(result.outstandingSessions).toBe(2);
    expect(result.outstandingLiability).toBe(8_000);
  });
});
