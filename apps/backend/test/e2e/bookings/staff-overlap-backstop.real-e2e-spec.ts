/**
 * Staff-overlap DB backstop — Real-DB e2e spec
 * ============================================
 *
 * Regression coverage for the P1-9 audit finding: the GiST exclusion constraint
 * `booking_staff_active_time_no_overlap` (migration 20260624000000) widened to
 * include COMPLETED + NO_SHOW had ZERO test proving it actually rejects an
 * overlapping pair. Without a test the constraint could be silently dropped in a
 * future migration and nobody would notice until a prod double-booking recurs.
 *
 * This spec inserts a COMPLETED booking and then attempts a CONFIRMED booking
 * that overlaps it on the same employee — and asserts the database rejects the
 * write with a 23P01 exclusion_violation. A non-overlapping control succeeds.
 *
 * Run:
 *   REAL_E2E_DATABASE_URL=... pnpm --filter=backend run test:e2e:real -- \
 *     test/e2e/bookings/staff-overlap-backstop.real-e2e-spec.ts
 */

import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { AppModule } from "../../../src/app.module";
import { PrismaService } from "../../../src/infrastructure/database";

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL
  ? describe
  : describe.skip;

describeRealE2e("Staff-overlap DB backstop (P1-9)", () => {
  jest.setTimeout(60_000);

  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tag = (label: string) => `p1-9-${suffix}-${label}`;

  const ids = {
    branchId: "",
    serviceId: "",
    employeeId: "",
    clientId: "",
  };
  const bookingIds: string[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.REAL_E2E_DATABASE_URL!;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.$queryRaw`SELECT 1`;
    await seed();
  });

  afterAll(async () => {
    await cleanup().catch(() => undefined);
    if (app) await app.close();
  });

  async function seed() {
    const branch = await prisma.branch.create({
      data: { nameAr: tag("branch"), nameEn: tag("branch-en"), isActive: true },
    });
    ids.branchId = branch.id;

    const dept = await prisma.department.create({
      data: { nameAr: tag("dept"), nameEn: tag("dept-en"), isActive: true },
    });
    const cat = await prisma.serviceCategory.create({
      data: { nameAr: tag("cat"), nameEn: tag("cat-en"), departmentId: dept.id, isActive: true },
    });
    const svc = await prisma.service.create({
      data: {
        nameAr: tag("svc"), nameEn: tag("svc-en"), durationMins: 60, price: 30_000,
        currency: "SAR", isActive: true, categoryId: cat.id,
      },
    });
    ids.serviceId = svc.id;

    const emp = await prisma.employee.create({
      data: {
        name: tag("emp"), nameAr: tag("emp"), nameEn: tag("emp-en"),
        email: `p1-9-${suffix}-emp@sawaa.test`,
        phone: `05${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
        isActive: true,
      },
    });
    ids.employeeId = emp.id;

    const cli = await prisma.client.create({
      data: {
        name: tag("client"),
        phone: `05${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
        email: `p1-9-${suffix}-client@sawaa.test`,
        source: "ONLINE",
      },
    });
    ids.clientId = cli.id;
  }

  async function makeBooking(
    status: string,
    scheduledAt: Date,
    bookingNumber: number,
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
        price: 30_000,
        currency: "SAR",
        status: status as never,
        bookingNumber,
        deliveryType: "IN_PERSON",
      },
    });
    bookingIds.push(booking.id);
    return booking;
  }

  async function cleanup() {
    if (!prisma) return;
    const safe = (fn: () => Promise<unknown>) => fn().catch(() => undefined);
    await safe(() => prisma.booking.deleteMany({ where: { id: { in: bookingIds } } }));
    await safe(() => prisma.client.deleteMany({ where: { id: ids.clientId } }));
    await safe(() => prisma.service.deleteMany({ where: { id: ids.serviceId } }));
    await safe(() => prisma.serviceCategory.deleteMany({ where: { nameEn: { startsWith: tag("") } } }));
    await safe(() => prisma.department.deleteMany({ where: { nameEn: { startsWith: tag("") } } }));
    await safe(() => prisma.employee.deleteMany({ where: { id: ids.employeeId } }));
    await safe(() => prisma.branch.deleteMany({ where: { nameEn: { startsWith: tag("") } } }));
  }

  it("rejects a CONFIRMED booking overlapping a COMPLETED booking on the same employee (23P01)", async () => {
    // 30 days out at 10:00 (any future time; the constraint is time-only, not
    // lead-time aware — it is the raw DB backstop).
    const slot = new Date(Date.now() + 30 * 24 * 3_600_000);
    slot.setHours(10, 0, 0, 0);

    // First booking → COMPLETED (a finalized appointment still occupies the slot).
    await makeBooking("COMPLETED", slot, 900_001);

    // Overlapping CONFIRMED booking on the SAME employee must be rejected by the
    // GiST exclusion constraint widened in migration 20260624000000.
    const overlapping = makeBooking("CONFIRMED", slot, 900_002);

    await expect(overlapping).rejects.toMatchObject({
      // Prisma surfaces the Postgres exclusion_violation. The adapter error
      // carries the raw 23P01 code in its message/meta — assert on that.
      message: expect.stringMatching(/booking_staff_active_time_no_overlap|23P01|exclusion/i),
    });
  });

  it("allows a non-overlapping CONFIRMED booking on the same employee", async () => {
    const slot = new Date(Date.now() + 31 * 24 * 3_600_000);
    slot.setHours(14, 0, 0, 0);
    // A different day/time → no overlap → the constraint does not fire.
    const ok = await makeBooking("CONFIRMED", slot, 900_003);
    expect(ok.id).toBeTruthy();
    expect(ok.status).toBe("CONFIRMED");
  });
});
