import { PackagePurchaseStatus } from '@prisma/client';
import { ListClientPackagePurchasesHandler } from './list-client-package-purchases.handler';

const CLIENT_ID = '00000000-0000-4000-a000-000000000001';
const PURCHASE_ID_1 = '00000000-0000-4000-a000-000000000010';
const PURCHASE_ID_2 = '00000000-0000-4000-a000-000000000020';

const SERVICE_ID = '00000000-0000-4000-a000-000000000100';
const EMPLOYEE_ID = '00000000-0000-4000-a000-000000000101';
const DURATION_OPTION_ID = '00000000-0000-4000-a000-000000000102';

const OTHER_SERVICE_ID = '00000000-0000-4000-a000-000000000200';
const OTHER_EMPLOYEE_ID = '00000000-0000-4000-a000-000000000201';

const PRISMA_DECIMAL = (n: number) => ({ toString: () => String(n) });

const PURCHASE_1 = {
  id: PURCHASE_ID_1,
  packageId: 'pkg-1',
  clientId: CLIENT_ID,
  branchId: 'branch-1',
  status: PackagePurchaseStatus.ACTIVE,
  subtotalSnapshot: PRISMA_DECIMAL(40_000),
  discountSnapshot: PRISMA_DECIMAL(4_000),
  amountPaid: PRISMA_DECIMAL(36_000),
  paidAt: new Date('2026-01-15T10:00:00Z'),
  refundedAt: null,
  refundAmount: PRISMA_DECIMAL(0),
  notes: null,
  createdAt: new Date('2026-01-15T10:00:00Z'),
  updatedAt: new Date('2026-01-15T10:00:00Z'),
  credits: [
    {
      id: 'credit-1',
      purchaseId: PURCHASE_ID_1,
      serviceId: SERVICE_ID,
      employeeId: EMPLOYEE_ID,
      durationOptionId: DURATION_OPTION_ID,
      unitPriceSnapshot: PRISMA_DECIMAL(10_000),
      totalQuantity: 5,
      usedQuantity: 2,
      createdAt: new Date('2026-01-15T10:00:00Z'),
    },
    {
      id: 'credit-2',
      purchaseId: PURCHASE_ID_1,
      serviceId: OTHER_SERVICE_ID,
      employeeId: OTHER_EMPLOYEE_ID,
      durationOptionId: 'dopt-other',
      unitPriceSnapshot: PRISMA_DECIMAL(5_000),
      totalQuantity: 3,
      usedQuantity: 3, // fully consumed → remaining 0
      createdAt: new Date('2026-01-15T10:00:00Z'),
    },
  ],
};

const PURCHASE_2 = {
  ...PURCHASE_1,
  id: PURCHASE_ID_2,
  packageId: 'pkg-2',
  createdAt: new Date('2026-02-01T10:00:00Z'),
  paidAt: new Date('2026-02-01T10:00:00Z'),
  updatedAt: new Date('2026-02-01T10:00:00Z'),
  credits: [
    {
      id: 'credit-3',
      purchaseId: PURCHASE_ID_2,
      serviceId: SERVICE_ID,
      employeeId: EMPLOYEE_ID,
      durationOptionId: DURATION_OPTION_ID,
      unitPriceSnapshot: PRISMA_DECIMAL(10_000),
      totalQuantity: 4,
      usedQuantity: 0,
      createdAt: new Date('2026-02-01T10:00:00Z'),
    },
  ],
};

function buildPrisma() {
  return {
    packagePurchase: { findMany: jest.fn() },
    sessionPackage: { findMany: jest.fn() },
    service: { findMany: jest.fn() },
    employee: { findMany: jest.fn() },
    serviceDurationOption: { findMany: jest.fn() },
  };
}

