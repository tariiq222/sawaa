import { ListBookingsHandler } from './list-bookings.handler';
import { buildPrisma, mockBooking } from '../testing/booking-test-helpers';
import { BookingStatus, DeliveryType } from '@prisma/client';

describe('ListBookingsHandler', () => {
  it.each([
    ['middle name', 'Codex', 'middleName'],
    ['legacy full name', 'اختبار حجز Codex 6b135e40', 'name'],
    ['first name', 'اختبار', 'firstName'],
    ['last name', '6b135e40', 'lastName'],
    ['phone', '+966500000001', 'phone'],
  ])('searches clients by %s before filtering bookings', async (_label, search, field) => {
    const prisma = buildPrisma();
    prisma.client.findMany = jest.fn().mockResolvedValue([{ id: 'client-match' }]);

    await new ListBookingsHandler(prisma as never).execute({ search, page: 2, limit: 10, status: 'CONFIRMED' });

    expect(prisma.client.findMany).toHaveBeenCalledWith({
      where: { OR: expect.arrayContaining([{ [field]: { contains: search, mode: 'insensitive' } }]) },
      select: { id: true },
    });
    const expectedWhere = {
      status: 'CONFIRMED',
      OR: [{ id: { contains: search, mode: 'insensitive' } }, { clientId: { in: ['client-match'] } }],
    };
    expect(prisma.booking.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expectedWhere, skip: 10, take: 10,
    }));
    expect(prisma.booking.count).toHaveBeenCalledWith({ where: expectedWhere });
  });

  it.each([
    ['  اختبار   حجز Codex 6b135e40  ', ['اختبار', 'حجز', 'Codex', '6b135e40']],
    ['اختبار 6b135e40', ['اختبار', '6b135e40']],
  ])('requires every full-name token across all name fields for %s', async (search, tokens) => {
    const prisma = buildPrisma();
    await new ListBookingsHandler(prisma as never).execute({ search, page: 1, limit: 10 });

    expect(prisma.client.findMany).toHaveBeenCalledWith({
      where: {
        OR: expect.arrayContaining([{
          AND: tokens.map((token) => ({
            OR: expect.arrayContaining([
              { name: { contains: token, mode: 'insensitive' } },
              { firstName: { contains: token, mode: 'insensitive' } },
              { middleName: { contains: token, mode: 'insensitive' } },
              { lastName: { contains: token, mode: 'insensitive' } },
            ]),
          })),
        }]),
      },
      select: { id: true },
    });
  });

  it('keeps numeric booking lookup when no client matches', async () => {
    const prisma = buildPrisma();
    prisma.client.findMany = jest.fn().mockResolvedValue([]);
    await new ListBookingsHandler(prisma as never).execute({ search: ' 12345 ', page: 1, limit: 10 });
    expect(prisma.booking.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: [{ id: { contains: '12345', mode: 'insensitive' } }, { bookingNumber: 12345 }] },
    }));
  });

  it.each([
    ['upcoming', { notIn: ['COMPLETED', 'NO_SHOW', 'CANCELLED', 'CANCEL_REQUESTED', 'EXPIRED'] }],
    ['past', { in: ['COMPLETED', 'NO_SHOW'] }],
    ['cancelled', { in: ['CANCELLED', 'CANCEL_REQUESTED', 'EXPIRED'] }],
  ] as const)('filters the %s tab before pagination and counting', async (tab, status) => {
    const prisma = buildPrisma();
    prisma.booking.findMany = jest.fn().mockResolvedValue([]);
    await new ListBookingsHandler(prisma as never).execute({ clientId: 'client-1', page: 2, limit: 50, clientTab: tab });
    expect(prisma.booking.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { clientId: 'client-1', AND: [{ status }] }, skip: 50, take: 50,
    }));
    expect(prisma.booking.count).toHaveBeenCalledWith({ where: { clientId: 'client-1', AND: [{ status }] } });
  });

  it('returns paginated bookings', async () => {
    const prisma = buildPrisma();
    prisma.booking.findMany = jest.fn().mockResolvedValue([mockBooking]);
    const result = await new ListBookingsHandler(prisma as never).execute({
      page: 1, limit: 10,
    });
    expect(result.items).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  it('loads package funding in batches and exposes it on the matching booking', async () => {
    const prisma = buildPrisma();
    prisma.booking.findMany = jest.fn().mockResolvedValue([
      { ...mockBooking, packageCreditId: 'credit-1' },
    ]);
    prisma.packageCreditUsage.findMany = jest.fn().mockResolvedValue([
      { bookingId: 'book-1', creditId: 'credit-1', status: 'CONSUMED' },
    ]);
    prisma.packageCredit.findMany = jest.fn().mockResolvedValue([
      { id: 'credit-1', purchaseId: 'purchase-1', netValue: 2910_00, totalQuantity: 10 },
    ]);
    prisma.packagePurchase.findMany = jest.fn().mockResolvedValue([
      { id: 'purchase-1', packageId: 'package-1' },
    ]);
    prisma.sessionPackage.findMany = jest.fn().mockResolvedValue([
      { id: 'package-1', nameAr: 'باقة الجلسات', nameEn: 'Session package' },
    ]);

    const result = await new ListBookingsHandler(prisma as never).execute({ page: 1, limit: 10 });

    expect(result.items[0]?.packageFunding).toEqual({
      creditId: 'credit-1',
      purchaseId: 'purchase-1',
      packageId: 'package-1',
      packageNameAr: 'باقة الجلسات',
      packageNameEn: 'Session package',
      usageStatus: 'CONSUMED',
      sessionValue: 291_00,
    });
    expect(prisma.packageCreditUsage.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.packageCredit.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.packagePurchase.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.sessionPackage.findMany).toHaveBeenCalledTimes(1);
  });

  it('maps a null sessionValue when the credit has no netValue and the purchase cannot be resolved', async () => {
    const prisma = buildPrisma();
    prisma.booking.findMany = jest.fn().mockResolvedValue([
      { ...mockBooking, packageCreditId: 'credit-1' },
    ]);
    prisma.packageCreditUsage.findMany = jest.fn().mockResolvedValue([
      { bookingId: 'book-1', creditId: 'credit-1', status: 'RESERVED' },
    ]);
    prisma.packageCredit.findMany = jest
      .fn()
      // First call: credits directly referenced by the page's bookings.
      .mockResolvedValueOnce([
        { id: 'credit-1', purchaseId: 'purchase-1', netValue: null, totalQuantity: 10 },
      ])
      // Second call: fallback sibling-credit batch load — empty means the
      // purchase's credits could not be resolved.
      .mockResolvedValueOnce([]);
    prisma.packagePurchase.findMany = jest.fn().mockResolvedValue([
      { id: 'purchase-1', packageId: 'package-1', amountPaid: 0, refundAmount: 0 },
    ]);
    prisma.sessionPackage.findMany = jest.fn().mockResolvedValue([
      { id: 'package-1', nameAr: 'باقة الجلسات', nameEn: 'Session package' },
    ]);

    const result = await new ListBookingsHandler(prisma as never).execute({ page: 1, limit: 10 });

    expect(result.items[0]?.packageFunding?.sessionValue).toBeNull();
  });

  // Phase 0 added `netValue` to PackageCredit; every credit issued before that
  // migration has netValue: null. sessionValue must fall back to allocating
  // the parent purchase's net amount (amountPaid − refundAmount) across ALL
  // sibling credits by list value, same as the outstanding-credit report.
  it('falls back to allocatePurchaseNet when netValue is null, using the purchase amountPaid', async () => {
    const prisma = buildPrisma();
    prisma.booking.findMany = jest.fn().mockResolvedValue([
      { ...mockBooking, packageCreditId: 'credit-1' },
    ]);
    prisma.packageCreditUsage.findMany = jest.fn().mockResolvedValue([
      { bookingId: 'book-1', creditId: 'credit-1', status: 'CONSUMED' },
    ]);
    prisma.packageCredit.findMany = jest
      .fn()
      .mockResolvedValueOnce([
        { id: 'credit-1', purchaseId: 'purchase-1', netValue: null, totalQuantity: 6 },
      ])
      // Sibling-credit batch load for the fallback: this purchase has a
      // single credit, so it gets the full purchase net amount.
      .mockResolvedValueOnce([
        { id: 'credit-1', purchaseId: 'purchase-1', unitPriceSnapshot: 29166, totalQuantity: 6 },
      ]);
    prisma.packagePurchase.findMany = jest.fn().mockResolvedValue([
      { id: 'purchase-1', packageId: 'package-1', amountPaid: 175000, refundAmount: 0 },
    ]);
    prisma.sessionPackage.findMany = jest.fn().mockResolvedValue([
      { id: 'package-1', nameAr: 'باقة الجلسات', nameEn: 'Session package' },
    ]);

    const result = await new ListBookingsHandler(prisma as never).execute({ page: 1, limit: 10 });

    expect(result.items[0]?.packageFunding?.sessionValue).toBe(29166);
    // Batched — one query for the whole page's sibling credits, not one per booking.
    expect(prisma.packageCredit.findMany).toHaveBeenCalledTimes(2);
  });

  it('loads Booknetic payment metadata for imported booking rows', async () => {
    const prisma = buildPrisma() as ReturnType<typeof buildPrisma> & {
      legacyImportRecord: { findMany: jest.Mock };
    };
    prisma.booking.findMany = jest.fn().mockResolvedValue([
      { ...mockBooking, isHistoricalImport: true, status: BookingStatus.CONFIRMED },
    ]);
    prisma.legacyImportRecord.findMany = jest.fn().mockResolvedValue([
        {
          targetId: 'book-1',
          metadata: { paymentStatus: 'paid', paymentMethod: 'local', paidAmount: '200.0000' },
        },
      ]);

    const result = await new ListBookingsHandler(prisma as never).execute({ page: 1, limit: 10 });

    expect(result.items[0]?.historicalPayment).toEqual({
      status: 'paid',
      amount: 20000,
      method: 'local',
      requiresReview: false,
    });
    expect(prisma.legacyImportRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ targetId: { in: ['book-1'] } }),
      }),
    );
  });

  it('does not load legacy payment metadata for a linked operational booking', async () => {
    const prisma = buildPrisma() as ReturnType<typeof buildPrisma> & {
      legacyImportRecord: { findMany: jest.Mock };
    };
    prisma.booking.findMany = jest.fn().mockResolvedValue([
      { ...mockBooking, isHistoricalImport: false },
    ]);

    const result = await new ListBookingsHandler(prisma as never).execute({ page: 1, limit: 10 });

    expect(prisma.legacyImportRecord.findMany).not.toHaveBeenCalled();
    expect(result.items[0]?.historicalPayment).toBeNull();
  });

  it('filters by status when provided', async () => {
    const prisma = buildPrisma();
    const handler = new ListBookingsHandler(prisma as never);
    await handler.execute({ status: BookingStatus.CONFIRMED, page: 1, limit: 10 });
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: BookingStatus.CONFIRMED }) }),
    );
  });

  it('filters by branchId and employeeId', async () => {
    const prisma = buildPrisma();
    const handler = new ListBookingsHandler(prisma as never);
    await handler.execute({ branchId: 'branch-1', employeeId: 'emp-1', page: 1, limit: 10 });
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ branchId: 'branch-1', employeeId: 'emp-1' }),
      }),
    );
  });

  it('filters by deliveryType when provided', async () => {
    const prisma = buildPrisma();
    const handler = new ListBookingsHandler(prisma as never);
    await handler.execute({ deliveryType: DeliveryType.ONLINE, page: 1, limit: 10 });
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deliveryType: DeliveryType.ONLINE }),
      }),
    );
  });

  it('resolves isGuest=false to non-online client IDs (no booking.client relation)', async () => {
    const prisma = buildPrisma();
    prisma.client.findMany = jest.fn().mockResolvedValue([{ id: 'c-1' }, { id: 'c-2' }]);
    const handler = new ListBookingsHandler(prisma as never);
    await handler.execute({ isGuest: false, page: 1, limit: 10 });
    expect(prisma.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { source: { not: 'ONLINE' } } }),
    );
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ clientId: { in: ['c-1', 'c-2'] } }),
      }),
    );
  });

  it('includes date range filtering', async () => {
    const prisma = buildPrisma();
    const handler = new ListBookingsHandler(prisma as never);
    const fromDate = new Date('2026-01-01');
    const toDate = new Date('2026-01-31');
    await handler.execute({ fromDate, toDate, page: 1, limit: 10 });
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ scheduledAt: { gte: fromDate, lte: toDate } }),
      }),
    );
  });

  it('returns correct pagination metadata', async () => {
    const prisma = buildPrisma();
    prisma.booking.count = jest.fn().mockResolvedValue(25);
    const handler = new ListBookingsHandler(prisma as never);
    const result = await handler.execute({ page: 2, limit: 10 });
    expect(result.meta.totalPages).toBe(3);
    expect(result.meta.page).toBe(2);
    expect(result.meta.limit).toBe(10);
  });

  it('auto-filters by Employee when role=EMPLOYEE', async () => {
    const prisma = buildPrisma();
    prisma.employee.findFirst = jest.fn().mockResolvedValueOnce({ id: 'emp-9' });
    const handler = new ListBookingsHandler(prisma as never);
    await handler.execute({
      role: 'EMPLOYEE',
      userId: 'user-emp',
      page: 1,
      limit: 10,
    });
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ employeeId: 'emp-9' }),
      }),
    );
  });

  it('returns empty page for EMPLOYEE with no Employee row', async () => {
    const prisma = buildPrisma();
    prisma.employee.findFirst = jest.fn().mockResolvedValueOnce(null);
    prisma.booking.findMany = jest.fn();
    const handler = new ListBookingsHandler(prisma as never);
    const result = await handler.execute({
      role: 'EMPLOYEE',
      userId: 'orphan',
      page: 1,
      limit: 10,
    });
    expect(result.items).toEqual([]);
    expect(result.meta.total).toBe(0);
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
  });

  // Regression: BK-LIST-500 — a malformed Booking row with null status /
  // endsAt / scheduledAt must NOT 500 the dashboard list endpoint. Before
  // the guard, mapBookingRow called `.toLowerCase()` / `.toUpperCase()` /
  // formatInTimeZone() on the bad values and threw, aborting the response
  // for every row.
  it('does not throw on a row with null status / null endsAt / null scheduledAt', async () => {
    const prisma = buildPrisma();
    const malformed = {
      ...mockBooking,
      status: null,
      scheduledAt: null,
      endsAt: null,
    } as unknown as { id: string; clientId: string; employeeId: string; serviceId: string | null; isHistoricalImport: boolean };
    prisma.booking.findMany = jest.fn().mockResolvedValue([malformed]);
    const handler = new ListBookingsHandler(prisma as never);
    const result = await handler.execute({ page: 1, limit: 10 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.status).toBe('');
    expect(result.items[0]?.date).toBeNull();
    expect(result.items[0]?.startTime).toBeNull();
    expect(result.items[0]?.endTime).toBeNull();
  });

  // Regression: BK-LIST-500 — the dashboard list query must use an explicit
  // narrow `select` so it does not name columns that may not yet exist on the
  // live dev DB (e.g. `Booking.creationIdempotencyKey`, added by migration
  // `20260813000001_unified_web_chat` and missing from a freshly-migrated DB
  // before that migration runs). Without this select, the generated SQL
  // includes every Booking column and Postgres raises
  // `column ... does not exist in the current database` → 500.
  it('issues findMany with a narrow select (no creationIdempotencyKey, no zoomCreatePhase)', async () => {
    const prisma = buildPrisma();
    const handler = new ListBookingsHandler(prisma as never);
    await handler.execute({ page: 1, limit: 10 });
    const args = (prisma.booking.findMany as jest.Mock).mock.calls[0]?.[0] as {
      select?: Record<string, unknown>;
    };
    expect(args.select).toBeDefined();
    expect(Object.keys(args.select ?? {}).sort()).toEqual([
      'bookingNumber',
      'bookingType',
      'branchNameSnapshot',
      'cancelReason',
      'cancelledAt',
      'categoryNameSnapshot',
      'checkedInAt',
      'clientId',
      'completedAt',
      'confirmedAt',
      'createdAt',
      'deliveryType',
      'durationMinutesSnapshot',
      'employeeId',
      'endsAt',
      'id',
      'isHistoricalImport',
      'notes',
      'packageCreditId',
      'priceSnapshot',
      'scheduledAt',
      'serviceId',
      'source',
      'status',
      'updatedAt',
      'zoomHostUrl',
      'zoomJoinUrl',
      'zoomMeetingError',
      'zoomMeetingStatus',
      'zoomStartUrl',
    ]);
    // Explicit guard: these columns must NEVER appear in the list SELECT.
    // Naming any of them is the exact regression we are guarding against.
    expect(args.select).not.toHaveProperty('creationIdempotencyKey');
    expect(args.select).not.toHaveProperty('creationRequestHash');
    expect(args.select).not.toHaveProperty('zoomCreatePhase');
    expect(args.select).not.toHaveProperty('zoomCreateAttemptCount');
    expect(args.select).not.toHaveProperty('zoomSyncRevision');
  });
});
