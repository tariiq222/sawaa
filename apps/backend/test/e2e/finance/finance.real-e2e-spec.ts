/**
 * Finance — Real-DB E2E Spec
 * ==========================
 *
 * Exercises the high-value FINANCE endpoints against a real Postgres database
 * (no mocked Prisma). External HTTP is intercepted globally by setup-e2e.ts,
 * and the MoyasarApiClient is overridden here so refund / payment-provider
 * calls short-circuit to a deterministic stub.
 *
 * The spec focuses on the behaviours a mocked-Prisma test cannot prove:
 *   - halala-safe money arithmetic round-trips through the DB
 *   - coupon apply mutates Invoice rows under a real transaction
 *   - payment and refund flows update the real Payment / RefundRequest /
 *     Invoice state machine to the right terminal status
 *   - permission checks (CASL guard) reject under-permissioned callers
 *
 * Data isolation: every seeded row carries a per-run suffix so this spec can
 * run alongside other real-DB specs without colliding on unique columns.
 * Cleanup is targeted (by suffix + by id) and never touches shared rows.
 *
 * Run:
 *   REAL_E2E_DATABASE_URL="postgresql://sawaa:sawaa_dev_password@localhost:3453/sawaa_test?schema=public" \
 *     npx jest --config test/jest-e2e.json --runInBand \
 *     test/e2e/finance/finance.real-e2e-spec.ts
 */

import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { AppModule } from "../../../src/app.module";
import { PrismaService } from "../../../src/infrastructure/database";
import { MoyasarApiClient } from "../../../src/modules/finance/moyasar-api/moyasar-api.client";

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL
  ? describe
  : describe.skip;

