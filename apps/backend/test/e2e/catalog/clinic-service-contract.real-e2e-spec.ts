/**
 * Clinic / Service Booking Contract — Real-DB E2E Spec
 * =====================================================
 *
 * Pins the backend-enforceable rules of the canonical contract
 * (docs/architecture/clinic-service-booking-contract.md) against a real
 * Postgres database, exercising the real dashboard + public HTTP endpoints.
 *
 * The contract's rules are grouped here as:
 *   1. Category kind × booking mode matrix (SERVICE_GROUP + DIRECT rejected)
 *   2. DIRECT clinic owns exactly one internal (isHidden) service
 *   3. Internal service is protected in the general services editor
 *   4. Clinic rename syncs the internal service's current name
 *   5. bookingMode is immutable after creation (409 CATEGORY_BOOKING_MODE_LOCKED)
 *   6. kind is editable only while bookingMode = SERVICES
 *   7. Public read contract: includeDirectClinics opt-in on the three resources
 *   8. Bookings carry the internal serviceId for DIRECT clinics
 *   9. Archive/delete of a service is blocked by package references
 *
 * Data isolation: every fixture carries a per-run suffix; cleanup is targeted
 * by tracked ids and suffix, never touching sibling specs' rows. The spec does
 * not modify the shared OrganizationSettings row.
 *
 * Run:
 *   REAL_E2E_DATABASE_URL="postgresql://test:test@127.0.0.1:55491/sawaa_e2e_test?schema=public" \
 *     npx jest --config test/jest-e2e.json --runInBand clinic-service-contract
 */

import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { DeliveryType, Prisma } from "@prisma/client";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createRealE2eApp } from "../../helpers/create-real-e2e-app";
import { PrismaService } from "../../../src/infrastructure/database";

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL
  ? describe
  : describe.skip;

type Category = {
  id: string;
  nameAr: string;
  nameEn: string | null;
  kind: string;
  bookingMode: string;
};

