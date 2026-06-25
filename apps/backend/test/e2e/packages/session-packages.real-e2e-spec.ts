/**
 * Session Packages — Real-DB E2E Spec
 * ===================================
 *
 * Exercises the NEW session-package (credit-pack) system against a real
 * Postgres database (no mocked Prisma). External HTTP is intercepted globally
 * by setup-e2e.ts, and the MoyasarApiClient is overridden here so the app can
 * construct it (the manual flows in this spec never reach the gateway).
 *
 * This spec closes the biggest gap in the rebuild: every behaviour below is one
 * a mocked-Prisma unit test CANNOT prove, because it depends on real DB side
 * effects, real CHECK/XOR constraints, and — critically — the real Serializable
 * + SELECT FOR UPDATE concurrency guard on PackageCredit:
 *
 *   1. CRUD over HTTP (create + items, discount validation, list/detail price,
 *      update, archive) with the DB rows re-read afterwards.
 *   2. Manual purchase → invoice + credits round-trip (halala-exact, ONE
 *      invoice with packagePurchaseId XOR bookingId, payment flips it to PAID).
 *   3. Book-from-credit: a zero-value booking that consumes a credit, with NO
 *      new invoice and a CONSUMED usage row + incremented usedQuantity.
 *   4. REAL CONCURRENCY — two simultaneous from-credit requests on the last
 *      remaining credit: exactly one 201, the other rejected, no over-draw.
 *   5. Credit return on cancel (usage RETURNED, usedQuantity decremented,
 *      a COMPLETED purchase reopened to ACTIVE).
 *   6. Manual refund → REFUNDED + voided credits (a refunded credit is no
 *      longer bookable even with remaining > 0).
 *   7. Transfer a credit to a qualifying employee (+ reject a non-qualifying).
 *   8. Authorization — an under-permissioned RECEPTIONIST is rejected on refund.
 *
 * Data isolation: every seeded row carries a per-run suffix so this spec can run
 * alongside sibling real-DB specs without colliding on unique columns. Cleanup
 * is targeted (by suffix + by id) and never touches shared rows.
 *
 * Run:
 *   pnpm --filter=backend run test:e2e:real -- \
 *     test/e2e/packages/session-packages.real-e2e-spec.ts
 */

import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import request from "supertest";
import { AppModule } from "../../../src/app.module";
import { PrismaService } from "../../../src/infrastructure/database";
import { MoyasarApiClient } from "../../../src/modules/finance/moyasar-api/moyasar-api.client";

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL
  ? describe
  : describe.skip;

