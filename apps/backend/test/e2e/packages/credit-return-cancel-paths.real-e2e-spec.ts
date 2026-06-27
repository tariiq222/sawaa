/**
 * Credit return on cancel paths — Real-DB e2e spec
 * =================================================
 *
 * Regression coverage for the P1-1 audit finding:
 *   "ApproveCancel + ClientCancel never return session-package credits"
 *
 * The cancel-booking (staff) path was already covered in
 * session-packages.real-e2e-spec.ts. This spec focuses on the two NEW
 * paths the fix adds:
 *   - ApproveCancelBookingHandler.execute   (staff approves a pending cancel)
 *   - ClientCancelBookingHandler.execute    (client cancels directly)
 *
 * Both paths must:
 *   1. flip PackageCreditUsage.status CONSUMED → RETURNED with returnedAt set
 *   2. decrement PackageCredit.usedQuantity by 1
 *   3. reopen PackagePurchase.status COMPLETED → ACTIVE (if applicable)
 *
 * The CANCEL_REQUESTED branches of ClientCancelBookingHandler must NOT
 * return the credit (the booking is still scheduled until staff approves).
 *
 * Run:
 *   REAL_E2E_DATABASE_URL=... pnpm --filter=backend run test:e2e:real -- \
 *     test/e2e/packages/credit-return-cancel-paths.real-e2e-spec.ts
 */

import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { AppModule } from "../../../src/app.module";
import { PrismaService } from "../../../src/infrastructure/database";
import { MoyasarApiClient } from "../../../src/modules/finance/moyasar-api/moyasar-api.client";
import { ApproveCancelBookingHandler } from "../../../src/modules/bookings/approve-cancel-booking/approve-cancel-booking.handler";
import { ClientCancelBookingHandler } from "../../../src/modules/bookings/client/client-cancel-booking.handler";

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL
  ? describe
  : describe.skip;

