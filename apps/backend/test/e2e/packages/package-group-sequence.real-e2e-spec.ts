/**
 * Grouped package sequence contract against a migrated real database.
 *
 * The suite is skipped without REAL_E2E_DATABASE_URL. It deliberately keeps
 * the fixture small and reads PackagePurchaseGroup / PackageCreditUsage back
 * from Postgres after each lifecycle mutation; the coordinator's booking HTTP
 * flow adds the full slot and concurrent reservation coverage.
 */
import { randomUUID } from 'node:crypto';
import { PackageCreditUsageStatus } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createRealE2eApp } from '../../helpers/create-real-e2e-app';
import { PrismaService } from '../../../src/infrastructure/database';
import {
  getPackageCreditAvailability,
  PackageCreditGroupCreditState,
} from '../../../src/modules/bookings/package-credit-availability.helper';

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;

describeRealE2e('grouped package session sequence (real DB)', () => {
  jest.setTimeout(60_000);

  let app: Awaited<ReturnType<typeof createRealE2eApp>>['app'];
  let prisma: PrismaService;
  let adminToken: string;
  let adminUserId: string;
  const purchaseId = randomUUID();
  const packageId = randomUUID();
  const clientId = randomUUID();
  const branchId = randomUUID();
  const serviceId = randomUUID();
  const employeeId = randomUUID();
  const groupId = randomUUID();
  const dependencyGroupId = randomUUID();
  const creditIds = [randomUUID(), randomUUID(), randomUUID()];
  const dependencyCreditId = randomUUID();
  const bookingIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];

  beforeAll(async () => {
    ({ app, prisma } = await createRealE2eApp());
    const admin = await prisma.user.create({
      data: {
        email: `grouped-sequence-${randomUUID()}@sawaa.test`,
        name: 'Grouped sequence e2e admin',
        role: 'ADMIN',
        isSuperAdmin: true,
      },
    });
    adminUserId = admin.id;
    adminToken = app.get(JwtService).sign({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      isSuperAdmin: true,
    });
    await prisma.packagePurchase.create({
      data: {
        id: purchaseId,
        packageId,
        clientId,
        branchId,
        modelVersion: 'GROUPED_V2',
        status: 'ACTIVE',
        subtotalSnapshot: 30_000,
        discountSnapshot: 0,
        amountPaid: 30_000,
        paidAt: new Date(),
      },
    });
    await prisma.packagePurchaseGroup.createMany({
      data: [
        { id: groupId, purchaseId, key: 'ordered', label: 'Ordered', serviceId, employeeId, sequenceMode: 'ORDERED' },
        { id: dependencyGroupId, purchaseId, key: 'dependency', label: 'Dependency', serviceId, employeeId, sequenceMode: 'UNORDERED' },
      ],
    });
    await prisma.packageCredit.createMany({
      data: [
        ...creditIds.map((id, index) => ({
          id,
          purchaseId,
          purchaseGroupId: groupId,
          sessionPosition: index,
          serviceId,
          employeeId,
          durationMinsSnapshot: 60,
          deliveryTypeSnapshot: 'IN_PERSON' as const,
          serviceNameSnapshot: 'Service',
          employeeNameSnapshot: 'Practitioner',
          listPriceSnapshot: 10_000,
          unitPriceSnapshot: 10_000,
          netValue: 10_000,
          totalQuantity: 1,
        })),
        {
          id: dependencyCreditId,
          purchaseId,
          purchaseGroupId: dependencyGroupId,
          sessionPosition: 0,
          serviceId,
          employeeId,
          durationMinsSnapshot: 60,
          deliveryTypeSnapshot: 'IN_PERSON' as const,
          serviceNameSnapshot: 'Service',
          employeeNameSnapshot: 'Practitioner',
          listPriceSnapshot: 10_000,
          unitPriceSnapshot: 10_000,
          netValue: 10_000,
          totalQuantity: 1,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma?.packageCreditUsage.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await prisma?.packageCredit.deleteMany({ where: { purchaseId } });
    await prisma?.packagePurchaseGroup.deleteMany({ where: { purchaseId } });
    await prisma?.packagePurchase.delete({ where: { id: purchaseId } }).catch(() => undefined);
    if (adminUserId) await prisma?.user.delete({ where: { id: adminUserId } }).catch(() => undefined);
    await app?.close();
  });

  async function states(ids: string[]): Promise<PackageCreditGroupCreditState[]> {
    return prisma.packageCredit.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        sessionPosition: true,
        totalQuantity: true,
        usedQuantity: true,
        reservedQuantity: true,
        usages: { select: { status: true, deliveredAt: true } },
      },
      orderBy: { sessionPosition: 'asc' },
    });
  }

  it('keeps ORDERED session 2 locked after reserve/check-in and opens it on delivered completion', async () => {
    await prisma.packageCreditUsage.create({ data: { creditId: creditIds[0], bookingId: bookingIds[0], status: PackageCreditUsageStatus.RESERVED } });
    await prisma.packageCredit.update({ where: { id: creditIds[0] }, data: { reservedQuantity: 1 } });
    const beforeComplete = await states(creditIds);
    expect(getPackageCreditAvailability({
      modelVersion: 'GROUPED_V2',
      purchaseStatus: 'ACTIVE',
      totalQuantity: 1,
      usedQuantity: 0,
      reservedQuantity: 0,
      sequenceMode: 'ORDERED',
      sessionPosition: 1,
      creditId: creditIds[1],
      purchaseGroupId: groupId,
      groupCredits: beforeComplete,
    })).toEqual({ bookable: false, reason: 'PREDECESSOR_INCOMPLETE' });

    await prisma.packageCreditUsage.updateMany({ where: { bookingId: bookingIds[0] }, data: { status: PackageCreditUsageStatus.CONSUMED, consumedAt: new Date(), deliveredAt: new Date() } });
    await prisma.packageCredit.update({ where: { id: creditIds[0] }, data: { reservedQuantity: 0, usedQuantity: 1 } });
    const afterComplete = await states(creditIds);
    expect(getPackageCreditAvailability({
      modelVersion: 'GROUPED_V2', purchaseStatus: 'ACTIVE', totalQuantity: 1,
      usedQuantity: 0, reservedQuantity: 0, sequenceMode: 'ORDERED', sessionPosition: 1,
      creditId: creditIds[1], purchaseGroupId: groupId,
      groupCredits: afterComplete,
    })).toEqual({ bookable: true, reason: null });
  });

  it('allows an UNORDERED session independently and blocks a dependent group until all dependency credits deliver', async () => {
    const dependency = await states([dependencyCreditId]);
    const dependent = getPackageCreditAvailability({
      modelVersion: 'GROUPED_V2', purchaseStatus: 'ACTIVE', totalQuantity: 1,
      usedQuantity: 0, reservedQuantity: 0, sequenceMode: 'UNORDERED', sessionPosition: 0,
      creditId: 'dependent-credit', purchaseGroupId: 'dependent-group',
      groupCredits: [{ id: 'dependent-credit', sessionPosition: 0, totalQuantity: 1, usedQuantity: 0, reservedQuantity: 0, usages: [] }],
      dependsOnGroupId: dependencyGroupId, dependencyCredits: dependency,
    });
    expect(dependent).toEqual({ bookable: false, reason: 'DEPENDENCY_INCOMPLETE' });
    expect(getPackageCreditAvailability({
      modelVersion: 'GROUPED_V2', purchaseStatus: 'ACTIVE', totalQuantity: 1,
      usedQuantity: 0, reservedQuantity: 0, sequenceMode: 'UNORDERED', sessionPosition: 2,
      creditId: creditIds[2], purchaseGroupId: groupId,
      groupCredits: await states(creditIds),
    })).toEqual({ bookable: true, reason: null });
  });

  it('keeps the same session credit identity after NO_SHOW return and allows rebooking only when its own slot is free', async () => {
    await prisma.packageCreditUsage.create({ data: { creditId: creditIds[1], bookingId: bookingIds[1], status: PackageCreditUsageStatus.RETURNED, returnedAt: new Date() } });
    const row = await prisma.packageCredit.findUnique({ where: { id: creditIds[1] } });
    expect(row?.id).toBe(creditIds[1]);
    expect(getPackageCreditAvailability({
      modelVersion: 'GROUPED_V2', purchaseStatus: 'ACTIVE', totalQuantity: 1,
      usedQuantity: row!.usedQuantity, reservedQuantity: row!.reservedQuantity,
      sequenceMode: 'ORDERED', sessionPosition: 1, creditId: creditIds[1], purchaseGroupId: groupId,
      groupCredits: await states(creditIds),
    })).toEqual({ bookable: true, reason: null });
    await prisma.packageCreditUsage.create({ data: { creditId: creditIds[1], bookingId: bookingIds[2], status: PackageCreditUsageStatus.RESERVED } });
    await prisma.packageCredit.update({ where: { id: creditIds[1] }, data: { reservedQuantity: 1 } });
    const afterRebook = await states(creditIds);
    expect(getPackageCreditAvailability({
      modelVersion: 'GROUPED_V2', purchaseStatus: 'ACTIVE', totalQuantity: 1,
      usedQuantity: 0, reservedQuantity: 0, sequenceMode: 'ORDERED', sessionPosition: 2,
      creditId: creditIds[2], purchaseGroupId: groupId,
      groupCredits: afterRebook,
    })).toEqual({ bookable: false, reason: 'PREDECESSOR_INCOMPLETE' });
  });

  it('exposes grouped metadata through the existing dashboard list and matching-credit controller paths', async () => {
    const http = request(app.getHttpServer());
    const list = await http.get(`/api/v1/dashboard/finance/clients/${clientId}/package-purchases`).set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(list.body[0]).toMatchObject({ id: purchaseId, modelVersion: 'GROUPED_V2' });
    expect(list.body[0].credits[0]).toEqual(expect.objectContaining({
      purchaseGroupId: groupId,
      sequenceMode: 'ORDERED',
      availability: expect.any(Object),
    }));

    const matching = await http.get('/api/v1/dashboard/bookings/matching-credits').set('Authorization', `Bearer ${adminToken}`).query({
      clientId,
      serviceId,
      employeeId,
      durationOptionId: randomUUID(),
    });
    expect(matching.status).toBe(200);
    expect(Array.isArray(matching.body)).toBe(true);
  });
});
