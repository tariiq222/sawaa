import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  PackageConstraintDimension,
  PackageConstraintMode,
  PackagePurchaseStatus,
  Prisma,
} from '@prisma/client';
import { BookFromCreditHandler } from './book-from-credit.handler';

// ─── Canonical ids ───────────────────────────────────────────────────────────
const CLIENT_ID = '00000000-0000-4000-a000-000000000001';
const BRANCH_ID = '00000000-0000-4000-a000-000000000002';
const EMPLOYEE_ID = '00000000-0000-4000-a000-000000000003';
const SERVICE_ID = '00000000-0000-4000-a000-000000000004';
const DURATION_OPTION_ID = '00000000-0000-4000-a000-000000000005';
const CREDIT_ID = '00000000-0000-4000-a000-000000000006';
const PURCHASE_ID = '00000000-0000-4000-a000-000000000007';
const BOOKING_ID = '00000000-0000-4000-a000-000000000008';

const FUTURE = new Date(Date.now() + 3 * 86_400_000); // 3 days out

const DURATION_OPTION = {
  id: DURATION_OPTION_ID,
  serviceId: SERVICE_ID,
  durationMins: 45,
  deliveryType: 'IN_PERSON',
};

/**
 * Legacy credits carry no snapshot constraints — the matching engine falls
 * back to synthesizing INCLUDE constraints from the credit's own triple, so
 * an empty array here reproduces the pre-flexible-packages equality match.
 */
const LEGACY_CONSTRAINTS: Array<{
  dimension: PackageConstraintDimension;
  mode: PackageConstraintMode;
  targets: { targetId: string }[];
}> = [];

/** A locked-credit row as returned by the `SELECT ... FOR UPDATE` raw query. */
function lockedCreditRow(overrides: Partial<{ usedQuantity: number; totalQuantity: number }> = {}) {
  return {
    id: CREDIT_ID,
    purchaseId: PURCHASE_ID,
    serviceId: SERVICE_ID,
    employeeId: EMPLOYEE_ID,
    durationOptionId: DURATION_OPTION_ID,
    totalQuantity: 5,
    usedQuantity: 0,
    ...overrides,
  };
}

function buildTx(lockedCredit = lockedCreditRow()) {
  const tx = {
    // FOR UPDATE raw select returns an array of rows.
    $queryRaw: jest.fn().mockResolvedValue([lockedCredit]),
    $executeRaw: jest.fn().mockResolvedValue(undefined),
    booking: {
      findFirst: jest.fn().mockResolvedValue(null), // no overlap by default
      create: jest.fn().mockResolvedValue({
        id: BOOKING_ID,
        bookingNumber: 42,
        clientId: CLIENT_ID,
        employeeId: EMPLOYEE_ID,
        serviceId: SERVICE_ID,
        scheduledAt: FUTURE,
        status: 'CONFIRMED',
      }),
    },
    packageCreditUsage: { create: jest.fn().mockResolvedValue({ id: 'usage-1' }) },
    packageCredit: {
      update: jest.fn().mockResolvedValue({ id: CREDIT_ID }),
      // After increment, used==total → triggers auto-complete check. Default: still remaining.
      findMany: jest.fn().mockResolvedValue([
        { id: CREDIT_ID, totalQuantity: 5, usedQuantity: 1 },
      ]),
    },
    packagePurchase: {
      update: jest.fn().mockResolvedValue({ id: PURCHASE_ID }),
      // In-lock parent-purchase status guard — ACTIVE by default.
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: PURCHASE_ID, status: PackagePurchaseStatus.ACTIVE }),
    },
    invoice: { create: jest.fn() }, // must NEVER be called
    outboxEvent: { create: jest.fn().mockResolvedValue({ id: 'outbox-1' }) },
    activityLog: { create: jest.fn().mockResolvedValue({ id: 'log-1' }) },
  };
  return tx;
}

