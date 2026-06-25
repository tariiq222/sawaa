import { buildPackageConsumptionReport } from './package-consumption-report.builder';

function makePrisma() {
  return {
    packageCreditUsage: { findMany: jest.fn().mockResolvedValue([]) },
    employee: { findMany: jest.fn().mockResolvedValue([]) },
  } as any;
}

describe('buildPackageConsumptionReport', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = makePrisma();
  });

  it('returns an empty list when no sessions were delivered', async () => {
    const result = await buildPackageConsumptionReport(prisma, {
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
    });
    expect(result.totalConsumed).toBe(0);
    expect(result.byEmployee).toEqual([]);
  });

  it('queries only CONSUMED usages with usedAt in range, joined to the credit employeeId', async () => {
    await buildPackageConsumptionReport(prisma, {
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
    });
    const args = prisma.packageCreditUsage.findMany.mock.calls[0][0];
    expect(args.where.status).toBe('CONSUMED');
    expect(args.where.usedAt).toEqual({ gte: new Date('2026-01-01'), lte: new Date('2026-01-31') });
    // The employee comes from the parent credit.
    expect(args.select.credit.select.employeeId).toBe(true);
  });

  it('counts CONSUMED sessions grouped by the credit employee, resolving names', async () => {
    prisma.packageCreditUsage.findMany.mockResolvedValue([
      { credit: { employeeId: 'e1' } },
      { credit: { employeeId: 'e1' } },
      { credit: { employeeId: 'e2' } },
    ]);
    prisma.employee.findMany.mockResolvedValue([
      { id: 'e1', name: 'Emp One', nameAr: 'الأول', nameEn: 'Emp One' },
      { id: 'e2', name: 'Emp Two', nameAr: 'الثاني', nameEn: null },
    ]);

    const result = await buildPackageConsumptionReport(prisma, {
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
    });

    expect(result.totalConsumed).toBe(3);
    expect(result.byEmployee).toHaveLength(2);
    // Sorted descending by count: e1 (2) before e2 (1).
    expect(result.byEmployee[0]).toEqual({ employeeId: 'e1', name: 'الأول', count: 2 });
    expect(result.byEmployee[1]).toEqual({ employeeId: 'e2', name: 'الثاني', count: 1 });
  });

  it('falls back to name when nameAr is missing and tolerates an unknown employee', async () => {
    prisma.packageCreditUsage.findMany.mockResolvedValue([
      { credit: { employeeId: 'e3' } },
      { credit: { employeeId: 'ghost' } },
    ]);
    prisma.employee.findMany.mockResolvedValue([
      { id: 'e3', name: 'Plain Name', nameAr: null, nameEn: null },
    ]);

    const result = await buildPackageConsumptionReport(prisma, {
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
    });

    const e3 = result.byEmployee.find((r) => r.employeeId === 'e3');
    const ghost = result.byEmployee.find((r) => r.employeeId === 'ghost');
    expect(e3?.name).toBe('Plain Name');
    expect(ghost?.name).toBe(''); // unknown employee → empty label, count still recorded
    expect(ghost?.count).toBe(1);
  });
});
