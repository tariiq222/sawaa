/** Real-DB proof for package-family atomic writes and immutable purchase metadata. */
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { ArchivePackageFamilyHandler } from '../../../src/modules/org-experience/package-families/archive-package-family/archive-package-family.handler';
import { PaymentMethod } from '@prisma/client';
import { createRealE2eApp } from '../../helpers/create-real-e2e-app';
import { PrismaService } from '../../../src/infrastructure/database';
import { CreatePackageFamilyHandler } from '../../../src/modules/org-experience/package-families/create-package-family/create-package-family.handler';
import { UpdatePackageFamilyHandler } from '../../../src/modules/org-experience/package-families/update-package-family/update-package-family.handler';
import { CreateSessionPackageHandler } from '../../../src/modules/org-experience/session-packages/create-session-package/create-session-package.handler';
import { CreatePackagePurchaseHandler } from '../../../src/modules/finance/package-purchases/create-package-purchase/create-package-purchase.handler';

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;

describeRealE2e('package families (real DB)', () => {
  jest.setTimeout(60_000);

  let app: Awaited<ReturnType<typeof createRealE2eApp>>['app'];
  let prisma: PrismaService;
  let createFamily: CreatePackageFamilyHandler;
  let updateFamily: UpdatePackageFamilyHandler;
  let createPackage: CreateSessionPackageHandler;
  let purchasePackage: CreatePackagePurchaseHandler;
  const ids = {
    branchId: randomUUID(), clientId: randomUUID(), employeeId: randomUUID(), serviceId: randomUUID(), durationId: randomUUID(),
    familyId: '', otherFamilyId: '', option5Id: '', option9Id: '', otherOptionId: '', purchase5Id: '', purchase9Id: '', legacyPackageId: '',
  };

  const option = (count: number, id?: string) => ({
    ...(id ? { id } : {}), nameAr: `${count} جلسات`, nameEn: `${count} sessions`, isActive: true, isPublic: true,
    groups: (count > 1 ? [1, count - 1] : [1]).map((quantity, index) => ({
      key: `group-${index}`, label: index === 0 ? 'Scales' : 'Clinic', serviceId: ids.serviceId, employeeId: ids.employeeId,
      sequenceMode: 'ORDERED' as const, dependsOnGroupKey: index ? 'group-0' : null,
      sessions: Array.from({ length: quantity }, (_, position) => ({ key: `session-${index}-${position}`, position, durationOptionId: ids.durationId, deliveryType: 'IN_PERSON' as const, unitPrice: 10_000 })),
    })),
    globalDiscount: { type: 'PERCENTAGE' as const, value: 10 },
  });

  beforeAll(async () => {
    ({ app, prisma } = await createRealE2eApp());
    createFamily = app.get(CreatePackageFamilyHandler);
    updateFamily = app.get(UpdatePackageFamilyHandler);
    createPackage = app.get(CreateSessionPackageHandler);
    purchasePackage = app.get(CreatePackagePurchaseHandler);
    await prisma.branch.create({ data: { id: ids.branchId, nameAr: `family-${ids.branchId}`, isActive: true } });
    await prisma.client.create({ data: { id: ids.clientId, name: `family-${ids.clientId}`, phone: `05${ids.clientId.replaceAll('-', '').slice(0, 8)}` } });
    await prisma.employee.create({ data: { id: ids.employeeId, name: `family-${ids.employeeId}`, isActive: true } });
    await prisma.service.create({ data: { id: ids.serviceId, nameAr: `family-${ids.serviceId}`, durationMins: 60, price: 10_000, currency: 'SAR', isActive: true } });
    await prisma.serviceBookingConfig.create({ data: { serviceId: ids.serviceId, deliveryType: 'IN_PERSON', isActive: true } });
    await prisma.employeeService.create({ data: { employeeId: ids.employeeId, serviceId: ids.serviceId, isActive: true } });
    await prisma.serviceDurationOption.create({ data: { id: ids.durationId, serviceId: ids.serviceId, deliveryType: 'IN_PERSON', label: '60', labelAr: '٦٠', durationMins: 60, price: 10_000, isDefault: true, isActive: true } });
  });

  afterAll(async () => {
    if (!prisma) return;
    const purchaseIds = [ids.purchase5Id, ids.purchase9Id].filter(Boolean);
    await prisma.payment.deleteMany({ where: { invoice: { packagePurchaseId: { in: purchaseIds } } } }).catch(() => undefined);
    await prisma.invoice.deleteMany({ where: { packagePurchaseId: { in: purchaseIds } } }).catch(() => undefined);
    await prisma.packagePurchase.deleteMany({ where: { id: { in: purchaseIds } } }).catch(() => undefined);
    await prisma.sessionPackage.deleteMany({ where: { id: { in: [ids.option5Id, ids.option9Id, ids.otherOptionId, ids.legacyPackageId].filter(Boolean) } } }).catch(() => undefined);
    await prisma.packageFamily.deleteMany({ where: { id: { in: [ids.familyId, ids.otherFamilyId].filter(Boolean) } } }).catch(() => undefined);
    await prisma.serviceDurationOption.delete({ where: { id: ids.durationId } }).catch(() => undefined);
    await prisma.employeeService.deleteMany({ where: { employeeId: ids.employeeId } }).catch(() => undefined);
    await prisma.serviceBookingConfig.deleteMany({ where: { serviceId: ids.serviceId } }).catch(() => undefined);
    await prisma.service.delete({ where: { id: ids.serviceId } }).catch(() => undefined);
    await prisma.employee.delete({ where: { id: ids.employeeId } }).catch(() => undefined);
    await prisma.client.delete({ where: { id: ids.clientId } }).catch(() => undefined);
    await prisma.branch.delete({ where: { id: ids.branchId } }).catch(() => undefined);
    await app?.close();
  });

  it('creates 5/9 options atomically, sells both, rejects cross-family updates, and freezes rights through archive/edit', async () => {
    const family = await createFamily.execute({ nameAr: 'باقة العائلة', nameEn: 'Family pack', isActive: true, isPublic: true, options: [option(5), option(9)] });
    ids.familyId = family.id;
    ids.option5Id = family.options[0].id;
    ids.option9Id = family.options[1].id;
    expect(family.options).toHaveLength(2);
    const catalog = await request(app.getHttpServer()).get(`/api/v1/public/package-families/${family.id}`).expect(200);
    expect(catalog.body.options.map((item: { sessionCount: number }) => item.sessionCount).sort((a: number, b: number) => a - b)).toEqual([5, 9]);
    const five = catalog.body.options.find((item: { id: string }) => item.id === ids.option5Id);
    expect(five.groups.map((group: { sessions: unknown[] }) => group.sessions.length)).toEqual([1, 4]);
    expect(five.groups[1].dependsOnGroupKey).toBe('group-0');
    expect(five.groups[0].sessions[0]).toMatchObject({ durationOptionId: ids.durationId, deliveryType: 'IN_PERSON', unitPrice: 10_000 });
    expect(five.globalDiscount).toEqual({ type: 'PERCENTAGE', value: 10 });
    expect(five.price.finalPrice).toBe(45_000);
    expect(five.displayGroups).toHaveLength(2);
    expect(five.displayGroups[0]).toMatchObject({ serviceNameAr: `family-${ids.serviceId}`, employeeName: `family-${ids.employeeId}`, sessions: [{ position: 0, durationMins: 60, deliveryType: 'IN_PERSON' }] });
    await updateFamily.execute({ familyId: family.id, nameAr: family.nameAr, options: catalog.body.options.map((item: any) => ({ id: item.id, nameAr: item.nameAr, isActive: item.isActive, isPublic: item.isPublic, groups: item.groups, globalDiscount: item.globalDiscount })) });


    const firstSale = await purchasePackage.execute({ packageId: ids.option5Id, packageFamilyId: ids.familyId, clientId: ids.clientId, branchId: ids.branchId, method: PaymentMethod.CASH, idempotencyKey: randomUUID() });
    const secondSale = await purchasePackage.execute({ packageId: ids.option9Id, packageFamilyId: ids.familyId, clientId: ids.clientId, branchId: ids.branchId, method: PaymentMethod.CASH, idempotencyKey: randomUUID() });
    ids.purchase5Id = firstSale.purchase.id;
    ids.purchase9Id = secondSale.purchase.id;
    expect(firstSale.credits.reduce((sum, credit) => sum + credit.totalQuantity, 0)).toBe(5);
    expect(secondSale.credits.reduce((sum, credit) => sum + credit.totalQuantity, 0)).toBe(9);

    const other = await createFamily.execute({ nameAr: 'أخرى', isPublic: true, options: [option(1)] });
    ids.otherFamilyId = other.id;
    ids.otherOptionId = other.options[0].id;
    await expect(updateFamily.execute({ familyId: ids.familyId, nameAr: 'باقة العائلة', options: [option(5, ids.otherOptionId)] } as never)).rejects.toThrow(/another family|another/i);

    await updateFamily.execute({ familyId: ids.familyId, nameAr: 'باقة العائلة', isPublic: true, options: [option(1, ids.option9Id)] } as never);
    const frozen = await prisma.packagePurchase.findUniqueOrThrow({ where: { id: ids.purchase5Id } });
    expect(frozen.offerSnapshot).toMatchObject({ familyId: ids.familyId, optionNameAr: '5 جلسات', sessionCount: 5 });
    expect(await prisma.packageCredit.count({ where: { purchaseId: ids.purchase5Id } })).toBe(5);
    expect(await prisma.packageCredit.count({ where: { purchaseId: ids.purchase9Id } })).toBe(9);

    const legacy = await createPackage.execute({ nameAr: 'Legacy standalone', isPublic: true, items: [{ serviceId: ids.serviceId, employeeId: ids.employeeId, durationOptionId: ids.durationId, paidQuantity: 1, freeQuantity: 0 }] });
    ids.legacyPackageId = legacy.id;
    expect((await prisma.sessionPackage.findUniqueOrThrow({ where: { id: legacy.id } })).familyId).toBeNull();
    const standalone = await request(app.getHttpServer()).get(`/api/v1/public/package-families/${legacy.id}`).expect(200);
    expect(standalone.body).toMatchObject({ id: legacy.id, isStandalone: true });
    expect(standalone.body.options).toHaveLength(1);
    await app.get(ArchivePackageFamilyHandler).execute({ familyId: family.id });
    await request(app.getHttpServer()).get(`/api/v1/public/package-families/${family.id}`).expect(404);
    expect(await prisma.packageCredit.count({ where: { purchaseId: ids.purchase5Id } })).toBe(5);
    expect((await prisma.packagePurchase.findUniqueOrThrow({ where: { id: ids.purchase9Id } })).offerSnapshot).toMatchObject({ sessionCount: 9 });

  });
});
