/**
 * Reserve → consume lifecycle — Real-DB e2e spec
 * ===============================================
 *
 * Coverage gap: every other package e2e spec seeds a `CONSUMED`
 * PackageCreditUsage row directly (see
 * credit-return-cancel-paths.real-e2e-spec.ts "Bump usedQuantity to match the
 * consumed usage"), so they only ever exercise the legacy post-consumption
 * shape and never actually drive a session through the phase-1
 * RESERVED → CONSUMED state machine via the real handlers.
 *
 * This spec drives every leg of that state machine end to end against the
 * real database:
 *
 *   1. book-from-credit reserves a seat (reservedQuantity++, usage RESERVED)
 *   2. check-in consumes it (reservedQuantity--, usedQuantity++, CONSUMED)
 *   3. complete is a safety net when check-in never happened
 *   4. complete is a no-op when check-in already consumed the seat
 *   5. cancelling a RESERVED booking releases reservedQuantity
 *   6. cancelling a CONSUMED booking releases usedQuantity
 *   7. no-show → restore comes back as RESERVED when never attended
 *   8. availability is enforced across usedQuantity + reservedQuantity
 *   9. the purchase auto-completes only once the last session is CONSUMED,
 *      never merely RESERVED
 *
 * Every assertion reads the actual PackageCredit / PackageCreditUsage /
 * PackagePurchase rows back from Postgres — not handler return values.
 *
 * Run:
 *   REAL_E2E_DATABASE_URL=... pnpm --filter=backend run test:e2e:real -- \
 *     test/e2e/packages/reserve-consume-lifecycle.real-e2e-spec.ts
 */

import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { CancellationReason } from "@prisma/client";
import { AppModule } from "../../../src/app.module";
import { PrismaService } from "../../../src/infrastructure/database";
import { MoyasarApiClient } from "../../../src/modules/finance/moyasar-api/moyasar-api.client";
import { BookFromCreditHandler } from "../../../src/modules/bookings/book-from-credit/book-from-credit.handler";
import { CheckInBookingHandler } from "../../../src/modules/bookings/check-in-booking/check-in-booking.handler";
import { CompleteBookingHandler } from "../../../src/modules/bookings/complete-booking/complete-booking.handler";
import { CancelBookingHandler } from "../../../src/modules/bookings/cancel-booking/cancel-booking.handler";
import { NoShowBookingHandler } from "../../../src/modules/bookings/no-show-booking/no-show-booking.handler";
import { RestoreNoShowBookingHandler } from "../../../src/modules/bookings/restore-no-show-booking/restore-no-show-booking.handler";
import { RescheduleBookingHandler } from "../../../src/modules/bookings/reschedule-booking/reschedule-booking.handler";
import { BookingAutocompleteCron } from "../../../src/modules/ops/cron-tasks/booking-autocomplete.cron";

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL
  ? describe
  : describe.skip;

