/** Real-DB purchase evidence for V2 grouped snapshots. Skipped without the dedicated test URL. */
import { randomUUID } from 'node:crypto';
import { PaymentMethod } from '@prisma/client';
import { createRealE2eApp } from '../../helpers/create-real-e2e-app';
import { PrismaService } from '../../../src/infrastructure/database';
import { CreateSessionPackageHandler } from '../../../src/modules/org-experience/session-packages/create-session-package/create-session-package.handler';
import { UpdateSessionPackageHandler } from '../../../src/modules/org-experience/session-packages/update-session-package/update-session-package.handler';
import { ComputePackagePriceService } from '../../../src/modules/org-experience/compute-package-price.service';
import { CreatePackagePurchaseHandler } from '../../../src/modules/finance/package-purchases/create-package-purchase/create-package-purchase.handler';
import { InitPackagePurchaseHandler } from '../../../src/modules/finance/package-purchases/init-package-purchase/init-package-purchase.handler';
import { ActivatePackagePurchaseHandler } from '../../../src/modules/finance/package-purchases/activate-package-purchase/activate-package-purchase.handler';
import { RlsTransactionService } from '../../../src/infrastructure/database';

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;

describeRealE2e('grouped package purchase snapshots (real DB)', () => {
  jest.setTimeout(60_000);

  let app: Awaited<ReturnType<typeof createRealE2eApp>>['app'];
  let prisma: PrismaService;
  let createPackage: CreateSessionPackageHandler;
  let updatePackage: UpdateSessionPackageHandler;
  let purchasePackage: CreatePackagePurchaseHandler;
  let initPackagePurchase: InitPackagePurchaseHandler;
  let activatePackagePurchase: ActivatePackagePurchaseHandler;
  const zeroPurchaseIds: string[] = [];
  const zeroPackageIds: string[] = [];
  const zeroClientIds: string[] = [];
  let gatewayCreateCheckout: jest.Mock;
  const ids = {
    branchId: randomUUID(),
    clientId: randomUUID(),
    firstEmployeeId: randomUUID(),
    secondEmployeeId: randomUUID(),
    serviceId: randomUUID(),
    firstDurationId: randomUUID(),
    secondDurationId: randomUUID(),
    packageId: '',
    purchaseId: '',
    pendingPurchaseId: '',
  };

  beforeAll(async () => {
    ({ app, prisma } = await createRealE2eApp());
    createPackage = app.get(CreateSessionPackageHandler);
    updatePackage = app.get(UpdateSessionPackageHandler);
    purchasePackage = app.get(CreatePackagePurchaseHandler);
    gatewayCreateCheckout = jest.fn(async (_orgId: string, input: { amountHalalas: number }) => ({
      id: `checkout-${randomUUID()}`, status: 'initiated', amount: input.amountHalalas,
      currency: 'SAR', url: 'https://checkout.test/grouped-package', metadata: {},
    }));
    initPackagePurchase = new InitPackagePurchaseHandler(
      prisma,
      app.get(RlsTransactionService),
      app.get(ComputePackagePriceService),
      {
        createCheckoutInvoice: gatewayCreateCheckout,
        getCheckoutInvoice: jest.fn(),
        findCheckoutInvoiceByMetadata: jest.fn(),
      } as never,
    );
    activatePackagePurchase = app.get(ActivatePackagePurchaseHandler);
    await prisma.branch.create({ data: { id: ids.branchId, nameAr: `group-purchase-${ids.branchId}`, isActive: true } });
    await prisma.client.create({ data: { id: ids.clientId, name: `group-purchase-${ids.clientId}`, phone: `05${ids.clientId.replaceAll('-', '').slice(0, 8)}` } });
    await prisma.employee.createMany({ data: [
      { id: ids.firstEmployeeId, name: `group-purchase-${ids.firstEmployeeId}`, isActive: true },
      { id: ids.secondEmployeeId, name: `group-purchase-${ids.secondEmployeeId}`, isActive: true },
    ] });
    await prisma.service.create({ data: { id: ids.serviceId, nameAr: `group-purchase-${ids.serviceId}`, durationMins: 60, price: 10_000, currency: 'SAR', isActive: true } });
    await prisma.serviceBookingConfig.create({ data: { serviceId: ids.serviceId, deliveryType: 'IN_PERSON', isActive: true } });
    await prisma.employeeService.createMany({ data: [
      { employeeId: ids.firstEmployeeId, serviceId: ids.serviceId, isActive: true, useCustomPricing: false },
      { employeeId: ids.secondEmployeeId, serviceId: ids.serviceId, isActive: true, useCustomPricing: false },
    ] });
    await prisma.serviceDurationOption.createMany({ data: [
      { id: ids.firstDurationId, serviceId: ids.serviceId, deliveryType: 'IN_PERSON', label: '60', labelAr: '٦٠', durationMins: 60, price: 10_000, isDefault: true, isActive: true },
      { id: ids.secondDurationId, serviceId: ids.serviceId, deliveryType: 'IN_PERSON', label: '45', labelAr: '٤٥', durationMins: 45, price: 20_000, isDefault: false, isActive: true },
    ] });
  });

  afterAll(async () => {
    if (!prisma) return;
    try {
    const purchaseIds = [ids.purchaseId, ids.pendingPurchaseId, ...zeroPurchaseIds].filter(Boolean);
    await prisma.payment.deleteMany({ where: { invoice: { packagePurchaseId: { in: purchaseIds } } } });
    await prisma.invoice.deleteMany({ where: { packagePurchaseId: { in: purchaseIds } } });
    for (const purchaseId of zeroPurchaseIds) {
      await prisma.packagePurchase.delete({ where: { id: purchaseId } });
    }
    for (const packageId of zeroPackageIds) {
      await prisma.sessionPackage.delete({ where: { id: packageId } }).catch(() => undefined);
    }
    if (ids.purchaseId) await prisma.packagePurchase.delete({ where: { id: ids.purchaseId } }).catch(() => undefined);
    if (ids.pendingPurchaseId) await prisma.packagePurchase.delete({ where: { id: ids.pendingPurchaseId } }).catch(() => undefined);
    if (ids.packageId) await prisma.sessionPackage.delete({ where: { id: ids.packageId } }).catch(() => undefined);
    await prisma.serviceBookingConfig.deleteMany({ where: { serviceId: ids.serviceId } });
    await prisma.serviceDurationOption.deleteMany({ where: { id: { in: [ids.firstDurationId, ids.secondDurationId] } } });
    await prisma.employeeService.deleteMany({ where: { employeeId: { in: [ids.firstEmployeeId, ids.secondEmployeeId] } } });
    await prisma.service.delete({ where: { id: ids.serviceId } }).catch(() => undefined);
    await prisma.client.delete({ where: { id: ids.clientId } }).catch(() => undefined);
    for (const clientId of zeroClientIds) {
      await prisma.client.delete({ where: { id: clientId } }).catch(() => undefined);
    }
    await prisma.employee.deleteMany({ where: { id: { in: [ids.firstEmployeeId, ids.secondEmployeeId] } } });
    await prisma.branch.delete({ where: { id: ids.branchId } }).catch(() => undefined);
    } finally {
      await app?.close();
    }
  });

  it('freezes mixed-practitioner groups and replays the same credit fields without duplicates', async () => {
    const created = await createPackage.execute({
      nameAr: `group-purchase-${randomUUID()}`,
      modelVersion: 'GROUPED_V2',
      groups: [
        {
          key: 'first', label: 'First', serviceId: ids.serviceId, employeeId: ids.firstEmployeeId,
          sequenceMode: 'ORDERED', dependsOnGroupKey: null,
          sessions: [{ key: 'first-0', position: 0, durationOptionId: ids.firstDurationId, deliveryType: 'IN_PERSON', unitPrice: 10_000 }],
        },
        {
          key: 'second', label: 'Second', serviceId: ids.serviceId, employeeId: ids.secondEmployeeId,
          sequenceMode: 'UNORDERED', dependsOnGroupKey: 'first',
          sessions: [{ key: 'second-0', position: 0, durationOptionId: ids.secondDurationId, deliveryType: 'IN_PERSON', unitPrice: 20_000 }],
        },
      ],
      globalDiscount: { type: 'PERCENTAGE', value: 10 },
      isPublic: true,
    });
    ids.packageId = created.id;
    const command = {
      packageId: ids.packageId, clientId: ids.clientId, branchId: ids.branchId,
      method: PaymentMethod.CASH, idempotencyKey: randomUUID(),
    };
    const first = await purchasePackage.execute(command);
    ids.purchaseId = first.purchase.id;
    expect(first.paymentId).toBeTruthy();
    const groupedCredits = first.credits.map((credit) => {
      if (!('groupKey' in credit) || !('netValue' in credit)) throw new Error('Expected grouped purchase credit response');
      return credit;
    });
    expect(groupedCredits.map((credit) => `${credit.groupKey}:${credit.sessionPosition}`)).toEqual(['first:0', 'second:0']);
    expect(groupedCredits.map((credit) => credit.netValue)).toEqual([9_000, 18_000]);

    const revisedGroups = (firstPrice: number, secondPrice: number) => [
      {
        key: 'first', label: 'First', serviceId: ids.serviceId, employeeId: ids.firstEmployeeId,
        sequenceMode: 'ORDERED' as const, dependsOnGroupKey: null,
        sessions: [{ key: 'first-0', position: 0, durationOptionId: ids.firstDurationId, deliveryType: 'IN_PERSON' as const, unitPrice: firstPrice }],
      },
      {
        key: 'second', label: 'Second', serviceId: ids.serviceId, employeeId: ids.secondEmployeeId,
        sequenceMode: 'UNORDERED' as const, dependsOnGroupKey: 'first',
        sessions: [{ key: 'second-0', position: 0, durationOptionId: ids.secondDurationId, deliveryType: 'IN_PERSON' as const, unitPrice: secondPrice }],
      },
    ];
    await updatePackage.execute({ packageId: ids.packageId, groups: revisedGroups(99_000, 99_000) });
    const purchase = await prisma.packagePurchase.findUniqueOrThrow({
      where: { id: ids.purchaseId },
      include: { groups: true, credits: { include: { purchaseGroup: true } } },
    });
    expect(purchase.modelVersion).toBe('GROUPED_V2');
    expect(purchase.amountPaid.toString()).toBe('27000');
    expect(purchase.groups.map((group) => group.key)).toEqual(['first', 'second']);
    const snapshotCredits = new Map(purchase.credits.map((credit) => [
      `${credit.purchaseGroup?.key}:${credit.sessionPosition}`,
      credit.unitPriceSnapshot.toString(),
    ]));
    expect(Object.fromEntries(snapshotCredits)).toEqual({ 'first:0': '10000', 'second:0': '20000' });

    const replay = await purchasePackage.execute(command);
    expect(replay.paymentId).toBe(first.paymentId);
    expect(replay.credits).toEqual(first.credits);
    expect(await prisma.packageCredit.count({ where: { purchaseId: ids.purchaseId } })).toBe(2);

    const pending = await initPackagePurchase.execute({
      packageId: ids.packageId, branchId: ids.branchId, clientId: ids.clientId, idempotencyKey: randomUUID(),
    });
    ids.pendingPurchaseId = pending.purchaseId;
    await updatePackage.execute({ packageId: ids.packageId, groups: revisedGroups(1_000, 1_000) });
    await activatePackagePurchase.handle({ payload: {
      packagePurchaseId: pending.purchaseId, paymentId: pending.paymentId, invoiceId: pending.invoiceId,
      bookingId: null, amount: 178_200, currency: 'SAR',
    } } as never);
    const activated = await prisma.packagePurchase.findUniqueOrThrow({
      where: { id: pending.purchaseId }, include: { credits: true },
    });
    expect(activated.status).toBe('ACTIVE');
    expect(activated.credits.map((credit) => credit.unitPriceSnapshot.toString())).toEqual(['99000', '99000']);
    expect(activated.credits.map((credit) => credit.netValue?.toString())).toEqual(['89100', '89100']);
    const issuedBeforeDuplicate = await prisma.packageCredit.count({ where: { purchaseId: pending.purchaseId } });
    await activatePackagePurchase.handle({ payload: {
      packagePurchaseId: pending.purchaseId, paymentId: pending.paymentId, invoiceId: pending.invoiceId,
      bookingId: null, amount: 178_200, currency: 'SAR',
    } } as never);
    expect(await prisma.packageCredit.count({ where: { purchaseId: pending.purchaseId } })).toBe(issuedBeforeDuplicate);
  });

  it('charges net + VAT online when VAT is enabled and still activates on the gross payment', async () => {
    const vatClientId = randomUUID();
    zeroClientIds.push(vatClientId);
    await prisma.client.create({ data: { id: vatClientId, name: `group-purchase-vat-${vatClientId}`, phone: `05${vatClientId.replaceAll('-', '').slice(0, 8)}` } });
    const existing = await prisma.organizationSettings.findFirst({ orderBy: { createdAt: 'desc' } });
    const settingsId = existing
      ? (await prisma.organizationSettings.update({ where: { id: existing.id }, data: { vatRate: '0.15' } })).id
      : (await prisma.organizationSettings.create({ data: { vatRate: '0.15' } })).id;
    try {
      gatewayCreateCheckout.mockClear();
      const pending = await initPackagePurchase.execute({
        packageId: ids.packageId, branchId: ids.branchId, clientId: vatClientId, idempotencyKey: randomUUID(),
      });
      zeroPurchaseIds.push(pending.purchaseId);

      const purchase = await prisma.packagePurchase.findUniqueOrThrow({ where: { id: pending.purchaseId } });
      const net = Number(purchase.amountPaid);
      const vat = Math.round(net * 0.15);
      const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: pending.invoiceId } });
      expect(Number(invoice.vatAmt)).toBe(vat);
      expect(Number(invoice.total)).toBe(net + vat);
      expect(Number((await prisma.payment.findUniqueOrThrow({ where: { id: pending.paymentId } })).amount)).toBe(net + vat);
      expect(gatewayCreateCheckout).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ amountHalalas: net + vat }));

      await activatePackagePurchase.handle({ payload: {
        packagePurchaseId: pending.purchaseId, paymentId: pending.paymentId, invoiceId: pending.invoiceId,
        bookingId: null, amount: net + vat, currency: 'SAR',
      } } as never);
      const activated = await prisma.packagePurchase.findUniqueOrThrow({ where: { id: pending.purchaseId }, include: { credits: true } });
      expect(activated.status).toBe('ACTIVE');
      expect(activated.credits.length).toBeGreaterThan(0);
    } finally {
      if (existing) await prisma.organizationSettings.update({ where: { id: settingsId }, data: { vatRate: existing.vatRate } });
      else await prisma.organizationSettings.delete({ where: { id: settingsId } });
    }
  });

  it.each(['full-discount', 'zero-prices'])('issues zero-value rights without a fake payment: %s', async (variant) => {
    const zeroClientId = randomUUID();
    zeroClientIds.push(zeroClientId);
    await prisma.client.create({ data: { id: zeroClientId, name: `group-purchase-zero-${zeroClientId}`, phone: `05${zeroClientId.replaceAll('-', '').slice(0, 8)}` } });
    const zeroPackage = await createPackage.execute({
      nameAr: `group-purchase-zero-${randomUUID()}`,
      modelVersion: 'GROUPED_V2',
      groups: [{ key: 'zero', label: 'Zero', serviceId: ids.serviceId, employeeId: ids.firstEmployeeId,
        sequenceMode: 'ORDERED', dependsOnGroupKey: null,
        sessions: [0, 1].map((position) => ({ key: `zero-${position}`, position,
          durationOptionId: ids.firstDurationId, deliveryType: 'IN_PERSON' as const,
          unitPrice: variant === 'zero-prices' ? 0 : 10_000 })),
      }],
      globalDiscount: variant === 'full-discount' ? { type: 'PERCENTAGE', value: 100 } : { type: 'NONE', value: 0 },
      isPublic: true,
    });
    zeroPackageIds.push(zeroPackage.id);
    const command = { packageId: zeroPackage.id, clientId: zeroClientId, branchId: ids.branchId,
      method: PaymentMethod.CASH, idempotencyKey: randomUUID() };
    const result = await purchasePackage.execute(command);
    zeroPurchaseIds.push(result.purchase.id);
    expect(result.paymentId).toBeNull();
    expect(Number(result.purchase.amountPaid)).toBe(0);
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: result.invoiceId } });
    expect(invoice.status).toBe('PAID');
    expect(Number(invoice.total)).toBe(0);
    expect(invoice.issuedAt).not.toBeNull();
    expect(invoice.paidAt).not.toBeNull();
    expect(await prisma.payment.count({ where: { invoiceId: invoice.id } })).toBe(0);
    const credits = await prisma.packageCredit.findMany({ where: { purchaseId: result.purchase.id } });
    expect(credits).toHaveLength(2);
    expect(credits.every((credit) => credit.totalQuantity === 1 && Number(credit.netValue) === 0)).toBe(true);
    const replay = await purchasePackage.execute(command);
    expect(replay.purchase.id).toBe(result.purchase.id);
    expect(replay.paymentId).toBeNull();
    expect(await prisma.packageCredit.count({ where: { purchaseId: result.purchase.id } })).toBe(2);
    const pendingBefore = await prisma.packagePurchase.count({ where: { packageId: zeroPackage.id } });
    const invoicesBefore = await prisma.invoice.count({ where: { clientId: zeroClientId } });
    const gatewayCallsBefore = gatewayCreateCheckout.mock.calls.length;
    await expect(initPackagePurchase.execute({ packageId: zeroPackage.id, branchId: ids.branchId,
      clientId: zeroClientId, idempotencyKey: randomUUID() })).rejects.toThrow(/below the gateway minimum/i);
    expect(await prisma.packagePurchase.count({ where: { packageId: zeroPackage.id } })).toBe(pendingBefore);
    expect(await prisma.invoice.count({ where: { clientId: zeroClientId } })).toBe(invoicesBefore);
    expect(gatewayCreateCheckout.mock.calls.length).toBe(gatewayCallsBefore);
  });
});