describeRealE2e("Finance — real-DB e2e (halala math, coupons, payments, refunds, authz)", () => {
  jest.setTimeout(60_000);

  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  // ── Per-run isolation ──────────────────────────────────────────────────────
  // The spec runs against a shared sawaa_test DB. Every seeded row carries the
  // suffix so cleanup can target only our own writes, and unique constraints
  // (User.email, Coupon.code) cannot collide with sibling specs.
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tag = (label: string) => `fin-e2e-${suffix}-${label}`;
  const couponCode = (label: string) =>
    `FIN_E2E_${suffix}_${label}`.toUpperCase().slice(0, 60);
  const uniqueEmail = (label: string) =>
    `finance-real-e2e-${suffix}-${label}@sawaa.test`;
  const uniquePhone = () =>
    `05${String(Math.floor(10_000_000 + Math.random() * 89_999_999)).padStart(8, "0")}`;

  // Track every entity this spec creates so cleanup is targeted and parallel
  // sibling specs (if any) keep their own rows intact.
  const ctx = {
    userOwnerId: "",
    userEmployeeId: "",
    branchId: "",
    employeeId: "",
    clientId: "",
    authToken: "",
    employeeToken: "",
    bookingIds: [] as string[],
    invoiceIds: [] as string[],
    paymentIds: [] as string[],
    couponIds: [] as string[],
  };

  const api = () => request(app.getHttpServer());
  const withAuth = (token: string) => (req: request.Test) =>
    req.set("Authorization", `Bearer ${token}`);

  // ── Setup / teardown ──────────────────────────────────────────────────────

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.REAL_E2E_DATABASE_URL!;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MoyasarApiClient)
      .useValue({
        createPayment: jest.fn(),
        // The real createRefund hits api.moyasar.com and needs an encrypted
        // org credential that we do not want to manage in-test. The global
        // fetch mock in setup-e2e.ts would also satisfy it, but a stub here
        // keeps the test deterministic and side-effect free.
        createRefund: jest.fn().mockImplementation(
          (_org: string, params: { amount: number; paymentId: string }) =>
            Promise.resolve({
              id: `rfnd_mock_${suffix}_${params.paymentId}`,
              amount: params.amount,
              currency: "SAR",
              status: "refunded",
              paymentId: params.paymentId,
              createdAt: new Date().toISOString(),
            }),
        ),
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
      /* best-effort — see learn-from-mistakes for cleanup resilience */
    }
    if (app) await app.close();
  });

  async function seedBaseEntities() {
    // ADMIN user (BUILT_IN.ADMIN has manage:Invoice / Payment / Coupon /
    // Setting, so the dashboard finance endpoints are reachable). Same
    // permission set as OWNER — UserRole enum has no OWNER value.
    const owner = await prisma.user.create({
      data: {
        email: uniqueEmail("admin"),
        passwordHash: "not-used",
        name: tag("Admin"),
        role: "ADMIN",
        isActive: true,
      },
    });
    ctx.userOwnerId = owner.id;
    ctx.authToken = jwtService.sign({
      sub: owner.id,
      email: owner.email,
      role: owner.role,
      isSuperAdmin: true,
    });

    // EMPLOYEE user (BUILT_IN.EMPLOYEE has NO Invoice / Payment / Coupon
    // permissions → all dashboard finance endpoints must 403).
    const employeeUser = await prisma.user.create({
      data: {
        email: uniqueEmail("employee"),
        passwordHash: "not-used",
        name: tag("Employee"),
        role: "EMPLOYEE",
        isActive: true,
      },
    });
    ctx.userEmployeeId = employeeUser.id;
    ctx.employeeToken = jwtService.sign({
      sub: employeeUser.id,
      email: employeeUser.email,
      role: employeeUser.role,
      isSuperAdmin: false,
    });

    // Branch + Employee + Client — minimum prerequisites for a finance row.
    const branch = await prisma.branch.create({
      data: {
        nameAr: tag("branch-ar"),
        nameEn: tag("branch-en"),
        isActive: true,
      },
    });
    ctx.branchId = branch.id;

    const emp = await prisma.employee.create({
      data: {
        name: tag("employee"),
        nameAr: tag("employee-ar"),
        email: uniqueEmail("emp"),
        phone: uniquePhone(),
        isActive: true,
      },
    });
    ctx.employeeId = emp.id;

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
   * Targeted cleanup of only this spec's rows. Uses the per-run suffix and
   * the explicit ID lists accumulated in `ctx` so siblings running in
   * parallel keep their own data intact.
   */
  async function cleanup() {
    if (!prisma) return;
    // RefundRequest → Payment → CouponRedemption → Invoice → Booking →
    // Coupon → Client → Employee → Branch → User. The FKs are RESTRICT in
    // finance, so we have to delete in this order.
    await prisma.refundRequest
      .deleteMany({ where: { paymentId: { in: ctx.paymentIds } } })
      .catch(() => undefined);
    await prisma.payment
      .deleteMany({ where: { id: { in: ctx.paymentIds } } })
      .catch(() => undefined);
    await prisma.couponRedemption
      .deleteMany({ where: { invoiceId: { in: ctx.invoiceIds } } })
      .catch(() => undefined);
    await prisma.invoice
      .deleteMany({ where: { id: { in: ctx.invoiceIds } } })
      .catch(() => undefined);
    await prisma.coupon
      .deleteMany({ where: { id: { in: ctx.couponIds } } })
      .catch(() => undefined);
    await prisma.booking
      .deleteMany({ where: { id: { in: ctx.bookingIds } } })
      .catch(() => undefined);
    await prisma.user
      .deleteMany({
        where: { id: { in: [ctx.userOwnerId, ctx.userEmployeeId].filter(Boolean) } },
      })
      .catch(() => undefined);
    // Suffix-pattern cleanup as a safety net for any entity we forgot to
    // track in ctx (e.g. a failed-test half-state). Limited to rows whose
    // identifying column carries the suffix — never touches siblings.
    await prisma.client
      .deleteMany({ where: { email: { startsWith: `finance-real-e2e-${suffix}-` } } })
      .catch(() => undefined);
    await prisma.employee
      .deleteMany({ where: { email: { startsWith: `finance-real-e2e-${suffix}-` } } })
      .catch(() => undefined);
    await prisma.branch
      .deleteMany({ where: { nameEn: { startsWith: tag("") } } })
      .catch(() => undefined);

    ctx.bookingIds = [];
    ctx.invoiceIds = [];
    ctx.paymentIds = [];
    ctx.couponIds = [];
    ctx.userOwnerId = "";
    ctx.userEmployeeId = "";
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function makeBookingId(): string {
    // UUID v4 — the create-invoice DTO validates @IsUUID() on bookingId. The
    // suffix is embedded in the lower bits so cleanup-by-id still works.
    return randomUUID();
  }

  async function seedIssuedInvoice(opts: {
    subtotalHalalas: number;
    vatRate?: number;
    totalHalalas?: number;
  }) {
    const bookingId = makeBookingId();
    ctx.bookingIds.push(bookingId);
    // Mirror the create-invoice handler's halala-safe math: total = subtotal
    // minus discount, plus VAT at the configured rate (round half-up). When
    // the caller overrides totalHalalas we trust that value verbatim.
    const subtotalDec = new Prisma.Decimal(opts.subtotalHalalas);
    const vatRate = new Prisma.Decimal(opts.vatRate ?? 0);
    const vatAmt = subtotalDec.times(vatRate).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
    const total = new Prisma.Decimal(opts.totalHalalas ?? subtotalDec.plus(vatAmt).toNumber());
    const invoice = await prisma.invoice.create({
      data: {
        branchId: ctx.branchId,
        clientId: ctx.clientId,
        employeeId: ctx.employeeId,
        bookingId,
        subtotal: subtotalDec,
        discountAmt: new Prisma.Decimal(0),
        vatRate,
        vatAmt,
        total,
        currency: "SAR",
        status: "ISSUED",
        issuedAt: new Date(),
      },
    });
    ctx.invoiceIds.push(invoice.id);
    return invoice;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INVOICE LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Invoice lifecycle: create, list, get", () => {
    it("creates an invoice with exact halala amounts persisted (no float drift)", async () => {
      const bookingId = makeBookingId();
      ctx.bookingIds.push(bookingId);

      const res = await withAuth(ctx.authToken)(
        api().post("/api/v1/dashboard/finance/invoices"),
      ).send({
        branchId: ctx.branchId,
        clientId: ctx.clientId,
        employeeId: ctx.employeeId,
        bookingId,
        subtotal: 23_499, // 234.99 SAR — odd halala count exercises the round trip
        discountAmt: 0,
        vatRate: 0.15,
      });

      expect(res.status).toBe(201);
      ctx.invoiceIds.push(res.body.id);

      // Response must echo the canonical halala math.
      // 23499 × 0.15 = 3524.85 → ROUND_HALF_UP → 3525 halalas
      // total = 23499 + 3525 = 27024 halalas
      expect(Number(res.body.subtotal)).toBe(23_499);
      expect(Number(res.body.discountAmt)).toBe(0);
      expect(Number(res.body.vatAmt)).toBe(3_525);
      expect(Number(res.body.total)).toBe(27_024);
      expect(res.body.currency).toBe("SAR");
      expect(res.body.status).toBe("ISSUED");

      // Re-read from DB to confirm persistence (not just the in-memory response).
      const row = await prisma.invoice.findUnique({ where: { id: res.body.id } });
      expect(row).not.toBeNull();
      expect(Number(row!.subtotal)).toBe(23_499);
      expect(Number(row!.vatAmt)).toBe(3_525);
      expect(Number(row!.total)).toBe(27_024);
    });

    it("lists invoices and returns the just-created one with display fields", async () => {
      const res = await withAuth(ctx.authToken)(
        api().get("/api/v1/dashboard/finance/invoices"),
      ).query({ clientId: ctx.clientId, limit: 50 });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items.length).toBeGreaterThan(0);

      const created = res.body.items.find(
        (i: { clientId: string }) => i.clientId === ctx.clientId,
      );
      expect(created).toBeDefined();
      expect(typeof created.number).toBe("number");
      expect(created.currency).toBe("SAR");
      expect(created.clientName).toBeTruthy();
    });

    it("gets a single invoice by id, returning nested payments", async () => {
      // Use the invoice we just created.
      const listed = await withAuth(ctx.authToken)(
        api().get("/api/v1/dashboard/finance/invoices"),
      ).query({ clientId: ctx.clientId, limit: 1 });
      const invoiceId = listed.body.items[0].id as string;

      const res = await withAuth(ctx.authToken)(
        api().get(`/api/v1/dashboard/finance/invoices/${invoiceId}`),
      );

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(invoiceId);
      expect(Array.isArray(res.body.payments)).toBe(true);
    });

    it("rejects a second invoice for the same booking with 409 (UNIQUE bookingId)", async () => {
      const bookingId = makeBookingId();
      ctx.bookingIds.push(bookingId);

      const first = await withAuth(ctx.authToken)(
        api().post("/api/v1/dashboard/finance/invoices"),
      ).send({
        branchId: ctx.branchId,
        clientId: ctx.clientId,
        employeeId: ctx.employeeId,
        bookingId,
        subtotal: 10_000,
        vatRate: 0,
      });
      expect(first.status).toBe(201);
      ctx.invoiceIds.push(first.body.id);

      const second = await withAuth(ctx.authToken)(
        api().post("/api/v1/dashboard/finance/invoices"),
      ).send({
        branchId: ctx.branchId,
        clientId: ctx.clientId,
        employeeId: ctx.employeeId,
        bookingId,
        subtotal: 10_000,
        vatRate: 0,
      });
      expect(second.status).toBe(409);
      expect(second.body.code ?? second.body.message).toMatch(/INVOICE_ALREADY_EXISTS|already/i);
    });

    it("rejects invoice creation with neither bookingId nor packagePurchaseId (XOR)", async () => {
      const res = await withAuth(ctx.authToken)(
        api().post("/api/v1/dashboard/finance/invoices"),
      ).send({
        branchId: ctx.branchId,
        clientId: ctx.clientId,
        employeeId: ctx.employeeId,
        subtotal: 5_000,
        vatRate: 0,
      });
      expect(res.status).toBe(400);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // COUPON FLOW — happy + three failure paths
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Coupon apply: happy path + invalid / expired / exhausted rejections", () => {
    it("20% PERCENTAGE coupon reduces the invoice total (real DB writes)", async () => {
      const invoice = await seedIssuedInvoice({ subtotalHalalas: 20_000, vatRate: 0.15 });
      // 20000 + 3000 (15% VAT) = 23000

      const coupon = await prisma.coupon.create({
        data: {
          code: couponCode("SAVE20"),
          discountType: "PERCENTAGE",
          discountValue: new Prisma.Decimal(20),
          isActive: true,
        },
      });
      ctx.couponIds.push(coupon.id);

      const res = await withAuth(ctx.authToken)(
        api().post("/api/v1/dashboard/finance/coupons/apply"),
      ).send({ invoiceId: invoice.id, code: coupon.code });

      expect(res.status).toBe(200);

      // Re-read from DB to prove the write actually landed.
      const updated = await prisma.invoice.findUnique({
        where: { id: invoice.id },
      });
      expect(updated).not.toBeNull();
      // 20000 × 20% = 4000 halalas coupon discount
      expect(Number(updated!.discountAmt)).toBe(4_000);
      // 16000 × 15% = 2400 halalas VAT
      expect(Number(updated!.vatAmt)).toBe(2_400);
      // 16000 + 2400 = 18400 halalas total
      expect(Number(updated!.total)).toBe(18_400);

      // CouponRedemption row was created with the correct halala amount.
      const redemption = await prisma.couponRedemption.findUnique({
        where: {
          couponId_invoiceId: { couponId: coupon.id, invoiceId: invoice.id },
        },
      });
      expect(redemption).not.toBeNull();
      expect(Number(redemption!.discount)).toBe(4_000);
      expect(redemption!.clientId).toBe(ctx.clientId);

      // usedCount was atomically incremented.
      const couponAfter = await prisma.coupon.findUnique({ where: { id: coupon.id } });
      expect(couponAfter!.usedCount).toBe(1);
    });

    it("rejects an unknown coupon code with 404", async () => {
      const invoice = await seedIssuedInvoice({ subtotalHalalas: 10_000, vatRate: 0 });

      const res = await withAuth(ctx.authToken)(
        api().post("/api/v1/dashboard/finance/coupons/apply"),
      ).send({ invoiceId: invoice.id, code: couponCode("DOES_NOT_EXIST") });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/not found/i);

      // Discount must NOT have changed on rejection.
      const after = await prisma.invoice.findUnique({ where: { id: invoice.id } });
      expect(Number(after!.discountAmt)).toBe(0);
    });

    it("rejects an expired coupon with 400 (no DB write)", async () => {
      const invoice = await seedIssuedInvoice({ subtotalHalalas: 10_000, vatRate: 0 });

      const coupon = await prisma.coupon.create({
        data: {
          code: couponCode("EXPIRED"),
          discountType: "FIXED",
          discountValue: new Prisma.Decimal(1_000),
          isActive: true,
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1_000), // yesterday
        },
      });
      ctx.couponIds.push(coupon.id);

      const res = await withAuth(ctx.authToken)(
        api().post("/api/v1/dashboard/finance/coupons/apply"),
      ).send({ invoiceId: invoice.id, code: coupon.code });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/expired/i);

      // Invoice untouched, no redemption row.
      const after = await prisma.invoice.findUnique({ where: { id: invoice.id } });
      expect(Number(after!.discountAmt)).toBe(0);
      const redemption = await prisma.couponRedemption.count({
        where: { couponId: coupon.id, invoiceId: invoice.id },
      });
      expect(redemption).toBe(0);
    });

    it("rejects a coupon whose global maxUses is already exhausted with 400", async () => {
      const invoice = await seedIssuedInvoice({ subtotalHalalas: 10_000, vatRate: 0 });

      const coupon = await prisma.coupon.create({
        data: {
          code: couponCode("MAXED"),
          discountType: "FIXED",
          discountValue: new Prisma.Decimal(500),
          maxUses: 1,
          usedCount: 1, // already exhausted
          isActive: true,
        },
      });
      ctx.couponIds.push(coupon.id);

      const res = await withAuth(ctx.authToken)(
        api().post("/api/v1/dashboard/finance/coupons/apply"),
      ).send({ invoiceId: invoice.id, code: coupon.code });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/usage limit|reached/i);

      // No redemption row created.
      const redemption = await prisma.couponRedemption.count({
        where: { couponId: coupon.id, invoiceId: invoice.id },
      });
      expect(redemption).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PAYMENT LIFECYCLE — process, list, get, stats
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Payment lifecycle: process, list, get, stats", () => {
    it("processes a BANK_TRANSFER payment, marks the invoice PAID, persists exact halalas", async () => {
      // subtotal=10000, VAT=1500, total=11500 (15% VAT)
      const invoice = await seedIssuedInvoice({ subtotalHalalas: 10_000, vatRate: 0.15 });

      const res = await withAuth(ctx.authToken)(
        api().post("/api/v1/dashboard/finance/payments"),
      ).send({
        invoiceId: invoice.id,
        amount: 11_500,
        method: "BANK_TRANSFER",
        gatewayRef: `pay_e2e_${suffix}_paid`,
      });

      expect(res.status).toBe(201);
      ctx.paymentIds.push(res.body.id);

      // Re-read both the payment and the invoice from the DB.
      const payment = await prisma.payment.findUnique({ where: { id: res.body.id } });
      expect(payment).not.toBeNull();
      expect(Number(payment!.amount)).toBe(11_500);
      expect(payment!.status).toBe("COMPLETED");
      expect(payment!.method).toBe("BANK_TRANSFER");
      expect(payment!.gatewayRef).toBe(`pay_e2e_${suffix}_paid`);

      const invoiceAfter = await prisma.invoice.findUnique({ where: { id: invoice.id } });
      expect(invoiceAfter!.status).toBe("PAID");
      expect(invoiceAfter!.paidAt).not.toBeNull();
    });

    it("rejects an over-payment (amount > outstanding) with 400", async () => {
      // Subtotal 5000, VAT 0, total 5000. Already pay 5000 → invoice becomes
      // PAID. A second 1000 payment must be rejected.
      const invoice = await seedIssuedInvoice({ subtotalHalalas: 5_000, vatRate: 0 });

      const first = await withAuth(ctx.authToken)(
        api().post("/api/v1/dashboard/finance/payments"),
      ).send({
        invoiceId: invoice.id,
        amount: 5_000,
        method: "CASH",
      });
      expect(first.status).toBe(201);
      ctx.paymentIds.push(first.body.id);

      const second = await withAuth(ctx.authToken)(
        api().post("/api/v1/dashboard/finance/payments"),
      ).send({
        invoiceId: invoice.id,
        amount: 1_000,
        method: "CASH",
      });
      expect(second.status).toBe(400);
      expect(second.body.message).toMatch(/fully paid|exceeds/i);
    });

    it("rejects ONLINE_CARD via dashboard (must go through Moyasar webhook)", async () => {
      const invoice = await seedIssuedInvoice({ subtotalHalalas: 5_000, vatRate: 0 });

      const res = await withAuth(ctx.authToken)(
        api().post("/api/v1/dashboard/finance/payments"),
      ).send({
        invoiceId: invoice.id,
        amount: 5_000,
        method: "ONLINE_CARD",
      });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Moyasar webhook/i);
    });

    it("lists payments filtered by invoiceId and returns the COMPLETED one", async () => {
      // Re-use the paid invoice from the first scenario in this block.
      const listed = await withAuth(ctx.authToken)(
        api().get("/api/v1/dashboard/finance/payments"),
      ).query({ status: "COMPLETED", limit: 50 });
      expect(listed.status).toBe(200);
      expect(Array.isArray(listed.body.items)).toBe(true);

      const paid = listed.body.items.find(
        (p: { method: string }) => p.method === "BANK_TRANSFER",
      );
      expect(paid).toBeDefined();
      expect(Number(paid.amount)).toBe(11_500);
      expect(paid.invoice).toBeTruthy();
      expect(paid.invoice.client).toBeTruthy();
    });

    it("gets a single payment by id, with refundRequests nested", async () => {
      const listed = await withAuth(ctx.authToken)(
        api().get("/api/v1/dashboard/finance/payments"),
      ).query({ status: "COMPLETED", limit: 1 });
      const paymentId = listed.body.items[0].id as string;

      const res = await withAuth(ctx.authToken)(
        api().get(`/api/v1/dashboard/finance/payments/${paymentId}`),
      );
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(paymentId);
      expect(Array.isArray(res.body.refundRequests)).toBe(true);
    });

    it("payment stats reflect the real DB groupBy (counts + amounts add up)", async () => {
      const res = await withAuth(ctx.authToken)(
        api().get("/api/v1/dashboard/finance/payments/stats"),
      );
      expect(res.status).toBe(200);

      // We paid at least one BANK_TRANSFER and one CASH in this describe block.
      // The endpoint is global (no per-test filter) so we assert the invariants
      // the stats handler MUST hold:
      expect(res.body.completed).toBeGreaterThanOrEqual(2);
      expect(res.body.completedAmount).toBeGreaterThanOrEqual(16_500); // 11500 + 5000
      // Sum of per-status counts must equal the grand total.
      const perStatusSum =
        res.body.completed +
        res.body.pending +
        res.body.pendingVerification +
        res.body.refunded +
        res.body.failed;
      expect(res.body.total).toBe(perStatusSum);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // REFUND FLOW — happy path + over-refund rejection
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Refund: happy path + over-refund rejection", () => {
    async function seedCompletedPaymentWithGatewayRef(amount: number) {
      const invoice = await seedIssuedInvoice({
        subtotalHalalas: amount,
        vatRate: 0,
      });
      const payment = await prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: new Prisma.Decimal(amount),
          currency: "SAR",
          method: "MADA",
          status: "COMPLETED",
          gatewayRef: `pay_e2e_${suffix}_${Math.random().toString(36).slice(2, 8)}`,
          processedAt: new Date(),
        },
      });
      ctx.paymentIds.push(payment.id);
      return { invoice, payment };
    }

    it("happy path: partial refund marks payment PARTIALLY_REFUNDED, invoice PARTIALLY_REFUNDED", async () => {
      const { invoice, payment } = await seedCompletedPaymentWithGatewayRef(50_000);

      const res = await withAuth(ctx.authToken)(
        api().patch(`/api/v1/dashboard/finance/payments/${payment.id}/refund`),
      ).send({ reason: "Service partially delivered", amount: 20_000 });

      expect(res.status).toBe(200);

      // RefundRequest row created + moved to COMPLETED with the gateway ref.
      const refundReq = await prisma.refundRequest.findFirst({
        where: { paymentId: payment.id },
      });
      expect(refundReq).not.toBeNull();
      expect(refundReq!.status).toBe("COMPLETED");
      expect(Number(refundReq!.amount)).toBe(20_000);
      expect(refundReq!.gatewayRef).toMatch(/^rfnd_mock_/); // stub id from override

      // Payment row: PARTIALLY_REFUNDED with refundedAmount incremented.
      const paymentAfter = await prisma.payment.findUnique({ where: { id: payment.id } });
      expect(paymentAfter!.status).toBe("PARTIALLY_REFUNDED");
      expect(Number(paymentAfter!.refundedAmount)).toBe(20_000);

      // Invoice row: PARTIALLY_REFUNDED.
      const invoiceAfter = await prisma.invoice.findUnique({ where: { id: invoice.id } });
      expect(invoiceAfter!.status).toBe("PARTIALLY_REFUNDED");
      expect(Number(invoiceAfter!.refundedAmount)).toBe(20_000);
    });

    it("rejects a refund that exceeds the paid amount (over-refund guard) with 400", async () => {
      // Payment was 10_000 halalas; try to refund 15_000.
      const { payment } = await seedCompletedPaymentWithGatewayRef(10_000);

      const res = await withAuth(ctx.authToken)(
        api().patch(`/api/v1/dashboard/finance/payments/${payment.id}/refund`),
      ).send({ reason: "trying to over-refund", amount: 15_000 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/exceeds the refundable balance/i);

      // No RefundRequest row should have been left behind in a happy terminal
      // state. A PROCESSING row may exist (the handler persists before the
      // gateway call and would have marked it FAILED on rejection) — but
      // nothing should be COMPLETED.
      const completed = await prisma.refundRequest.count({
        where: { paymentId: payment.id, status: "COMPLETED" },
      });
      expect(completed).toBe(0);

      // Payment is still COMPLETED (the failed refund must not flip its status).
      const paymentAfter = await prisma.payment.findUnique({ where: { id: payment.id } });
      expect(paymentAfter!.status).toBe("COMPLETED");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTHORIZATION — under-permissioned callers must be rejected
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Authorization: under-permissioned caller is rejected", () => {
    it("EMPLOYEE role (no Coupon permission) is forbidden from managing coupons", async () => {
      const res = await withAuth(ctx.employeeToken)(
        api().post("/api/v1/dashboard/finance/coupons/apply"),
      ).send({ invoiceId: ctx.invoiceIds[0] ?? "00000000-0000-0000-0000-000000000000", code: "NOPE" });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/insufficient|forbidden/i);
    });

    it("unauthenticated request is rejected with 401 (no token)", async () => {
      const res = await api().get("/api/v1/dashboard/finance/payments/stats");
      expect(res.status).toBe(401);
    });
  });
});