function buildPrisma() {
  return {
    client: { findFirst: jest.fn().mockResolvedValue({ id: CLIENT_ID }) },
    branch: { findFirst: jest.fn().mockResolvedValue({ id: BRANCH_ID, nameAr: 'فرع', isActive: true }) },
    employee: { findFirst: jest.fn().mockResolvedValue({ id: EMPLOYEE_ID, name: 'معالج', isActive: true }) },
    service: {
      findFirst: jest.fn().mockResolvedValue({ id: SERVICE_ID, nameAr: 'خدمة', categoryId: null, isActive: true, archivedAt: null, bufferMinutes: 0 }),
    },
    serviceDurationOption: { findFirst: jest.fn().mockResolvedValue(DURATION_OPTION) },
    // `fields` mirrors Prisma's field-reference API used for the column-to-column
    // `usedQuantity < totalQuantity` filter in resolveCreditAndTarget.
    // `findFirst` backs the creditId path; `findMany` backs the no-creditId
    // (triple) candidate-search path.
    packageCredit: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      fields: { totalQuantity: 'totalQuantity' },
    },
    serviceCategory: { findFirst: jest.fn().mockResolvedValue(null) },
  };
}

function buildAvailability(slots: Array<{ startTime: Date; endTime: Date }> = [{ startTime: FUTURE, endTime: new Date(FUTURE.getTime() + 45 * 60_000) }]) {
  return { execute: jest.fn().mockResolvedValue(slots) };
}

function buildSettings() {
  return {
    execute: jest.fn().mockResolvedValue({
      bufferMinutes: 0,
      minBookingLeadMinutes: null,
      maxAdvanceBookingDays: null,
    }),
  };
}

