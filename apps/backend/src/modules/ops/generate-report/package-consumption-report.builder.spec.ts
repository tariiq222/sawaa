import { buildPackageConsumptionReport } from './package-consumption-report.builder';

function makePrisma() {
  return {
    packageCreditUsage: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
    booking: { findMany: jest.fn().mockResolvedValue([]) },
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

  it('queries CONSUMED usages by consumedAt, with usedAt as the legacy fallback', async () => {
    await buildPackageConsumptionReport(prisma, {
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
    });
    const args = prisma.packageCreditUsage.findMany.mock.calls[0][0];
    expect(args.where.status).toBe('CONSUMED');
    expect(args.where.OR).toEqual([
      { consumedAt: { gte: new Date('2026-01-01'), lte: new Date('2026-01-31') } },
      { consumedAt: null, usedAt: { gte: new Date('2026-01-01'), lte: new Date('2026-01-31') } },
    ]);
    expect(args.select.consumedAt).toBe(true);
    expect(args.select.usedAt).toBe(true);
    expect(args.select.bookingId).toBe(true);
    // The legacy fallback still comes from the parent credit.
    expect(args.select.credit.select.employeeId).toBe(true);
  });

  it('counts CONSUMED sessions grouped by the historical booking employee, resolving names', async () => {
    prisma.packageCreditUsage.findMany.mockResolvedValue([
      { bookingId: 'b1', consumedAt: new Date('2026-01-10'), credit: { employeeId: 'e2' } },
      { bookingId: 'b2', consumedAt: new Date('2026-01-11'), credit: { employeeId: 'e2' } },
      { bookingId: 'b3', consumedAt: new Date('2026-01-12'), credit: { employeeId: 'e2' } },
    ]);
    prisma.booking.findMany.mockResolvedValue([
      { id: 'b1', employeeId: 'e1', employeeNameSnapshot: 'الممارس السابق' },
      { id: 'b2', employeeId: 'e1', employeeNameSnapshot: null },
      { id: 'b3', employeeId: 'e2', employeeNameSnapshot: null },
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
    // Sorted descending by count: historical e1 (2) before e2 (1).
    expect(result.byEmployee[0]).toEqual({ employeeId: 'e1', name: 'الممارس السابق', count: 2 });
    expect(result.byEmployee[1]).toEqual({ employeeId: 'e2', name: 'الثاني', count: 1 });
    expect(prisma.booking.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['b1', 'b2', 'b3'] } },
      select: { id: true, employeeId: true, employeeNameSnapshot: true },
    });
  });

  it('places a newly debited session in the consumedAt period, even when reservation usedAt is earlier', async () => {
    prisma.packageCreditUsage.findMany.mockResolvedValue([
      {
        bookingId: 'b-june',
        consumedAt: new Date('2026-06-10'),
        usedAt: new Date('2026-05-20'),
        credit: { employeeId: 'e2' },
      },
    ]);
    prisma.booking.findMany.mockResolvedValue([
      { id: 'b-june', employeeId: 'e1', employeeNameSnapshot: 'A' },
    ]);

    const result = await buildPackageConsumptionReport(prisma, {
      from: new Date('2026-06-01'),
      to: new Date('2026-06-30'),
    });

    expect(result.totalConsumed).toBe(1);
    expect(result.byEmployee[0]).toMatchObject({ employeeId: 'e1', count: 1 });
    const where = prisma.packageCreditUsage.findMany.mock.calls[0][0].where;
    expect(where.OR[0].consumedAt).toEqual({
      gte: new Date('2026-06-01'),
      lte: new Date('2026-06-30'),
    });
  });

  it('uses usedAt for legacy rows without writing a historical timestamp', async () => {
    prisma.packageCreditUsage.findMany.mockResolvedValue([
      {
        bookingId: null,
        consumedAt: null,
        usedAt: new Date('2026-01-15'),
        credit: { employeeId: 'e3' },
      },
    ]);
    prisma.employee.findMany.mockResolvedValue([
      { id: 'e3', name: 'Plain Name', nameAr: null, nameEn: null },
    ]);

    const result = await buildPackageConsumptionReport(prisma, {
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
    });

    expect(result.byEmployee).toEqual([
      { employeeId: 'e3', name: 'Plain Name', count: 1, attribution: 'LEGACY_CREDIT' },
    ]);
    expect(prisma.packageCreditUsage.update).not.toHaveBeenCalled();
  });

  it('keeps a missing legacy practitioner visible as an explicit unknown row', async () => {
    prisma.packageCreditUsage.findMany.mockResolvedValue([
      {
        bookingId: null,
        consumedAt: null,
        usedAt: new Date('2026-01-15'),
        credit: { employeeId: null },
      },
    ]);

    const result = await buildPackageConsumptionReport(prisma, {
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
    });

    expect(result.byEmployee).toEqual([
      { employeeId: 'unknown', name: 'Unknown practitioner', count: 1, attribution: 'UNKNOWN' },
    ]);
  });

  it('labels a missing booking fallback as legacy credit attribution', async () => {
    prisma.packageCreditUsage.findMany.mockResolvedValue([
      {
        bookingId: 'missing-booking',
        consumedAt: new Date('2026-01-15'),
        credit: { employeeId: 'e3' },
      },
    ]);
    prisma.employee.findMany.mockResolvedValue([
      { id: 'e3', name: 'Plain Name', nameAr: null, nameEn: null },
    ]);

    const result = await buildPackageConsumptionReport(prisma, {
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
    });

    expect(result.byEmployee).toEqual([
      { employeeId: 'e3', name: 'Plain Name', count: 1, attribution: 'LEGACY_CREDIT' },
    ]);
  });
});
