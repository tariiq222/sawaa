/** Real-DB grouped credit reassignment coverage; skipped without a test-only DB. */
import { randomUUID } from 'node:crypto';
import { PackageCreditUsageStatus } from '@prisma/client';
import { createRealE2eApp } from '../../helpers/create-real-e2e-app';
import { PrismaService } from '../../../src/infrastructure/database';
import { TransferCreditHandler } from '../../../src/modules/bookings/transfer-credit/transfer-credit.handler';

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;

describeRealE2e('grouped package reassignment (real DB)', () => {
  jest.setTimeout(60_000);
  let app: Awaited<ReturnType<typeof createRealE2eApp>>['app'];
  let prisma: PrismaService;
  let transfer: TransferCreditHandler;
  const purchaseId = randomUUID();
  const packageId = randomUUID();
  const branchId = randomUUID();
  const clientId = randomUUID();
  const serviceId = randomUUID();
  const fromEmployeeId = randomUUID();
  const toEmployeeId = randomUUID();
  const fromOptionId = randomUUID();
  const toOptionId = randomUUID();
  const groupId = randomUUID();
  const creditId = randomUUID();
  const employeeServiceId = randomUUID();

  beforeAll(async () => {
    ({ app, prisma } = await createRealE2eApp());
    transfer = app.get(TransferCreditHandler);
    await prisma.service.create({ data: { id: serviceId, nameAr: 'Reassignment test service', durationMins: 60, price: 12_000 } });
    await prisma.packagePurchase.create({
      data: { id: purchaseId, packageId, clientId, branchId, modelVersion: 'GROUPED_V2', status: 'ACTIVE', subtotalSnapshot: 12_000, discountSnapshot: 0, amountPaid: 12_000, paidAt: new Date() },
    });
    await prisma.employee.createMany({ data: [
      { id: fromEmployeeId, name: `group-from-${fromEmployeeId}`, isActive: true },
      { id: toEmployeeId, name: `group-to-${toEmployeeId}`, isActive: true },
    ] });
    await prisma.employeeService.create({ data: { id: employeeServiceId, employeeId: toEmployeeId, serviceId, isActive: true, useCustomPricing: true } });
    await prisma.serviceDurationOption.createMany({ data: [
      { id: fromOptionId, serviceId, employeeServiceId: null, deliveryType: 'IN_PERSON', label: '60', labelAr: '60', durationMins: 60, price: 12_000, isActive: true },
      { id: toOptionId, serviceId, employeeServiceId, deliveryType: 'IN_PERSON', label: 'Target 60', labelAr: '٦٠', durationMins: 60, price: 20_000, isActive: true },
    ] });
    await prisma.packagePurchaseGroup.create({ data: { id: groupId, purchaseId, key: 'reassign', serviceId, employeeId: fromEmployeeId, sequenceMode: 'UNORDERED' } });
    await prisma.packageCredit.create({ data: {
      id: creditId, purchaseId, purchaseGroupId: groupId, sessionPosition: 0, serviceId,
      employeeId: fromEmployeeId, durationOptionId: fromOptionId, durationMinsSnapshot: 60,
      deliveryTypeSnapshot: 'IN_PERSON', serviceNameSnapshot: 'Service', employeeNameSnapshot: 'From',
      listPriceSnapshot: 12_000, unitPriceSnapshot: 12_000, netValue: 12_000, totalQuantity: 1,
    } });
  });

  afterAll(async () => {
    await prisma?.packageCreditUsage.deleteMany({ where: { creditId } });
    await prisma?.packageCredit.deleteMany({ where: { id: creditId } });
    await prisma?.packagePurchaseGroup.deleteMany({ where: { id: groupId } });
    await prisma?.serviceDurationOption.deleteMany({ where: { id: { in: [fromOptionId, toOptionId] } } });
    await prisma?.employeeService.deleteMany({ where: { id: employeeServiceId } });
    await prisma?.service.deleteMany({ where: { id: serviceId } });
    await prisma?.employee.deleteMany({ where: { id: { in: [fromEmployeeId, toEmployeeId] } } });
    await prisma?.packagePurchase.delete({ where: { id: purchaseId } }).catch(() => undefined);
    await app?.close();
  });

  it('transfers a remaining unreserved V2 credit to a different target option without repricing', async () => {
    await transfer.execute({ creditId, toEmployeeId, targetDurationOptionId: toOptionId, reason: 'Practitioner changed', userId: fromEmployeeId });
    const row = await prisma.packageCredit.findUnique({ where: { id: creditId }, include: { constraints: { include: { targets: true } } } });
    expect(row).toMatchObject({ employeeId: toEmployeeId, durationOptionId: toOptionId, durationMinsSnapshot: 60 });
    expect(row?.unitPriceSnapshot.toNumber()).toBe(12_000);
    expect(row?.netValue?.toNumber()).toBe(12_000);
    expect(row?.constraints.filter((constraint) => constraint.dimension === 'PRACTITIONER').flatMap((constraint) => constraint.targets.map((target) => target.targetId))).toContain(toEmployeeId);
    expect(row?.constraints.filter((constraint) => constraint.dimension === 'DURATION').flatMap((constraint) => constraint.targets.map((target) => target.targetId))).toContain(toOptionId);
  });

  it('rejects reassignment after a reserved booking, preserving the session identity', async () => {
    await prisma.packageCredit.update({ where: { id: creditId }, data: { reservedQuantity: 1 } });
    await prisma.packageCreditUsage.create({ data: { creditId, bookingId: randomUUID(), status: PackageCreditUsageStatus.RESERVED } });
    await expect(transfer.execute({ creditId, toEmployeeId: fromEmployeeId, reason: 'Second move', userId: fromEmployeeId })).rejects.toThrow('before booking');
  });
});