describeRealE2e("Clinic/service booking contract — real-DB e2e", () => {
  jest.setTimeout(60_000);

  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const prefix = `csc-e2e-${suffix}`;
  const tag = (label: string) => `${prefix}-${label}`;
  const uniqueEmail = (label: string) => `${prefix}-${label}@sawaa.test`;
  const uniquePhone = () =>
    `05${String(Math.floor(10_000_000 + Math.random() * 89_999_999)).padStart(8, "0")}`;

  const ctx = {
    adminToken: "",
    clientToken: "",
    clientId: "",
    departmentId: "",
    branchId: "",
    categoryIds: [] as string[],
    bookingIds: [] as string[],
    invoiceIds: [] as string[],
  };

  const api = () => request(app.getHttpServer());
  const dash = "/api/v1/dashboard/organization";
  const auth = () => ({ Authorization: `Bearer ${ctx.adminToken}` });

  beforeAll(async () => {
    const created = await createRealE2eApp();
    app = created.app;
    prisma = created.prisma;
    jwtService = app.get(JwtService);

    const admin = await prisma.user.create({
      data: {
        email: uniqueEmail("admin"),
        passwordHash: "not-used",
        name: tag("admin"),
        role: "ADMIN",
        isSuperAdmin: true,
        isActive: true,
      },
    });
    ctx.adminToken = jwtService.sign({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      isSuperAdmin: true,
    });

    const dept = await prisma.department.create({
      data: { nameAr: tag("dept-ar"), nameEn: tag("dept-en"), isActive: true },
    });
    ctx.departmentId = dept.id;
  });

  afterAll(async () => {
    try {
      await cleanup();
    } catch {
      /* best-effort */
    }
    if (app) await app.close();
  });

  async function cleanup() {
    if (!prisma) return;
    const swallow = () => undefined;
    await prisma.outboxEvent
      .deleteMany({ where: { aggregateId: { in: ctx.bookingIds } } })
      .catch(swallow);
    await prisma.invoice
      .deleteMany({ where: { id: { in: ctx.invoiceIds } } })
      .catch(swallow);
    await prisma.booking
      .deleteMany({ where: { id: { in: ctx.bookingIds } } })
      .catch(swallow);
    await prisma.sessionPackage
      .deleteMany({ where: { nameAr: { startsWith: prefix } } })
      .catch(swallow);

    const services = await prisma.service.findMany({
      where: {
        OR: [
          { categoryId: { in: ctx.categoryIds } },
          { nameAr: { startsWith: prefix } },
        ],
      },
      select: { id: true },
    });
    const serviceIds = services.map((s) => s.id);
    await prisma.serviceBookingConfig
      .deleteMany({ where: { serviceId: { in: serviceIds } } })
      .catch(swallow);
    await prisma.serviceDurationOption
      .deleteMany({ where: { serviceId: { in: serviceIds } } })
      .catch(swallow);
    await prisma.employeeService
      .deleteMany({ where: { serviceId: { in: serviceIds } } })
      .catch(swallow);
    await prisma.service
      .deleteMany({ where: { id: { in: serviceIds } } })
      .catch(swallow);
    await prisma.serviceCategory
      .deleteMany({
        where: {
          OR: [
            { id: { in: ctx.categoryIds } },
            { nameAr: { startsWith: prefix } },
          ],
        },
      })
      .catch(swallow);
    await prisma.employee
      .deleteMany({ where: { email: { startsWith: prefix } } })
      .catch(swallow);
    await prisma.client
      .deleteMany({ where: { email: { startsWith: prefix } } })
      .catch(swallow);
    await prisma.branch
      .deleteMany({ where: { nameAr: { startsWith: prefix } } })
      .catch(swallow);
    await prisma.department
      .deleteMany({ where: { nameAr: { startsWith: prefix } } })
      .catch(swallow);
    await prisma.user
      .deleteMany({ where: { email: { startsWith: prefix } } })
      .catch(swallow);
  }

  // ── Fixture helpers (real HTTP where the rule is about API behaviour) ─────

  async function createCategory(
    label: string,
    body: { kind?: string; bookingMode?: string } = {},
  ): Promise<Category> {
    const res = await api()
      .post(`${dash}/categories`)
      .set(auth())
      .send({
        nameAr: tag(`${label}-ar`),
        nameEn: tag(`${label}-en`),
        departmentId: ctx.departmentId,
        ...body,
      });
    expect(res.status).toBe(201);
    ctx.categoryIds.push(res.body.id);
    return res.body as Category;
  }

  async function createVisibleService(
    label: string,
    categoryId: string,
    extra: Record<string, unknown> = {},
  ): Promise<{ id: string }> {
    const res = await api()
      .post(`${dash}/services`)
      .set(auth())
      .send({
        nameAr: tag(`${label}-svc-ar`),
        nameEn: tag(`${label}-svc-en`),
        durationMins: 60,
        price: 25_000,
        categoryId,
        ...extra,
      });
    expect(res.status).toBe(201);
    return res.body as { id: string };
  }

  async function internalServicesOf(categoryId: string) {
    return prisma.service.findMany({
      where: { categoryId, isHidden: true },
    });
  }

  async function createPublicEmployee(label: string, serviceIds: string[]) {
    const emp = await prisma.employee.create({
      data: {
        name: tag(`${label}-emp`),
        nameAr: tag(`${label}-emp-ar`),
        email: uniqueEmail(`${label}-emp`),
        phone: uniquePhone(),
        slug: tag(`${label}-emp-slug`),
        isActive: true,
        isPublic: true,
      },
    });
    for (const serviceId of serviceIds) {
      await prisma.employeeService.create({
        data: { employeeId: emp.id, serviceId, isActive: true },
      });
    }
    return emp;
  }

  // ═══════════════════════════════════════════════════════════════════════
  describe("Rule 1 — Category kind × booking mode matrix", () => {
    it("accepts CLINIC+DIRECT, CLINIC+SERVICES and SERVICE_GROUP+SERVICES", async () => {
      const direct = await createCategory("r1-clinic-direct", {
        kind: "CLINIC",
        bookingMode: "DIRECT",
      });
      const services = await createCategory("r1-clinic-services", {
        kind: "CLINIC",
        bookingMode: "SERVICES",
      });
      const group = await createCategory("r1-group-services", {
        kind: "SERVICE_GROUP",
        bookingMode: "SERVICES",
      });
      expect(direct).toMatchObject({ kind: "CLINIC", bookingMode: "DIRECT" });
      expect(services).toMatchObject({ kind: "CLINIC", bookingMode: "SERVICES" });
      expect(group).toMatchObject({ kind: "SERVICE_GROUP", bookingMode: "SERVICES" });
    });

    it("rejects SERVICE_GROUP+DIRECT with 400 and writes nothing", async () => {
      const res = await api()
        .post(`${dash}/categories`)
        .set(auth())
        .send({
          nameAr: tag("r1-group-direct-ar"),
          nameEn: tag("r1-group-direct-en"),
          kind: "SERVICE_GROUP",
          bookingMode: "DIRECT",
        });
      if (res.body?.id) ctx.categoryIds.push(res.body.id);
      expect(res.status).toBe(400);
      expect(
        await prisma.serviceCategory.count({
          where: { nameAr: tag("r1-group-direct-ar") },
        }),
      ).toBe(0);
      expect(
        await prisma.service.count({ where: { nameAr: tag("r1-group-direct-ar") } }),
      ).toBe(0);
    });

    it("defaults an omitted kind to CLINIC and an omitted bookingMode to SERVICES", async () => {
      const cat = await createCategory("r1-defaults");
      expect(cat).toMatchObject({ kind: "CLINIC", bookingMode: "SERVICES" });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  describe("Rule 2 — DIRECT clinic owns exactly one internal service", () => {
    it("creating a DIRECT clinic creates one isHidden service named after the clinic", async () => {
      const clinic = await createCategory("r2-direct", { bookingMode: "DIRECT" });
      const internal = await internalServicesOf(clinic.id);
      expect(internal).toHaveLength(1);
      expect(internal[0]).toMatchObject({
        categoryId: clinic.id,
        isHidden: true,
        isActive: true,
        nameAr: clinic.nameAr,
        nameEn: clinic.nameEn,
        archivedAt: null,
      });
      expect(await prisma.service.count({ where: { categoryId: clinic.id } })).toBe(1);
    });

    it("SERVICES clinics and service groups get no internal service", async () => {
      const clinic = await createCategory("r2-services", { bookingMode: "SERVICES" });
      const group = await createCategory("r2-group", { kind: "SERVICE_GROUP" });
      expect(await prisma.service.count({ where: { categoryId: clinic.id } })).toBe(0);
      expect(await prisma.service.count({ where: { categoryId: group.id } })).toBe(0);
    });

    it("the partial unique index rejects a second hidden service in the same category", async () => {
      const clinic = await createCategory("r2-index", { bookingMode: "DIRECT" });
      await expect(
        prisma.service.create({
          data: {
            categoryId: clinic.id,
            nameAr: tag("r2-index-dup-ar"),
            nameEn: tag("r2-index-dup-en"),
            price: new Prisma.Decimal(0),
            durationMins: 30,
            isHidden: true,
          },
        }),
      ).rejects.toMatchObject({ code: "P2002" });
      expect(await internalServicesOf(clinic.id)).toHaveLength(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  describe("Rule 3 — Internal service is protected in the general services editor", () => {
    let directClinic: Category;
    let otherClinic: Category;
    let internalId: string;

    beforeAll(async () => {
      directClinic = await createCategory("r3-direct", { bookingMode: "DIRECT" });
      otherClinic = await createCategory("r3-other", { bookingMode: "SERVICES" });
      internalId = (await internalServicesOf(directClinic.id))[0].id;
    });

    it("rejects un-hiding the internal service", async () => {
      const res = await api()
        .patch(`${dash}/services/${internalId}`)
        .set(auth())
        .send({ isHidden: false });
      expect(res.status).toBe(400);
      const row = await prisma.service.findUniqueOrThrow({ where: { id: internalId } });
      expect(row.isHidden).toBe(true);
    });

    it("rejects moving the internal service to another category", async () => {
      const res = await api()
        .patch(`${dash}/services/${internalId}`)
        .set(auth())
        .send({ categoryId: otherClinic.id });
      expect(res.status).toBe(400);
      const row = await prisma.service.findUniqueOrThrow({ where: { id: internalId } });
      expect(row.categoryId).toBe(directClinic.id);
    });

    it("rejects renaming the internal service directly", async () => {
      const res = await api()
        .patch(`${dash}/services/${internalId}`)
        .set(auth())
        .send({ nameAr: tag("r3-renamed-ar") });
      expect(res.status).toBe(400);
      const row = await prisma.service.findUniqueOrThrow({ where: { id: internalId } });
      expect(row.nameAr).toBe(directClinic.nameAr);
    });

    it("keeps price and duration of the internal service manageable", async () => {
      const res = await api()
        .patch(`${dash}/services/${internalId}`)
        .set(auth())
        .send({ price: 30_000, durationMins: 45 });
      expect(res.status).toBe(200);
      const row = await prisma.service.findUniqueOrThrow({ where: { id: internalId } });
      expect(Number(row.price)).toBe(30_000);
      expect(row.durationMins).toBe(45);
    });

    it("rejects deleting/archiving the internal service from the general endpoint", async () => {
      const res = await api().delete(`${dash}/services/${internalId}`).set(auth());
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("DIRECT_CLINIC_SERVICE_CANNOT_BE_DELETED");
      const row = await prisma.service.findUnique({ where: { id: internalId } });
      expect(row).not.toBeNull();
      expect(row!.archivedAt).toBeNull();
    });

    it("rejects creating a visible service under a DIRECT clinic", async () => {
      const res = await api()
        .post(`${dash}/services`)
        .set(auth())
        .send({
          nameAr: tag("r3-under-direct-ar"),
          nameEn: tag("r3-under-direct-en"),
          durationMins: 30,
          price: 10_000,
          categoryId: directClinic.id,
        });
      expect(res.status).toBe(400);
      expect(await prisma.service.count({ where: { categoryId: directClinic.id } })).toBe(1);
    });

    it("rejects moving a visible service into a DIRECT clinic", async () => {
      const visible = await createVisibleService("r3-move", otherClinic.id);
      const res = await api()
        .patch(`${dash}/services/${visible.id}`)
        .set(auth())
        .send({ categoryId: directClinic.id });
      expect(res.status).toBe(400);
      const row = await prisma.service.findUniqueOrThrow({ where: { id: visible.id } });
      expect(row.categoryId).toBe(otherClinic.id);
    });

    it("a hidden service under a SERVICES clinic stays an ordinary service", async () => {
      const hidden = await createVisibleService("r3-hidden-services", otherClinic.id, {
        isHidden: true,
      });
      const unhide = await api()
        .patch(`${dash}/services/${hidden.id}`)
        .set(auth())
        .send({ isHidden: false });
      expect(unhide.status).toBe(200);
      const del = await api().delete(`${dash}/services/${hidden.id}`).set(auth());
      expect(del.status).toBe(204);
      expect(await prisma.service.findUnique({ where: { id: hidden.id } })).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  describe("Rule 4 — Clinic rename syncs the internal service name", () => {
    it("renaming a DIRECT clinic renames its internal service", async () => {
      const clinic = await createCategory("r4-direct", { bookingMode: "DIRECT" });
      const res = await api()
        .patch(`${dash}/categories/${clinic.id}`)
        .set(auth())
        .send({ nameAr: tag("r4-renamed-ar"), nameEn: tag("r4-renamed-en") });
      expect(res.status).toBe(200);
      const internal = await internalServicesOf(clinic.id);
      expect(internal).toHaveLength(1);
      expect(internal[0].nameAr).toBe(tag("r4-renamed-ar"));
      expect(internal[0].nameEn).toBe(tag("r4-renamed-en"));
    });

    it("renaming a SERVICES clinic leaves its hidden service untouched", async () => {
      const clinic = await createCategory("r4-services", { bookingMode: "SERVICES" });
      const hidden = await createVisibleService("r4-hidden", clinic.id, { isHidden: true });
      const res = await api()
        .patch(`${dash}/categories/${clinic.id}`)
        .set(auth())
        .send({ nameAr: tag("r4-services-renamed-ar") });
      expect(res.status).toBe(200);
      const row = await prisma.service.findUniqueOrThrow({ where: { id: hidden.id } });
      expect(row.nameAr).toBe(tag("r4-hidden-svc-ar"));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  describe("Rule 5 — bookingMode is immutable after creation", () => {
    it("accepts PATCH with the same bookingMode", async () => {
      const clinic = await createCategory("r5-same", { bookingMode: "DIRECT" });
      const res = await api()
        .patch(`${dash}/categories/${clinic.id}`)
        .set(auth())
        .send({ bookingMode: "DIRECT", sortOrder: 3 });
      expect(res.status).toBe(200);
      expect(res.body.bookingMode).toBe("DIRECT");
    });

    it.each([
      ["SERVICES", "DIRECT"],
      ["DIRECT", "SERVICES"],
    ])("rejects %s → %s with 409 CATEGORY_BOOKING_MODE_LOCKED", async (from, to) => {
      const clinic = await createCategory(`r5-${from}-${to}`, { bookingMode: from });
      const servicesBefore = await prisma.service.count({ where: { categoryId: clinic.id } });
      const res = await api()
        .patch(`${dash}/categories/${clinic.id}`)
        .set(auth())
        .send({ bookingMode: to });
      expect(res.status).toBe(409);
      expect(JSON.stringify(res.body)).toContain("CATEGORY_BOOKING_MODE_LOCKED");
      const row = await prisma.serviceCategory.findUniqueOrThrow({ where: { id: clinic.id } });
      expect(row.bookingMode).toBe(from);
      expect(await prisma.service.count({ where: { categoryId: clinic.id } })).toBe(
        servicesBefore,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  describe("Rule 6 — kind is editable only while bookingMode=SERVICES", () => {
    it("switches kind CLINIC ↔ SERVICE_GROUP on a SERVICES category", async () => {
      const cat = await createCategory("r6-services", { bookingMode: "SERVICES" });
      const toGroup = await api()
        .patch(`${dash}/categories/${cat.id}`)
        .set(auth())
        .send({ kind: "SERVICE_GROUP" });
      expect(toGroup.status).toBe(200);
      expect(toGroup.body.kind).toBe("SERVICE_GROUP");
      const back = await api()
        .patch(`${dash}/categories/${cat.id}`)
        .set(auth())
        .send({ kind: "CLINIC" });
      expect(back.status).toBe(200);
      expect(back.body.kind).toBe("CLINIC");
    });

    it("rejects turning a DIRECT clinic into a SERVICE_GROUP", async () => {
      const clinic = await createCategory("r6-direct", { bookingMode: "DIRECT" });
      const res = await api()
        .patch(`${dash}/categories/${clinic.id}`)
        .set(auth())
        .send({ kind: "SERVICE_GROUP" });
      expect(res.status).toBe(400);
      const row = await prisma.serviceCategory.findUniqueOrThrow({ where: { id: clinic.id } });
      expect(row.kind).toBe("CLINIC");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  describe("Rule 7 — Public read contract: includeDirectClinics opt-in", () => {
    const f = {
      internalId: "",
      inactiveInternalId: "",
      visibleId: "",
      hiddenUnderServicesId: "",
      employeeId: "",
      employeeSlug: "",
      directOnlyEmployeeId: "",
    };

    beforeAll(async () => {
      const direct = await createCategory("r7-direct", { bookingMode: "DIRECT" });
      f.internalId = (await internalServicesOf(direct.id))[0].id;

      const inactiveDirect = await createCategory("r7-inactive-direct", {
        bookingMode: "DIRECT",
      });
      f.inactiveInternalId = (await internalServicesOf(inactiveDirect.id))[0].id;
      const deactivate = await api()
        .patch(`${dash}/categories/${inactiveDirect.id}`)
        .set(auth())
        .send({ isActive: false });
      expect(deactivate.status).toBe(200);

      const servicesClinic = await createCategory("r7-services", { bookingMode: "SERVICES" });
      f.visibleId = (await createVisibleService("r7-visible", servicesClinic.id)).id;
      f.hiddenUnderServicesId = (
        await createVisibleService("r7-hidden-services", servicesClinic.id, { isHidden: true })
      ).id;

      const emp = await createPublicEmployee("r7-mixed", [
        f.internalId,
        f.inactiveInternalId,
        f.visibleId,
        f.hiddenUnderServicesId,
      ]);
      f.employeeId = emp.id;
      f.employeeSlug = emp.slug!;
      f.directOnlyEmployeeId = (await createPublicEmployee("r7-direct-only", [f.internalId])).id;
    });

    const catalogIds = async (query: Record<string, string>) => {
      const res = await api().get("/api/v1/public/services").query(query);
      expect(res.status).toBe(200);
      return (res.body.services as { id: string }[]).map((s) => s.id);
    };

    it("GET /public/services hides internal services by default", async () => {
      const ids = await catalogIds({});
      expect(ids).toContain(f.visibleId);
      expect(ids).not.toContain(f.internalId);
      expect(ids).not.toContain(f.hiddenUnderServicesId);
    });

    it("GET /public/services?includeDirectClinics=true adds only active DIRECT internal services", async () => {
      const res = await api()
        .get("/api/v1/public/services")
        .query({ includeDirectClinics: "true" });
      expect(res.status).toBe(200);
      const services = res.body.services as { id: string; isHidden?: boolean }[];
      const ids = services.map((s) => s.id);
      expect(ids).toContain(f.visibleId);
      expect(ids).toContain(f.internalId);
      expect(services.find((s) => s.id === f.internalId)!.isHidden).toBe(true);
      expect(ids).not.toContain(f.inactiveInternalId);
      expect(ids).not.toContain(f.hiddenUnderServicesId);
    });

    it("GET /public/employees follows the same opt-in", async () => {
      const pick = async (query: Record<string, string>) => {
        const res = await api().get("/api/v1/public/employees").query(query);
        expect(res.status).toBe(200);
        return (res.body as { id: string; serviceIds: string[] }[]).find(
          (e) => e.id === f.employeeId,
        )!;
      };
      const plain = await pick({});
      expect(plain.serviceIds).toEqual([f.visibleId]);
      const opted = await pick({ includeDirectClinics: "true" });
      expect([...opted.serviceIds].sort()).toEqual([f.internalId, f.visibleId].sort());
    });

    it("GET /public/employees/:key follows the same opt-in (by id and by slug)", async () => {
      for (const key of [f.employeeId, f.employeeSlug]) {
        const plain = await api().get(`/api/v1/public/employees/${key}`);
        expect(plain.status).toBe(200);
        expect(plain.body.serviceIds).toEqual([f.visibleId]);
        const opted = await api()
          .get(`/api/v1/public/employees/${key}`)
          .query({ includeDirectClinics: "true" });
        expect(opted.status).toBe(200);
        expect([...opted.body.serviceIds].sort()).toEqual(
          [f.internalId, f.visibleId].sort(),
        );
      }
    });

    it("list and detail agree on the DIRECT-only practitioner and never price it from the internal default", async () => {
      const list = await api()
        .get("/api/v1/public/employees")
        .query({ includeDirectClinics: "true" });
      const fromList = (list.body as { id: string; serviceIds: string[]; minServicePrice: number | null }[]).find(
        (e) => e.id === f.directOnlyEmployeeId,
      )!;
      const detail = await api()
        .get(`/api/v1/public/employees/${f.directOnlyEmployeeId}`)
        .query({ includeDirectClinics: "true" });
      expect(detail.status).toBe(200);
      expect(fromList.serviceIds).toEqual([f.internalId]);
      expect(detail.body.serviceIds).toEqual(fromList.serviceIds);
      expect(fromList.minServicePrice).toBeNull();
      expect(detail.body.minServicePrice).toBeNull();

      const plainDetail = await api().get(`/api/v1/public/employees/${f.directOnlyEmployeeId}`);
      expect(plainDetail.body.serviceIds).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  describe("Rule 8 — Bookings carry the internal serviceId for DIRECT clinics", () => {
    const f = {
      clinic: undefined as unknown as Category,
      internalId: "",
      hiddenUnderServicesId: "",
      employeeId: "",
    };

    async function addBookingConfig(serviceId: string) {
      await prisma.serviceBookingConfig.create({
        data: {
          serviceId,
          deliveryType: DeliveryType.IN_PERSON,
          price: new Prisma.Decimal(20_000),
          durationMins: 60,
          isActive: true,
        },
      });
      await prisma.serviceDurationOption.create({
        data: {
          serviceId,
          deliveryType: DeliveryType.IN_PERSON,
          label: "60 min",
          labelAr: "60 دقيقة",
          durationMins: 60,
          price: new Prisma.Decimal(20_000),
          isDefault: true,
          isActive: true,
          sortOrder: 1,
        },
      });
    }

    function nextDayAtUtc(hour: number): Date {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + 2);
      d.setUTCHours(hour, 0, 0, 0);
      return d;
    }

    beforeAll(async () => {
      f.clinic = await createCategory("r8-direct", { bookingMode: "DIRECT" });
      f.internalId = (await internalServicesOf(f.clinic.id))[0].id;
      const servicesClinic = await createCategory("r8-services", { bookingMode: "SERVICES" });
      f.hiddenUnderServicesId = (
        await createVisibleService("r8-hidden-services", servicesClinic.id, { isHidden: true })
      ).id;
      await addBookingConfig(f.internalId);
      await addBookingConfig(f.hiddenUnderServicesId);

      const branch = await prisma.branch.create({
        data: { nameAr: tag("r8-branch-ar"), nameEn: tag("r8-branch-en"), isActive: true },
      });
      ctx.branchId = branch.id;
      const emp = await createPublicEmployee("r8", [f.internalId, f.hiddenUnderServicesId]);
      f.employeeId = emp.id;
      await prisma.employeeBranch.create({ data: { employeeId: emp.id, branchId: branch.id } });
      for (let dow = 0; dow < 7; dow++) {
        await prisma.businessHour.create({
          data: { branchId: branch.id, dayOfWeek: dow, startTime: "08:00", endTime: "22:00", isOpen: true },
        });
        await prisma.employeeAvailability.create({
          data: { employeeId: emp.id, dayOfWeek: dow, startTime: "08:00", endTime: "22:00", isActive: true },
        });
      }

      const client = await prisma.client.create({
        data: {
          name: tag("r8-client"),
          firstName: tag("r8-client"),
          phone: uniquePhone(),
          email: uniqueEmail("r8-client"),
          source: "ONLINE",
          isActive: true,
          tokenVersion: 0,
        },
      });
      ctx.clientId = client.id;
      ctx.clientToken = jwtService.sign(
        { sub: client.id, email: client.email, namespace: "client", jti: randomUUID(), tokenVersion: 0 },
        { secret: process.env.JWT_CLIENT_ACCESS_SECRET! },
      );
    });

    it("exposes practitioner booking options for the internal service, not for a hidden SERVICES service", async () => {
      const ok = await api().get(
        `/api/v1/public/services/${f.internalId}/practitioners/${f.employeeId}/booking-options`,
      );
      expect(ok.status).toBe(200);
      expect(ok.body.options.length).toBeGreaterThan(0);
      const hidden = await api().get(
        `/api/v1/public/services/${f.hiddenUnderServicesId}/practitioners/${f.employeeId}/booking-options`,
      );
      expect(hidden.status).toBe(404);
    });

    it("POST /public/bookings with the internal serviceId creates the booking", async () => {
      const res = await api()
        .post("/api/v1/public/bookings")
        .set("Authorization", `Bearer ${ctx.clientToken}`)
        .send({
          branchId: ctx.branchId,
          employeeId: f.employeeId,
          serviceId: f.internalId,
          startsAt: nextDayAtUtc(11).toISOString(),
          deliveryType: "IN_PERSON",
        });
      if (res.body?.id) ctx.bookingIds.push(res.body.id);
      if (res.body?.invoiceId) ctx.invoiceIds.push(res.body.invoiceId);
      expect(res.status).toBe(201);
      expect(res.body.serviceId).toBe(f.internalId);
      const booking = await prisma.booking.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(booking.serviceId).toBe(f.internalId);
      expect(booking.serviceNameSnapshot).toBe(f.clinic.nameAr);
    });

    it("POST /public/bookings rejects a hidden service under a SERVICES clinic", async () => {
      const res = await api()
        .post("/api/v1/public/bookings")
        .set("Authorization", `Bearer ${ctx.clientToken}`)
        .send({
          branchId: ctx.branchId,
          employeeId: f.employeeId,
          serviceId: f.hiddenUnderServicesId,
          startsAt: nextDayAtUtc(15).toISOString(),
          deliveryType: "IN_PERSON",
        });
      if (res.body?.id) ctx.bookingIds.push(res.body.id);
      if (res.body?.invoiceId) ctx.invoiceIds.push(res.body.invoiceId);
      expect(res.status).toBe(400);
      expect(
        await prisma.booking.count({
          where: { clientId: ctx.clientId, serviceId: f.hiddenUnderServicesId },
        }),
      ).toBe(0);
    });

    it("renaming the clinic afterwards does not rewrite the frozen booking snapshot", async () => {
      const bookingId = ctx.bookingIds[0];
      expect(bookingId).toBeDefined();
      const res = await api()
        .patch(`${dash}/categories/${f.clinic.id}`)
        .set(auth())
        .send({ nameAr: tag("r8-direct-renamed-ar") });
      expect(res.status).toBe(200);
      const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
      expect(booking.serviceNameSnapshot).toBe(f.clinic.nameAr);
      const internal = await prisma.service.findUniqueOrThrow({ where: { id: f.internalId } });
      expect(internal.nameAr).toBe(tag("r8-direct-renamed-ar"));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  describe("Rule 9 — Archive/delete of a service is blocked by package references", () => {
    it("DELETE is rejected with 409 SERVICE_REFERENCED_BY_PACKAGE even with zero bookings", async () => {
      const clinic = await createCategory("r9-services", { bookingMode: "SERVICES" });
      const svc = await createVisibleService("r9-referenced", clinic.id);
      await prisma.sessionPackage.create({
        data: {
          nameAr: tag("r9-package-ar"),
          discountType: "PERCENTAGE",
          discountValue: new Prisma.Decimal(0),
          items: { create: [{ serviceId: svc.id, paidQuantity: 2 }] },
        },
      });
      expect(await prisma.booking.count({ where: { serviceId: svc.id } })).toBe(0);

      const res = await api().delete(`${dash}/services/${svc.id}`).set(auth());
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("SERVICE_REFERENCED_BY_PACKAGE");
      const row = await prisma.service.findUnique({ where: { id: svc.id } });
      expect(row).not.toBeNull();
      expect(row!.archivedAt).toBeNull();
    });

    it("an unreferenced service with zero bookings is deleted", async () => {
      const clinic = await createCategory("r9-free", { bookingMode: "SERVICES" });
      const svc = await createVisibleService("r9-free", clinic.id);
      const res = await api().delete(`${dash}/services/${svc.id}`).set(auth());
      expect(res.status).toBe(204);
      expect(await prisma.service.findUnique({ where: { id: svc.id } })).toBeNull();
    });
  });
});
