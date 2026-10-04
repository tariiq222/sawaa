/**
 * Final grouped-package booking acceptance against a migrated test database.
 *
 * This lane deliberately creates the catalog and sale through their dashboard
 * HTTP endpoints, then drives every package-credit mutation through the real
 * booking HTTP handlers. It is skipped unless REAL_E2E_DATABASE_URL is set;
 * the guarded createRealE2eApp helper refuses unsafe database targets.
 */
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createRealE2eApp } from '../../helpers/create-real-e2e-app';
import { PrismaService } from '../../../src/infrastructure/database';

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;

type Slot = { startTime: string; endTime: string };
type ListedCredit = {
  id: string;
  purchaseGroupId: string | null;
  sessionPosition: number | null;
  durationOptionId: string | null;
  employeeId: string | null;
  employeeNameSnapshot: string | null;
  unitPriceSnapshot: number;
  netValue: number | null;
  usedQuantity: number;
  reservedQuantity: number;
  remaining: number;
  groupLabel: string | null;
  sequenceMode: string | null;
  availability?: { bookable: boolean; reason: string | null };
};

describeRealE2e('grouped package booking HTTP acceptance (real DB)', () => {
  jest.setTimeout(90_000);

  let app: Awaited<ReturnType<typeof createRealE2eApp>>['app'];
  let prisma: PrismaService;
  let adminToken: string;
  let adminUserId: string;

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tag = (label: string) => `group-booking-${suffix}-${label}`;
  const email = (label: string) => `${tag(label)}@sawaa.test`;
  const phone = () => `05${String(Math.floor(10_000_000 + Math.random() * 89_999_999))}`;

  const ids = {
    branchId: '',
    departmentId: '',
    categoryId: '',
    scalesCategoryId: '',
    serviceAId: '',
    serviceBId: '',
    employeeAId: '',
    employeeBId: '',
    substituteId: '',
    clientAId: '',
    clientBId: '',
    packageId: '',
    purchaseId: '',
    orderedGroupId: '',
    dependencyGroupId: '',
    serviceA30Id: '',
    serviceA45Id: '',
    serviceA60Id: '',
    serviceB60Id: '',
    customDurationBId: '',
    bookingIds: [] as string[],
  };

  const api = () => request(app.getHttpServer());
  const auth = (token = adminToken) => (req: request.Test) =>
    req.set('Authorization', `Bearer ${token}`);

  const daysFromNow = (days: number, hour = 10, minute = 0) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(hour, minute, 0, 0);
    return date;
  };

  beforeAll(async () => {
    ({ app, prisma } = await createRealE2eApp());
    const jwt = app.get(JwtService);

    const admin = await prisma.user.create({
      data: {
        email: email('admin'),
        passwordHash: 'not-used',
        name: tag('admin'),
        role: 'ADMIN',
        isActive: true,
        isSuperAdmin: true,
      },
    });
    adminUserId = admin.id;
    adminToken = jwt.sign({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      isSuperAdmin: true,
    });

    const branch = await prisma.branch.create({
      data: { nameAr: tag('branch'), nameEn: tag('branch-en'), isActive: true },
    });
    ids.branchId = branch.id;

    const department = await prisma.department.create({
      data: { nameAr: tag('department'), nameEn: tag('department-en'), isActive: true },
    });
    ids.departmentId = department.id;
    const category = await prisma.serviceCategory.create({
      data: {
        nameAr: tag('clinic'),
        nameEn: tag('clinic-en'),
        departmentId: department.id,
        isActive: true,
        bookingMode: 'DIRECT',
      },
    });
    ids.categoryId = category.id;
    const scalesCategory = await prisma.serviceCategory.create({
      data: {
        nameAr: tag('scales'),
        nameEn: tag('scales-en'),
        departmentId: department.id,
        isActive: true,
        bookingMode: 'SERVICES',
      },
    });
    ids.scalesCategoryId = scalesCategory.id;

    const [employeeA, employeeB, substitute] = await Promise.all([
      prisma.employee.create({
        data: { name: tag('employee-a'), nameAr: tag('employee-a-ar'), email: email('employee-a'), phone: phone(), isActive: true },
      }),
      prisma.employee.create({
        data: { name: tag('employee-b'), nameAr: tag('employee-b-ar'), email: email('employee-b'), phone: phone(), isActive: true },
      }),
      prisma.employee.create({
        data: { name: tag('substitute'), nameAr: tag('substitute-ar'), email: email('substitute'), phone: phone(), isActive: true },
      }),
    ]);
    ids.employeeAId = employeeA.id;
    ids.employeeBId = employeeB.id;
    ids.substituteId = substitute.id;

    const [serviceA, serviceB] = await Promise.all([
      prisma.service.create({
        data: {
          nameAr: tag('service-a'),
          nameEn: tag('service-a-en'),
          categoryId: category.id,
          isHidden: true,
          durationMins: 30,
          price: 10_000,
          currency: 'SAR',
          isActive: true,
        },
      }),
      prisma.service.create({
        data: {
          nameAr: tag('service-b'),
          nameEn: tag('service-b-en'),
          categoryId: scalesCategory.id,
          durationMins: 60,
          price: 20_000,
          currency: 'SAR',
          isActive: true,
        },
      }),
    ]);
    ids.serviceAId = serviceA.id;
    ids.serviceBId = serviceB.id;

    await prisma.serviceBookingConfig.createMany({
      data: [
        { serviceId: serviceA.id, deliveryType: 'IN_PERSON', isActive: true, useCustomAvailability: false },
        { serviceId: serviceB.id, deliveryType: 'IN_PERSON', isActive: true, useCustomAvailability: false },
      ],
    });

    const [a30, a45, a60, b60] = await Promise.all([
      prisma.serviceDurationOption.create({ data: { serviceId: serviceA.id, deliveryType: 'IN_PERSON', label: '30', labelAr: '30', durationMins: 30, price: 10_000, isDefault: true, isActive: true } }),
      prisma.serviceDurationOption.create({ data: { serviceId: serviceA.id, deliveryType: 'IN_PERSON', label: '45', labelAr: '45', durationMins: 45, price: 15_000, isDefault: false, isActive: true } }),
      prisma.serviceDurationOption.create({ data: { serviceId: serviceA.id, deliveryType: 'IN_PERSON', label: '60', labelAr: '60', durationMins: 60, price: 20_000, isDefault: false, isActive: true } }),
      prisma.serviceDurationOption.create({ data: { serviceId: serviceB.id, deliveryType: 'IN_PERSON', label: '60', labelAr: '60', durationMins: 60, price: 20_000, isDefault: true, isActive: true } }),
    ]);

    const [linkA, linkB, substituteA, substituteB] = await Promise.all([
      prisma.employeeService.create({ data: { employeeId: employeeA.id, serviceId: serviceA.id, isActive: true, useCustomPricing: false } }),
      prisma.employeeService.create({ data: { employeeId: employeeB.id, serviceId: serviceB.id, isActive: true, useCustomPricing: false } }),
      prisma.employeeService.create({ data: { employeeId: substitute.id, serviceId: serviceA.id, isActive: true, useCustomPricing: true } }),
      prisma.employeeService.create({ data: { employeeId: substitute.id, serviceId: serviceB.id, isActive: true, useCustomPricing: true } }),
    ]);
    // A same-duration owned option lets the V2 transfer choose a substitute
    // offering with a different current price while retaining the frozen price.
    const customB = await prisma.serviceDurationOption.create({
      data: {
        serviceId: serviceB.id,
        employeeServiceId: substituteB.id,
        deliveryType: 'IN_PERSON',
        label: '60 custom',
        labelAr: '60 مخصص',
        durationMins: 60,
        price: 35_000,
        isDefault: false,
        isActive: true,
      },
    });
    ids.customDurationBId = customB.id;
    void a30;
    void a45;
    void a60;
    void b60;
    void linkA;
    void linkB;
    void substituteA;

    await prisma.employeeBranch.createMany({
      data: [
        { employeeId: employeeA.id, branchId: branch.id },
        { employeeId: employeeB.id, branchId: branch.id },
        { employeeId: substitute.id, branchId: branch.id },
      ],
    });
    const businessHours = Array.from({ length: 7 }, (_, dayOfWeek) => ({
      branchId: branch.id,
      dayOfWeek,
      startTime: '08:00',
      endTime: '22:00',
      isOpen: true,
    }));
    await prisma.businessHour.createMany({ data: businessHours });
    await prisma.employeeAvailability.createMany({
      data: [employeeA.id, employeeB.id, substitute.id].flatMap((employeeId) =>
        Array.from({ length: 7 }, (_, dayOfWeek) => ({
          employeeId,
          dayOfWeek,
          startTime: '08:00',
          endTime: '22:00',
          isActive: true,
        })),
      ),
    });
    await prisma.bookingSettings.create({
      data: {
        branchId: branch.id,
        minBookingLeadMinutes: 30,
        maxAdvanceBookingDays: 90,
        bufferMinutes: 0,
        requireCancelApproval: false,
        autoRefundOnCancel: true,
      },
    });

    const [clientA, clientB] = await Promise.all([
      prisma.client.create({ data: { name: tag('client-a'), phone: phone(), email: email('client-a') } }),
      prisma.client.create({ data: { name: tag('client-b'), phone: phone(), email: email('client-b') } }),
    ]);
    ids.clientAId = clientA.id;
    ids.clientBId = clientB.id;
  });

  afterAll(async () => {
    try {
      if (!prisma) return;
      const ownedEmployees = [ids.employeeAId, ids.employeeBId, ids.substituteId].filter(Boolean);
      const ownedServices = [ids.serviceAId, ids.serviceBId].filter(Boolean);
      const del = (operation: () => Promise<unknown>) => operation().catch(() => undefined);
      await del(() => prisma.packageCreditUsage.deleteMany({ where: { bookingId: { in: ids.bookingIds } } }));
      await del(() => prisma.bookingStatusLog.deleteMany({ where: { bookingId: { in: ids.bookingIds } } }));
      await del(() => prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: ids.bookingIds } } }));
      await del(() => prisma.booking.deleteMany({ where: { id: { in: ids.bookingIds } } }));
      const invoiceIds = ids.purchaseId
        ? (await prisma.invoice.findMany({ where: { packagePurchaseId: ids.purchaseId }, select: { id: true } })).map(({ id }) => id)
        : [];
      if (invoiceIds.length > 0) {
        await del(() => prisma.paymentCollectionIdempotency.deleteMany({ where: { invoiceId: { in: invoiceIds } } }));
        await del(() => prisma.refundRequest.deleteMany({ where: { invoiceId: { in: invoiceIds } } }));
        await del(() => prisma.couponRedemption.deleteMany({ where: { invoiceId: { in: invoiceIds } } }));
        await del(() => prisma.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } }));
        await del(() => prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } }));
      }
      if (ids.purchaseId) await del(() => prisma.packagePurchase.delete({ where: { id: ids.purchaseId } }));
      if (ids.packageId) await del(() => prisma.sessionPackage.delete({ where: { id: ids.packageId } }));
      await del(() => prisma.employeeAvailability.deleteMany({ where: { employeeId: { in: ownedEmployees } } }));
      await del(() => prisma.businessHour.deleteMany({ where: { branchId: ids.branchId } }));
      await del(() => prisma.bookingSettings.deleteMany({ where: { branchId: ids.branchId } }));
      await del(() => prisma.employeeBranch.deleteMany({ where: { employeeId: { in: ownedEmployees } } }));
      await del(() => prisma.employeeServiceOption.deleteMany({ where: { durationOptionId: ids.customDurationBId } }));
      await del(() => prisma.employeeService.deleteMany({ where: { employeeId: { in: ownedEmployees } } }));
      await del(() => prisma.serviceDurationOption.deleteMany({ where: { serviceId: { in: ownedServices } } }));
      await del(() => prisma.serviceBookingConfig.deleteMany({ where: { serviceId: { in: ownedServices } } }));
      await del(() => prisma.client.deleteMany({ where: { id: { in: [ids.clientAId, ids.clientBId].filter(Boolean) } } }));
      await del(() => prisma.service.deleteMany({ where: { id: { in: ownedServices } } }));
      await del(() => prisma.serviceCategory.deleteMany({ where: { id: { in: [ids.categoryId, ids.scalesCategoryId].filter(Boolean) } } }));
      await del(() => prisma.department.deleteMany({ where: { id: ids.departmentId } }));
      await del(() => prisma.employee.deleteMany({ where: { id: { in: ownedEmployees } } }));
      await del(() => prisma.branch.deleteMany({ where: { id: ids.branchId } }));
      await del(() => prisma.user.delete({ where: { id: adminUserId } }));
    } finally {
      await app?.close();
    }
  });

  async function availableSlots(employeeId: string, serviceId: string, durationMins: number, day: number): Promise<Slot[]> {
    const response = await auth()(api().get('/api/v1/dashboard/bookings/availability')).query({
      branchId: ids.branchId,
      employeeId,
      serviceId,
      durationMins,
      deliveryType: 'IN_PERSON',
      date: daysFromNow(day).toISOString(),
    });
    expect(response.status).toBe(200);
    return response.body as Slot[];
  }

  async function createPackage() {
    const body = {
      nameAr: tag('package'),
      nameEn: `Grouped package ${suffix}`,
      modelVersion: 'GROUPED_V2',
      groups: [
        {
          key: 'ordered-a',
          label: 'Ordered A',
          serviceId: ids.serviceAId,
          employeeId: ids.employeeAId,
          sequenceMode: 'ORDERED',
          dependsOnGroupKey: null,
          sessions: [
            { key: 'a-0', position: 0, durationOptionId: ids.serviceA30Id, deliveryType: 'IN_PERSON', unitPrice: 10_000 },
            { key: 'a-1', position: 1, durationOptionId: ids.serviceA45Id, deliveryType: 'IN_PERSON', unitPrice: 15_000 },
            { key: 'a-2', position: 2, durationOptionId: ids.serviceA60Id, deliveryType: 'IN_PERSON', unitPrice: 20_000 },
            { key: 'a-3', position: 3, durationOptionId: ids.serviceA30Id, deliveryType: 'IN_PERSON', unitPrice: 10_000 },
          ],
        },
        {
          key: 'dependency-b',
          label: 'Dependency B',
          serviceId: ids.serviceBId,
          employeeId: ids.employeeBId,
          sequenceMode: 'UNORDERED',
          dependsOnGroupKey: 'ordered-a',
          sessions: [
            { key: 'b-0', position: 0, durationOptionId: ids.serviceB60Id, deliveryType: 'IN_PERSON', unitPrice: 20_000 },
            { key: 'b-1', position: 1, durationOptionId: ids.serviceB60Id, deliveryType: 'IN_PERSON', unitPrice: 20_000 },
          ],
        },
      ],
      globalDiscount: { type: 'PERCENTAGE', value: 10 },
      isActive: true,
      isPublic: true,
    };
    const response = await auth()(api().post('/api/v1/dashboard/organization/packages')).send(body);
    expect(response.status).toBe(201);
    ids.packageId = response.body.id;
    return { input: body, response };
  }

  async function listPurchases() {
    const response = await auth()(api().get(`/api/v1/dashboard/finance/clients/${ids.clientAId}/package-purchases`));
    expect(response.status).toBe(200);
    return response.body as Array<{ id: string; amountPaid: number; modelVersion: string; credits: ListedCredit[] }>;
  }

  async function book(creditId: string, slot: Slot, over: Record<string, unknown> = {}, token = adminToken) {
    const response = await auth(token)(api().post('/api/v1/dashboard/bookings/from-credit')).send({
      clientId: ids.clientAId,
      creditId,
      branchId: ids.branchId,
      scheduledAt: slot.startTime,
      ...over,
    });
    if (response.status === 201 && response.body?.id) ids.bookingIds.push(response.body.id);
    return response;
  }

  async function lifecycle(bookingId: string, action: 'check-in' | 'complete' | 'no-show', body?: Record<string, unknown>) {
    return auth()(api().patch(`/api/v1/dashboard/bookings/${bookingId}/${action}`)).send(body ?? {});
  }

  it('creates and sells a mixed V2 package through HTTP, freezes prices, and exposes list/matching data', async () => {
    const first = await prisma.serviceDurationOption.findMany({ where: { serviceId: ids.serviceAId }, orderBy: { durationMins: 'asc' } });
    const bOption = await prisma.serviceDurationOption.findFirst({ where: { serviceId: ids.serviceBId, employeeServiceId: null } });
    ids.serviceA30Id = first.find((option) => option.durationMins === 30)!.id;
    ids.serviceA45Id = first.find((option) => option.durationMins === 45)!.id;
    ids.serviceA60Id = first.find((option) => option.durationMins === 60)!.id;
    ids.serviceB60Id = bOption!.id;

    const created = await createPackage();
    const sale = await auth()(api().post('/api/v1/dashboard/finance/package-purchases')).send({
      packageId: ids.packageId,
      clientId: ids.clientAId,
      branchId: ids.branchId,
      method: 'CASH',
      idempotencyKey: randomUUID(),
    });
    expect(sale.status).toBe(201);
    ids.purchaseId = sale.body.purchase.id;

    const purchases = await listPurchases();
    expect(purchases).toHaveLength(1);
    expect(purchases[0]).toMatchObject({ id: ids.purchaseId, modelVersion: 'GROUPED_V2', amountPaid: 85_500 });
    const credits = purchases[0].credits;
    expect(credits).toHaveLength(6);
    ids.orderedGroupId = credits.find((credit) => credit.groupLabel === 'Ordered A')!.purchaseGroupId!;
    ids.dependencyGroupId = credits.find((credit) => credit.groupLabel === 'Dependency B')!.purchaseGroupId!;
    expect(new Set(credits.map((credit) => credit.netValue))).toEqual(new Set([9_000, 13_500, 18_000]));
    expect(credits.every((credit) => credit.remaining === 1)).toBe(true);
    const snapshotOrder = [...credits]
      .sort((left, right) => {
        const groupOrder = left.purchaseGroupId === ids.orderedGroupId ? 0 : 1;
        const otherGroupOrder = right.purchaseGroupId === ids.orderedGroupId ? 0 : 1;
        return groupOrder - otherGroupOrder || (left.sessionPosition ?? 0) - (right.sessionPosition ?? 0);
      });

    // The mutable catalog price is changed after sale; immutable old credits
    // keep their original per-session snapshot and allocation.
    const changed = await auth()(api().patch(`/api/v1/dashboard/organization/packages/${ids.packageId}`)).send({
      modelVersion: 'GROUPED_V2',
      groups: (created.input.groups as Array<Record<string, unknown>>).map((group) => ({
        ...group,
        sessions: (group.sessions as Array<Record<string, unknown>>).map((session) => ({ ...session, unitPrice: 99_000 })),
      })),
      globalDiscount: { type: 'PERCENTAGE', value: 10 },
    });
    expect(changed.status).toBe(200);
    const afterEditResponse = await auth()(api().get(`/api/v1/dashboard/finance/clients/${ids.clientAId}/package-purchases`));
    expect(afterEditResponse.status).toBe(200);
    const afterEditPurchases = afterEditResponse.body as Array<{ credits: ListedCredit[] }>;
    if (!afterEditPurchases[0]) {
      const diagnostics = await Promise.all([
        prisma.packagePurchase.findUnique({
          where: { id: ids.purchaseId },
          select: {
            id: true,
            clientId: true,
            packageId: true,
            status: true,
            _count: { select: { credits: true } },
          },
        }),
        prisma.sessionPackage.findUnique({
          where: { id: ids.packageId },
          select: { id: true, modelVersion: true, isActive: true, archivedAt: true },
        }),
      ]).then(([purchaseState, packageState]) => ({ purchaseState, packageState })).catch((error: unknown) => ({
        readError: error instanceof Error ? error.message : String(error),
      }));
      throw new Error(`Post-edit package purchase disappeared from HTTP list: clientId=${ids.clientAId} purchaseId=${ids.purchaseId} updateResponse=${JSON.stringify(changed.body)} listResponse=${JSON.stringify(afterEditResponse.body)} diagnostics=${JSON.stringify(diagnostics)}`);
    }
    const afterEdit = afterEditPurchases[0];
    expect(afterEdit.credits.map((credit) => credit.netValue).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual(credits.map((credit) => credit.netValue).sort((a, b) => (a ?? 0) - (b ?? 0)));
    expect(afterEdit.credits.map((credit) => credit.unitPriceSnapshot).sort((left, right) => left - right)).toEqual([10_000, 10_000, 15_000, 20_000, 20_000, 20_000]);
    expect(snapshotOrder.map((credit) => credit.unitPriceSnapshot)).toEqual([10_000, 15_000, 20_000, 10_000, 20_000, 20_000]);

    const matching = await auth()(api().get('/api/v1/dashboard/bookings/matching-credits')).query({
      clientId: ids.clientAId,
      serviceId: ids.serviceAId,
      employeeId: ids.employeeAId,
      durationOptionId: ids.serviceA30Id,
      deliveryType: 'IN_PERSON',
    });
    expect(matching.status).toBe(200);
    expect(matching.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ modelVersion: 'GROUPED_V2', purchaseGroupId: ids.orderedGroupId, sessionPosition: 0 }),
    ]));

    const unauthenticated = await api().get('/api/v1/dashboard/bookings/matching-credits').query({
      clientId: ids.clientAId,
      serviceId: ids.serviceAId,
      employeeId: ids.employeeAId,
      durationOptionId: ids.serviceA30Id,
    });
    expect(unauthenticated.status).toBe(401);

    const wrongClient = await book(credits[0].id, (await availableSlots(ids.employeeAId, ids.serviceAId, 30, 1))[0], { clientId: ids.clientBId });
    expect(wrongClient.status).toBe(404);
  });

  it('enforces ordered/dependency gates, exact no-show return, cancellation return, and transfer snapshots through HTTP', async () => {
    const purchase = (await listPurchases())[0];
    const byPosition = (groupId: string, position: number) => purchase.credits.find((credit) => credit.purchaseGroupId === groupId && credit.sessionPosition === position)!;
    const ordered = Array.from({ length: 4 }, (_, position) => byPosition(ids.orderedGroupId, position));
    const dependent = [byPosition(ids.dependencyGroupId, 0), byPosition(ids.dependencyGroupId, 1)];

    const slot0 = (await availableSlots(ids.employeeAId, ids.serviceAId, 30, 1))[0];
    const firstBooking = await book(ordered[0].id, slot0);
    expect(firstBooking.status).toBe(201);
    let credit = await prisma.packageCredit.findUnique({ where: { id: ordered[0].id } });
    expect(credit).toMatchObject({ reservedQuantity: 1, usedQuantity: 0 });

    const blockedBeforeCompletion = await book(ordered[1].id, (await availableSlots(ids.employeeAId, ids.serviceAId, 45, 2))[0]);
    expect(blockedBeforeCompletion.status).toBe(400);
    expect((await lifecycle(firstBooking.body.id, 'check-in')).status).toBe(200);
    credit = await prisma.packageCredit.findUnique({ where: { id: ordered[0].id } });
    expect(credit).toMatchObject({ reservedQuantity: 0, usedQuantity: 1 });
    expect((await book(ordered[1].id, (await availableSlots(ids.employeeAId, ids.serviceAId, 45, 2))[0])).status).toBe(400);
    expect((await lifecycle(firstBooking.body.id, 'complete')).status).toBe(200);

    const secondBooking = await book(ordered[1].id, (await availableSlots(ids.employeeAId, ids.serviceAId, 45, 2))[0]);
    expect(secondBooking.status).toBe(201);
    expect((await book(ordered[2].id, (await availableSlots(ids.employeeAId, ids.serviceAId, 60, 3))[0])).status).toBe(400);
    expect((await lifecycle(secondBooking.body.id, 'check-in')).status).toBe(200);
    expect((await lifecycle(secondBooking.body.id, 'complete')).status).toBe(200);

    const thirdBooking = await book(ordered[2].id, (await availableSlots(ids.employeeAId, ids.serviceAId, 60, 3))[0]);
    expect(thirdBooking.status).toBe(201);
    const noShowResponse = await lifecycle(thirdBooking.body.id, 'no-show');
    if (noShowResponse.status !== 200) {
      const diagnostics = await Promise.all([
        prisma.booking.findUnique({
          where: { id: thirdBooking.body.id },
          select: { id: true, status: true, checkedInAt: true, noShowAt: true, cancelledAt: true, packageCreditId: true },
        }),
        prisma.packageCreditUsage.findMany({
          where: { bookingId: thirdBooking.body.id },
          select: { id: true, creditId: true, status: true, deliveredAt: true, returnedAt: true },
        }),
      ]).then(([bookingState, usageState]) => ({ bookingState, usageState })).catch((error: unknown) => ({
        readError: error instanceof Error ? error.message : String(error),
      }));
      throw new Error(`No-show HTTP transition failed: response=${JSON.stringify({ status: noShowResponse.status, body: noShowResponse.body })} diagnostics=${JSON.stringify(diagnostics)}`);
    }
    expect(noShowResponse.status).toBe(200);
    const noShowUsage = await prisma.packageCreditUsage.findFirst({ where: { bookingId: thirdBooking.body.id } });
    expect(noShowUsage).toMatchObject({ creditId: ordered[2].id, status: 'RETURNED' });
    expect((await prisma.packageCredit.findUnique({ where: { id: ordered[2].id } }))!.reservedQuantity).toBe(0);
    expect((await book(ordered[3].id, (await availableSlots(ids.employeeAId, ids.serviceAId, 30, 4))[0])).status).toBe(400);

    const rebookedThird = await book(ordered[2].id, (await availableSlots(ids.employeeAId, ids.serviceAId, 60, 5))[0]);
    expect(rebookedThird.status).toBe(201);
    expect((await lifecycle(rebookedThird.body.id, 'check-in')).status).toBe(200);
    expect((await lifecycle(rebookedThird.body.id, 'complete')).status).toBe(200);

    // The dependent UNORDERED group remains blocked until every ordered
    // session is delivered.
    const dependencyBlockedSlot = (await availableSlots(ids.employeeBId, ids.serviceBId, 60, 7))[0];
    expect((await book(dependent[0].id, dependencyBlockedSlot)).status).toBe(400);

    const fourthBooking = await book(ordered[3].id, (await availableSlots(ids.employeeAId, ids.serviceAId, 30, 6))[0]);
    expect(fourthBooking.status).toBe(201);
    expect((await lifecycle(fourthBooking.body.id, 'complete')).status).toBe(200);

    // The dependent group now opens and either session is selectable. Transfer
    // its first credit before booking and retain the purchase's frozen net amount.
    const beforeTransfer = await prisma.packageCredit.findUnique({ where: { id: dependent[0].id } });
    const sourceSlot = (await availableSlots(ids.employeeBId, ids.serviceBId, 60, 7))[0];
    const transferRequest = auth()(api().post(`/api/v1/dashboard/bookings/credits/${dependent[0].id}/transfer`)).send({
      toEmployeeId: ids.substituteId,
      targetDurationOptionId: ids.customDurationBId,
      reason: 'Practitioner unavailable',
    });
    const [racedTransfer, racedBooking] = await Promise.all([
      transferRequest,
      book(dependent[0].id, sourceSlot),
    ]);
    expect([201, 400, 409]).toContain(racedTransfer.status);
    expect([201, 400, 404, 409]).toContain(racedBooking.status);
    const raceCredit = await prisma.packageCredit.findUnique({ where: { id: dependent[0].id } });
    expect(raceCredit?.employeeId).toBe(
      racedTransfer.status === 201 ? ids.substituteId : ids.employeeBId,
    );
    expect(raceCredit?.reservedQuantity).toBe(racedBooking.status === 201 ? 1 : 0);

    // The booking/transfer race must leave one coherent owner. After a
    // booking winner is cancelled, transfer is still allowed because the
    // grouped credit is unreserved again; this also verifies the normal
    // unreserved-transfer path against the same frozen net value.
    if (racedBooking.status === 201) {
      const racedBookingRow = await prisma.booking.findUnique({ where: { id: racedBooking.body.id } });
      expect(racedBookingRow?.employeeId).toBe(raceCredit?.employeeId);
      const cancelledRace = await auth()(api().patch(`/api/v1/dashboard/bookings/${racedBooking.body.id}/cancel`)).send({ reason: 'CLIENT_REQUESTED' });
      expect(cancelledRace.status).toBe(200);
    }
    const transfer = racedTransfer.status === 201
      ? racedTransfer
      : await auth()(api().post(`/api/v1/dashboard/bookings/credits/${dependent[0].id}/transfer`)).send({
        toEmployeeId: ids.substituteId,
        targetDurationOptionId: ids.customDurationBId,
        reason: 'Practitioner unavailable',
      });
    expect(transfer.status).toBe(201);
    const transferred = await prisma.packageCredit.findUnique({ where: { id: dependent[0].id } });
    expect(transferred?.employeeId).toBe(ids.substituteId);
    expect(Number(transferred?.netValue)).toBe(Number(beforeTransfer?.netValue));

    const transferredSlot = (await availableSlots(ids.substituteId, ids.serviceBId, 60, 7))[0];
    const transferredBooking = await book(dependent[0].id, transferredSlot, {
      serviceId: ids.serviceBId,
      employeeId: ids.substituteId,
      durationOptionId: ids.customDurationBId,
    });
    expect(transferredBooking.status).toBe(201);
    expect(transferredBooking.body.employeeId).toBe(ids.substituteId);
    const persistedTransferredBooking = await prisma.booking.findUnique({ where: { id: transferredBooking.body.id } });
    expect(persistedTransferredBooking).toMatchObject({ employeeId: ids.substituteId, employeeNameSnapshot: expect.stringContaining('substitute') });
    expect(persistedTransferredBooking!.endsAt.getTime() - persistedTransferredBooking!.scheduledAt.getTime()).toBe(60 * 60_000);

    const cancelled = await auth()(api().patch(`/api/v1/dashboard/bookings/${transferredBooking.body.id}/cancel`)).send({ reason: 'CLIENT_REQUESTED' });
    expect(cancelled.status).toBe(200);
    const cancelUsage = await prisma.packageCreditUsage.findFirst({ where: { bookingId: transferredBooking.body.id } });
    expect(cancelUsage).toMatchObject({ creditId: dependent[0].id, status: 'RETURNED' });
    expect(await prisma.packageCredit.findUnique({ where: { id: dependent[0].id }, select: { reservedQuantity: true, usedQuantity: true } })).toEqual({ reservedQuantity: 0, usedQuantity: 0 });
  });

  it('serializes two actual HTTP reservations on one final credit without overdraw', async () => {
    const purchase = (await listPurchases())[0];
    const credit = purchase.credits.find((candidate) => candidate.purchaseGroupId === ids.dependencyGroupId && candidate.sessionPosition === 1)!;
    const slots = await availableSlots(ids.employeeBId, ids.serviceBId, 60, 8);
    expect(slots.length).toBeGreaterThanOrEqual(2);
    const [left, right] = [slots[0], slots[slots.length - 1]];

    const [first, second] = await Promise.all([
      book(credit.id, left),
      book(credit.id, right),
    ]);
    const responses = [first, second];
    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
    expect(responses.filter((response) => response.status !== 201)).toHaveLength(1);
    expect([400, 404, 409]).toContain(responses.find((response) => response.status !== 201)!.status);

    const persisted = await prisma.packageCredit.findUnique({ where: { id: credit.id } });
    expect(persisted).toMatchObject({ totalQuantity: 1, usedQuantity: 0, reservedQuantity: 1 });
    expect(await prisma.packageCreditUsage.count({ where: { creditId: credit.id, status: 'RESERVED' } })).toBe(1);
  });
});