describe('ListClientPackagePurchasesHandler', () => {
  let prisma: ReturnType<typeof buildPrisma>;

  beforeEach(() => {
    prisma = buildPrisma();
  });

  afterEach(() => jest.clearAllMocks());

  function mockHappyPath() {
    prisma.packagePurchase.findMany.mockResolvedValue([PURCHASE_2, PURCHASE_1]); // desc order
    prisma.sessionPackage.findMany.mockResolvedValue([
      { id: 'pkg-1', nameAr: 'باقة العائلة', nameEn: 'Family Pack' },
      { id: 'pkg-2', nameAr: 'باقة الفرد', nameEn: 'Solo Pack' },
    ]);
    prisma.service.findMany.mockResolvedValue([
      { id: SERVICE_ID, nameAr: 'استشارة زوجية', nameEn: 'Couples Counseling' },
      { id: OTHER_SERVICE_ID, nameAr: 'استشارة فردية', nameEn: 'Individual Counseling' },
    ]);
    prisma.employee.findMany.mockResolvedValue([
      { id: EMPLOYEE_ID, nameAr: 'د. سارة', nameEn: 'Dr. Sara' },
      { id: OTHER_EMPLOYEE_ID, nameAr: 'د. خالد', nameEn: 'Dr. Khaled' },
    ]);
    prisma.serviceDurationOption.findMany.mockResolvedValue([
      { id: DURATION_OPTION_ID, labelAr: 'جلسة 60 دقيقة', label: '60-min Session', durationMins: 60 },
      { id: 'dopt-other', labelAr: 'جلسة 30 دقيقة', label: '30-min Session', durationMins: 30 },
    ]);
  }

  it('is defined', () => {
    const handler = new ListClientPackagePurchasesHandler(prisma as never);
    expect(handler).toBeDefined();
  });

  it('returns the client\'s purchases joined with package names', async () => {
    mockHappyPath();
    const handler = new ListClientPackagePurchasesHandler(prisma as never);

    const result = await handler.execute({ clientId: CLIENT_ID });

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(PURCHASE_ID_2);
    expect(result[0].packageNameAr).toBe('باقة الفرد');
    expect(result[0].packageNameEn).toBe('Solo Pack');
    expect(result[1].packageNameAr).toBe('باقة العائلة');
  });

  it('returns the purchases most-recently paid first', async () => {
    mockHappyPath();
    const handler = new ListClientPackagePurchasesHandler(prisma as never);

    const result = await handler.execute({ clientId: CLIENT_ID });

    // The prisma.findMany mock already returns them in [PURCHASE_2, PURCHASE_1] order;
    // verify the handler preserves that order and reads each row's paidAt correctly.
    expect(result[0].paidAt).toBe(PURCHASE_2.paidAt.toISOString());
    expect(result[1].paidAt).toBe(PURCHASE_1.paidAt.toISOString());
    expect(result[0].paidAt > result[1].paidAt).toBe(true);
  });

  it('exposes each credit with remaining = totalQuantity − usedQuantity', async () => {
    mockHappyPath();
    const handler = new ListClientPackagePurchasesHandler(prisma as never);

    const result = await handler.execute({ clientId: CLIENT_ID });

    // First purchase has two credits:
    //   credit-1 → total 5, used 2 → remaining 3
    //   credit-2 → total 3, used 3 → remaining 0 (fully consumed)
    const credits = result[1].credits;
    expect(credits).toHaveLength(2);
    const c1 = credits.find((c) => c.id === 'credit-1');
    const c2 = credits.find((c) => c.id === 'credit-2');
    expect(c1).toBeDefined();
    expect(c1!.remaining).toBe(3);
    expect(c1!.totalQuantity).toBe(5);
    expect(c1!.usedQuantity).toBe(2);
    expect(c2!.remaining).toBe(0);
    expect(c2!.totalQuantity).toBe(3);
    expect(c2!.usedQuantity).toBe(3);
  });

  it('resolves service / employee / duration display names for each credit', async () => {
    mockHappyPath();
    const handler = new ListClientPackagePurchasesHandler(prisma as never);

    const result = await handler.execute({ clientId: CLIENT_ID });

    const c1 = result[1].credits.find((c) => c.id === 'credit-1')!;
    expect(c1.serviceNameAr).toBe('استشارة زوجية');
    expect(c1.serviceNameEn).toBe('Couples Counseling');
    expect(c1.employeeNameAr).toBe('د. سارة');
    expect(c1.employeeNameEn).toBe('Dr. Sara');
    expect(c1.durationLabelAr).toBe('جلسة 60 دقيقة');
    expect(c1.durationLabelEn).toBe('60-min Session');
    expect(c1.durationMins).toBe(60);
  });

  it('falls back to a literal id string when a referenced service/employee/duration is missing', async () => {
    mockHappyPath();
    // Remove the second service so credit-2 cannot resolve its name.
    prisma.service.findMany.mockResolvedValue([
      { id: SERVICE_ID, nameAr: 'استشارة زوجية', nameEn: 'Couples Counseling' },
    ]);
    prisma.employee.findMany.mockResolvedValue([
      { id: EMPLOYEE_ID, nameAr: 'د. سارة', nameEn: 'Dr. Sara' },
    ]);
    prisma.serviceDurationOption.findMany.mockResolvedValue([
      { id: DURATION_OPTION_ID, labelAr: 'جلسة 60 دقيقة', label: '60-min Session', durationMins: 60 },
    ]);
    const handler = new ListClientPackagePurchasesHandler(prisma as never);

    const result = await handler.execute({ clientId: CLIENT_ID });
    const c2 = result[1].credits.find((c) => c.id === 'credit-2')!;
    // Missing lookups should expose the raw id rather than crashing.
    expect(c2.serviceNameAr).toBe('');
    expect(c2.employeeNameAr).toBe('');
    expect(c2.durationLabelAr).toBe('');
  });

  it('exposes purchase money fields as plain integers (no Prisma.Decimal leaks)', async () => {
    mockHappyPath();
    const handler = new ListClientPackagePurchasesHandler(prisma as never);

    const result = await handler.execute({ clientId: CLIENT_ID });

    expect(typeof result[0].subtotalSnapshot).toBe('number');
    expect(typeof result[0].discountSnapshot).toBe('number');
    expect(typeof result[0].amountPaid).toBe('number');
    expect(typeof result[0].refundAmount).toBe('number');
    expect(result[0].subtotalSnapshot).toBe(40_000);
    expect(result[0].discountSnapshot).toBe(4_000);
    expect(result[0].amountPaid).toBe(36_000);
    expect(result[0].refundAmount).toBe(0);
  });

  it('applies the optional status filter at the prisma level', async () => {
    mockHappyPath();
    const handler = new ListClientPackagePurchasesHandler(prisma as never);

    await handler.execute({ clientId: CLIENT_ID, status: PackagePurchaseStatus.ACTIVE });

    expect(prisma.packagePurchase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          clientId: CLIENT_ID,
          status: PackagePurchaseStatus.ACTIVE,
        }),
      }),
    );
  });

  it('omits the status filter when no status is provided', async () => {
    mockHappyPath();
    const handler = new ListClientPackagePurchasesHandler(prisma as never);

    await handler.execute({ clientId: CLIENT_ID });

    const where = prisma.packagePurchase.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ clientId: CLIENT_ID });
  });

  it('returns an empty array when the client has no purchases (no extra queries fire)', async () => {
    prisma.packagePurchase.findMany.mockResolvedValue([]);
    const handler = new ListClientPackagePurchasesHandler(prisma as never);

    const result = await handler.execute({ clientId: CLIENT_ID });

    expect(result).toEqual([]);
    // No bulk lookups fire when there are no rows to enrich.
    expect(prisma.sessionPackage.findMany).not.toHaveBeenCalled();
    expect(prisma.service.findMany).not.toHaveBeenCalled();
    expect(prisma.employee.findMany).not.toHaveBeenCalled();
    expect(prisma.serviceDurationOption.findMany).not.toHaveBeenCalled();
  });

  it('resolves category + department + bookability onto each credit row', async () => {
    prisma.packagePurchase.findMany.mockResolvedValue([
      {
        id: 'p1', packageId: 'pkg1', clientId: 'c1', status: 'ACTIVE',
        subtotalSnapshot: 0, discountSnapshot: 0, amountPaid: 0, refundAmount: 0,
        paidAt: new Date('2026-06-01'), refundedAt: null, notes: null, createdAt: new Date('2026-06-01'),
        credits: [
          { id: 'cr1', serviceId: 's1', employeeId: 'e1', durationOptionId: 'd1',
            unitPriceSnapshot: 10000, totalQuantity: 5, usedQuantity: 1 },
          { id: 'cr2', serviceId: 's2', employeeId: 'e1', durationOptionId: 'd1',
            unitPriceSnapshot: 10000, totalQuantity: 2, usedQuantity: 0 },
        ],
      },
    ]);
    prisma.sessionPackage.findMany.mockResolvedValue([{ id: 'pkg1', nameAr: 'باقة', nameEn: null }]);
    prisma.service.findMany.mockResolvedValue([
      { id: 's1', nameAr: 'خدمة', nameEn: null, isActive: true, archivedAt: null,
        categoryId: 'cat1',
        category: { id: 'cat1', nameAr: 'عيادة', nameEn: null, bookingMode: 'SERVICES',
          departmentId: 'dep1', department: { id: 'dep1', nameAr: 'قسم', nameEn: null } } },
      { id: 's2', nameAr: 'خدمة محذوفة', nameEn: null, isActive: false, archivedAt: new Date('2026-06-02'),
        categoryId: 'cat1',
        category: { id: 'cat1', nameAr: 'عيادة', nameEn: null, bookingMode: 'SERVICES',
          departmentId: 'dep1', department: { id: 'dep1', nameAr: 'قسم', nameEn: null } } },
    ]);
    prisma.employee.findMany.mockResolvedValue([{ id: 'e1', name: 'Emp', nameAr: 'موظف', nameEn: null, isActive: true }]);
    prisma.serviceDurationOption.findMany.mockResolvedValue([{ id: 'd1', labelAr: '٤٥ د', label: '45m', durationMins: 45 }]);

    const handler = new ListClientPackagePurchasesHandler(prisma as never);
    const rows = await handler.execute({ clientId: 'c1' });
    const [active, archived] = rows[0].credits;
    expect(active).toEqual(expect.objectContaining({
      categoryId: 'cat1', categoryNameAr: 'عيادة', categoryBookingMode: 'SERVICES',
      departmentId: 'dep1', departmentNameAr: 'قسم', serviceIsBookable: true,
    }));
    expect(archived.serviceIsBookable).toBe(false);
  });
});