describeRealE2e("Credit return on cancel paths (P1-1 fix)", () => {
  jest.setTimeout(60_000);

  let app: INestApplication;
  let prisma: PrismaService;
  let approveHandler: ApproveCancelBookingHandler;
  let clientHandler: ClientCancelBookingHandler;

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tag = (label: string) => `p1-1-${suffix}-${label}`;

  const ids = {
    branchId: "",
    serviceId: "",
    durationOptionId: "",
    employeeId: "",
    clientId: "",
    packageId: "",
    purchaseId: "",
    creditId: "",
    adminUserId: "",
  };

  // Track entities for cleanup.
  const bookingIds: string[] = [];
  const purchaseIds: string[] = [];
  const packageIds: string[] = [];

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
    approveHandler = app.get(ApproveCancelBookingHandler);
    clientHandler = app.get(ClientCancelBookingHandler);
    await prisma.$queryRaw`SELECT 1`;

    await seedBaseEntities();
  });

  afterAll(async () => {
    await cleanup().catch(() => undefined);
    if (app) await app.close();
  });

  // ─── Seed: minimal entities to make a credit booking possible ──────────
  async function seedBaseEntities() {
    // Org + booking settings
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

    // Admin user (for the approve-cancel changedBy)
    const admin = await prisma.user.create({
      data: {
        email: `p1-1-${suffix}-admin@sawaa.test`,
        passwordHash: "not-used",
        name: tag("Admin"),
        role: "ADMIN",
        isActive: true,
      },
    });
    ids.adminUserId = admin.id;

    // Branch + dept + category
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

    // Employee + service + duration option
    const emp = await prisma.employee.create({
      data: {
        name: tag("emp"),
        nameAr: tag("emp"),
        nameEn: tag("emp-en"),
        email: `p1-1-${suffix}-emp@sawaa.test`,
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

    // Business hours + availability covering all weekdays
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

    // Client
    const cli = await prisma.client.create({
      data: {
        name: tag("client"),
        phone: `05${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
        email: `p1-1-${suffix}-client@sawaa.test`,
        source: "ONLINE",
      },
    });
    ids.clientId = cli.id;
  }

  /** Build a single-credit SessionPackage + ACTIVE PackagePurchase + credit
   *  for the test client. The credit is a single-session credit (paidQuantity=1,
   *  freeQuantity=0) so a single book-from-credit auto-completes the purchase. */
  async function seedCreditBundle() {
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
              paidQuantity: 1,
              freeQuantity: 0,
              sortOrder: 1,
            },
          ],
        },
      },
    });
    ids.packageId = pkg.id;
    packageIds.push(pkg.id);

    const purchase = await prisma.packagePurchase.create({
      data: {
        clientId: ids.clientId,
        packageId: pkg.id,
        status: "ACTIVE",
        subtotalSnapshot: 30_000,
        discountSnapshot: 0,
        amountPaid: 30_000,
        paidAt: new Date(),
        branchId: ids.branchId,
      },
    });
    ids.purchaseId = purchase.id;
    purchaseIds.push(purchase.id);

    const credit = await prisma.packageCredit.create({
      data: {
        purchaseId: purchase.id,
        serviceId: ids.serviceId,
        employeeId: ids.employeeId,
        durationOptionId: ids.durationOptionId,
        totalQuantity: 1,
        usedQuantity: 0,
        unitPriceSnapshot: 30_000,
      },
    });
    ids.creditId = credit.id;
    return credit;
  }

  /** Create a Booking + a CONSUMED PackageCreditUsage for a given status.
   *  Lets the test jump straight to the cancel/approve-cancel step. */
  async function seedCreditBookingInStatus(
    status: "CANCEL_REQUESTED" | "CONFIRMED" | "PENDING",
    scheduledAt: Date,
  ) {
    const booking = await prisma.booking.create({
      data: {
        clientId: ids.clientId,
        employeeId: ids.employeeId,
        serviceId: ids.serviceId,
        branchId: ids.branchId,
        scheduledAt,
        endsAt: new Date(scheduledAt.getTime() + 60 * 60_000),
        durationMins: 60,
        price: 0,
        currency: "SAR",
        status,
        packageCreditId: ids.creditId,
        bookingNumber: Math.floor(Math.random() * 1_000_000),
        deliveryType: "IN_PERSON",
      },
    });
    bookingIds.push(booking.id);

    await prisma.packageCreditUsage.create({
      data: {
        creditId: ids.creditId,
        bookingId: booking.id,
        status: "CONSUMED",
        usedAt: new Date(),
      },
    });

    // Bump usedQuantity to match the consumed usage.
    await prisma.packageCredit.update({
      where: { id: ids.creditId },
      data: { usedQuantity: { increment: 1 } },
    });

    return booking;
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
      prisma.packageCredit.deleteMany({ where: { id: ids.creditId } }),
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

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. ApproveCancel returns the credit
  // ═══════════════════════════════════════════════════════════════════════════

  describe("ApproveCancelBookingHandler", () => {
    it("flips PackageCreditUsage → RETURNED and decrements usedQuantity on cancel-approval of a credit booking", async () => {
      await seedCreditBundle();
      // 72h ahead — different from the other tests' slots to avoid the
      // booking_staff_active_time_no_overlap DB backstop.
      const booking = await seedCreditBookingInStatus(
        "CANCEL_REQUESTED",
        new Date(Date.now() + 72 * 3_600_000),
      );

      // Sanity: usage is CONSUMED before the call.
      const usageBefore = await prisma.packageCreditUsage.findFirst({
        where: { bookingId: booking.id },
      });
      expect(usageBefore!.status).toBe("CONSUMED");

      const creditBefore = await prisma.packageCredit.findUnique({
        where: { id: ids.creditId },
      });
      expect(creditBefore!.usedQuantity).toBe(1);

      await approveHandler.execute({
        bookingId: booking.id,
        approvedBy: ids.adminUserId,
        approverNotes: "test",
      });

      // Usage flipped to RETURNED.
      const usageAfter = await prisma.packageCreditUsage.findFirst({
        where: { bookingId: booking.id },
      });
      expect(usageAfter!.status).toBe("RETURNED");
      expect(usageAfter!.returnedAt).not.toBeNull();

      // usedQuantity decremented back to 0.
      const creditAfter = await prisma.packageCredit.findUnique({
        where: { id: ids.creditId },
      });
      expect(creditAfter!.usedQuantity).toBe(0);

      // Booking is CANCELLED.
      const bookingAfter = await prisma.booking.findUnique({
        where: { id: booking.id },
      });
      expect(bookingAfter!.status).toBe("CANCELLED");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. ClientCancel (direct, free-cancel window) returns the credit
  // ═══════════════════════════════════════════════════════════════════════════

  describe("ClientCancelBookingHandler (direct path)", () => {
    it("flips PackageCreditUsage → RETURNED, decrements usedQuantity on direct cancel within free-cancel window", async () => {
      await seedCreditBundle();
      // 48h ahead (different from test 1's 72h to avoid the
      // booking_staff_active_time_no_overlap DB backstop), outside the
      // 24h free-cancel window → CLIENT_DIRECT_CANCEL → CANCELLED.
      const booking = await seedCreditBookingInStatus(
        "CONFIRMED",
        new Date(Date.now() + 48 * 3_600_000),
      );

      const result = await clientHandler.execute({
        bookingId: booking.id,
        clientId: ids.clientId,
        reason: "test",
      });

      expect(result.status).toBe("CANCELLED");
      expect(result.requiresApproval).toBe(false);

      const usage = await prisma.packageCreditUsage.findFirst({
        where: { bookingId: booking.id },
      });
      expect(usage!.status).toBe("RETURNED");
      expect(usage!.returnedAt).not.toBeNull();

      const creditAfter = await prisma.packageCredit.findUnique({
        where: { id: ids.creditId },
      });
      expect(creditAfter!.usedQuantity).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. ClientCancel (CANCEL_REQUESTED path) does NOT return the credit
  // ═══════════════════════════════════════════════════════════════════════════

  describe("ClientCancelBookingHandler (CANCEL_REQUESTED path)", () => {
    it("does NOT return the credit when the cancel is escalated to CANCEL_REQUESTED", async () => {
      await seedCreditBundle();
      // 12h ahead, inside the 24h free-cancel window → CANCEL_REQUESTED.
      const booking = await seedCreditBookingInStatus(
        "CONFIRMED",
        new Date(Date.now() + 12 * 3_600_000),
      );

      const result = await clientHandler.execute({
        bookingId: booking.id,
        clientId: ids.clientId,
      });

      expect(result.status).toBe("CANCEL_REQUESTED");
      expect(result.requiresApproval).toBe(true);

      // Credit must remain consumed — booking is still scheduled until staff
      // approval; returning the credit now would be a money leak.
      const usage = await prisma.packageCreditUsage.findFirst({
        where: { bookingId: booking.id },
      });
      expect(usage!.status).toBe("CONSUMED");
      expect(usage!.returnedAt).toBeNull();

      const creditAfter = await prisma.packageCredit.findUnique({
        where: { id: ids.creditId },
      });
      expect(creditAfter!.usedQuantity).toBe(1);
    });
  });
});
