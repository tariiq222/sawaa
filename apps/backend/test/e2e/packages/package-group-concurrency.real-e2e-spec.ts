/** Real-DB V2 concurrency cases. Skipped unless REAL_E2E_DATABASE_URL is set. */
import { randomUUID } from 'node:crypto';
import { PackageCreditUsageStatus } from '@prisma/client';
import { createRealE2eApp } from '../../helpers/create-real-e2e-app';
import { PrismaService } from '../../../src/infrastructure/database';
import { CheckInBookingHandler } from '../../../src/modules/bookings/check-in-booking/check-in-booking.handler';
import { NoShowBookingHandler } from '../../../src/modules/bookings/no-show-booking/no-show-booking.handler';
import { TransferCreditHandler } from '../../../src/modules/bookings/transfer-credit/transfer-credit.handler';
import { assertPackageSessionBookable } from '../../../src/modules/bookings/package-credit-availability.helper';
import { returnPackageCreditForBooking } from '../../../src/modules/bookings/package-credit-return.helper';

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;

describeRealE2e('grouped package concurrency (real DB)', () => {
  jest.setTimeout(60_000);
  let app: Awaited<ReturnType<typeof createRealE2eApp>>['app'];
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createRealE2eApp());
  });

  afterAll(async () => {
    await app?.close();
  });

  async function seed(options: { withBooking?: boolean; withRouting?: boolean } = {}) {
    const ids = {
      purchaseId: randomUUID(), packageId: randomUUID(), clientId: randomUUID(), branchId: randomUUID(),
      serviceId: randomUUID(), groupId: randomUUID(), predecessorId: randomUUID(), childId: randomUUID(),
      bookingId: randomUUID(), secondBookingId: randomUUID(), fromEmployeeId: randomUUID(), toEmployeeId: randomUUID(),
      durationOptionId: randomUUID(), targetDurationOptionId: randomUUID(), targetLinkId: randomUUID(),
    };
    await prisma.packagePurchase.create({
      data: { id: ids.purchaseId, packageId: ids.packageId, clientId: ids.clientId, branchId: ids.branchId, modelVersion: 'GROUPED_V2', status: 'ACTIVE', subtotalSnapshot: 20_000, discountSnapshot: 0, amountPaid: 20_000, paidAt: new Date() },
    });
    await prisma.packagePurchaseGroup.create({ data: { id: ids.groupId, purchaseId: ids.purchaseId, key: 'ordered', label: 'Ordered', serviceId: ids.serviceId, employeeId: ids.fromEmployeeId, sequenceMode: 'ORDERED' } });
    await prisma.packageCredit.createMany({ data: [
      { id: ids.predecessorId, purchaseId: ids.purchaseId, purchaseGroupId: ids.groupId, sessionPosition: 0, serviceId: ids.serviceId, employeeId: ids.fromEmployeeId, durationOptionId: ids.durationOptionId, durationMinsSnapshot: 60, deliveryTypeSnapshot: 'IN_PERSON', serviceNameSnapshot: 'Service', employeeNameSnapshot: 'Practitioner', listPriceSnapshot: 10_000, unitPriceSnapshot: 10_000, netValue: 10_000, totalQuantity: 1 },
      { id: ids.childId, purchaseId: ids.purchaseId, purchaseGroupId: ids.groupId, sessionPosition: 1, serviceId: ids.serviceId, employeeId: ids.fromEmployeeId, durationOptionId: ids.durationOptionId, durationMinsSnapshot: 60, deliveryTypeSnapshot: 'IN_PERSON', serviceNameSnapshot: 'Service', employeeNameSnapshot: 'Practitioner', listPriceSnapshot: 10_000, unitPriceSnapshot: 10_000, netValue: 10_000, totalQuantity: 1 },
    ] });
    if (options.withRouting) {
      await prisma.service.create({ data: { id: ids.serviceId, nameAr: 'Concurrency service', durationMins: 60, price: 10_000 } });
      await prisma.employee.createMany({ data: [
        { id: ids.fromEmployeeId, name: 'From practitioner', isActive: true },
        { id: ids.toEmployeeId, name: 'To practitioner', isActive: true },
      ] });
      await prisma.employeeService.create({ data: { id: randomUUID(), employeeId: ids.fromEmployeeId, serviceId: ids.serviceId, isActive: true, useCustomPricing: false } });
      await prisma.employeeService.create({ data: { id: ids.targetLinkId, employeeId: ids.toEmployeeId, serviceId: ids.serviceId, isActive: true, useCustomPricing: true } });
      await prisma.serviceDurationOption.create({ data: { id: ids.durationOptionId, serviceId: ids.serviceId, deliveryType: 'IN_PERSON', label: '60', labelAr: '60', durationMins: 60, price: 10_000, isDefault: true, isActive: true } });
      await prisma.serviceDurationOption.create({ data: { id: ids.targetDurationOptionId, serviceId: ids.serviceId, employeeServiceId: ids.targetLinkId, deliveryType: 'IN_PERSON', label: 'Target 60', labelAr: 'Target 60', durationMins: 60, price: 20_000, isDefault: false, isActive: true } });
      for (const [dimension, targetId] of [
        ['SERVICE', ids.serviceId],
        ['PRACTITIONER', ids.fromEmployeeId],
        ['DURATION', ids.durationOptionId],
      ] as const) {
        await prisma.packageCreditConstraint.create({
          data: {
            id: randomUUID(), creditId: ids.predecessorId, dimension, mode: 'INCLUDE',
            targets: { create: [{ targetId }] },
          },
        });
      }
    }
    if (options.withBooking) {
      await prisma.booking.create({ data: {
        id: ids.bookingId, branchId: ids.branchId, clientId: ids.clientId, employeeId: ids.fromEmployeeId,
        serviceId: ids.serviceId, deliveryType: 'IN_PERSON', scheduledAt: new Date(Date.now() + 86_400_000), endsAt: new Date(Date.now() + 90_000_000),
        durationMins: 60, price: 0, discountedPrice: 0, bookingNumber: Math.floor(Math.random() * 1_000_000_000),
        status: 'CONFIRMED', packageCreditId: ids.predecessorId,
      } });
      await prisma.packageCreditUsage.create({ data: { creditId: ids.predecessorId, bookingId: ids.bookingId, status: 'RESERVED' } });
      await prisma.packageCredit.update({ where: { id: ids.predecessorId }, data: { reservedQuantity: 1 } });
    }
    return ids;
  }

  async function cleanup(ids: Awaited<ReturnType<typeof seed>>) {
    await prisma.bookingStatusLog.deleteMany({ where: { bookingId: { in: [ids.bookingId, ids.secondBookingId] } } });
    await prisma.booking.deleteMany({ where: { id: { in: [ids.bookingId, ids.secondBookingId] } } });
    await prisma.packageCreditUsage.deleteMany({ where: { creditId: { in: [ids.predecessorId, ids.childId] } } });
    await prisma.packageCreditConstraint.deleteMany({ where: { creditId: { in: [ids.predecessorId, ids.childId] } } });
    await prisma.packageCredit.deleteMany({ where: { purchaseId: ids.purchaseId } });
    await prisma.packagePurchaseGroup.deleteMany({ where: { purchaseId: ids.purchaseId } });
    await prisma.packagePurchase.delete({ where: { id: ids.purchaseId } }).catch(() => undefined);
    await prisma.serviceDurationOption.deleteMany({ where: { id: { in: [ids.durationOptionId, ids.targetDurationOptionId] } } });
    await prisma.employeeService.deleteMany({ where: { serviceId: ids.serviceId } });
    await prisma.employee.deleteMany({ where: { id: { in: [ids.fromEmployeeId, ids.toEmployeeId] } } });
    await prisma.service.deleteMany({ where: { id: ids.serviceId } });
  }

  it('serializes two competing reservations on the same V2 credit', async () => {
    const ids = await seed();
    const reserve = (bookingId: string) => prisma.$transaction(async (tx) => {
      await assertPackageSessionBookable(tx, ids.predecessorId);
      await tx.packageCreditUsage.create({ data: { creditId: ids.predecessorId, bookingId, status: 'RESERVED' } });
      return tx.packageCredit.update({ where: { id: ids.predecessorId }, data: { reservedQuantity: { increment: 1 } } });
    }, { isolationLevel: 'Serializable' });
    const results = await Promise.allSettled([reserve(ids.bookingId), reserve(ids.secondBookingId)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((await prisma.packageCredit.findUnique({ where: { id: ids.predecessorId } }))?.reservedQuantity).toBe(1);
    await cleanup(ids);
  });

  it('serializes check-in against no-show on a V2 booking', async () => {
    const ids = await seed({ withBooking: true });
    const checkIn = app.get(CheckInBookingHandler);
    const noShow = app.get(NoShowBookingHandler);
    const results = await Promise.allSettled([
      checkIn.execute({ bookingId: ids.bookingId, changedBy: 'v2-race' }),
      noShow.execute({ bookingId: ids.bookingId, changedBy: 'v2-race' }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const booking = await prisma.booking.findUnique({ where: { id: ids.bookingId } });
    expect(booking?.status === 'NO_SHOW' || booking?.checkedInAt != null).toBe(true);
    await cleanup(ids);
  });

  it('serializes predecessor return against a child booking attempt', async () => {
    const ids = await seed({ withBooking: true });
    await prisma.packageCreditUsage.updateMany({ where: { bookingId: ids.bookingId }, data: { status: 'CONSUMED', consumedAt: new Date(), deliveredAt: new Date() } });
    await prisma.packageCredit.update({ where: { id: ids.predecessorId }, data: { reservedQuantity: 0, usedQuantity: 1 } });
    const returnAttempt = prisma.$transaction((tx) => returnPackageCreditForBooking(tx, ids.bookingId), { isolationLevel: 'Serializable' });
    const childAttempt = prisma.$transaction(async (tx) => {
      await assertPackageSessionBookable(tx, ids.childId);
      await tx.packageCreditUsage.create({ data: { creditId: ids.childId, bookingId: ids.secondBookingId, status: 'RESERVED' } });
      return tx.packageCredit.update({ where: { id: ids.childId }, data: { reservedQuantity: { increment: 1 } } });
    }, { isolationLevel: 'Serializable' });
    const results = await Promise.allSettled([returnAttempt, childAttempt]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    await cleanup(ids);
  });

  it('serializes transfer against a V2 booking attempt without stale routing', async () => {
    const ids = await seed({ withRouting: true });
    const transfer = app.get(TransferCreditHandler);
    const transferAttempt = transfer.execute({ creditId: ids.predecessorId, toEmployeeId: ids.toEmployeeId, reason: 'Practitioner changed', userId: 'v2-actor' });
    const bookingAttempt = prisma.$transaction(async (tx) => {
      await assertPackageSessionBookable(tx, ids.predecessorId, { serviceId: ids.serviceId, employeeId: ids.fromEmployeeId, durationOptionId: ids.durationOptionId, deliveryType: 'IN_PERSON' });
      await tx.packageCreditUsage.create({ data: { creditId: ids.predecessorId, bookingId: ids.bookingId, status: 'RESERVED' } });
      return tx.packageCredit.update({ where: { id: ids.predecessorId }, data: { reservedQuantity: { increment: 1 } } });
    }, { isolationLevel: 'Serializable' });
    const results = await Promise.allSettled([transferAttempt, bookingAttempt]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    await cleanup(ids);
  });
});