describeRealE2e("Reserve → consume lifecycle (phase-1 state machine)", () => {
  jest.setTimeout(60_000);

  let app: INestApplication;
  let prisma: PrismaService;
  let bookHandler: BookFromCreditHandler;
  let checkInHandler: CheckInBookingHandler;
  let completeHandler: CompleteBookingHandler;
  let cancelHandler: CancelBookingHandler;
  let noShowHandler: NoShowBookingHandler;
  let restoreHandler: RestoreNoShowBookingHandler;
  let rescheduleHandler: RescheduleBookingHandler;
  let autocompleteCron: BookingAutocompleteCron;

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tag = (label: string) => `reserve-consume-${suffix}-${label}`;

  const ids = {
    branchId: "",
    serviceId: "",
    durationOptionId: "",
    employeeId: "",
    clientId: "",
    adminUserId: "",
  };

  // Track entities for cleanup — several credit bundles are seeded, one per
  // scenario, so these are arrays rather than single ids.
  const bookingIds: string[] = [];
  const purchaseIds: string[] = [];
  const packageIds: string[] = [];
  const creditIds: string[] = [];

  // Days-from-now offset used for the next seeded booking's scheduledAt.
  // Each scenario gets its own day (same employee across the whole file) so
  // bookings never overlap and never trip the
  // booking_staff_active_time_no_overlap DB backstop.
  let dayOffset = 4;
  function nextSlot(): Date {
    const scheduledAt = new Date(Date.now() + dayOffset * 24 * 3_600_000);
    dayOffset += 1;
    scheduledAt.setHours(10, 0, 0, 0);
    return scheduledAt;
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.REAL_E2E_DATABASE_URL!;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MoyasarApiClient)
      .useValue({
        createPayment: jest.fn(),
        createRefund: jest.fn(),
        getPaymentStatus: jest.fn(),
        getRefundStatus: jest.fn(),
        invalidate: jest.fn(),
        toPaymentStatus: jest.fn(),
        toPaymentMethod: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.setGlobalPrefix("api/v1");
    await app.init();

    prisma = app.get(PrismaService);
    bookHandler = app.get(BookFromCreditHandler);
    checkInHandler = app.get(CheckInBookingHandler);
    completeHandler = app.get(CompleteBookingHandler);
    cancelHandler = app.get(CancelBookingHandler);
    noShowHandler = app.get(NoShowBookingHandler);
    restoreHandler = app.get(RestoreNoShowBookingHandler);
    rescheduleHandler = app.get(RescheduleBookingHandler);
    autocompleteCron = app.get(BookingAutocompleteCron);
    await prisma.$queryRaw`SELECT 1`;

    await seedBaseEntities();
  });

  afterAll(async () => {
    await cleanup().catch(() => undefined);
    if (app) await app.close();
  });

  // ─── Seed: minimal entities to make a credit booking possible ──────────
  async function seedBaseEntities() {
    const existingOrg = await prisma.organizationSettings.findFirst();
    if (existingOrg) {
      await prisma.organizationSettings.update({
        where: { id: existingOrg.id },
        data: { vatRate: "0", paymentAtClinicEnabled: false },
      });
    } else {
      await prisma.organizationSettings.create({
        data: { vatRate: "0", paymentAtClinicEnabled: false },
      });
    }
    const existingBookingSettings = await prisma.bookingSettings.findFirst({
      where: { branchId: null },
    });
    if (!existingBookingSettings) {
      await prisma.bookingSettings.create({
        data: {
          branchId: null,
          minBookingLeadMinutes: 60,
          maxAdvanceBookingDays: 90,
          requireCancelApproval: false,
          autoRefundOnCancel: true,
        },
      });
    }

    const admin = await prisma.user.create({
      data: {
        email: `reserve-consume-${suffix}-admin@sawaa.test`,
        passwordHash: "not-used",
        name: tag("Admin"),
        role: "ADMIN",
        isActive: true,
      },
    });
    ids.adminUserId = admin.id;

    const branch = await prisma.branch.create({
      data: { nameAr: tag("branch"), nameEn: tag("branch-en"), isActive: true },
    });
    ids.branchId = branch.id;

    const dept = await prisma.department.create({
      data: { nameAr: tag("dept"), nameEn: tag("dept-en"), isActive: true },
    });

    const cat = await prisma.serviceCategory.create({
      data: {
        nameAr: tag("cat"),
        nameEn: tag("cat-en"),
        departmentId: dept.id,
        isActive: true,
      },
    });

    const emp = await prisma.employee.create({
      data: {
        name: tag("emp"),
        nameAr: tag("emp"),
        nameEn: tag("emp-en"),
        email: `reserve-consume-${suffix}-emp@sawaa.test`,
        phone: `05${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
        isActive: true,
      },
    });
    ids.employeeId = emp.id;

    const svc = await prisma.service.create({
      data: {
        nameAr: tag("svc"),
        nameEn: tag("svc-en"),
        durationMins: 60,
        price: 30_000,
        currency: "SAR",
        isActive: true,
        categoryId: cat.id,
      },
    });
    ids.serviceId = svc.id;

    await prisma.serviceBookingConfig.create({
      data: { serviceId: svc.id, deliveryType: "IN_PERSON", useCustomAvailability: false },
    });

    const dur = await prisma.serviceDurationOption.create({
      data: {
        serviceId: svc.id,
        durationMins: 60,
        deliveryType: "IN_PERSON",
        label: "60 min",
        labelAr: "60 دقيقة",
        price: 30_000,
        isDefault: true,
        isActive: true,
        sortOrder: 1,
      },
    });
    ids.durationOptionId = dur.id;

    await prisma.employeeService.create({
      data: { employeeId: emp.id, serviceId: svc.id, isActive: true },
    });
    await prisma.employeeBranch.create({
      data: { employeeId: emp.id, branchId: branch.id },
    });

    const businessHours = [];
    const empAvail = [];
    for (let dow = 0; dow < 7; dow++) {
      businessHours.push({
        branchId: branch.id,
        dayOfWeek: dow,
        startTime: "08:00",
        endTime: "22:00",
        isOpen: true,
      });
      empAvail.push({
        employeeId: emp.id,
        dayOfWeek: dow,
        startTime: "08:00",
        endTime: "22:00",
        isActive: true,
      });
    }
    await prisma.businessHour.createMany({ data: businessHours });
    await prisma.employeeAvailability.createMany({ data: empAvail });

    const cli = await prisma.client.create({
      data: {
        name: tag("client"),
        phone: `05${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
        email: `reserve-consume-${suffix}-client@sawaa.test`,
        source: "ONLINE",
      },
    });
    ids.clientId = cli.id;
  }

  /** Seed a fresh SessionPackage + ACTIVE PackagePurchase + PackageCredit for
   *  the shared test client, with the given total session count. Each
   *  scenario gets its own bundle so cases cannot interfere with each
   *  other's counters. */
  async function seedCreditBundle(totalQuantity: number) {
    const pkg = await prisma.sessionPackage.create({
      data: {
        nameAr: tag("pack"),
        nameEn: tag("pack-en"),
        discountType: "FIXED",
        discountValue: 0,
        isPublic: false,
        isActive: true,
        sortOrder: 1,
        items: {
          create: [
            {
              serviceId: ids.serviceId,
              employeeId: ids.employeeId,
              durationOptionId: ids.durationOptionId,
              paidQuantity: totalQuantity,
              freeQuantity: 0,
              sortOrder: 1,
            },
          ],
        },
      },
    });
    packageIds.push(pkg.id);

    const purchase = await prisma.packagePurchase.create({
      data: {
        clientId: ids.clientId,
        packageId: pkg.id,
        status: "ACTIVE",
        subtotalSnapshot: 30_000 * totalQuantity,
        discountSnapshot: 0,
        amountPaid: 30_000 * totalQuantity,
        paidAt: new Date(),
        branchId: ids.branchId,
      },
    });
    purchaseIds.push(purchase.id);

    const credit = await prisma.packageCredit.create({
      data: {
        purchaseId: purchase.id,
        serviceId: ids.serviceId,
        employeeId: ids.employeeId,
        durationOptionId: ids.durationOptionId,
        totalQuantity,
        usedQuantity: 0,
        unitPriceSnapshot: 30_000,
      },
    });
    creditIds.push(credit.id);

    return { pkg, purchase, credit };
  }

  async function bookFromCredit(creditId: string, scheduledAt: Date) {
    const booking = await bookHandler.execute({
      clientId: ids.clientId,
      creditId,
      branchId: ids.branchId,
      scheduledAt,
      userId: ids.adminUserId,
    });
    bookingIds.push(booking.id);
    return booking;
  }

  function getCredit(creditId: string) {
    return prisma.packageCredit.findUniqueOrThrow({ where: { id: creditId } });
  }

  function getUsage(bookingId: string) {
    return prisma.packageCreditUsage.findFirstOrThrow({ where: { bookingId } });
  }

  function getPurchase(purchaseId: string) {
    return prisma.packagePurchase.findUniqueOrThrow({ where: { id: purchaseId } });
  }

  async function cleanup() {
    if (!prisma) return;
    const safe = (fn: () => Promise<unknown>) => fn().catch(() => undefined);

    await safe(() =>
      prisma.packageCreditUsage.deleteMany({ where: { bookingId: { in: bookingIds } } }),
    );
    await safe(() =>
      prisma.bookingStatusLog.deleteMany({ where: { bookingId: { in: bookingIds } } }),
    );
    await safe(() =>
      prisma.booking.deleteMany({ where: { id: { in: bookingIds } } }),
    );
    await safe(() =>
      prisma.packageCredit.deleteMany({ where: { id: { in: creditIds } } }),
    );
    await safe(() =>
      prisma.packagePurchase.deleteMany({ where: { id: { in: purchaseIds } } }),
    );
    await safe(() =>
      prisma.sessionPackage.deleteMany({ where: { id: { in: packageIds } } }),
    );
    await safe(() =>
      prisma.employeeAvailability.deleteMany({ where: { employeeId: ids.employeeId } }),
    );
    await safe(() =>
      prisma.businessHour.deleteMany({ where: { branchId: ids.branchId } }),
    );
    await safe(() =>
      prisma.employeeService.deleteMany({ where: { employeeId: ids.employeeId } }),
    );
    await safe(() =>
      prisma.employeeBranch.deleteMany({ where: { employeeId: ids.employeeId } }),
    );
    await safe(() =>
      prisma.serviceDurationOption.deleteMany({ where: { id: ids.durationOptionId } }),
    );
    await safe(() =>
      prisma.serviceBookingConfig.deleteMany({ where: { serviceId: ids.serviceId } }),
    );
    await safe(() =>
      prisma.client.deleteMany({ where: { id: ids.clientId } }),
    );
    await safe(() =>
      prisma.service.deleteMany({ where: { id: ids.serviceId } }),
    );
    await safe(() =>
      prisma.serviceCategory.deleteMany({ where: { nameEn: { startsWith: tag("") } } }),
    );
    await safe(() =>
      prisma.department.deleteMany({ where: { nameEn: { startsWith: tag("") } } }),
    );
    await safe(() =>
      prisma.employee.deleteMany({ where: { id: ids.employeeId } }),
    );
    await safe(() =>
      prisma.branch.deleteMany({ where: { nameEn: { startsWith: tag("") } } }),
    );
    await safe(() =>
      prisma.user.deleteMany({ where: { id: ids.adminUserId } }),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 1. book-from-credit reserves without consuming
  // ═══════════════════════════════════════════════════════════════════════

  it("reserves a seat on book-from-credit: usedQuantity unchanged, reservedQuantity 1, usage RESERVED", async () => {
    const { credit } = await seedCreditBundle(1);
    const booking = await bookFromCredit(credit.id, nextSlot());

    const creditAfter = await getCredit(credit.id);
    expect(creditAfter.usedQuantity).toBe(0);
    expect(creditAfter.reservedQuantity).toBe(1);

    const usage = await getUsage(booking.id);
    expect(usage.status).toBe("RESERVED");
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 2. check-in consumes the reservation
  // ═══════════════════════════════════════════════════════════════════════

  it("check-in moves the seat: reservedQuantity back to 0, usedQuantity to 1, usage CONSUMED", async () => {
    const { credit } = await seedCreditBundle(1);
    const booking = await bookFromCredit(credit.id, nextSlot());

    await checkInHandler.execute({ bookingId: booking.id, changedBy: ids.adminUserId });

    const creditAfter = await getCredit(credit.id);
    expect(creditAfter.reservedQuantity).toBe(0);
    expect(creditAfter.usedQuantity).toBe(1);

    const usage = await getUsage(booking.id);
    expect(usage.status).toBe("CONSUMED");
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 3. complete-booking is the safety net when check-in never happened
  // ═══════════════════════════════════════════════════════════════════════

  it("completing a booking that was never checked in consumes it the same way (safety net)", async () => {
    const { credit } = await seedCreditBundle(1);
    const booking = await bookFromCredit(credit.id, nextSlot());

    await completeHandler.execute({ bookingId: booking.id, changedBy: ids.adminUserId });

    const creditAfter = await getCredit(credit.id);
    expect(creditAfter.reservedQuantity).toBe(0);
    expect(creditAfter.usedQuantity).toBe(1);

    const usage = await getUsage(booking.id);
    expect(usage.status).toBe("CONSUMED");
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 4. complete-booking is idempotent when check-in already consumed
  // ═══════════════════════════════════════════════════════════════════════

  it("completing an already checked-in booking changes nothing (idempotent)", async () => {
    const { credit } = await seedCreditBundle(1);
    const booking = await bookFromCredit(credit.id, nextSlot());

    await checkInHandler.execute({ bookingId: booking.id, changedBy: ids.adminUserId });

    const creditBefore = await getCredit(credit.id);
    const usageBefore = await getUsage(booking.id);
    expect(creditBefore.usedQuantity).toBe(1);
    expect(creditBefore.reservedQuantity).toBe(0);
    expect(usageBefore.status).toBe("CONSUMED");

    await completeHandler.execute({ bookingId: booking.id, changedBy: ids.adminUserId });

    const creditAfter = await getCredit(credit.id);
    const usageAfter = await getUsage(booking.id);
    expect(creditAfter.usedQuantity).toBe(creditBefore.usedQuantity);
    expect(creditAfter.reservedQuantity).toBe(creditBefore.reservedQuantity);
    expect(usageAfter.status).toBe(usageBefore.status);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 5. cancelling a RESERVED booking releases reservedQuantity
  // ═══════════════════════════════════════════════════════════════════════

  it("cancelling a still-RESERVED booking releases reservedQuantity, not usedQuantity", async () => {
    const { credit } = await seedCreditBundle(1);
    const booking = await bookFromCredit(credit.id, nextSlot());

    const creditBefore = await getCredit(credit.id);
    expect(creditBefore.reservedQuantity).toBe(1);
    expect(creditBefore.usedQuantity).toBe(0);

    await cancelHandler.execute({
      bookingId: booking.id,
      changedBy: ids.adminUserId,
      reason: CancellationReason.CLIENT_REQUESTED,
      source: "admin",
    });

    const creditAfter = await getCredit(credit.id);
    expect(creditAfter.reservedQuantity).toBe(0);
    expect(creditAfter.usedQuantity).toBe(0);

    const usage = await getUsage(booking.id);
    expect(usage.status).toBe("RETURNED");
    expect(usage.returnedAt).not.toBeNull();

    // The seat is available again for a fresh booking.
    const rebooked = await bookFromCredit(credit.id, nextSlot());
    const creditAfterRebook = await getCredit(credit.id);
    expect(creditAfterRebook.reservedQuantity).toBe(1);
    const rebookedUsage = await getUsage(rebooked.id);
    expect(rebookedUsage.status).toBe("RESERVED");
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 6. cancelling a CONSUMED booking releases usedQuantity
  // ═══════════════════════════════════════════════════════════════════════

  it("cancelling an already-CONSUMED booking releases usedQuantity", async () => {
    const { credit } = await seedCreditBundle(1);
    const booking = await bookFromCredit(credit.id, nextSlot());
    await checkInHandler.execute({ bookingId: booking.id, changedBy: ids.adminUserId });

    const creditBefore = await getCredit(credit.id);
    expect(creditBefore.usedQuantity).toBe(1);
    expect(creditBefore.reservedQuantity).toBe(0);

    await cancelHandler.execute({
      bookingId: booking.id,
      changedBy: ids.adminUserId,
      reason: CancellationReason.CLIENT_REQUESTED,
      source: "admin",
    });

    const creditAfter = await getCredit(credit.id);
    expect(creditAfter.usedQuantity).toBe(0);
    expect(creditAfter.reservedQuantity).toBe(0);

    const usage = await getUsage(booking.id);
    expect(usage.status).toBe("RETURNED");
    expect(usage.returnedAt).not.toBeNull();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 7. no-show (never attended) → restore comes back as RESERVED
  // ═══════════════════════════════════════════════════════════════════════

  it("a no-show that was never attended, then restored, comes back as RESERVED (not CONSUMED)", async () => {
    const { credit } = await seedCreditBundle(1);
    const booking = await bookFromCredit(credit.id, nextSlot());

    // Never checked in.
    const bookingBeforeNoShow = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(bookingBeforeNoShow.checkedInAt).toBeNull();

    await noShowHandler.execute({ bookingId: booking.id, changedBy: ids.adminUserId });

    const creditAfterNoShow = await getCredit(credit.id);
    expect(creditAfterNoShow.reservedQuantity).toBe(0);
    expect(creditAfterNoShow.usedQuantity).toBe(0);
    const usageAfterNoShow = await getUsage(booking.id);
    expect(usageAfterNoShow.status).toBe("RETURNED");

    await restoreHandler.execute({
      bookingId: booking.id,
      changedBy: ids.adminUserId,
      reason: "Restoring for e2e lifecycle verification",
    });

    const creditAfterRestore = await getCredit(credit.id);
    expect(creditAfterRestore.reservedQuantity).toBe(1);
    expect(creditAfterRestore.usedQuantity).toBe(0);

    const usageAfterRestore = await getUsage(booking.id);
    const bookingAfterRestore = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(bookingAfterRestore.checkedInAt).toBeNull();
    expect(bookingAfterRestore.autoNoShowSuppressedAt).not.toBeNull();
    expect(usageAfterRestore.status).toBe("RESERVED");
    expect(usageAfterRestore.returnedAt).toBeNull();

    // The restored booking can still be attended normally; restore itself
    // must never consume the reserved session or fabricate attendance.
    await checkInHandler.execute({ bookingId: booking.id, changedBy: ids.adminUserId });
    expect((await getCredit(credit.id)).usedQuantity).toBe(1);
    expect((await getUsage(booking.id)).status).toBe("CONSUMED");
  });

  it("keeps a never-attended credit RESERVED across repeated no-show/restore cycles", async () => {
    const { credit } = await seedCreditBundle(1);
    const booking = await bookFromCredit(credit.id, nextSlot());

    for (let cycle = 0; cycle < 2; cycle += 1) {
      await noShowHandler.execute({ bookingId: booking.id, changedBy: ids.adminUserId });
      await restoreHandler.execute({
        bookingId: booking.id,
        changedBy: ids.adminUserId,
        reason: `Repeated restore cycle ${cycle + 1}`,
      });
    }

    const finalCredit = await getCredit(credit.id);
    expect({ used: finalCredit.usedQuantity, reserved: finalCredit.reservedQuantity }).toEqual({
      used: 0,
      reserved: 1,
    });
    expect((await getUsage(booking.id)).status).toBe("RESERVED");
  });

  it("clears restore suppression when the booking is explicitly rescheduled", async () => {
    const { credit } = await seedCreditBundle(1);
    const booking = await bookFromCredit(credit.id, nextSlot());
    await noShowHandler.execute({ bookingId: booking.id, changedBy: ids.adminUserId });
    await restoreHandler.execute({
      bookingId: booking.id,
      changedBy: ids.adminUserId,
      reason: "Restore before reschedule",
    });

    await rescheduleHandler.execute({
      bookingId: booking.id,
      newScheduledAt: nextSlot(),
      changedBy: ids.adminUserId,
    });

    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).autoNoShowSuppressedAt).toBeNull();
  });

  it("does not autocomplete a restored booking that never had attendance", async () => {
    const { credit } = await seedCreditBundle(1);
    const booking = await bookFromCredit(credit.id, nextSlot());
    await prisma.bookingSettings.updateMany({ where: { branchId: null }, data: { autoCompleteAfterHours: 1 } });
    await prisma.booking.update({
      where: { id: booking.id },
      data: { scheduledAt: new Date(Date.now() - 5 * 3_600_000), endsAt: new Date(Date.now() - 4 * 3_600_000) },
    });

    await noShowHandler.execute({ bookingId: booking.id, changedBy: ids.adminUserId });
    await restoreHandler.execute({
      bookingId: booking.id,
      changedBy: ids.adminUserId,
      reason: "Restore without attendance",
    });
    await autocompleteCron.execute();

    expect({ used: (await getCredit(credit.id)).usedQuantity, usage: (await getUsage(booking.id)).status }).toEqual({
      used: 0,
      usage: "RESERVED",
    });
  });

  it("autocompletes a restored booking that retains real attendance", async () => {
    const { credit } = await seedCreditBundle(1);
    const booking = await bookFromCredit(credit.id, nextSlot());
    await checkInHandler.execute({ bookingId: booking.id, changedBy: ids.adminUserId });
    const checkedInAt = (await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).checkedInAt;

    await noShowHandler.execute({ bookingId: booking.id, changedBy: ids.adminUserId });
    await restoreHandler.execute({
      bookingId: booking.id,
      changedBy: ids.adminUserId,
      reason: "Restore attended booking",
    });

    await prisma.bookingSettings.updateMany({ where: { branchId: null }, data: { autoCompleteAfterHours: 1 } });
    await prisma.booking.update({
      where: { id: booking.id },
      data: { scheduledAt: new Date(Date.now() - 7 * 3_600_000), endsAt: new Date(Date.now() - 6 * 3_600_000) },
    });
    await autocompleteCron.execute();

    const restored = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(restored.status).toBe("COMPLETED");
    expect(restored.checkedInAt).toEqual(checkedInAt);
    expect(restored.autoNoShowSuppressedAt).not.toBeNull();
    expect((await getCredit(credit.id)).usedQuantity).toBe(1);
    expect((await getUsage(booking.id)).status).toBe("CONSUMED");
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 8. availability is enforced across usedQuantity + reservedQuantity
  // ═══════════════════════════════════════════════════════════════════════

  it("rejects a further book-from-credit when both counters together already fill the bucket", async () => {
    const { credit } = await seedCreditBundle(2);

    // Seat 1: consumed via check-in.
    const bookingA = await bookFromCredit(credit.id, nextSlot());
    await checkInHandler.execute({ bookingId: bookingA.id, changedBy: ids.adminUserId });

    // Seat 2: still reserved.
    const bookingB = await bookFromCredit(credit.id, nextSlot());

    const creditBefore = await getCredit(credit.id);
    expect(creditBefore.usedQuantity).toBe(1);
    expect(creditBefore.reservedQuantity).toBe(1);
    expect(creditBefore.usedQuantity + creditBefore.reservedQuantity).toBe(
      creditBefore.totalQuantity,
    );

    // A third booking against the same (now-full) credit must be rejected —
    // capacity is used + reserved, not just used.
    await expect(bookFromCredit(credit.id, nextSlot())).rejects.toThrow(
      /No usable package credit found for this id/,
    );

    // Nothing changed as a result of the rejected attempt.
    const creditAfter = await getCredit(credit.id);
    expect(creditAfter.usedQuantity).toBe(1);
    expect(creditAfter.reservedQuantity).toBe(1);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 9. purchase auto-completes only once the last session is CONSUMED
  // ═══════════════════════════════════════════════════════════════════════

  it("auto-completes the purchase only after the last session is CONSUMED, not merely RESERVED", async () => {
    const { credit, purchase } = await seedCreditBundle(1);

    const booking = await bookFromCredit(credit.id, nextSlot());

    // Booking the last (only) session reserves it — must NOT complete the
    // purchase yet.
    const purchaseAfterBooking = await getPurchase(purchase.id);
    expect(purchaseAfterBooking.status).toBe("ACTIVE");

    await checkInHandler.execute({ bookingId: booking.id, changedBy: ids.adminUserId });

    // Only once it is actually delivered (CONSUMED) does the purchase
    // auto-complete.
    const purchaseAfterCheckIn = await getPurchase(purchase.id);
    expect(purchaseAfterCheckIn.status).toBe("COMPLETED");
  });
});
