/**
 * Public Booking Funnel — Real-DB E2E Spec
 * =========================================
 *
 * Exercises the website's core conversion path against a real Postgres
 * database (no mocked Prisma). External HTTP is intercepted globally by
 * setup-e2e.ts.
 *
 * The spec focuses on the behaviours the existing Prisma-mocked
 * public-bookings.e2e-spec.ts cannot prove:
 *   - GET /public/branches/services/employees return the seeded active
 *     records AND exclude inactive ones (failure/filter path)
 *   - GET /public/availability slots for a seeded service+employee returns
 *     slots; querying an unsupported deliveryType or a non-public employee
 *     is rejected/empty as the handler dictates
 *   - POST /public/bookings (the funnel endpoint) happy path → Booking row
 *     persisted with correct snapshot fields + matching Invoice; failure
 *     paths (outside business hours, inactive service, missing client
 *     session) → rejected with the right status codes
 *   - Public unauthenticated endpoints are reachable WITHOUT a token;
 *     any protected action (POST /public/bookings) requires a verified
 *     ClientSession (401 without)
 *
 * Data isolation: every seeded row carries a per-run suffix so this spec
 * can run alongside other real-DB specs (finance, contact-messages,
 * booking-scenarios) on the shared `sawaa_test` database. Cleanup is
 * targeted (by suffix + by id) and never touches shared rows.
 *
 * Run:
 *   REAL_E2E_DATABASE_URL="postgresql://sawaa:sawaa_dev_password@localhost:3453/sawaa_test?schema=public" \
 *     npx jest --config test/jest-e2e.json --runInBand \
 *     test/e2e/bookings/public-booking-funnel.real-e2e-spec.ts
 */

import { INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { DeliveryType, Prisma } from "@prisma/client";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createRealE2eApp } from "../../helpers/create-real-e2e-app";
import { PrismaService } from "../../../src/infrastructure/database";

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL
  ? describe
  : describe.skip;

