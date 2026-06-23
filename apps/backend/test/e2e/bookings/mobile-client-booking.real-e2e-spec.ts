/**
 * Mobile Client Booking — Real-DB E2E Spec
 * =========================================
 *
 * Exercises the MOBILE CLIENT booking surface
 * (POST/GET /mobile/client/bookings, :id, :id/cancel, :id/reschedule,
 *  :id/rate) against a real Postgres database (no mocked Prisma). External
 *  HTTP is intercepted globally by setup-e2e.ts.
 *
 * The spec focuses on behaviours the existing Prisma-mocked
 * bookings-controller spec cannot prove:
 *
 *   - The ClientSessionGuard (client-jwt strategy) actually rejects
 *     unauthenticated callers with 401 against the real auth pipeline.
 *   - Authenticated client creates a booking → Booking row persisted with
 *     snapshot fields (priceSnapshot, employeeNameSnapshot, …) AND an
 *     Invoice row, exactly the way the website funnel writes.
 *   - The list endpoint scopes strictly to the authenticated client — two
 *     different client sessions MUST NOT see each other's bookings
 *     (P1 ownership-isolation property).
 *   - GET /:id returns the row only for its owner; another client's token
 *     on the same id is denied (403) — the handler's documented contract.
 *   - Cancel + Reschedule + Rate transitions write the right status
 *     transitions into BookingStatusLog; failure paths (state-machine
 *     conflict, invalid slot, non-completed rating) reject with the
 *     right code and DO NOT mutate the row.
 *
 * Data isolation: every seeded row carries a per-run suffix so this spec
 * can run alongside other real-DB specs (finance, public-funnel, …) on
 * the shared `sawaa_test` database. Cleanup is targeted (by suffix + by
 * id) and never touches shared rows.
 *
 * Security note (P1): every assertion that tests "another client cannot
 * access my booking" intentionally checks the SECURE behaviour the
 * handler documents. If any of these go red it indicates a real
 * authorisation gap and is reported in the final summary — not silently
 * relaxed.
 *
 * Run:
 *   REAL_E2E_DATABASE_URL="postgresql://sawaa:sawaa_dev_password@localhost:3453/sawaa_test?schema=public&connection_limit=10&pool_timeout=20" \
 *     npx jest --config test/jest-e2e.json --runInBand \
 *     test/e2e/bookings/mobile-client-booking.real-e2e-spec.ts
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
  "Mobile Client Bookings — real-DB e2e (create, list, get, cancel, reschedule, rate, ownership)",
  () => {
    jest.setTimeout(60_000);

    let app: INestApplication;
    let prisma: PrismaService;
    let jwtService: JwtService;

    // ── Per-run isolation ────────────────────────────────────────────────────
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tag = (label: string) => `mcb-e2e-${suffix}-${label}`;
    const uniqueEmail = (label: string) =>
      `mcb-e2e-${suffix}-${label}@sawaa.test`;
    const uniquePhone = () =>
      `+9665${String(Math.floor(10_000_000 + Math.random() * 89_999_999)).padStart(8, "0")}`;

    // Tracked IDs for targeted cleanup + sanity checks
    const ctx = {
      branchId: "",
      deptId: "",
      catId: "",
      employeeId: "",
      serviceId: "",
      durationOptionId: "",
      // TWO clients prove ownership isolation end-to-end.
      clientAId: "",
      clientAEmail: "",
      clientBId: "",
      clientBEmail: "",
      clientAToken: "",
      clientBToken: "",
      // IDs of rows the spec creates (cleaned up by id in afterAll).
      bookingIds: [] as string[],
      ratingIds: [] as string[],
      outboxIds: [] as string[],
    };

    const api = () => request(app.getHttpServer());
    const withClient = (token: string) => (req: request.Test) =>
      req.set("Authorization", `Bearer ${token}`);

    // ── Setup / teardown ─────────────────────────────────────────────────────

    beforeAll(async () => {
      // The real-DB helper sets process.env.DATABASE_URL from
      // REAL_E2E_DATABASE_URL and validates the database name. It also
      // wires ValidationPipe + global prefix, so we can use the returned
      // app directly.
      const { app: a, prisma: p } = await createRealE2eApp();
      app = a;
      prisma = p;
      jwtService = app.get(JwtService);
      await prisma.$queryRaw`SELECT 1`;

      await cleanup();
      await seedOrganizationSettings();
      await seedBaseEntities();
      await seedTwoClients();
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
      // 15% VAT + payAtClinic allowed. Create handler reads vatRate when
      // computing the Invoice total; keeping it consistent avoids a drift
      // test failure.
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

      // Default booking settings — maxReschedulesPerBooking: 3,
      // clientRescheduleMinHoursBefore: 24 (matches DEFAULT_BOOKING_SETTINGS).
      // We deliberately do NOT customise these for the failure-path test
      // (see "max reschedules reached" → seeds 3 status-log rows directly).
      const globalSettings = await prisma.bookingSettings.findFirst({
        where: { branchId: null },
      });
      if (globalSettings) {
        await prisma.bookingSettings.update({
          where: { id: globalSettings.id },
          data: {
            maxReschedulesPerBooking: 3,
            clientRescheduleMinHoursBefore: 24,
            minBookingLeadMinutes: 60,
            maxAdvanceBookingDays: 90,
          },
        });
      } else {
        await prisma.bookingSettings.create({
          data: {
            maxReschedulesPerBooking: 3,
            clientRescheduleMinHoursBefore: 24,
            minBookingLeadMinutes: 60,
            maxAdvanceBookingDays: 90,
          },
        });
      }
    }

    async function seedBaseEntities() {
      // ── Branch (must be isMain=true so resolver falls back to it) ──
      const branch = await prisma.branch.create({
        data: {
          nameAr: tag("branch-ar"),
          nameEn: tag("branch-en"),
          isActive: true,
          isMain: true,
        },
      });
      ctx.branchId = branch.id;

      // ── Department + category (Service.categoryId is required) ──
      const dept = await prisma.department.create({
        data: {
          nameAr: tag("dept-ar"),
          nameEn: tag("dept-en"),
          isActive: true,
        },
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

      // ── Employee + Service + EmployeeService link ──
      const employee = await prisma.employee.create({
        data: {
          name: tag("emp"),
          nameAr: tag("emp-ar"),
          email: uniqueEmail("emp"),
          phone: uniquePhone(),
          isActive: true,
        },
      });
      ctx.employeeId = employee.id;

      const service = await prisma.service.create({
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
      ctx.serviceId = service.id;

      // ServiceBookingConfig: required for CheckAvailabilityHandler's
      // "serviceId has config" gate. IN_PERSON only — the create endpoint
      // accepts IN_PERSON delivery by default through normalizeBookingTypes.
      await prisma.serviceBookingConfig.create({
        data: {
          serviceId: service.id,
          deliveryType: DeliveryType.IN_PERSON,
          price: new Prisma.Decimal(30000),
          durationMins: 60,
          isActive: true,
        },
      });

      const durationOption = await prisma.serviceDurationOption.create({
        data: {
          serviceId: service.id,
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
      ctx.durationOptionId = durationOption.id;

      await prisma.employeeService.create({
        data: {
          employeeId: employee.id,
          serviceId: service.id,
          isActive: true,
        },
      });

      // EmployeeBranch link is required by CheckAvailabilityHandler — without
      // it the availability query returns no slots and the create handler
      // throws "Selected booking time is not available".
      await prisma.employeeBranch.create({
        data: {
          employeeId: employee.id,
          branchId: branch.id,
        },
      });

      // ── Business hours + employee availability on every day of the week ──
      // Covers any date the test picks. 08:00–22:00 windows with 30-min
      // slot grid (60-min duration) → plenty of valid 14:00 / 15:00 / …
      // slots in the future.
      for (let dow = 0; dow < 7; dow++) {
        await prisma.businessHour.create({
          data: {
            branchId: branch.id,
            dayOfWeek: dow,
            startTime: "08:00",
            endTime: "22:00",
            isOpen: true,
          },
        });
        await prisma.employeeAvailability.create({
          data: {
            employeeId: employee.id,
            dayOfWeek: dow,
            startTime: "08:00",
            endTime: "22:00",
            isActive: true,
          },
        });
      }
    }

    async function seedTwoClients() {
      // Two clients (A + B) so ownership-isolation tests are real: every
      // "another client tries to access" path uses a second JWT that
      // resolves to a real Client row, not a synthetic stub.
      const clientA = await prisma.client.create({
        data: {
          name: tag("clientA"),
          firstName: tag("clientA"),
          phone: uniquePhone(),
          email: uniqueEmail("clientA"),
          source: "ONLINE",
          isActive: true,
          tokenVersion: 0,
        },
      });
      ctx.clientAId = clientA.id;
      ctx.clientAEmail = clientA.email!;
      ctx.clientAToken = signClientJwt(clientA.id, clientA.email);

      const clientB = await prisma.client.create({
        data: {
          name: tag("clientB"),
          firstName: tag("clientB"),
          phone: uniquePhone(),
          email: uniqueEmail("clientB"),
          source: "ONLINE",
          isActive: true,
          tokenVersion: 0,
        },
      });
      ctx.clientBId = clientB.id;
      ctx.clientBEmail = clientB.email!;
      ctx.clientBToken = signClientJwt(clientB.id, clientB.email);
    }

    /**
     * Mint a CLIENT-namespaced JWT for the given client id. Signs with
     * JWT_CLIENT_ACCESS_SECRET so the real ClientJwtStrategy can verify
     * it (the strategy reads from the same secret via ConfigService).
     */
    function signClientJwt(clientId: string, email: string | null): string {
      return jwtService.sign(
        {
          sub: clientId,
          email: email ?? "",
          namespace: "client",
          jti: randomUUID(),
          tokenVersion: 0,
        },
        { secret: process.env.JWT_CLIENT_ACCESS_SECRET! },
      );
    }

    // ── Targeted cleanup (by suffix + by id) ────────────────────────────────

    async function cleanup() {
      if (!prisma) return;
      // Order matters: child rows first, then parents. BookingStatusLog
      // and Rating both reference Booking; OutboxEvent references by
      // aggregateId (plain string). Cross-BC refs to Client/Employee/
      // Branch/Service are plain strings — no Prisma FK cascade.
      await prisma.outboxEvent
        .deleteMany({ where: { id: { in: ctx.outboxIds } } })
        .catch(() => undefined);
      await prisma.rating
        .deleteMany({ where: { id: { in: ctx.ratingIds } } })
        .catch(() => undefined);
      await prisma.bookingStatusLog
        .deleteMany({ where: { bookingId: { in: ctx.bookingIds } } })
        .catch(() => undefined);
      await prisma.invoice
        .deleteMany({ where: { bookingId: { in: ctx.bookingIds } } })
        .catch(() => undefined);
      await prisma.payment
        .deleteMany({
          where: { invoice: { bookingId: { in: ctx.bookingIds } } },
        })
        .catch(() => undefined);
      await prisma.booking
        .deleteMany({ where: { id: { in: ctx.bookingIds } } })
        .catch(() => undefined);
      // Suffix-pattern safety net for anything we forgot to track.
      await prisma.client
        .deleteMany({ where: { email: { startsWith: `mcb-e2e-${suffix}-` } } })
        .catch(() => undefined);
      await prisma.employee
        .deleteMany({ where: { email: { startsWith: `mcb-e2e-${suffix}-` } } })
        .catch(() => undefined);
      await prisma.service
        .deleteMany({ where: { nameEn: { startsWith: tag("svc-en") } } })
        .catch(() => undefined);
      await prisma.serviceCategory
        .deleteMany({ where: { nameEn: { startsWith: tag("cat-en") } } })
        .catch(() => undefined);
      await prisma.department
        .deleteMany({ where: { nameEn: { startsWith: tag("dept-en") } } })
        .catch(() => undefined);
      await prisma.branch
        .deleteMany({ where: { nameEn: { startsWith: tag("branch-en") } } })
        .catch(() => undefined);

      ctx.bookingIds = [];
      ctx.ratingIds = [];
      ctx.outboxIds = [];
    }

    // ── Time helpers (no wall-clock drift across runs) ──────────────────────

    /**
     * Returns a UTC Date that is the next occurrence of `targetDow` (JS
     * getUTCDay()) at the given HH:mm, with a +N-day lead to clear the
     * 60-minute min-lead guard. We always add at least +1 day so the
     * 24-hour client-reschedule window is satisfied too.
     */
    function nextUtcDayAt(
      targetDow: number,
      hour: number,
      minute: number,
      daysAhead: number = 2,
    ): Date {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + daysAhead);
      while (d.getUTCDay() !== targetDow) {
        d.setUTCDate(d.getUTCDate() + 1);
      }
      d.setUTCHours(hour, minute, 0, 0);
      return d;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // AUTH GATE
    // ═══════════════════════════════════════════════════════════════════════

    describe("Auth gate: ClientSessionGuard rejects unauthenticated callers", () => {
      it("rejects an unauthenticated POST /bookings with 401", async () => {
        const target = nextUtcDayAt(new Date().getUTCDay(), 14, 0);
        const res = await api()
          .post("/api/v1/mobile/client/bookings")
          .send({
            branchId: ctx.branchId,
            employeeId: ctx.employeeId,
            serviceId: ctx.serviceId,
            scheduledAt: target.toISOString(),
          });
        expect(res.status).toBe(401);
      });

      it("rejects an unauthenticated GET /bookings with 401", async () => {
        const res = await api().get("/api/v1/mobile/client/bookings");
        expect(res.status).toBe(401);
      });

      it("rejects an unauthenticated GET /bookings/:id with 401", async () => {
        const res = await api().get(
          `/api/v1/mobile/client/bookings/${randomUUID()}`,
        );
        expect(res.status).toBe(401);
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // CREATE
    // ═══════════════════════════════════════════════════════════════════════

    describe("POST /mobile/client/bookings — authenticated create", () => {
      it("creates a Booking row owned by the authenticated client + Invoice + snapshot fields + outbox event", async () => {
        // 14:00 on the next matching day — well past 60-min min-lead, inside
        // the 08:00–22:00 business window, on a 30-min slot grid.
        const target = nextUtcDayAt(new Date().getUTCDay(), 14, 0);

        const res = await withClient(ctx.clientAToken)(
          api().post("/api/v1/mobile/client/bookings"),
        ).send({
          branchId: ctx.branchId,
          employeeId: ctx.employeeId,
          serviceId: ctx.serviceId,
          scheduledAt: target.toISOString(),
        });

        expect(res.status).toBe(201);
        const bookingId = res.body.id as string;
        expect(bookingId).toMatch(/^[0-9a-f-]{36}$/);
        ctx.bookingIds.push(bookingId);

        // ── Response contract: clientId = the authenticated client,
        //    invoiceId present, AWAITING_PAYMENT for unpaid ONLINE bookings.
        expect(res.body.clientId).toBe(ctx.clientAId);
        expect(res.body.employeeId).toBe(ctx.employeeId);
        expect(res.body.serviceId).toBe(ctx.serviceId);
        expect(res.body.branchId).toBe(ctx.branchId);
        expect(res.body.source).toBe("ONLINE");
        expect(res.body.status).toBe("AWAITING_PAYMENT");
        expect(res.body.invoiceId).toMatch(/^[0-9a-f-]{36}$/);

        // ── Re-read the Booking row from the DB to prove the writes
        //    landed (not just the in-memory response).
        const persisted = await prisma.booking.findUnique({
          where: { id: bookingId },
        });
        expect(persisted).not.toBeNull();
        expect(persisted!.clientId).toBe(ctx.clientAId);
        expect(persisted!.status).toBe("AWAITING_PAYMENT");
        // Snapshot fields: denormalised at creation for stable history.
        expect(persisted!.priceSnapshot).not.toBeNull();
        expect(Number(persisted!.priceSnapshot)).toBe(30_000);
        expect(persisted!.durationMinutesSnapshot).toBe(60);
        expect(persisted!.employeeNameSnapshot).toMatch(/emp/);
        expect(persisted!.serviceNameSnapshot).toMatch(/svc-/);
        expect(persisted!.branchNameSnapshot).toMatch(/branch-/);
        // AWAITING_PAYMENT bookings carry a 15-min expiry window.
        expect(persisted!.expiresAt).not.toBeNull();

        // ── Invoice: ISSUED with correct halala math (30000 + 15% VAT =
        //    34500 halalas). Re-read from DB, not just response.
        const invoice = await prisma.invoice.findFirst({
          where: { bookingId },
        });
        expect(invoice).not.toBeNull();
        expect(invoice!.status).toBe("ISSUED");
        expect(Number(invoice!.subtotal)).toBe(30_000);
        expect(Number(invoice!.vatAmt)).toBe(4_500);
        expect(Number(invoice!.total)).toBe(34_500);

        // ── Outbox event written transactionally (create-booking CR-5).
        const outbox = await prisma.outboxEvent.findFirst({
          where: { aggregateId: bookingId },
        });
        expect(outbox).not.toBeNull();
        expect(outbox!.eventType).toBe("bookings.booking.created");
        ctx.outboxIds.push(outbox!.id);
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // LIST — ownership isolation
    // ═══════════════════════════════════════════════════════════════════════

    describe("GET /mobile/client/bookings — strict per-client ownership", () => {
      let clientAFirstBookingId: string;
      let clientBFirstBookingId: string;

      beforeAll(async () => {
        // Seed a second booking owned by clientA AND a booking owned by
        // clientB so the list endpoint can be queried with two distinct
        // authenticated principals and the response MUST be partitioned.
        const targetA = nextUtcDayAt(new Date().getUTCDay(), 15, 0, 3);
        const createA = await withClient(ctx.clientAToken)(
          api().post("/api/v1/mobile/client/bookings"),
        ).send({
          branchId: ctx.branchId,
          employeeId: ctx.employeeId,
          serviceId: ctx.serviceId,
          scheduledAt: targetA.toISOString(),
        });
        expect(createA.status).toBe(201);
        clientAFirstBookingId = createA.body.id as string;
        ctx.bookingIds.push(clientAFirstBookingId);

        const targetB = nextUtcDayAt(new Date().getUTCDay(), 16, 0, 4);
        const createB = await withClient(ctx.clientBToken)(
          api().post("/api/v1/mobile/client/bookings"),
        ).send({
          branchId: ctx.branchId,
          employeeId: ctx.employeeId,
          serviceId: ctx.serviceId,
          scheduledAt: targetB.toISOString(),
        });
        expect(createB.status).toBe(201);
        clientBFirstBookingId = createB.body.id as string;
        ctx.bookingIds.push(clientBFirstBookingId);
      });

      it("clientA's list returns only clientA bookings (no leakage from clientB)", async () => {
        const res = await withClient(ctx.clientAToken)(
          api().get("/api/v1/mobile/client/bookings"),
        ).query({ limit: 50 });

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.items)).toBe(true);
        expect(res.body.items.length).toBeGreaterThan(0);

        // Every row must be owned by clientA.
        for (const row of res.body.items) {
          expect(row.clientId).toBe(ctx.clientAId);
        }
        // clientA's own booking is present.
        const ids = res.body.items.map((r: { id: string }) => r.id);
        expect(ids).toContain(clientAFirstBookingId);
        // clientB's booking MUST NOT leak into clientA's list.
        expect(ids).not.toContain(clientBFirstBookingId);
      });

      it("clientB's list returns only clientB bookings (no leakage from clientA)", async () => {
        const res = await withClient(ctx.clientBToken)(
          api().get("/api/v1/mobile/client/bookings"),
        ).query({ limit: 50 });

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.items)).toBe(true);
        for (const row of res.body.items) {
          expect(row.clientId).toBe(ctx.clientBId);
        }
        const ids = res.body.items.map((r: { id: string }) => r.id);
        expect(ids).toContain(clientBFirstBookingId);
        expect(ids).not.toContain(clientAFirstBookingId);
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // GET BY ID — ownership check
    // ═══════════════════════════════════════════════════════════════════════

    describe("GET /mobile/client/bookings/:id — owner-only read", () => {
      it("returns the row for the owning client (200)", async () => {
        // Use clientA's first booking (created in the CREATE test).
        const list = await withClient(ctx.clientAToken)(
          api().get("/api/v1/mobile/client/bookings"),
        ).query({ limit: 1 });
        const ownBookingId = list.body.items[0].id as string;

        const res = await withClient(ctx.clientAToken)(
          api().get(`/api/v1/mobile/client/bookings/${ownBookingId}`),
        );
        expect(res.status).toBe(200);
        expect(res.body.id).toBe(ownBookingId);
        expect(res.body.clientId).toBe(ctx.clientAId);
      });

      it("denies a different authenticated client from reading the row (403)", async () => {
        // SECURITY (P1): clientB must NOT be able to read clientA's
        // booking by id. GetBookingHandler throws ForbiddenException when
        // query.clientId !== booking.clientId. The test asserts the
        // SECURE behaviour the handler documents.
        const list = await withClient(ctx.clientAToken)(
          api().get("/api/v1/mobile/client/bookings"),
        ).query({ limit: 1 });
        const clientABookingId = list.body.items[0].id as string;

        const res = await withClient(ctx.clientBToken)(
          api().get(`/api/v1/mobile/client/bookings/${clientABookingId}`),
        );
        expect(res.status).toBe(403);
        expect(res.body.message ?? "").toMatch(/not your booking/i);
      });

      it("returns 404 for a UUID that does not match any booking", async () => {
        const res = await withClient(ctx.clientAToken)(
          api().get(`/api/v1/mobile/client/bookings/${randomUUID()}`),
        );
        expect(res.status).toBe(404);
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // CANCEL — happy path + ownership + state-machine failure
    // ═══════════════════════════════════════════════════════════════════════

    describe("PATCH /mobile/client/bookings/:id/cancel — happy path + ownership + state machine", () => {
      it("cancels own booking: 200 + DB status flips to CANCELLED + status log row written", async () => {
        // Create a fresh booking as clientA, then bump status to CONFIRMED
        // because the mobile-client path always writes AWAITING_PAYMENT but
        // DIRECT_CANCEL only accepts PENDING | CONFIRMED | CANCEL_REQUESTED
        // | DEPOSIT_PAID (see booking-state-machine.ts). Updating the row
        // here mirrors the real-world sequence: client pays → status flips
        // to CONFIRMED → client cancels.
        const target = nextUtcDayAt(new Date().getUTCDay(), 10, 0);
        const create = await withClient(ctx.clientAToken)(
          api().post("/api/v1/mobile/client/bookings"),
        ).send({
          branchId: ctx.branchId,
          employeeId: ctx.employeeId,
          serviceId: ctx.serviceId,
          scheduledAt: target.toISOString(),
        });
        expect(create.status).toBe(201);
        const bookingId = create.body.id as string;
        ctx.bookingIds.push(bookingId);

        await prisma.booking.update({
          where: { id: bookingId },
          data: { status: "CONFIRMED" },
        });

        const res = await withClient(ctx.clientAToken)(
          api().patch(`/api/v1/mobile/client/bookings/${bookingId}/cancel`),
        ).send({ reason: "CLIENT_REQUESTED", cancelNotes: "Plans changed" });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe("CANCELLED");

        // Re-read from DB to prove the write landed.
        const persisted = await prisma.booking.findUnique({
          where: { id: bookingId },
        });
        expect(persisted!.status).toBe("CANCELLED");
        expect(persisted!.cancelReason).toBe("CLIENT_REQUESTED");
        expect(persisted!.cancelNotes).toBe("Plans changed");
        expect(persisted!.cancelledAt).toBeInstanceOf(Date);

        // BookingStatusLog row was appended (state-machine transition log).
        const log = await prisma.bookingStatusLog.findFirst({
          where: { bookingId, toStatus: "CANCELLED" },
        });
        expect(log).not.toBeNull();
        expect(log!.fromStatus).toBe("CONFIRMED");
        expect(log!.reason).toBe("CLIENT_REQUESTED");
      });

      it("denies a different authenticated client from cancelling the row (403)", async () => {
        // SECURITY (P1): clientB must NOT cancel clientA's booking. The
        // handler throws ForbiddenException when source='client' AND
        // booking.clientId !== cmd.clientId.
        const target = nextUtcDayAt(new Date().getUTCDay(), 11, 0);
        const create = await withClient(ctx.clientAToken)(
          api().post("/api/v1/mobile/client/bookings"),
        ).send({
          branchId: ctx.branchId,
          employeeId: ctx.employeeId,
          serviceId: ctx.serviceId,
          scheduledAt: target.toISOString(),
        });
        expect(create.status).toBe(201);
        const bookingId = create.body.id as string;
        ctx.bookingIds.push(bookingId);
        await prisma.booking.update({
          where: { id: bookingId },
          data: { status: "CONFIRMED" },
        });

        const res = await withClient(ctx.clientBToken)(
          api().patch(`/api/v1/mobile/client/bookings/${bookingId}/cancel`),
        ).send({ reason: "CLIENT_REQUESTED" });

        expect(res.status).toBe(403);
        expect(res.body.message ?? "").toMatch(/not your booking/i);

        // The booking must NOT be cancelled by the rejected request.
        const after = await prisma.booking.findUnique({
          where: { id: bookingId },
        });
        expect(after!.status).toBe("CONFIRMED");
      });

      it("rejects cancelling an already-cancelled booking with 400 (state machine)", async () => {
        // Re-use the booking from the first cancel test (now CANCELLED)
        // and try to cancel it again. The state machine asserts
        // DIRECT_CANCEL's from-list excludes CANCELLED → BadRequestException.
        const list = await withClient(ctx.clientAToken)(
          api().get("/api/v1/mobile/client/bookings"),
        ).query({ status: "CANCELLED", limit: 1 });
        const cancelledId = list.body.items[0]?.id as string | undefined;
        expect(cancelledId).toBeDefined();

        const res = await withClient(ctx.clientAToken)(
          api().patch(`/api/v1/mobile/client/bookings/${cancelledId}/cancel`),
        ).send({ reason: "CLIENT_REQUESTED" });

        expect(res.status).toBe(400);
        expect(res.body.message ?? "").toMatch(
          /cannot apply transition|allowed source statuses/i,
        );
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // RESCHEDULE — happy path + invalid slot + ownership + max-reschedules
    // ═══════════════════════════════════════════════════════════════════════

    describe("PATCH /mobile/client/bookings/:id/reschedule — happy + invalid + ownership + max-reached", () => {
      it("reschedules own booking: 200 + new scheduledAt persisted in DB", async () => {
        // Create a booking ~50h in the future (clears 24h client-reschedule
        // window) then reschedule to a different valid slot ~70h out.
        const target = nextUtcDayAt(new Date().getUTCDay(), 12, 0);
        const create = await withClient(ctx.clientAToken)(
          api().post("/api/v1/mobile/client/bookings"),
        ).send({
          branchId: ctx.branchId,
          employeeId: ctx.employeeId,
          serviceId: ctx.serviceId,
          scheduledAt: target.toISOString(),
        });
        expect(create.status).toBe(201);
        const bookingId = create.body.id as string;
        ctx.bookingIds.push(bookingId);
        await prisma.booking.update({
          where: { id: bookingId },
          data: { status: "CONFIRMED" },
        });

        // Reschedule to 13:00 on the same weekday. The handler excludes
        // the current booking from the conflict check, so moving within
        // the same business window is fine.
        const newTime = nextUtcDayAt(new Date().getUTCDay(), 13, 0);
        const res = await withClient(ctx.clientAToken)(
          api().patch(`/api/v1/mobile/client/bookings/${bookingId}/reschedule`),
        ).send({ newScheduledAt: newTime.toISOString() });

        expect(res.status).toBe(200);

        // Re-read from DB: scheduledAt + endsAt moved; status preserved.
        const persisted = await prisma.booking.findUnique({
          where: { id: bookingId },
        });
        expect(persisted!.scheduledAt.toISOString()).toBe(
          newTime.toISOString(),
        );
        expect(persisted!.endsAt.getTime()).toBe(
          newTime.getTime() + persisted!.durationMins * 60_000,
        );
        expect(persisted!.status).toBe("CONFIRMED");

        // BookingStatusLog row: fromStatus=toStatus=CONFIRMED (RESCHEDULE
        // is a self-loop), reason='rescheduled' (consumed by the
        // max-reschedules counter in the handler).
        const log = await prisma.bookingStatusLog.findFirst({
          where: { bookingId, reason: "rescheduled" },
        });
        expect(log).not.toBeNull();
        expect(log!.fromStatus).toBe("CONFIRMED");
        expect(log!.toStatus).toBe("CONFIRMED");
      });

      it("rejects rescheduling to a slot outside business hours with 400", async () => {
        // 03:00 UTC is outside the 08:00–22:00 business-hour window →
        // CheckAvailabilityHandler returns no slots →
        // assertSlotAvailable throws BadRequestException.
        const target = nextUtcDayAt(new Date().getUTCDay(), 17, 0);
        const create = await withClient(ctx.clientAToken)(
          api().post("/api/v1/mobile/client/bookings"),
        ).send({
          branchId: ctx.branchId,
          employeeId: ctx.employeeId,
          serviceId: ctx.serviceId,
          scheduledAt: target.toISOString(),
        });
        expect(create.status).toBe(201);
        const bookingId = create.body.id as string;
        ctx.bookingIds.push(bookingId);
        await prisma.booking.update({
          where: { id: bookingId },
          data: { status: "CONFIRMED" },
        });

        const badTime = nextUtcDayAt(new Date().getUTCDay(), 3, 0, 5);
        const res = await withClient(ctx.clientAToken)(
          api().patch(`/api/v1/mobile/client/bookings/${bookingId}/reschedule`),
        ).send({ newScheduledAt: badTime.toISOString() });

        expect(res.status).toBe(400);
        expect(res.body.message ?? "").toMatch(/not available/i);

        // The scheduledAt MUST NOT have moved on the rejected request.
        const after = await prisma.booking.findUnique({
          where: { id: bookingId },
        });
        expect(after!.scheduledAt.toISOString()).toBe(target.toISOString());
      });

      it("denies a different authenticated client from rescheduling the row (403)", async () => {
        // SECURITY (P1): clientB must NOT reschedule clientA's booking.
        // The handler throws ForbiddenException when
        // booking.clientId !== cmd.clientId.
        const target = nextUtcDayAt(new Date().getUTCDay(), 18, 0);
        const create = await withClient(ctx.clientAToken)(
          api().post("/api/v1/mobile/client/bookings"),
        ).send({
          branchId: ctx.branchId,
          employeeId: ctx.employeeId,
          serviceId: ctx.serviceId,
          scheduledAt: target.toISOString(),
        });
        expect(create.status).toBe(201);
        const bookingId = create.body.id as string;
        ctx.bookingIds.push(bookingId);
        await prisma.booking.update({
          where: { id: bookingId },
          data: { status: "CONFIRMED" },
        });

        const newTime = nextUtcDayAt(new Date().getUTCDay(), 19, 0, 7);
        const res = await withClient(ctx.clientBToken)(
          api().patch(`/api/v1/mobile/client/bookings/${bookingId}/reschedule`),
        ).send({ newScheduledAt: newTime.toISOString() });

        expect(res.status).toBe(403);
        expect(res.body.message ?? "").toMatch(
          /do not own this booking|not your booking/i,
        );

        // scheduledAt MUST NOT have moved.
        const after = await prisma.booking.findUnique({
          where: { id: bookingId },
        });
        expect(after!.scheduledAt.toISOString()).toBe(target.toISOString());
      });

      it("rejects a 4th reschedule when the per-booking limit is already reached (400)", async () => {
        // To avoid the cost of 3 sequential real reschedules, seed 3
        // BookingStatusLog rows with reason='rescheduled' directly. The
        // handler's counter is `where: { reason: 'rescheduled' }`, so
        // seeding is functionally equivalent to 3 real reschedules.
        const target = nextUtcDayAt(new Date().getUTCDay(), 9, 0);
        const create = await withClient(ctx.clientAToken)(
          api().post("/api/v1/mobile/client/bookings"),
        ).send({
          branchId: ctx.branchId,
          employeeId: ctx.employeeId,
          serviceId: ctx.serviceId,
          scheduledAt: target.toISOString(),
        });
        expect(create.status).toBe(201);
        const bookingId = create.body.id as string;
        ctx.bookingIds.push(bookingId);
        await prisma.booking.update({
          where: { id: bookingId },
          data: { status: "CONFIRMED" },
        });

        // Pre-seed 3 reschedule log rows (maxReschedulesPerBooking is 3).
        for (let i = 0; i < 3; i++) {
          await prisma.bookingStatusLog.create({
            data: {
              bookingId,
              fromStatus: "CONFIRMED",
              toStatus: "CONFIRMED",
              changedBy: ctx.clientAId,
              reason: "rescheduled",
            },
          });
        }

        // The next reschedule attempt must be rejected — the counter
        // query in the handler sees 3 rows and the limit is 3. The
        // target slot is a valid 30-min grid time so the failure
        // pinpoints the "maximum reschedules" message and not the
        // "slot unavailable" message (the slot check fires AFTER the
        // max-reschedules check).
        const newTime = nextUtcDayAt(new Date().getUTCDay(), 8, 0, 9);
        const res = await withClient(ctx.clientAToken)(
          api().patch(`/api/v1/mobile/client/bookings/${bookingId}/reschedule`),
        ).send({ newScheduledAt: newTime.toISOString() });

        expect(res.status).toBe(400);
        expect(res.body.message ?? "").toMatch(/maximum reschedules/i);

        // No 4th reschedule log row should have been written.
        const logCount = await prisma.bookingStatusLog.count({
          where: { bookingId, reason: "rescheduled" },
        });
        expect(logCount).toBe(3);
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // RATE — non-completed rejection + completed happy path + duplicate guard
    // ═══════════════════════════════════════════════════════════════════════

    describe("POST /mobile/client/bookings/:id/rate — completed-only + duplicate guard", () => {
      it("rejects rating a non-completed booking with 400 (status not COMPLETED)", async () => {
        // The mobile-client create path always lands a new booking in
        // AWAITING_PAYMENT (ONLINE source, no payAtClinic). Rating an
        // AWAITING_PAYMENT booking must be rejected — the handler throws
        // BadRequestException because booking.status !== 'COMPLETED'.
        const target = nextUtcDayAt(new Date().getUTCDay(), 9, 0, 10);
        const create = await withClient(ctx.clientAToken)(
          api().post("/api/v1/mobile/client/bookings"),
        ).send({
          branchId: ctx.branchId,
          employeeId: ctx.employeeId,
          serviceId: ctx.serviceId,
          scheduledAt: target.toISOString(),
        });
        expect(create.status).toBe(201);
        const bookingId = create.body.id as string;
        ctx.bookingIds.push(bookingId);

        const res = await withClient(ctx.clientAToken)(
          api().post(`/api/v1/mobile/client/bookings/${bookingId}/rate`),
        ).send({ score: 5, comment: "Loved it" });

        expect(res.status).toBe(400);
        expect(res.body.message ?? "").toMatch(/completed before/i);

        // No Rating row was created.
        const ratings = await prisma.rating.count({ where: { bookingId } });
        expect(ratings).toBe(0);
      });

      it("rates a completed booking: 201 + Rating row persisted with the right fields", async () => {
        const target = nextUtcDayAt(new Date().getUTCDay(), 8, 0, 11);
        const create = await withClient(ctx.clientAToken)(
          api().post("/api/v1/mobile/client/bookings"),
        ).send({
          branchId: ctx.branchId,
          employeeId: ctx.employeeId,
          serviceId: ctx.serviceId,
          scheduledAt: target.toISOString(),
        });
        expect(create.status).toBe(201);
        const bookingId = create.body.id as string;
        ctx.bookingIds.push(bookingId);

        // Mark as COMPLETED (the spec never invokes the dashboard
        // complete-booking endpoint — that path is out of scope here).
        await prisma.booking.update({
          where: { id: bookingId },
          data: { status: "COMPLETED" },
        });

        const res = await withClient(ctx.clientAToken)(
          api().post(`/api/v1/mobile/client/bookings/${bookingId}/rate`),
        ).send({ score: 5, comment: "Excellent session" });

        expect(res.status).toBe(201);
        const ratingId = res.body.id as string;
        ctx.ratingIds.push(ratingId);

        // Re-read from DB to prove the write landed. SubmitRatingHandler
        // always forces isPublic=false (the visibility flip is an admin
        // decision, not the client's) — assert that explicitly.
        const rating = await prisma.rating.findUnique({
          where: { id: ratingId },
        });
        expect(rating).not.toBeNull();
        expect(rating!.bookingId).toBe(bookingId);
        expect(rating!.clientId).toBe(ctx.clientAId);
        expect(rating!.employeeId).toBe(ctx.employeeId);
        expect(rating!.score).toBe(5);
        expect(rating!.comment).toBe("Excellent session");
        expect(rating!.isPublic).toBe(false);
      });

      it("rejects a duplicate rating on the same booking with 409", async () => {
        // Re-use the rating from the previous test. The handler's
        // "Rating already submitted" guard fires before the insert.
        const list = await withClient(ctx.clientAToken)(
          api().get("/api/v1/mobile/client/bookings"),
        ).query({ status: "COMPLETED", limit: 1 });
        const completedId = list.body.items[0]?.id as string | undefined;
        expect(completedId).toBeDefined();

        const res = await withClient(ctx.clientAToken)(
          api().post(`/api/v1/mobile/client/bookings/${completedId}/rate`),
        ).send({ score: 4 });

        expect(res.status).toBe(409);
        expect(res.body.message ?? "").toMatch(/already submitted/i);

        // Still exactly one Rating row for the booking.
        const ratings = await prisma.rating.count({
          where: { bookingId: completedId },
        });
        expect(ratings).toBe(1);
      });
    });
  },
);