describeRealE2e("Session Packages — real-DB e2e (CRUD, purchase, credit booking, concurrency, refund, transfer, authz)", () => {
  jest.setTimeout(60_000);

  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  // ── Per-run isolation ──────────────────────────────────────────────────────
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tag = (label: string) => `pkg-e2e-${suffix}-${label}`;
  const uniqueEmail = (label: string) =>
    `packages-real-e2e-${suffix}-${label}@sawaa.test`;
  const uniquePhone = () =>
    `05${String(Math.floor(10_000_000 + Math.random() * 89_999_999)).padStart(8, "0")}`;

  // Track every entity this spec creates for targeted cleanup.
  const ctx = {
    adminUserId: "",
    receptionistUserId: "",
    adminToken: "",
    receptionistToken: "",
    branchId: "",
    deptId: "",
    catId: "",
    employeeId: "",
    employee2Id: "", // qualifies for the service+duration (transfer target)
    employee3Id: "", // does NOT provide the service (negative transfer)
    serviceId: "",
    durationOptionId: "",
    clientId: "",
    packageIds: [] as string[],
    purchaseIds: [] as string[],
    invoiceIds: [] as string[],
    paymentIds: [] as string[],
    bookingIds: [] as string[],
  };

  const api = () => request(app.getHttpServer());
  const withAuth = (token: string) => (req: request.Test) =>
    req.set("Authorization", `Bearer ${token}`);

  // Slots in the future (the DB row is keyed by a real timestamp). We probe the
  // availability endpoint for genuine bookable slots so the slot/overlap check
  // is satisfied and the CREDIT becomes the limiter in the concurrency test.
  const daysFromNow = (days: number, hour = 10, minute = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(hour, minute, 0, 0);
    return d;
  };

  // ── Setup / teardown ──────────────────────────────────────────────────────

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
    jwtService = app.get(JwtService);
    await prisma.$queryRaw`SELECT 1`;

    await cleanup();
    await seedBaseEntities();
  });

  afterAll(async () => {
    try {
      await cleanup();
    } catch {
      /* best-effort */
    }
    if (app) await app.close();
  });

  async function seedBaseEntities() {
    // Org settings: VAT=0 (center not VAT-registered), pay-at-clinic on (not used
    // by the credit path but harmless). Booking settings (branchId:null) so
    // GetBookingSettingsHandler resolves lead/buffer windows for availability.
    const existingOrgSettings = await prisma.organizationSettings.findFirst({});
    if (existingOrgSettings) {
      await prisma.organizationSettings.update({
        where: { id: existingOrgSettings.id },
        data: { vatRate: "0", paymentAtClinicEnabled: true },
      });
    } else {
      await prisma.organizationSettings.create({
        data: { vatRate: "0", paymentAtClinicEnabled: true },
      });
    }
    const existingBookingSettings = await prisma.bookingSettings.findFirst({
      where: { branchId: null },
    });
    if (!existingBookingSettings) {
      await prisma.bookingSettings.create({
        data: {
          minBookingLeadMinutes: 60,
          maxAdvanceBookingDays: 90,
          requireCancelApproval: false,
          autoRefundOnCancel: true,
        },
      });
    }

    // ADMIN user (built-in ADMIN ≈ OWNER: manage:Service / Invoice / Setting /
    // Booking) — reachable on every privileged package endpoint.
    const admin = await prisma.user.create({
      data: {
        email: uniqueEmail("admin"),
        passwordHash: "not-used",
        name: tag("Admin"),
        role: "ADMIN",
        isActive: true,
      },
    });
    ctx.adminUserId = admin.id;
    ctx.adminToken = jwtService.sign({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      isSuperAdmin: true,
    });

    // RECEPTIONIST user: has create/read Invoice + create/read/update Booking,
    // but NOT manage:Setting → must be 403 on the package refund endpoint.
    const receptionist = await prisma.user.create({
      data: {
        email: uniqueEmail("reception"),
        passwordHash: "not-used",
        name: tag("Reception"),
        role: "RECEPTIONIST",
        isActive: true,
      },
    });
    ctx.receptionistUserId = receptionist.id;
    ctx.receptionistToken = jwtService.sign({
      sub: receptionist.id,
      email: receptionist.email,
      role: receptionist.role,
      isSuperAdmin: false,
    });

    // Branch + department + category.
    const branch = await prisma.branch.create({
      data: { nameAr: tag("branch-ar"), nameEn: tag("branch-en"), isActive: true },
    });
    ctx.branchId = branch.id;

    const dept = await prisma.department.create({
      data: { nameAr: tag("dept-ar"), nameEn: tag("dept-en"), isActive: true },
    });
    ctx.deptId = dept.id;

    const cat = await prisma.serviceCategory.create({
      data: {
        nameAr: tag("cat-ar"),
        nameEn: tag("cat-en"),
        departmentId: dept.id,
        isActive: true,
      },
    });
    ctx.catId = cat.id;

    // Employees: emp1 (primary), emp2 (also provides the service → transfer
    // target), emp3 (does NOT provide the service → negative transfer).
    const emp = await prisma.employee.create({
      data: {
        name: tag("emp1"),
        nameAr: tag("emp1-ar"),
        nameEn: tag("emp1-en"),
        email: uniqueEmail("emp1"),
        phone: uniquePhone(),
        isActive: true,
      },
    });
    ctx.employeeId = emp.id;

    const emp2 = await prisma.employee.create({
      data: {
        name: tag("emp2"),
        nameAr: tag("emp2-ar"),
        nameEn: tag("emp2-en"),
        email: uniqueEmail("emp2"),
        phone: uniquePhone(),
        isActive: true,
      },
    });
    ctx.employee2Id = emp2.id;

    const emp3 = await prisma.employee.create({
      data: {
        name: tag("emp3"),
        nameAr: tag("emp3-ar"),
        nameEn: tag("emp3-en"),
        email: uniqueEmail("emp3"),
        phone: uniquePhone(),
        isActive: true,
      },
    });
    ctx.employee3Id = emp3.id;

    // Service: 60-min, 300 SAR (30000 halalas).
    const svc = await prisma.service.create({
      data: {
        nameAr: tag("svc-ar"),
        nameEn: tag("svc-en"),
        durationMins: 60,
        price: 30_000,
        currency: "SAR",
        isActive: true,
        categoryId: cat.id,
      },
    });
    ctx.serviceId = svc.id;

    await prisma.serviceBookingConfig.createMany({
      data: [
        { serviceId: svc.id, deliveryType: "IN_PERSON", useCustomAvailability: false },
      ],
    });

    const durationOption = await prisma.serviceDurationOption.create({
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
    ctx.durationOptionId = durationOption.id;

    // Link emp1 + emp2 to the service (emp3 intentionally NOT linked).
    await prisma.employeeService.createMany({
      data: [
        { employeeId: emp.id, serviceId: svc.id, isActive: true },
        { employeeId: emp2.id, serviceId: svc.id, isActive: true },
      ],
    });

    // Link emps to branch (a missing EmployeeBranch makes availability return []).
    await prisma.employeeBranch.createMany({
      data: [
        { employeeId: emp.id, branchId: branch.id },
        { employeeId: emp2.id, branchId: branch.id },
        { employeeId: emp3.id, branchId: branch.id },
      ],
    });

    // Business hours + availability for a wide window across the next week so
    // every probed slot is bookable regardless of which weekday "tomorrow" is.
    const businessHours = [];
    const emp1Availability = [];
    const emp2Availability = [];
    for (let dow = 0; dow < 7; dow++) {
      businessHours.push({
        branchId: branch.id,
        dayOfWeek: dow,
        startTime: "08:00",
        endTime: "22:00",
        isOpen: true,
      });
      emp1Availability.push({
        employeeId: emp.id,
        dayOfWeek: dow,
        startTime: "08:00",
        endTime: "22:00",
        isActive: true,
      });
      emp2Availability.push({
        employeeId: emp2.id,
        dayOfWeek: dow,
        startTime: "08:00",
        endTime: "22:00",
        isActive: true,
      });
    }
    await prisma.businessHour.createMany({ data: businessHours });
    await prisma.employeeAvailability.createMany({
      data: [...emp1Availability, ...emp2Availability],
    });

    const cli = await prisma.client.create({
      data: {
        name: tag("client"),
        phone: uniquePhone(),
        email: uniqueEmail("client"),
        source: "ONLINE",
      },
    });
    ctx.clientId = cli.id;
  }

  /**
   * Targeted cleanup. Deletes in FK-safe order, scoped to this run's ids/suffix.
   * PackageCreditUsage / PackageCredit cascade from PackagePurchase, but we
   * delete bookings first (bookings hold a plain packageCreditId ref, no FK).
   */
  async function cleanup() {
    if (!prisma) return;
    const del = (fn: () => Promise<unknown>) => fn().catch(() => undefined);

    await del(() =>
      prisma.packageCreditUsage.deleteMany({
        where: { bookingId: { in: ctx.bookingIds } },
      }),
    );
    await del(() =>
      prisma.refundRequest.deleteMany({ where: { paymentId: { in: ctx.paymentIds } } }),
    );
    await del(() =>
      prisma.payment.deleteMany({ where: { id: { in: ctx.paymentIds } } }),
    );
    await del(() =>
      prisma.bookingStatusLog.deleteMany({ where: { bookingId: { in: ctx.bookingIds } } }),
    );
    await del(() =>
      prisma.booking.deleteMany({ where: { id: { in: ctx.bookingIds } } }),
    );
    await del(() =>
      prisma.invoice.deleteMany({ where: { id: { in: ctx.invoiceIds } } }),
    );
    // PackagePurchase cascade-deletes its PackageCredit + PackageCreditUsage rows.
    await del(() =>
      prisma.packagePurchase.deleteMany({ where: { id: { in: ctx.purchaseIds } } }),
    );
    // SessionPackage cascade-deletes its items.
    await del(() =>
      prisma.sessionPackage.deleteMany({ where: { id: { in: ctx.packageIds } } }),
    );

    // Suffix-pattern safety net for entities we may have missed.
    await del(() =>
      prisma.packagePurchase.deleteMany({ where: { clientId: ctx.clientId } }),
    );
    await del(() =>
      prisma.sessionPackage.deleteMany({ where: { nameAr: { startsWith: tag("") } } }),
    );
    await del(() =>
      prisma.employeeAvailability.deleteMany({
        where: { employeeId: { in: [ctx.employeeId, ctx.employee2Id, ctx.employee3Id].filter(Boolean) } },
      }),
    );
    await del(() =>
      prisma.businessHour.deleteMany({ where: { branchId: ctx.branchId } }),
    );
    await del(() =>
      prisma.employeeService.deleteMany({
        where: { employeeId: { in: [ctx.employeeId, ctx.employee2Id, ctx.employee3Id].filter(Boolean) } },
      }),
    );
    await del(() =>
      prisma.employeeBranch.deleteMany({
        where: { employeeId: { in: [ctx.employeeId, ctx.employee2Id, ctx.employee3Id].filter(Boolean) } },
      }),
    );
    await del(() =>
      prisma.serviceDurationOption.deleteMany({ where: { serviceId: ctx.serviceId } }),
    );
    await del(() =>
      prisma.serviceBookingConfig.deleteMany({ where: { serviceId: ctx.serviceId } }),
    );
    await del(() =>
      prisma.client.deleteMany({ where: { email: { startsWith: `packages-real-e2e-${suffix}-` } } }),
    );
    await del(() =>
      prisma.service.deleteMany({ where: { id: ctx.serviceId } }),
    );
    await del(() =>
      prisma.serviceCategory.deleteMany({ where: { id: ctx.catId } }),
    );
    await del(() =>
      prisma.department.deleteMany({ where: { id: ctx.deptId } }),
    );
    await del(() =>
      prisma.employee.deleteMany({ where: { email: { startsWith: `packages-real-e2e-${suffix}-` } } }),
    );
    await del(() =>
      prisma.branch.deleteMany({ where: { nameEn: { startsWith: tag("") } } }),
    );
    await del(() =>
      prisma.user.deleteMany({
        where: { id: { in: [ctx.adminUserId, ctx.receptionistUserId].filter(Boolean) } },
      }),
    );

    ctx.packageIds = [];
    ctx.purchaseIds = [];
    ctx.invoiceIds = [];
    ctx.paymentIds = [];
    ctx.bookingIds = [];
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  const validItem = (over: Partial<Record<string, unknown>> = {}) => ({
    serviceId: ctx.serviceId,
    employeeId: ctx.employeeId,
    durationOptionId: ctx.durationOptionId,
    paidQuantity: 4,
    freeQuantity: 1,
    ...over,
  });

  /** Create a package via the dashboard endpoint (admin), tracked for cleanup. */
  async function createPackage(body: Record<string, unknown>) {
    const res = await withAuth(ctx.adminToken)(
      api().post("/api/v1/dashboard/organization/packages"),
    ).send(body);
    if (res.status === 201 && res.body?.id) ctx.packageIds.push(res.body.id);
    return res;
  }

  /** Sell a package to the client (admin), tracking purchase/invoice/payment. */
  async function purchasePackage(over: Record<string, unknown> = {}) {
    const res = await withAuth(ctx.adminToken)(
      api().post("/api/v1/dashboard/finance/package-purchases"),
    ).send({
      packageId: ctx.packageIds[ctx.packageIds.length - 1],
      clientId: ctx.clientId,
      branchId: ctx.branchId,
      method: "CASH",
      ...over,
    });
    if (res.status === 201) {
      if (res.body?.purchase?.id) ctx.purchaseIds.push(res.body.purchase.id);
      if (res.body?.invoiceId) ctx.invoiceIds.push(res.body.invoiceId);
      if (res.body?.paymentId) ctx.paymentIds.push(res.body.paymentId);
    }
    return res;
  }

  /** Probe the availability endpoint for genuine bookable slot start times. */
  async function availableSlots(employeeId: string, date: Date): Promise<Date[]> {
    const res = await withAuth(ctx.adminToken)(
      api().get("/api/v1/dashboard/bookings/availability"),
    ).query({
      branchId: ctx.branchId,
      employeeId,
      serviceId: ctx.serviceId,
      date: date.toISOString(),
      durationMins: 60,
    });
    expect(res.status).toBe(200);
    return (res.body as { startTime: string }[]).map((s) => new Date(s.startTime));
  }

  async function bookFromCredit(body: Record<string, unknown>, token = ctx.adminToken) {
    const res = await withAuth(token)(
      api().post("/api/v1/dashboard/bookings/from-credit"),
    ).send(body);
    if (res.status === 201 && res.body?.id) ctx.bookingIds.push(res.body.id);
    return res;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. CRUD over HTTP
  // ═══════════════════════════════════════════════════════════════════════════

  describe("CRUD: create + items, validation, list/detail price, update, archive", () => {
    it("creates a package + its items and persists them to the DB", async () => {
      const res = await createPackage({
        nameAr: tag("pack-crud"),
        nameEn: "CRUD Pack",
        discountType: "PERCENTAGE",
        discountValue: 10,
        isPublic: true,
        items: [validItem()],
      });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeTruthy();
      expect(res.body.items).toHaveLength(1);

      // Re-read from DB to prove the write landed (not just the response).
      const row = await prisma.sessionPackage.findUnique({
        where: { id: res.body.id },
        include: { items: true },
      });
      expect(row).not.toBeNull();
      expect(row!.discountType).toBe("PERCENTAGE");
      expect(Number(row!.discountValue)).toBe(10);
      expect(row!.isPublic).toBe(true);
      expect(row!.archivedAt).toBeNull();
      expect(row!.items).toHaveLength(1);
      expect(row!.items[0].serviceId).toBe(ctx.serviceId);
      expect(row!.items[0].employeeId).toBe(ctx.employeeId);
      expect(row!.items[0].paidQuantity).toBe(4);
      expect(row!.items[0].freeQuantity).toBe(1);
    });

    it("rejects a PERCENTAGE discount > 100 with 400", async () => {
      const res = await createPackage({
        nameAr: tag("pack-badpct"),
        discountType: "PERCENTAGE",
        discountValue: 150,
        items: [validItem()],
      });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/PERCENTAGE|between 0 and 100/i);
    });

    it("rejects a FIXED discount that exceeds the computed subtotal with 400", async () => {
      // subtotal = 4 paid × 30000 = 120000 halalas. A 200000 FIXED discount is illegal.
      const res = await createPackage({
        nameAr: tag("pack-badfixed"),
        discountType: "FIXED",
        discountValue: 200_000,
        items: [validItem()],
      });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/FIXED|exceed the computed subtotal/i);
    });

    it("rejects an item whose employee does NOT provide the service with 400", async () => {
      // emp3 has no EmployeeService link for this service.
      const res = await createPackage({
        nameAr: tag("pack-noemp"),
        discountType: "PERCENTAGE",
        discountValue: 0,
        items: [validItem({ employeeId: ctx.employee3Id })],
      });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/does not provide this service/i);
    });

    it("lists packages and returns the computed price on detail", async () => {
      const created = await createPackage({
        nameAr: tag("pack-priced"),
        discountType: "PERCENTAGE",
        discountValue: 10,
        items: [validItem({ paidQuantity: 4, freeQuantity: 0 })],
      });
      expect(created.status).toBe(201);
      const packageId = created.body.id as string;

      const list = await withAuth(ctx.adminToken)(
        api().get("/api/v1/dashboard/organization/packages"),
      ).query({ limit: 100 });
      expect(list.status).toBe(200);
      expect(Array.isArray(list.body.items)).toBe(true);
      expect(list.body.items.some((p: { id: string }) => p.id === packageId)).toBe(true);

      const detail = await withAuth(ctx.adminToken)(
        api().get(`/api/v1/dashboard/organization/packages/${packageId}`),
      );
      expect(detail.status).toBe(200);
      // subtotal = 4 × 30000 = 120000; 10% discount = 12000; final = 108000.
      expect(detail.body.price.subtotal).toBe(120_000);
      expect(detail.body.price.discountAmount).toBe(12_000);
      expect(detail.body.price.finalPrice).toBe(108_000);
    });

    it("updates a package (PATCH) and persists the change", async () => {
      const created = await createPackage({
        nameAr: tag("pack-update"),
        discountType: "PERCENTAGE",
        discountValue: 10,
        items: [validItem()],
      });
      expect(created.status).toBe(201);
      const packageId = created.body.id as string;

      const patch = await withAuth(ctx.adminToken)(
        api().patch(`/api/v1/dashboard/organization/packages/${packageId}`),
      ).send({ nameAr: tag("pack-update-renamed"), isPublic: false });
      expect(patch.status).toBe(200);

      const row = await prisma.sessionPackage.findUnique({ where: { id: packageId } });
      expect(row!.nameAr).toBe(tag("pack-update-renamed"));
      expect(row!.isPublic).toBe(false);
    });

    it("archives a package (DELETE → archivedAt set, excluded from list)", async () => {
      const created = await createPackage({
        nameAr: tag("pack-archive"),
        discountType: "FIXED",
        discountValue: 0,
        items: [validItem()],
      });
      expect(created.status).toBe(201);
      const packageId = created.body.id as string;

      const del = await withAuth(ctx.adminToken)(
        api().delete(`/api/v1/dashboard/organization/packages/${packageId}`),
      );
      expect(del.status).toBe(204);

      const row = await prisma.sessionPackage.findUnique({ where: { id: packageId } });
      expect(row!.archivedAt).not.toBeNull();

      const list = await withAuth(ctx.adminToken)(
        api().get("/api/v1/dashboard/organization/packages"),
      ).query({ limit: 100 });
      expect(list.body.items.some((p: { id: string }) => p.id === packageId)).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Manual purchase → invoice + credits (real money round-trip)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Manual purchase: PackagePurchase + credits + ONE PAID invoice (halala-exact, XOR)", () => {
    it("creates an ACTIVE purchase, frozen credits, and a PAID invoice = finalPrice", async () => {
      // 4 paid + 1 free @ 30000 → subtotal 120000, 10% off = 12000, final 108000.
      const pkg = await createPackage({
        nameAr: tag("pack-sale"),
        discountType: "PERCENTAGE",
        discountValue: 10,
        items: [validItem({ paidQuantity: 4, freeQuantity: 1 })],
      });
      expect(pkg.status).toBe(201);

      const res = await purchasePackage();
      expect(res.status).toBe(201);
      const purchaseId = res.body.purchase.id as string;
      const invoiceId = res.body.invoiceId as string;

      // PackagePurchase row: ACTIVE, frozen snapshots, halala-exact.
      const purchase = await prisma.packagePurchase.findUnique({
        where: { id: purchaseId },
      });
      expect(purchase!.status).toBe("ACTIVE");
      expect(Number(purchase!.subtotalSnapshot)).toBe(120_000);
      expect(Number(purchase!.discountSnapshot)).toBe(12_000);
      expect(Number(purchase!.amountPaid)).toBe(108_000);

      // One PackageCredit per item, totalQuantity = paid + free, frozen unit price.
      const credits = await prisma.packageCredit.findMany({
        where: { purchaseId },
      });
      expect(credits).toHaveLength(1);
      expect(credits[0].totalQuantity).toBe(5); // 4 paid + 1 free
      expect(credits[0].usedQuantity).toBe(0);
      expect(Number(credits[0].unitPriceSnapshot)).toBe(30_000);

      // Exactly ONE invoice, linked via packagePurchaseId, total = finalPrice.
      const invoices = await prisma.invoice.findMany({
        where: { packagePurchaseId: purchaseId },
      });
      expect(invoices).toHaveLength(1);
      expect(invoices[0].id).toBe(invoiceId);
      expect(Number(invoices[0].total)).toBe(108_000);
      expect(Number(invoices[0].vatAmt)).toBe(0); // center not VAT-registered
      // XOR: package invoice carries packagePurchaseId and NO bookingId.
      expect(invoices[0].bookingId).toBeNull();
      expect(invoices[0].packagePurchaseId).toBe(purchaseId);
      // The manual payment flipped the invoice to PAID.
      expect(invoices[0].status).toBe("PAID");
      expect(invoices[0].paidAt).not.toBeNull();

      // A recorded COMPLETED payment for the full amount.
      const payments = await prisma.payment.findMany({
        where: { invoiceId },
      });
      expect(payments).toHaveLength(1);
      expect(payments[0].status).toBe("COMPLETED");
      expect(Number(payments[0].amount)).toBe(108_000);
      expect(payments[0].method).toBe("CASH");
    });

    it("rejects an ONLINE_CARD manual purchase with 400 (must use the webhook flow)", async () => {
      await createPackage({
        nameAr: tag("pack-online-reject"),
        discountType: "FIXED",
        discountValue: 0,
        items: [validItem()],
      });
      const res = await purchasePackage({ method: "ONLINE_CARD" });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/ONLINE_CARD|Moyasar webhook/i);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Book from credit (zero-value, no invoice)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Book from credit: zero-value booking, no invoice, usage CONSUMED", () => {
    it("creates a price=0 booking, consumes one credit, and creates NO new invoice", async () => {
      await createPackage({
        nameAr: tag("pack-consume"),
        discountType: "FIXED",
        discountValue: 0,
        items: [validItem({ paidQuantity: 3, freeQuantity: 0 })],
      });
      const sale = await purchasePackage();
      expect(sale.status).toBe(201);
      const purchaseId = sale.body.purchase.id as string;
      const credit = await prisma.packageCredit.findFirst({ where: { purchaseId } });
      expect(credit).not.toBeNull();

      const invoicesBefore = await prisma.invoice.count();

      const slots = await availableSlots(ctx.employeeId, daysFromNow(1));
      expect(slots.length).toBeGreaterThan(0);
      const slot = slots[0];

      const res = await bookFromCredit({
        clientId: ctx.clientId,
        creditId: credit!.id,
        branchId: ctx.branchId,
        scheduledAt: slot.toISOString(),
      });
      expect(res.status).toBe(201);
      const bookingId = res.body.id as string;
      expect(res.body.packageCreditId).toBe(credit!.id);

      const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
      expect(Number(booking!.price)).toBe(0);
      expect(Number(booking!.discountedPrice)).toBe(0);
      expect(Number(booking!.priceSnapshot)).toBe(0);
      expect(booking!.packageCreditId).toBe(credit!.id);
      // Duration is FIXED by the credit's duration option (60 min).
      expect(booking!.endsAt.getTime() - booking!.scheduledAt.getTime()).toBe(
        60 * 60_000,
      );

      // No new invoice was created for the credit booking.
      const invoicesAfter = await prisma.invoice.count();
      expect(invoicesAfter).toBe(invoicesBefore);
      const bookingInvoice = await prisma.invoice.findFirst({ where: { bookingId } });
      expect(bookingInvoice).toBeNull();

      // PackageCreditUsage CONSUMED + usedQuantity incremented.
      const usage = await prisma.packageCreditUsage.findFirst({
        where: { bookingId },
      });
      expect(usage!.status).toBe("CONSUMED");
      const creditAfter = await prisma.packageCredit.findUnique({
        where: { id: credit!.id },
      });
      expect(creditAfter!.usedQuantity).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. REAL CONCURRENCY — the critical test
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Concurrency: two simultaneous from-credit on the LAST credit → exactly one wins", () => {
    it("fires two concurrent bookings on a remaining=1 credit; exactly one 201, no over-draw", async () => {
      // A single-session credit (paid=1, free=0 → totalQuantity=1).
      await createPackage({
        nameAr: tag("pack-race"),
        discountType: "FIXED",
        discountValue: 0,
        items: [validItem({ paidQuantity: 1, freeQuantity: 0 })],
      });
      const sale = await purchasePackage();
      expect(sale.status).toBe(201);
      const purchaseId = sale.body.purchase.id as string;
      const credit = await prisma.packageCredit.findFirst({ where: { purchaseId } });
      expect(credit!.totalQuantity).toBe(1);
      expect(credit!.usedQuantity).toBe(0);

      // Two DISTINCT valid slots so the slot/overlap check never limits — the
      // CREDIT bucket is the only contended resource.
      const slots = await availableSlots(ctx.employeeId, daysFromNow(2));
      expect(slots.length).toBeGreaterThanOrEqual(2);
      const slotA = slots[0];
      const slotB = slots[1];

      // Fire both at once. Track ids manually because Promise.all bypasses the
      // bookFromCredit tracking helper's ordering.
      const [resA, resB] = await Promise.all([
        withAuth(ctx.adminToken)(
          api().post("/api/v1/dashboard/bookings/from-credit"),
        ).send({
          clientId: ctx.clientId,
          creditId: credit!.id,
          branchId: ctx.branchId,
          scheduledAt: slotA.toISOString(),
        }),
        withAuth(ctx.adminToken)(
          api().post("/api/v1/dashboard/bookings/from-credit"),
        ).send({
          clientId: ctx.clientId,
          creditId: credit!.id,
          branchId: ctx.branchId,
          scheduledAt: slotB.toISOString(),
        }),
      ]);

      for (const r of [resA, resB]) {
        if (r.status === 201 && r.body?.id) ctx.bookingIds.push(r.body.id);
      }

      const statuses = [resA.status, resB.status].sort();
      const successes = statuses.filter((s) => s === 201);
      const failures = statuses.filter((s) => s !== 201);

      // EXACTLY ONE winner.
      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);
      // The loser is rejected with an over-draw / conflict status (409 from the
      // ConflictException; a Serializable-abort surfaces as a 4xx/5xx but must
      // NOT be a 201). We assert it is specifically a rejection, not a success.
      const loserStatus = failures[0];
      expect([400, 409, 500]).toContain(loserStatus);

      // No over-draw: usedQuantity is exactly 1 (== totalQuantity), enforced by
      // the Serializable + FOR UPDATE guard AND the DB CHECK
      // (PackageCredit_quantities_chk: usedQuantity <= totalQuantity).
      const creditAfter = await prisma.packageCredit.findUnique({
        where: { id: credit!.id },
      });
      expect(creditAfter!.usedQuantity).toBe(1);
      expect(creditAfter!.usedQuantity).toBe(creditAfter!.totalQuantity);

      // Exactly one CONSUMED usage row for this credit.
      const consumed = await prisma.packageCreditUsage.count({
        where: { creditId: credit!.id, status: "CONSUMED" },
      });
      expect(consumed).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. Credit return on cancel
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Cancel: credit returned (usage RETURNED, usedQuantity decremented, COMPLETED → ACTIVE)", () => {
    it("returns the credit and reopens a fully-consumed purchase to ACTIVE on cancel", async () => {
      // Single-session credit so consuming it auto-completes the purchase.
      await createPackage({
        nameAr: tag("pack-cancel"),
        discountType: "FIXED",
        discountValue: 0,
        items: [validItem({ paidQuantity: 1, freeQuantity: 0 })],
      });
      const sale = await purchasePackage();
      expect(sale.status).toBe(201);
      const purchaseId = sale.body.purchase.id as string;
      const credit = await prisma.packageCredit.findFirst({ where: { purchaseId } });

      const slots = await availableSlots(ctx.employeeId, daysFromNow(3));
      const res = await bookFromCredit({
        clientId: ctx.clientId,
        creditId: credit!.id,
        branchId: ctx.branchId,
        scheduledAt: slots[0].toISOString(),
      });
      expect(res.status).toBe(201);
      const bookingId = res.body.id as string;

      // The purchase auto-completed (its only credit is fully consumed).
      const purchaseAfterBook = await prisma.packagePurchase.findUnique({
        where: { id: purchaseId },
      });
      expect(purchaseAfterBook!.status).toBe("COMPLETED");

      // Cancel the credit booking.
      const cancel = await withAuth(ctx.adminToken)(
        api().patch(`/api/v1/dashboard/bookings/${bookingId}/cancel`),
      ).send({ reason: "CLIENT_REQUESTED" });
      expect(cancel.status).toBe(200);

      // Usage flipped to RETURNED; usedQuantity decremented to 0.
      const usage = await prisma.packageCreditUsage.findFirst({
        where: { bookingId },
      });
      expect(usage!.status).toBe("RETURNED");
      expect(usage!.returnedAt).not.toBeNull();

      const creditAfter = await prisma.packageCredit.findUnique({
        where: { id: credit!.id },
      });
      expect(creditAfter!.usedQuantity).toBe(0);

      // The COMPLETED purchase was reopened to ACTIVE (capacity is free again).
      const purchaseAfterCancel = await prisma.packagePurchase.findUnique({
        where: { id: purchaseId },
      });
      expect(purchaseAfterCancel!.status).toBe("ACTIVE");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. Manual refund
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Manual refund: REFUNDED + voided credits (refunded credit no longer bookable)", () => {
    it("marks the purchase REFUNDED, records the refund, and voids the credits", async () => {
      await createPackage({
        nameAr: tag("pack-refund"),
        discountType: "FIXED",
        discountValue: 0,
        items: [validItem({ paidQuantity: 2, freeQuantity: 0 })],
      });
      const sale = await purchasePackage();
      expect(sale.status).toBe(201);
      const purchaseId = sale.body.purchase.id as string;
      const invoiceId = sale.body.invoiceId as string;
      const credit = await prisma.packageCredit.findFirst({ where: { purchaseId } });
      expect(credit!.usedQuantity).toBe(0); // remaining > 0 before refund

      // subtotal = 2 × 30000 = 60000, no discount → amountPaid 60000. Refund full.
      const refund = await withAuth(ctx.adminToken)(
        api().post(`/api/v1/dashboard/finance/package-purchases/${purchaseId}/refund`),
      ).send({ refundAmount: 60_000, notes: "Client moved abroad" });
      expect(refund.status).toBe(200);

      const purchase = await prisma.packagePurchase.findUnique({
        where: { id: purchaseId },
      });
      expect(purchase!.status).toBe("REFUNDED");
      expect(Number(purchase!.refundAmount)).toBe(60_000);
      expect(purchase!.refundedAt).not.toBeNull();

      // Credits voided: usedQuantity bumped to totalQuantity → remaining 0.
      const creditAfter = await prisma.packageCredit.findUnique({
        where: { id: credit!.id },
      });
      expect(creditAfter!.usedQuantity).toBe(creditAfter!.totalQuantity);

      // The invoice + payment moved to a refunded state and a RefundRequest exists.
      const invoiceAfter = await prisma.invoice.findUnique({ where: { id: invoiceId } });
      expect(invoiceAfter!.status).toBe("REFUNDED");
      const refundReq = await prisma.refundRequest.findFirst({
        where: { invoiceId },
      });
      expect(refundReq).not.toBeNull();
      expect(refundReq!.status).toBe("COMPLETED");
      expect(Number(refundReq!.amount)).toBe(60_000);

      // A from-credit on a REFUNDED purchase's credit is rejected (voided money).
      const slots = await availableSlots(ctx.employeeId, daysFromNow(4));
      const book = await bookFromCredit({
        clientId: ctx.clientId,
        creditId: credit!.id,
        branchId: ctx.branchId,
        scheduledAt: slots[0].toISOString(),
      });
      // resolveCredit filters on purchase.status=ACTIVE → 404 (no usable credit).
      expect([400, 404, 409]).toContain(book.status);
      expect(book.status).not.toBe(201);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. Transfer
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Transfer: re-point a credit to a qualifying employee (and reject a non-qualifying one)", () => {
    it("transfers to an employee who provides the service/duration (price snapshot unchanged)", async () => {
      await createPackage({
        nameAr: tag("pack-transfer"),
        discountType: "FIXED",
        discountValue: 0,
        items: [validItem({ paidQuantity: 2, freeQuantity: 0 })],
      });
      const sale = await purchasePackage();
      expect(sale.status).toBe(201);
      const purchaseId = sale.body.purchase.id as string;
      const credit = await prisma.packageCredit.findFirst({ where: { purchaseId } });
      const priceBefore = Number(credit!.unitPriceSnapshot);
      expect(credit!.employeeId).toBe(ctx.employeeId);

      const res = await withAuth(ctx.adminToken)(
        api().post(`/api/v1/dashboard/bookings/credits/${credit!.id}/transfer`),
      ).send({ toEmployeeId: ctx.employee2Id });
      // POST defaults to 201 (the controller declares no @HttpCode(200)).
      expect(res.status).toBe(201);

      const creditAfter = await prisma.packageCredit.findUnique({
        where: { id: credit!.id },
      });
      expect(creditAfter!.employeeId).toBe(ctx.employee2Id);
      // Frozen price snapshot must NOT change on transfer.
      expect(Number(creditAfter!.unitPriceSnapshot)).toBe(priceBefore);
    });

    it("rejects a transfer to an employee who does NOT provide the service with 400", async () => {
      await createPackage({
        nameAr: tag("pack-transfer-bad"),
        discountType: "FIXED",
        discountValue: 0,
        items: [validItem({ paidQuantity: 2, freeQuantity: 0 })],
      });
      const sale = await purchasePackage();
      expect(sale.status).toBe(201);
      const purchaseId = sale.body.purchase.id as string;
      const credit = await prisma.packageCredit.findFirst({ where: { purchaseId } });

      // emp3 has no EmployeeService link for this service.
      const res = await withAuth(ctx.adminToken)(
        api().post(`/api/v1/dashboard/bookings/credits/${credit!.id}/transfer`),
      ).send({ toEmployeeId: ctx.employee3Id });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/does not provide this service/i);

      // Credit untouched.
      const creditAfter = await prisma.packageCredit.findUnique({
        where: { id: credit!.id },
      });
      expect(creditAfter!.employeeId).toBe(ctx.employeeId);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. Authorization
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Authorization: under-permissioned caller rejected on privileged endpoints", () => {
    it("RECEPTIONIST (no manage:Setting) is forbidden from refunding a purchase", async () => {
      await createPackage({
        nameAr: tag("pack-authz"),
        discountType: "FIXED",
        discountValue: 0,
        items: [validItem({ paidQuantity: 1, freeQuantity: 0 })],
      });
      const sale = await purchasePackage();
      expect(sale.status).toBe(201);
      const purchaseId = sale.body.purchase.id as string;

      const res = await withAuth(ctx.receptionistToken)(
        api().post(`/api/v1/dashboard/finance/package-purchases/${purchaseId}/refund`),
      ).send({ refundAmount: 0 });
      expect(res.status).toBe(403);

      // The purchase was NOT refunded by the rejected call.
      const purchase = await prisma.packagePurchase.findUnique({
        where: { id: purchaseId },
      });
      expect(purchase!.status).toBe("ACTIVE");
    });

    it("unauthenticated request to create a package is rejected with 401", async () => {
      const res = await api()
        .post("/api/v1/dashboard/organization/packages")
        .send({
          nameAr: tag("pack-noauth"),
          discountType: "FIXED",
          discountValue: 0,
          items: [validItem()],
        });
      expect(res.status).toBe(401);
    });
  });
});