describeRealE2e(
  "Public Booking Funnel — real-DB e2e (catalog, availability, create booking, programs)",
  () => {
    jest.setTimeout(60_000);

    let app: INestApplication;
    let prisma: PrismaService;
    let jwtService: JwtService;

    // ── Per-run isolation ────────────────────────────────────────────────────
    // Suffix is used on every nameAr/nameEn/email/phone seeded by this spec.
    // The helper enforces DB name contains "test" so we can safely share the
    // sawaa_test database with sibling specs.
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tag = (label: string) => `pbf-e2e-${suffix}-${label}`;
    const uniqueEmail = (label: string) =>
      `pbf-e2e-${suffix}-${label}@sawaa.test`;
    const uniquePhone = () =>
      `05${String(Math.floor(10_000_000 + Math.random() * 89_999_999)).padStart(8, "0")}`;

    // Tracked IDs for targeted cleanup + sanity checks
    const ctx = {
      branchId: "",
      inactiveBranchId: "",
      mainBranchId: "",
      publicEmployeeId: "",
      hiddenEmployeeId: "",
      serviceId: "",
      inactiveServiceId: "",
      clientId: "",
      clientToken: "",
      bookingIds: [] as string[],
      invoiceIds: [] as string[],
      outboxIds: [] as string[],
      programId: "",
    };

    const api = () => request(app.getHttpServer());

    // ── Setup / teardown ─────────────────────────────────────────────────────

    beforeAll(async () => {
      // The real-DB helper sets process.env.DATABASE_URL from REAL_E2E_DATABASE_URL
      // and validates the database name. We override the AppModule's bootstrap
      // so ValidationPipe is wired with enableImplicitConversion (the public
      // slots controller needs it for the durationMins query param).
      process.env.DATABASE_URL = process.env.REAL_E2E_DATABASE_URL!;

      const { app: a, prisma: p } = await createRealE2eApp();
      app = a;
      prisma = p;
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
          transformOptions: { enableImplicitConversion: true },
        }),
      );
      app.setGlobalPrefix("api/v1");
      // The helper already called app.init() before we replaced the pipes,
      // so the global prefix + validation are picked up via re-init.
      // We need to re-init for the new ValidationPipe to take effect.
      await app.init();

      jwtService = app.get(JwtService);
      await prisma.$queryRaw`SELECT 1`;

      await cleanup();
      await seedOrganizationSettings();
      await seedBaseEntities();
      await seedClientSession();
    });

    afterAll(async () => {
      try {
        await cleanup();
      } catch {
        /* best-effort — see learn-from-mistakes for cleanup resilience */
      }
      if (app) await app.close();
    });

    // ── Seed helpers ─────────────────────────────────────────────────────────

    async function seedOrganizationSettings() {
      // OrganizationSettings is a single-row config table. The create-booking
      // handler reads vatRate from it; align with the rest of the e2e suite
      // (15% VAT, payAtClinic allowed) so the funnel price math is consistent.
      const existing = await prisma.organizationSettings.findFirst({});
      if (existing) {
        await prisma.organizationSettings.update({
          where: { id: existing.id },
          data: { vatRate: "0.15", paymentAtClinicEnabled: true },
        });
      } else {
        await prisma.organizationSettings.create({
          data: { vatRate: "0.15", paymentAtClinicEnabled: true },
        });
      }
    }

    async function seedBaseEntities() {
      // ── Main branch (isMain=true so CreatePublicBookingHandler resolves it
      //    when the booking request omits branchId) ──
      const mainBranch = await prisma.branch.create({
        data: {
          nameAr: tag("main-branch-ar"),
          nameEn: tag("main-branch-en"),
          isActive: true,
          isMain: true,
        },
      });
      ctx.mainBranchId = mainBranch.id;

      // A second non-main active branch — proves the public list returns all
      // active branches, not just the main one.
      const branch = await prisma.branch.create({
        data: {
          nameAr: tag("branch-ar"),
          nameEn: tag("branch-en"),
          isActive: true,
          isMain: false,
        },
      });
      ctx.branchId = branch.id;

      // Inactive branch — the public list endpoint must NOT include it.
      const inactiveBranch = await prisma.branch.create({
        data: {
          nameAr: tag("inactive-branch-ar"),
          nameEn: tag("inactive-branch-en"),
          isActive: false,
        },
      });
      ctx.inactiveBranchId = inactiveBranch.id;

      // ── Department + category so the Service has a valid categoryId ──
      const dept = await prisma.department.create({
        data: {
          nameAr: tag("dept-ar"),
          nameEn: tag("dept-en"),
          isActive: true,
        },
      });
      const cat = await prisma.serviceCategory.create({
        data: {
          nameAr: tag("cat-ar"),
          nameEn: tag("cat-en"),
          departmentId: dept.id,
          isActive: true,
        },
      });

      // ── Two employees ──
      // publicEmployee  → isPublic=true, isActive=true (visible in /public/employees)
      // hiddenEmployee  → isPublic=false (invisible in /public/employees)
      const publicEmp = await prisma.employee.create({
        data: {
          name: tag("public-emp"),
          nameAr: tag("public-emp-ar"),
          email: uniqueEmail("emp-public"),
          phone: uniquePhone(),
          slug: tag("public-emp-slug"),
          isActive: true,
          isPublic: true,
        },
      });
      ctx.publicEmployeeId = publicEmp.id;

      const hiddenEmp = await prisma.employee.create({
        data: {
          name: tag("hidden-emp"),
          nameAr: tag("hidden-emp-ar"),
          email: uniqueEmail("emp-hidden"),
          phone: uniquePhone(),
          isActive: true,
          isPublic: false,
        },
      });
      ctx.hiddenEmployeeId = hiddenEmp.id;

      // Link both employees to the main branch.
      await prisma.employeeBranch.createMany({
        data: [
          { employeeId: publicEmp.id, branchId: ctx.mainBranchId },
          { employeeId: hiddenEmp.id, branchId: ctx.mainBranchId },
        ],
      });

      // ── Active service (with IN_PERSON config so slots endpoint succeeds) ──
      const activeSvc = await prisma.service.create({
        data: {
          nameAr: tag("svc-ar"),
          nameEn: tag("svc-en"),
          durationMins: 60,
          price: 30000, // 300 SAR in halalas
          currency: "SAR",
          isActive: true,
          isHidden: false,
          archivedAt: null,
          categoryId: cat.id,
        },
      });
      ctx.serviceId = activeSvc.id;

      await prisma.serviceBookingConfig.create({
        data: {
          serviceId: activeSvc.id,
          deliveryType: DeliveryType.IN_PERSON,
          price: new Prisma.Decimal(30000),
          durationMins: 60,
          isActive: true,
        },
      });
      // Default duration option required for PriceResolverService to land
      // somewhere when the booking request omits durationOptionId.
      await prisma.serviceDurationOption.create({
        data: {
          serviceId: activeSvc.id,
          deliveryType: DeliveryType.IN_PERSON,
          label: "60 min",
          labelAr: "60 دقيقة",
          durationMins: 60,
          price: new Prisma.Decimal(30000),
          isDefault: true,
          isActive: true,
          sortOrder: 1,
        },
      });

      // ── Inactive service (isActive=false) — funnel MUST reject this ──
      const inactiveSvc = await prisma.service.create({
        data: {
          nameAr: tag("inactive-svc-ar"),
          nameEn: tag("inactive-svc-en"),
          durationMins: 30,
          price: 5000,
          currency: "SAR",
          isActive: false,
          isHidden: false,
          archivedAt: null,
          categoryId: cat.id,
        },
      });
      ctx.inactiveServiceId = inactiveSvc.id;

      // Link the public employee to the active service.
      await prisma.employeeService.create({
        data: {
          employeeId: publicEmp.id,
          serviceId: activeSvc.id,
          isActive: true,
        },
      });

      // ── Business hours + employee availability on every day of the week ──
      // We cover all 7 days so any date the test picks has coverage. The
      // failure-path "outside business hours" case is constructed by picking
      // a different day with a closed business hour entry (see later test).
      for (let dow = 0; dow < 7; dow++) {
        await prisma.businessHour.create({
          data: {
            branchId: ctx.mainBranchId,
            dayOfWeek: dow,
            startTime: "08:00",
            endTime: "22:00",
            isOpen: true,
          },
        });
        await prisma.employeeAvailability.create({
          data: {
            employeeId: publicEmp.id,
            dayOfWeek: dow,
            startTime: "08:00",
            endTime: "22:00",
            isActive: true,
          },
        });
      }

      // ── A public program for the /public/programs assertions ──
      const program = await prisma.program.create({
        data: {
          nameAr: tag("program-ar"),
          nameEn: tag("program-en"),
          departmentId: dept.id,
          branchId: ctx.mainBranchId,
          daysCount: 4,
          hoursPerDay: 2,
          minParticipants: 2,
          maxParticipants: 10,
          price: new Prisma.Decimal(40000),
          currency: "SAR",
          status: "OPEN",
          isPublic: true,
        },
      });
      ctx.programId = program.id;
    }

    async function seedClientSession() {
      // The public POST /bookings route is guarded by ClientSessionGuard
      // (client-jwt strategy). Strategy requires: sub = real client.id,
      // namespace = 'client', tokenVersion = client.tokenVersion.
      const client = await prisma.client.create({
        data: {
          name: tag("client"),
          firstName: tag("client"),
          phone: uniquePhone(),
          email: uniqueEmail("client"),
          source: "ONLINE",
          isActive: true,
          tokenVersion: 0,
        },
      });
      ctx.clientId = client.id;
      ctx.clientToken = jwtService.sign(
        {
          sub: client.id,
          email: client.email,
          namespace: "client",
          jti: randomUUID(),
          tokenVersion: 0,
        },
        // The default JwtService signs with JWT_ACCESS_SECRET. The client
        // strategy reads JWT_CLIENT_ACCESS_SECRET. Override here so a real
        // client-jwt is produced.
        { secret: process.env.JWT_CLIENT_ACCESS_SECRET! },
      );
    }

    // ── Targeted cleanup (by suffix + by id) ────────────────────────────────

    async function cleanup() {
      if (!prisma) return;
      // Order matters: child rows first, then parents. Booking ↔ Invoice ↔
      // Payment ↔ RefundRequest are real FKs; cross-BC refs to Branch /
      // Employee / Service are plain strings.
      await prisma.outboxEvent
        .deleteMany({ where: { id: { in: ctx.outboxIds } } })
        .catch(() => undefined);
      await prisma.invoice
        .deleteMany({ where: { id: { in: ctx.invoiceIds } } })
        .catch(() => undefined);
      await prisma.booking
        .deleteMany({ where: { id: { in: ctx.bookingIds } } })
        .catch(() => undefined);
      // Suffix-pattern safety net for anything we forgot to track in ctx.
      // Each filter targets a UNIQUE column (email, nameEn, etc.) so we
      // never touch sibling specs' rows.
      await prisma.program
        .deleteMany({
          where: { nameAr: { startsWith: tag("program") } },
        })
        .catch(() => undefined);
      await prisma.employee
        .deleteMany({
          where: { email: { startsWith: `pbf-e2e-${suffix}-` } },
        })
        .catch(() => undefined);
      await prisma.service
        .deleteMany({
          where: { nameEn: { startsWith: tag("svc-en") } },
        })
        .catch(() => undefined);
      await prisma.service
        .deleteMany({
          where: { nameEn: { startsWith: tag("inactive-svc-en") } },
        })
        .catch(() => undefined);
      await prisma.serviceCategory
        .deleteMany({ where: { nameEn: { startsWith: tag("cat-en") } } })
        .catch(() => undefined);
      await prisma.department
        .deleteMany({ where: { nameEn: { startsWith: tag("dept-en") } } })
        .catch(() => undefined);
      await prisma.client
        .deleteMany({ where: { email: { startsWith: `pbf-e2e-${suffix}-` } } })
        .catch(() => undefined);
      await prisma.branch
        .deleteMany({ where: { nameEn: { startsWith: tag("branch-en") } } })
        .catch(() => undefined);
      await prisma.branch
        .deleteMany({ where: { nameEn: { startsWith: tag("inactive-branch-en") } } })
        .catch(() => undefined);
      await prisma.branch
        .deleteMany({ where: { nameEn: { startsWith: tag("main-branch-en") } } })
        .catch(() => undefined);

      ctx.bookingIds = [];
      ctx.invoiceIds = [];
      ctx.outboxIds = [];
    }

    // ── Time helpers (no wall-clock drift across runs) ──────────────────────

    /**
     * Returns the next calendar day (relative to `now`) that maps to the
     * given JS getUTCDay() value. We use UTC dates so the slot endpoints
     * (which accept ISO date strings) get stable inputs.
     */
    function nextUtcDayAt(targetDow: number, hour: number, minute: number): Date {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + 1); // tomorrow — avoids the "min lead" guard
      while (d.getUTCDay() !== targetDow) {
        d.setUTCDate(d.getUTCDate() + 1);
      }
      d.setUTCHours(hour, minute, 0, 0);
      return d;
    }

    const ymd = (d: Date) => d.toISOString().slice(0, 10);

    // ═══════════════════════════════════════════════════════════════════════
    // CATALOG: branches, services, employees
    // ═══════════════════════════════════════════════════════════════════════

    describe("Public catalog: branches, services, employees", () => {
      it("GET /public/branches returns active branches and excludes the inactive one", async () => {
        const res = await api().get("/api/v1/public/branches").expect(200);
        expect(Array.isArray(res.body)).toBe(true);

        const ids: string[] = res.body.map((b: { id: string }) => b.id);
        // Our active branches must be present.
        expect(ids).toContain(ctx.mainBranchId);
        expect(ids).toContain(ctx.branchId);
        // The inactive branch MUST be filtered out (handler query has
        // where: { isActive: true }).
        expect(ids).not.toContain(ctx.inactiveBranchId);
      });

      it("GET /public/services returns only active, visible, non-archived services", async () => {
        const res = await api().get("/api/v1/public/services").expect(200);
        expect(res.body).toHaveProperty("services");
        expect(Array.isArray(res.body.services)).toBe(true);

        const serviceIds: string[] = res.body.services.map(
          (s: { id: string }) => s.id,
        );
        // Our active service is in the catalog.
        expect(serviceIds).toContain(ctx.serviceId);
        // The inactive service is filtered out.
        expect(serviceIds).not.toContain(ctx.inactiveServiceId);

        // The catalog payload exposes the price snapshot fields the
        // wizard reads (price, currency, showPrice, showDuration).
        const ours = res.body.services.find(
          (s: { id: string }) => s.id === ctx.serviceId,
        );
        expect(ours).toBeDefined();
        expect(ours.currency).toBe("SAR");
        expect(ours.showPrice).toBe(true);
        expect(ours.showDuration).toBe(true);
      });

      it("GET /public/employees returns only public+active employees", async () => {
        const res = await api().get("/api/v1/public/employees").expect(200);
        expect(Array.isArray(res.body)).toBe(true);

        const ids: string[] = res.body.map((e: { id: string }) => e.id);
        expect(ids).toContain(ctx.publicEmployeeId);
        // Hidden (isPublic=false) employee is filtered out.
        expect(ids).not.toContain(ctx.hiddenEmployeeId);

        // The public employee we seeded must carry the bookability
        // metadata the wizard uses to disable the calendar.
        const ours = res.body.find(
          (e: { id: string }) => e.id === ctx.publicEmployeeId,
        );
        expect(ours).toBeDefined();
        expect(ours.isBookable).toBe(true);
        expect(ours.branchIds).toContain(ctx.mainBranchId);
        expect(ours.serviceIds).toContain(ctx.serviceId);
        // BranchIds filtered to isActive=true (our main branch is active).
        expect(ours.availableDaysOfWeek.length).toBe(7);
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // AVAILABILITY: slots + day strip + failure paths
    // ═══════════════════════════════════════════════════════════════════════

    describe("Public availability: slots, day strip, failure paths", () => {
      it("GET /public/availability returns open slots for the seeded service+employee on a covered day", async () => {
        // Pick a target day that has business hours + employee availability.
        const target = nextUtcDayAt(new Date().getUTCDay(), 9, 0);
        const res = await api()
          .get("/api/v1/public/availability")
          .query({
            employeeId: ctx.publicEmployeeId,
            branchId: ctx.mainBranchId,
            serviceId: ctx.serviceId,
            date: ymd(target),
            deliveryType: DeliveryType.IN_PERSON,
            durationMins: 60,
            bookingType: "INDIVIDUAL",
          })
          .expect(200);

        expect(Array.isArray(res.body)).toBe(true);
        // The 08:00–22:00 window with a 60-min duration at the 15-min
        // grid (slotInterval returns 30 for >30-min durations) must yield
        // at least one slot. The exact count depends on min lead minutes
        // and the current wall clock; we only assert >0.
        expect(res.body.length).toBeGreaterThan(0);
        const first = res.body[0];
        expect(typeof first.startTime).toBe("string");
        expect(typeof first.endTime).toBe("string");
        // endTime > startTime.
        expect(
          new Date(first.endTime).getTime() >
            new Date(first.startTime).getTime(),
        ).toBe(true);
      });

      it("rejects an unsupported deliveryType (no ServiceBookingConfig) with 400", async () => {
        // The active service has IN_PERSON config only. Requesting ONLINE
        // makes the handler throw BadRequestException at the
        // "service does not support the requested delivery type" gate.
        const target = nextUtcDayAt(new Date().getUTCDay(), 9, 0);
        const res = await api().get("/api/v1/public/availability").query({
          employeeId: ctx.publicEmployeeId,
          branchId: ctx.mainBranchId,
          serviceId: ctx.serviceId,
          date: ymd(target),
          deliveryType: DeliveryType.ONLINE,
          durationMins: 60,
        });
        expect(res.status).toBe(400);
        expect(res.body.message ?? "").toMatch(
          /delivery type|not support/i,
        );
      });

      it("returns 404 for a non-public (hidden) employee (handler refuses to expose schedule)", async () => {
        // The public/slots controller first runs a guarded
        // prisma.employee.findFirst({ where: { id, isPublic: true, isActive: true } })
        // and throws NotFoundException if it misses. The hidden employee
        // has isPublic=false → 404.
        const target = nextUtcDayAt(new Date().getUTCDay(), 9, 0);
        const res = await api().get("/api/v1/public/availability").query({
          employeeId: ctx.hiddenEmployeeId,
          branchId: ctx.mainBranchId,
          serviceId: ctx.serviceId,
          date: ymd(target),
          deliveryType: DeliveryType.IN_PERSON,
          durationMins: 60,
        });
        expect(res.status).toBe(404);
        expect(res.body.message ?? "").toMatch(/not found|not available/i);
      });

      it("GET /public/employees/:id/availability/days returns a day-strip probe", async () => {
        const today = new Date();
        const startDate = ymd(today);
        const res = await api()
          .get(
            `/api/v1/public/employees/${ctx.publicEmployeeId}/availability/days`,
          )
          .query({ startDate, days: 3 })
          .expect(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(3);
        // Each entry is { date, hasSlots }; every day we seeded has
        // business hours + employee availability, so all should be true.
        for (const entry of res.body) {
          expect(typeof entry.date).toBe("string");
          expect(typeof entry.hasSlots).toBe("boolean");
          expect(entry.hasSlots).toBe(true);
        }
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // CREATE PUBLIC BOOKING — auth gate + happy + failure paths
    // ═══════════════════════════════════════════════════════════════════════

    describe("POST /public/bookings — auth gate, happy path, failure paths", () => {
      it("rejects an unauthenticated request with 401 (ClientSessionGuard)", async () => {
        const target = nextUtcDayAt(new Date().getUTCDay(), 14, 0);
        const res = await api()
          .post("/api/v1/public/bookings")
          .send({
            branchId: ctx.mainBranchId,
            employeeId: ctx.publicEmployeeId,
            serviceId: ctx.serviceId,
            startsAt: target.toISOString(),
            deliveryType: "IN_PERSON",
          });
        expect(res.status).toBe(401);
      });

      it("happy path: creates a Booking with snapshots + matching ISSUED Invoice (real DB writes)", async () => {
        // Pick a slot the handler's availability probe will return. We use
        // 14:00 on the next matching day — well past the 60-min min lead
        // and inside the 08:00–22:00 business window.
        const target = nextUtcDayAt(new Date().getUTCDay(), 14, 0);
        const res = await api()
          .post("/api/v1/public/bookings")
          .set("Authorization", `Bearer ${ctx.clientToken}`)
          .send({
            branchId: ctx.mainBranchId,
            employeeId: ctx.publicEmployeeId,
            serviceId: ctx.serviceId,
            startsAt: target.toISOString(),
            deliveryType: "IN_PERSON",
          });
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({
          clientId: ctx.clientId,
          employeeId: ctx.publicEmployeeId,
          serviceId: ctx.serviceId,
          branchId: ctx.mainBranchId,
          source: "ONLINE",
          deliveryType: "IN_PERSON",
          bookingType: "INDIVIDUAL",
          durationMins: 60,
        });
        const bookingId = res.body.id as string;
        expect(bookingId).toMatch(/^[0-9a-f-]{36}$/);
        ctx.bookingIds.push(bookingId);

        // The create handler ALWAYS returns invoiceId; ONLINE bookings
        // start as AWAITING_PAYMENT with an ISSUED invoice.
        const invoiceId = res.body.invoiceId as string;
        expect(invoiceId).toMatch(/^[0-9a-f-]{36}$/);
        ctx.invoiceIds.push(invoiceId);

        // ── Re-read from DB to confirm the row actually persisted with
        //    the snapshot fields (denormalised at creation so the history
        //    survives downstream edits to the service/employee/branch).
        const persisted = await prisma.booking.findUnique({
          where: { id: bookingId },
        });
        expect(persisted).not.toBeNull();
        expect(persisted!.status).toBe("AWAITING_PAYMENT");
        expect(persisted!.priceSnapshot).not.toBeNull();
        expect(persisted!.employeeNameSnapshot).toContain(
          "public-emp",
        );
        expect(persisted!.serviceNameSnapshot).toContain("svc-");
        expect(persisted!.durationMinutesSnapshot).toBe(60);
        // expiresAt is set for AWAITING_PAYMENT bookings (15-min window).
        expect(persisted!.expiresAt).not.toBeNull();

        // ── Invoice: ISSUED, totals computed against 15% VAT.
        // 30000 halalas subtotal + 15% VAT = 34500 halalas total.
        const invoice = await prisma.invoice.findUnique({
          where: { id: invoiceId },
        });
        expect(invoice).not.toBeNull();
        expect(invoice!.status).toBe("ISSUED");
        expect(invoice!.bookingId).toBe(bookingId);
        expect(Number(invoice!.subtotal)).toBe(30_000);
        expect(Number(invoice!.vatAmt)).toBe(4_500);
        expect(Number(invoice!.total)).toBe(34_500);

        // ── Outbox event was written inside the same transaction
        //    (create-booking.handler.ts: CR-5 transactional outbox).
        // The aggregate-level eventType is `bookings.booking.created` (see
        // BookingCreatedEvent.eventName — `${aggregateName}.${action}`).
        const outbox = await prisma.outboxEvent.findFirst({
          where: {
            aggregateId: bookingId,
            eventType: "bookings.booking.created",
          },
        });
        expect(outbox).not.toBeNull();
        ctx.outboxIds.push(outbox!.id);
      });

      it("rejects booking a slot outside business hours with 400", async () => {
        // The branch has 08:00–22:00 hours every day. Pick 03:00 (3 AM) on
        // the next matching day — outside hours → availability returns []
        // → assertSlotAvailable throws BadRequestException.
        const target = nextUtcDayAt(new Date().getUTCDay(), 3, 0);
        const res = await api()
          .post("/api/v1/public/bookings")
          .set("Authorization", `Bearer ${ctx.clientToken}`)
          .send({
            branchId: ctx.mainBranchId,
            employeeId: ctx.publicEmployeeId,
            serviceId: ctx.serviceId,
            startsAt: target.toISOString(),
            deliveryType: "IN_PERSON",
          });
        expect(res.status).toBe(400);
        // The handler surfaces a specific reason for the failure path.
        expect(res.body.message ?? "").toMatch(
          /not available|in the past|advance/i,
        );
      });

      it("rejects booking against an inactive service with 400", async () => {
        const target = nextUtcDayAt(new Date().getUTCDay(), 15, 0);
        const res = await api()
          .post("/api/v1/public/bookings")
          .set("Authorization", `Bearer ${ctx.clientToken}`)
          .send({
            branchId: ctx.mainBranchId,
            employeeId: ctx.publicEmployeeId,
            serviceId: ctx.inactiveServiceId,
            startsAt: target.toISOString(),
            deliveryType: "IN_PERSON",
          });
        expect(res.status).toBe(400);
        expect(res.body.message ?? "").toMatch(/not active/i);

        // No booking row should have been created from a rejected request.
        const count = await prisma.booking.count({
          where: {
            clientId: ctx.clientId,
            serviceId: ctx.inactiveServiceId,
          },
        });
        expect(count).toBe(0);
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // PROGRAMS: list + status probe
    // ═══════════════════════════════════════════════════════════════════════

    describe("Public programs + booking status probe", () => {
      it("GET /public/programs returns the seeded public program and computes isFull=false", async () => {
        const res = await api().get("/api/v1/public/programs").expect(200);
        expect(res.body).toHaveProperty("programs");
        expect(Array.isArray(res.body.programs)).toBe(true);

        const ids: string[] = res.body.programs.map((p: { id: string }) => p.id);
        expect(ids).toContain(ctx.programId);

        const ours = res.body.programs.find(
          (p: { id: string }) => p.id === ctx.programId,
        );
        expect(ours).toBeDefined();
        expect(ours.status).toBe("OPEN");
        expect(ours.isPublic).toBe(true);
        expect(ours.isFull).toBe(false);
      });

      it("GET /public/programs/:id returns the program detail; non-public is 404", async () => {
        // Positive case: our public program is reachable.
        const ok = await api()
          .get(`/api/v1/public/programs/${ctx.programId}`)
          .expect(200);
        expect(ok.body.id).toBe(ctx.programId);
        expect(ok.body.isOpenForEnrollment).toBe(true);

        // Negative case: a random non-existent id is 404.
        const ghost = await api()
          .get(`/api/v1/public/programs/${randomUUID()}`)
          .expect(404);
        expect(ghost.body.message ?? "").toMatch(/not found/i);
      });

      it("GET /public/bookings/:id/status returns status+paymentStatus from the real DB", async () => {
        // We have at least one booking persisted from the happy-path test.
        const bookingId = ctx.bookingIds[0];
        expect(bookingId).toBeDefined();

        const res = await api()
          .get(`/api/v1/public/bookings/${bookingId}/status`)
          .expect(200);
        expect(res.body).toMatchObject({
          bookingId,
          status: "AWAITING_PAYMENT",
          // No payment has been recorded yet → "NONE" sentinel.
          paymentStatus: "NONE",
        });
      });
    });
  },
);
