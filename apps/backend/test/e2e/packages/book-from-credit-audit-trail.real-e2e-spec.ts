/**
 * Book-from-credit audit trail — Real-DB e2e spec
 * ===============================================
 *
 * Regression coverage for the P1-2 audit finding:
 *   "book-from-credit trusts body-supplied clientId (cross-client credit theft)"
 *
 * The fix is an in-transaction ActivityLog write that records the acting
 * staff user, the target client, and the credit bucket. This spec exercises
 * the audit path against a real Postgres database (no mocked Prisma) and
 * asserts the row lands with the correct shape.
 *
 * Run:
 *   REAL_E2E_DATABASE_URL=... pnpm --filter=backend run test:e2e:real -- \
 *     test/e2e/packages/book-from-credit-audit-trail.real-e2e-spec.ts
 */

import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { ActivityAction } from "@prisma/client";
import { AppModule } from "../../../src/app.module";
import { PrismaService } from "../../../src/infrastructure/database";
import { MoyasarApiClient } from "../../../src/modules/finance/moyasar-api/moyasar-api.client";
import { BookFromCreditHandler } from "../../../src/modules/bookings/book-from-credit/book-from-credit.handler";

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL
  ? describe
  : describe.skip;

describeRealE2e("Book-from-credit audit trail (P1-2 fix)", () => {
  jest.setTimeout(60_000);

  let app: INestApplication;
  let prisma: PrismaService;
  let bookHandler: BookFromCreditHandler;

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tag = (label: string) => `p1-2-${suffix}-${label}`;

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
    bookHandler = app.get(BookFromCreditHandler);
    await prisma.$queryRaw`SELECT 1`;

    await seedBaseEntities();
  });

  afterAll(async () => {
    await cleanup().catch(() => undefined);
    if (app) await app.close();
  });

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
        email: `p1-2-${suffix}-admin@sawaa.test`,
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
        email: `p1-2-${suffix}-emp@sawaa.test`,
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
        email: `p1-2-${suffix}-client@sawaa.test`,
        source: "ONLINE",
      },
    });
    ids.clientId = cli.id;
  }

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

  async function cleanup() {
    if (!prisma) return;
    const safe = (fn: () => Promise<unknown>) => fn().catch(() => undefined);

    await safe(() =>
      prisma.activityLog.deleteMany({
        where: { description: { contains: tag("") } },
      }),
    );
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
  // Audit row is written inside the same transaction as the booking
  // ═══════════════════════════════════════════════════════════════════════════

  describe("book-from-credit writes an audit row with the acting user", () => {
    it("records userId, targetClientId, creditId, and bookingId when a credit is consumed", async () => {
      await seedCreditBundle();

      const STAFF_USER_ID = ids.adminUserId;
      // 4 days out at 10:00 local time (within the 08:00-22:00 business
      // hours seeded in beforeAll). Using a fixed hour ensures the
      // availability check matches.
      const scheduledAt = new Date(Date.now() + 96 * 3_600_000);
      scheduledAt.setHours(10, 0, 0, 0);
      const result = await bookHandler.execute({
        clientId: ids.clientId,
        creditId: ids.creditId,
        branchId: ids.branchId,
        scheduledAt,
        userId: STAFF_USER_ID,
      });
      bookingIds.push(result.id);

      // Find the audit row written by the handler (entity=PackageCreditUsage,
      // entityId=creditId, userId=STAFF_USER_ID).
      const audit = await prisma.activityLog.findFirst({
        where: {
          userId: STAFF_USER_ID,
          entity: "PackageCreditUsage",
          entityId: ids.creditId,
        },
      });

      expect(audit).not.toBeNull();
      expect(audit!.action).toBe(ActivityAction.CREATE);
      expect(audit!.description).toContain("session-package credit");
      expect(audit!.metadata).toEqual(
        expect.objectContaining({
          bookingId: result.id,
          targetClientId: ids.clientId,
          creditId: ids.creditId,
          purchaseId: ids.purchaseId,
          employeeId: ids.employeeId,
        }),
      );
    });
  });
});