function buildHandler(opts: {
  prisma?: ReturnType<typeof buildPrisma>;
  tx?: ReturnType<typeof buildTx>;
  availability?: ReturnType<typeof buildAvailability>;
  settings?: ReturnType<typeof buildSettings>;
} = {}) {
  const prisma = opts.prisma ?? buildPrisma();
  const tx = opts.tx ?? buildTx();
  const availability = opts.availability ?? buildAvailability();
  const settings = opts.settings ?? buildSettings();
  const rls = {
    withTransaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const handler = new BookFromCreditHandler(
    prisma as never,
    rls as never,
    settings as never,
    availability as never,
  );
  return { handler, prisma, tx, availability, settings, rls };
}

const baseCmd = () => ({
  clientId: CLIENT_ID,
  creditId: CREDIT_ID,
  branchId: BRANCH_ID,
  scheduledAt: FUTURE,
  userId: 'user-1',
});

describe('BookFromCreditHandler', () => {
  afterEach(() => jest.clearAllMocks());

  it('is defined', () => {
    const { handler } = buildHandler();
    expect(handler).toBeDefined();
  });

  describe('credit resolution', () => {
    it('uses the explicit creditId when provided (ACTIVE purchase, remaining > 0)', async () => {
      const prisma = buildPrisma();
      prisma.packageCredit.findFirst.mockResolvedValue({
        id: CREDIT_ID, purchaseId: PURCHASE_ID, serviceId: SERVICE_ID,
        employeeId: EMPLOYEE_ID, durationOptionId: DURATION_OPTION_ID,
        totalQuantity: 5, usedQuantity: 0,
        constraints: LEGACY_CONSTRAINTS,
        purchase: { id: PURCHASE_ID, status: PackagePurchaseStatus.ACTIVE },
      });
      const { handler, tx } = buildHandler({ prisma });

      await handler.execute(baseCmd());

      // Resolution looked up the credit by id (not by service/employee/duration triple).
      const findArgs = prisma.packageCredit.findFirst.mock.calls[0][0];
      expect(findArgs.where.id).toBe(CREDIT_ID);
      expect(tx.booking.create).toHaveBeenCalledTimes(1);
    });

    it('FIFO-selects the OLDEST active purchase credit when no creditId is given', async () => {
      const prisma = buildPrisma();
      // No-creditId (triple) path now fetches candidates via findMany, then
      // filters via the matching engine and picks narrowest-then-FIFO in JS.
      prisma.packageCredit.findMany.mockResolvedValue([
        {
          id: CREDIT_ID, purchaseId: PURCHASE_ID, serviceId: SERVICE_ID,
          employeeId: EMPLOYEE_ID, durationOptionId: DURATION_OPTION_ID,
          totalQuantity: 5, usedQuantity: 0,
          constraints: LEGACY_CONSTRAINTS,
        },
      ]);
      const { handler } = buildHandler({ prisma });

      await handler.execute({
        clientId: CLIENT_ID,
        serviceId: SERVICE_ID,
        employeeId: EMPLOYEE_ID,
        durationOptionId: DURATION_OPTION_ID,
        branchId: BRANCH_ID,
        scheduledAt: FUTURE,
      });

      const findArgs = prisma.packageCredit.findMany.mock.calls[0][0];
      // Candidate search filters by the calling client's ACTIVE purchases with
      // remaining capacity; the (service, employee, duration) match itself
      // happens afterwards via the matching engine, not in the where clause.
      expect(findArgs.where.purchase).toEqual(
        expect.objectContaining({ clientId: CLIENT_ID, status: PackagePurchaseStatus.ACTIVE }),
      );
      // FIFO ordering = oldest purchase first.
      expect(findArgs.orderBy).toEqual(
        expect.arrayContaining([{ purchase: { createdAt: 'asc' } }]),
      );
    });

    it('throws NotFoundException when no matching credit with remaining capacity exists', async () => {
      const prisma = buildPrisma();
      prisma.packageCredit.findMany.mockResolvedValue([]);
      const { handler } = buildHandler({ prisma });

      await expect(
        handler.execute({
          clientId: CLIENT_ID,
          serviceId: SERVICE_ID,
          employeeId: EMPLOYEE_ID,
          durationOptionId: DURATION_OPTION_ID,
          branchId: BRANCH_ID,
          scheduledAt: FUTURE,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when neither creditId nor the full triple is supplied', async () => {
      const { handler } = buildHandler();
      await expect(
        handler.execute({ clientId: CLIENT_ID, branchId: BRANCH_ID, scheduledAt: FUTURE } as never),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('flexible credit constraints (creditId + explicit triple)', () => {
    /** A flexible credit with no legacy triple — PRACTITIONER is ANY, everything else unconstrained. */
    function flexibleCreditAnyPractitioner() {
      return {
        id: CREDIT_ID, purchaseId: PURCHASE_ID,
        serviceId: null, employeeId: null, durationOptionId: null,
        totalQuantity: 5, usedQuantity: 0,
        constraints: [
          {
            dimension: PackageConstraintDimension.PRACTITIONER,
            mode: PackageConstraintMode.ANY,
            targets: [],
          },
        ],
        purchase: { id: PURCHASE_ID, status: PackagePurchaseStatus.ACTIVE },
      };
    }

    it('succeeds when the explicit triple satisfies the credit constraints (PRACTITIONER ANY)', async () => {
      const prisma = buildPrisma();
      prisma.packageCredit.findFirst.mockResolvedValue(flexibleCreditAnyPractitioner());
      const { handler, tx } = buildHandler({ prisma });

      await handler.execute({
        clientId: CLIENT_ID,
        creditId: CREDIT_ID,
        serviceId: SERVICE_ID,
        employeeId: EMPLOYEE_ID,
        durationOptionId: DURATION_OPTION_ID,
        branchId: BRANCH_ID,
        scheduledAt: FUTURE,
      });

      expect(tx.booking.create).toHaveBeenCalledTimes(1);
      const bookingData = tx.booking.create.mock.calls[0][0].data;
      expect(bookingData.employeeId).toBe(EMPLOYEE_ID);
      expect(bookingData.serviceId).toBe(SERVICE_ID);
      expect(bookingData.durationOptionId).toBe(DURATION_OPTION_ID);
      expect(bookingData.packageCreditId).toBe(CREDIT_ID);
    });

    it('throws 400 "The selected credit is not valid for this booking" when the triple violates an EXCLUDE constraint', async () => {
      const EXCLUDED_EMPLOYEE_ID = '00000000-0000-4000-a000-000000000099';
      const prisma = buildPrisma();
      prisma.packageCredit.findFirst.mockResolvedValue({
        id: CREDIT_ID, purchaseId: PURCHASE_ID,
        serviceId: null, employeeId: null, durationOptionId: null,
        totalQuantity: 5, usedQuantity: 0,
        constraints: [
          {
            dimension: PackageConstraintDimension.PRACTITIONER,
            mode: PackageConstraintMode.EXCLUDE,
            targets: [{ targetId: EXCLUDED_EMPLOYEE_ID }],
          },
        ],
        purchase: { id: PURCHASE_ID, status: PackagePurchaseStatus.ACTIVE },
      });
      const { handler, tx } = buildHandler({ prisma });

      await expect(
        handler.execute({
          clientId: CLIENT_ID,
          creditId: CREDIT_ID,
          serviceId: SERVICE_ID,
          employeeId: EXCLUDED_EMPLOYEE_ID, // the one practitioner this credit excludes
          durationOptionId: DURATION_OPTION_ID,
          branchId: BRANCH_ID,
          scheduledAt: FUTURE,
        }),
      ).rejects.toThrow(new BadRequestException('The selected credit is not valid for this booking'));
      expect(tx.booking.create).not.toHaveBeenCalled();
    });

    it('throws 400 when a creditId-only flexible credit (no legacy triple) is booked without an explicit target', async () => {
      const prisma = buildPrisma();
      prisma.packageCredit.findFirst.mockResolvedValue(flexibleCreditAnyPractitioner());
      const { handler } = buildHandler({ prisma });

      await expect(
        handler.execute({
          clientId: CLIENT_ID,
          creditId: CREDIT_ID,
          branchId: BRANCH_ID,
          scheduledAt: FUTURE,
        } as never),
      ).rejects.toThrow(
        new BadRequestException('This credit needs an explicit service, practitioner and duration'),
      );
    });
  });

  describe('fixed duration from the credit', () => {
    it('takes the duration from the credit durationOptionId and ignores any caller-supplied duration', async () => {
      const prisma = buildPrisma();
      prisma.packageCredit.findFirst.mockResolvedValue({
        id: CREDIT_ID, purchaseId: PURCHASE_ID, serviceId: SERVICE_ID,
        employeeId: EMPLOYEE_ID, durationOptionId: DURATION_OPTION_ID,
        totalQuantity: 5, usedQuantity: 0,
        constraints: LEGACY_CONSTRAINTS,
        purchase: { id: PURCHASE_ID, status: PackagePurchaseStatus.ACTIVE },
      });
      // duration option says 45 mins.
      prisma.serviceDurationOption.findFirst.mockResolvedValue({ ...DURATION_OPTION, durationMins: 45 });
      const { handler, tx } = buildHandler({ prisma });

      // Caller tries to sneak a different duration — must be ignored.
      await handler.execute({ ...baseCmd(), durationMins: 999 } as never);

      const bookingData = tx.booking.create.mock.calls[0][0].data;
      expect(bookingData.durationMins).toBe(45);
      // endsAt must be scheduledAt + 45 min.
      expect(new Date(bookingData.endsAt).getTime() - new Date(bookingData.scheduledAt).getTime()).toBe(45 * 60_000);
    });
  });

  describe('zero-value booking', () => {
    function mockResolvedCredit(prisma: ReturnType<typeof buildPrisma>) {
      prisma.packageCredit.findFirst.mockResolvedValue({
        id: CREDIT_ID, purchaseId: PURCHASE_ID, serviceId: SERVICE_ID,
        employeeId: EMPLOYEE_ID, durationOptionId: DURATION_OPTION_ID,
        totalQuantity: 5, usedQuantity: 0,
        constraints: LEGACY_CONSTRAINTS,
        purchase: { id: PURCHASE_ID, status: PackagePurchaseStatus.ACTIVE },
      });
    }

    it('creates the booking with price=0, discountedPrice=0 and packageCreditId set', async () => {
      const prisma = buildPrisma();
      mockResolvedCredit(prisma);
      const { handler, tx } = buildHandler({ prisma });

      await handler.execute(baseCmd());

      const bookingData = tx.booking.create.mock.calls[0][0].data;
      expect(Number(bookingData.price)).toBe(0);
      expect(Number(bookingData.discountedPrice)).toBe(0);
      expect(Number(bookingData.priceSnapshot)).toBe(0);
      expect(bookingData.packageCreditId).toBe(CREDIT_ID);
      expect(bookingData.status).toBe('CONFIRMED');
    });

    it('does NOT create any invoice (credit bookings have zero monetary value)', async () => {
      const prisma = buildPrisma();
      mockResolvedCredit(prisma);
      const { handler, tx } = buildHandler({ prisma });

      await handler.execute(baseCmd());

      expect(tx.invoice.create).not.toHaveBeenCalled();
    });

    it('records a CONSUMED PackageCreditUsage linked to the booking', async () => {
      const prisma = buildPrisma();
      mockResolvedCredit(prisma);
      const { handler, tx } = buildHandler({ prisma });

      await handler.execute(baseCmd());

      expect(tx.packageCreditUsage.create).toHaveBeenCalledTimes(1);
      const usageData = tx.packageCreditUsage.create.mock.calls[0][0].data;
      expect(usageData.creditId).toBe(CREDIT_ID);
      expect(usageData.bookingId).toBe(BOOKING_ID);
      expect(usageData.status).toBe('CONSUMED');
    });

    it('increments credit.usedQuantity by 1 via an id-keyed update', async () => {
      const prisma = buildPrisma();
      mockResolvedCredit(prisma);
      const { handler, tx } = buildHandler({ prisma });

      await handler.execute(baseCmd());

      expect(tx.packageCredit.update).toHaveBeenCalledWith({
        where: { id: CREDIT_ID },
        data: { usedQuantity: { increment: 1 } },
      });
    });

    it('P1-2: writes a PackageCreditUsage ActivityLog row with the acting user and target client', async () => {
    const prisma = buildPrisma();
    prisma.packageCredit.findFirst.mockResolvedValue({
      id: CREDIT_ID, purchaseId: PURCHASE_ID, serviceId: SERVICE_ID,
      employeeId: EMPLOYEE_ID, durationOptionId: DURATION_OPTION_ID,
      totalQuantity: 5, usedQuantity: 0,
      constraints: LEGACY_CONSTRAINTS,
    });
    const { handler, tx } = buildHandler({ prisma });
    const STAFF_USER_ID = 'staff-user-99';

    await handler.execute({ ...baseCmd(), userId: STAFF_USER_ID });

    expect(tx.activityLog.create).toHaveBeenCalledTimes(1);
    const call = tx.activityLog.create.mock.calls[0][0];
    expect(call.data).toEqual(
      expect.objectContaining({
        userId: STAFF_USER_ID,
        action: 'CREATE',
        entity: 'PackageCreditUsage',
        entityId: CREDIT_ID,
        description: expect.stringContaining('session-package credit'),
        metadata: expect.objectContaining({
          targetClientId: CLIENT_ID,
          creditId: CREDIT_ID,
          purchaseId: PURCHASE_ID,
          employeeId: EMPLOYEE_ID,
          bookingNumber: 1,
        }),
      }),
    );
  });

  it('P1-2: falls back to clientId as actor when the controller did not pass userId', async () => {
    // The /me/* client-side endpoint (if ever wired) would not pass userId
    // because the JWT claim lives on a different namespace. The audit row
    // MUST still record SOMETHING as the actor, so we fall back to the
    // clientId of the booking — which is the worst case the handler can
    // accept (no orphan audit row).
    const prisma = buildPrisma();
    prisma.packageCredit.findFirst.mockResolvedValue({
      id: CREDIT_ID, purchaseId: PURCHASE_ID, serviceId: SERVICE_ID,
      employeeId: EMPLOYEE_ID, durationOptionId: DURATION_OPTION_ID,
      totalQuantity: 5, usedQuantity: 0,
      constraints: LEGACY_CONSTRAINTS,
    });
    const { handler, tx } = buildHandler({ prisma });
    const cmdWithoutUserId = { ...baseCmd() } as Record<string, unknown>;
    delete cmdWithoutUserId.userId;

    await handler.execute(cmdWithoutUserId as never);

    expect(tx.activityLog.create).toHaveBeenCalledTimes(1);
    const call = tx.activityLog.create.mock.calls[0][0];
    expect(call.data.userId).toBe(CLIENT_ID);
  });

  it('writes a BookingCreatedEvent to the outbox inside the transaction', async () => {
      const prisma = buildPrisma();
      mockResolvedCredit(prisma);
      const { handler, tx } = buildHandler({ prisma });

      await handler.execute(baseCmd());

      expect(tx.outboxEvent.create).toHaveBeenCalledTimes(1);
      const outboxData = tx.outboxEvent.create.mock.calls[0][0].data;
      expect(outboxData.eventType).toBe('bookings.booking.created');
      expect(outboxData.aggregateId).toBe(BOOKING_ID);
    });
  });

  describe('availability + conflict checks (same as a normal booking)', () => {
    function mockResolvedCredit(prisma: ReturnType<typeof buildPrisma>) {
      prisma.packageCredit.findFirst.mockResolvedValue({
        id: CREDIT_ID, purchaseId: PURCHASE_ID, serviceId: SERVICE_ID,
        employeeId: EMPLOYEE_ID, durationOptionId: DURATION_OPTION_ID,
        totalQuantity: 5, usedQuantity: 0,
        constraints: LEGACY_CONSTRAINTS,
        purchase: { id: PURCHASE_ID, status: PackagePurchaseStatus.ACTIVE },
      });
    }

    it('rejects when the requested slot is not in the availability result', async () => {
      const prisma = buildPrisma();
      mockResolvedCredit(prisma);
      const availability = buildAvailability([]); // no slots
      const { handler } = buildHandler({ prisma, availability });

      await expect(handler.execute(baseCmd())).rejects.toThrow(BadRequestException);
    });

    it('acquires a pg_advisory_xact_lock keyed by employee + slot before the overlap check', async () => {
      const prisma = buildPrisma();
      mockResolvedCredit(prisma);
      const { handler, tx } = buildHandler({ prisma });

      await handler.execute(baseCmd());

      // First $executeRaw call must be the advisory lock.
      expect(tx.$executeRaw).toHaveBeenCalled();
    });

    it('rejects with 409 when the employee already has an overlapping booking', async () => {
      const prisma = buildPrisma();
      mockResolvedCredit(prisma);
      const tx = buildTx();
      tx.booking.findFirst.mockResolvedValue({ id: 'other-booking' }); // overlap present
      const { handler } = buildHandler({ prisma, tx });

      await expect(handler.execute(baseCmd())).rejects.toThrow(ConflictException);
      expect(tx.booking.create).not.toHaveBeenCalled();
    });

    it('rejects a booking scheduled in the past', async () => {
      const prisma = buildPrisma();
      mockResolvedCredit(prisma);
      const { handler } = buildHandler({ prisma });

      await expect(
        handler.execute({ ...baseCmd(), scheduledAt: new Date(Date.now() - 60_000) }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('OVERDRAW GUARD (concurrency — the critical case)', () => {
    it('rejects the booking when the FOR UPDATE recount shows usedQuantity == totalQuantity', async () => {
      // Simulate the LAST credit already fully consumed by a concurrent winner:
      // the FOR UPDATE row read inside the lock shows used == total.
      const prisma = buildPrisma();
      prisma.packageCredit.findFirst.mockResolvedValue({
        id: CREDIT_ID, purchaseId: PURCHASE_ID, serviceId: SERVICE_ID,
        employeeId: EMPLOYEE_ID, durationOptionId: DURATION_OPTION_ID,
        totalQuantity: 1, usedQuantity: 0, // pre-lock view: looked available
        constraints: LEGACY_CONSTRAINTS,
        purchase: { id: PURCHASE_ID, status: PackagePurchaseStatus.ACTIVE },
      });
      const tx = buildTx(lockedCreditRow({ totalQuantity: 1, usedQuantity: 1 })); // locked view: exhausted
      const { handler } = buildHandler({ prisma, tx });

      await expect(handler.execute(baseCmd())).rejects.toThrow(ConflictException);
      // The overdraw guard must fire BEFORE any mutation.
      expect(tx.booking.create).not.toHaveBeenCalled();
      expect(tx.packageCredit.update).not.toHaveBeenCalled();
      expect(tx.packageCreditUsage.create).not.toHaveBeenCalled();
    });

    it('exactly one of two concurrent bookings on the LAST credit succeeds; the second is rejected', async () => {
      // Deterministic simulation of the Serializable + FOR UPDATE recount.
      // A shared in-memory credit row models the DB row under the lock; the
      // FOR UPDATE select returns the CURRENT used/total, and the increment
      // mutates it — so the second caller's recount sees used == total.
      const credit = { id: CREDIT_ID, purchaseId: PURCHASE_ID, totalQuantity: 1, usedQuantity: 0 };

      const makeTx = () => {
        const tx = buildTx();
        tx.$queryRaw = jest.fn().mockImplementation(() =>
          Promise.resolve([{ ...lockedCreditRow(), totalQuantity: credit.totalQuantity, usedQuantity: credit.usedQuantity }]),
        );
        tx.packageCredit.update = jest.fn().mockImplementation((args: { data: { usedQuantity: { increment: number } } }) => {
          credit.usedQuantity += args.data.usedQuantity.increment;
          return Promise.resolve({ id: CREDIT_ID });
        });
        tx.packageCredit.findMany = jest.fn().mockResolvedValue([
          { id: CREDIT_ID, totalQuantity: credit.totalQuantity, usedQuantity: credit.usedQuantity },
        ]);
        return tx;
      };

      const resolvedCredit = {
        id: CREDIT_ID, purchaseId: PURCHASE_ID, serviceId: SERVICE_ID,
        employeeId: EMPLOYEE_ID, durationOptionId: DURATION_OPTION_ID,
        totalQuantity: 1, usedQuantity: 0,
        constraints: LEGACY_CONSTRAINTS,
        purchase: { id: PURCHASE_ID, status: PackagePurchaseStatus.ACTIVE },
      };

      const prismaA = buildPrisma();
      prismaA.packageCredit.findFirst.mockResolvedValue(resolvedCredit);
      const prismaB = buildPrisma();
      prismaB.packageCredit.findFirst.mockResolvedValue(resolvedCredit);

      const { handler: handlerA } = buildHandler({ prisma: prismaA, tx: makeTx() });
      const { handler: handlerB } = buildHandler({ prisma: prismaB, tx: makeTx() });

      // Serializable + FOR UPDATE serialize these: run sequentially (the lock
      // forces one-at-a-time). First wins, second sees the exhausted recount.
      const first = await handlerA.execute(baseCmd());
      expect(first).toBeDefined();

      await expect(handlerB.execute(baseCmd())).rejects.toThrow(ConflictException);
      expect(credit.usedQuantity).toBe(1); // exactly one consumed — no over-draw
    });
  });

  describe('REFUNDED purchase guard (finance-safety)', () => {
    function mockResolvedCredit(prisma: ReturnType<typeof buildPrisma>) {
      prisma.packageCredit.findFirst.mockResolvedValue({
        id: CREDIT_ID, purchaseId: PURCHASE_ID, serviceId: SERVICE_ID,
        employeeId: EMPLOYEE_ID, durationOptionId: DURATION_OPTION_ID,
        totalQuantity: 5, usedQuantity: 0,
        constraints: LEGACY_CONSTRAINTS,
        purchase: { id: PURCHASE_ID, status: PackagePurchaseStatus.ACTIVE },
      });
    }

    it('rejects booking when the parent purchase is REFUNDED, even if the credit still shows remaining', async () => {
      // The credit row itself still has remaining capacity (used < total), but
      // its parent purchase was refunded after resolveCredit read it. The in-lock
      // status guard must reject so a refunded purchase's credit is never bookable.
      const prisma = buildPrisma();
      mockResolvedCredit(prisma);
      const tx = buildTx(lockedCreditRow({ totalQuantity: 5, usedQuantity: 0 }));
      tx.packagePurchase.findUnique.mockResolvedValue({
        id: PURCHASE_ID,
        status: PackagePurchaseStatus.REFUNDED,
      });
      const { handler } = buildHandler({ prisma, tx });

      await expect(handler.execute(baseCmd())).rejects.toThrow(BadRequestException);
      // No mutation may happen for a refunded purchase's credit.
      expect(tx.booking.create).not.toHaveBeenCalled();
      expect(tx.packageCredit.update).not.toHaveBeenCalled();
      expect(tx.packageCreditUsage.create).not.toHaveBeenCalled();
    });

    it('queries the parent purchase status under the credit row lock', async () => {
      const prisma = buildPrisma();
      mockResolvedCredit(prisma);
      const { handler, tx } = buildHandler({ prisma });

      await handler.execute(baseCmd());

      expect(tx.packagePurchase.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: PURCHASE_ID } }),
      );
    });
  });

  describe('purchase auto-complete', () => {
    function mockResolvedCredit(prisma: ReturnType<typeof buildPrisma>) {
      prisma.packageCredit.findFirst.mockResolvedValue({
        id: CREDIT_ID, purchaseId: PURCHASE_ID, serviceId: SERVICE_ID,
        employeeId: EMPLOYEE_ID, durationOptionId: DURATION_OPTION_ID,
        totalQuantity: 1, usedQuantity: 0,
        constraints: LEGACY_CONSTRAINTS,
        purchase: { id: PURCHASE_ID, status: PackagePurchaseStatus.ACTIVE },
      });
    }

    it('sets the purchase to COMPLETED when every credit of the purchase is fully used after the increment', async () => {
      const prisma = buildPrisma();
      mockResolvedCredit(prisma);
      const tx = buildTx(lockedCreditRow({ totalQuantity: 1, usedQuantity: 0 }));
      // After increment, the recount shows all credits exhausted.
      tx.packageCredit.findMany.mockResolvedValue([
        { id: CREDIT_ID, totalQuantity: 1, usedQuantity: 1 },
      ]);
      const { handler } = buildHandler({ prisma, tx });

      await handler.execute(baseCmd());

      expect(tx.packagePurchase.update).toHaveBeenCalledWith({
        where: { id: PURCHASE_ID },
        data: { status: PackagePurchaseStatus.COMPLETED },
      });
    });

    it('does NOT complete the purchase while other credits still have remaining', async () => {
      const prisma = buildPrisma();
      mockResolvedCredit(prisma);
      const tx = buildTx(lockedCreditRow({ totalQuantity: 5, usedQuantity: 0 }));
      tx.packageCredit.findMany.mockResolvedValue([
        { id: CREDIT_ID, totalQuantity: 5, usedQuantity: 1 },
        { id: 'credit-2', totalQuantity: 3, usedQuantity: 0 },
      ]);
      const { handler } = buildHandler({ prisma, tx });

      await handler.execute(baseCmd());

      expect(tx.packagePurchase.update).not.toHaveBeenCalled();
    });
  });
});
