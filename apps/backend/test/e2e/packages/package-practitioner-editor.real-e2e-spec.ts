/**
 * Real-DB evidence for package practitioner ownership snapshots.
 *
 * The test is skipped unless REAL_E2E_DATABASE_URL points at the dedicated
 * test database. It deliberately calls the catalog, purchase, and booking
 * handlers so a template edit is checked against the persisted credit snapshot.
 */
import { randomUUID } from 'node:crypto';
import { PaymentMethod, PackageConstraintDimension, PackageConstraintMode } from '@prisma/client';
import { CreateSessionPackageHandler } from '../../../src/modules/org-experience/session-packages/create-session-package/create-session-package.handler';
import { UpdateSessionPackageHandler } from '../../../src/modules/org-experience/session-packages/update-session-package/update-session-package.handler';
import { CreatePackagePurchaseHandler } from '../../../src/modules/finance/package-purchases/create-package-purchase/create-package-purchase.handler';
import { BookFromCreditHandler } from '../../../src/modules/bookings/book-from-credit/book-from-credit.handler';
import { GetBookingSettingsHandler } from '../../../src/modules/bookings/get-booking-settings/get-booking-settings.handler';
import { PrismaService, RlsTransactionService } from '../../../src/infrastructure/database';
import { createRealE2eApp } from '../../helpers/create-real-e2e-app';

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;

describeRealE2e('package practitioner editor — real DB', () => {
  jest.setTimeout(60_000);

  let app: Awaited<ReturnType<typeof createRealE2eApp>>['app'];
  let prisma: PrismaService;
  let createPackage: CreateSessionPackageHandler;
  let updatePackage: UpdateSessionPackageHandler;
  let purchasePackage: CreatePackagePurchaseHandler;
  let bookFromCredit: BookFromCreditHandler;
  const ids = {
    branchId: randomUUID(),
    clientId: randomUUID(),
    ownerAId: randomUUID(),
    ownerBId: randomUUID(),
    serviceId: randomUUID(),
    ownerBServiceLinkId: randomUUID(),
    durationOptionId: randomUUID(),
    foreignDurationOptionId: randomUUID(),
    packageId: '',
    purchaseId: '',
    bookingId: '',
  };

  beforeAll(async () => {
    ({ app, prisma } = await createRealE2eApp());
    createPackage = app.get(CreateSessionPackageHandler);
    updatePackage = app.get(UpdateSessionPackageHandler);
    purchasePackage = app.get(CreatePackagePurchaseHandler);
    // Availability is covered by the existing booking real-DB suite. Keeping
    // this snapshot test on the handler's target gate avoids mutable schedule
    // fixtures obscuring the package-credit assertions.
    bookFromCredit = new BookFromCreditHandler(
      prisma,
      app.get(RlsTransactionService),
      app.get(GetBookingSettingsHandler),
    );

    await prisma.branch.create({ data: { id: ids.branchId, nameAr: `phase3-${ids.branchId}`, isActive: true } });
    await prisma.client.create({ data: { id: ids.clientId, name: `phase3-${ids.clientId}`, phone: `05${ids.clientId.replace(/-/g, '').slice(0, 8)}` } });
    await prisma.employee.createMany({
      data: [
        { id: ids.ownerAId, name: `phase3-${ids.ownerAId}`, isActive: true },
        { id: ids.ownerBId, name: `phase3-${ids.ownerBId}`, isActive: true },
      ],
    });
    await prisma.service.create({
      data: {
        id: ids.serviceId,
        nameAr: `phase3-${ids.serviceId}`,
        durationMins: 60,
        price: 20_000,
        currency: 'SAR',
        isActive: true,
      },
    });
    await prisma.serviceBookingConfig.create({
      data: { serviceId: ids.serviceId, deliveryType: 'IN_PERSON', isActive: true },
    });
    await prisma.employeeService.createMany({
      data: [
        { employeeId: ids.ownerAId, serviceId: ids.serviceId, isActive: true },
        {
          id: ids.ownerBServiceLinkId,
          employeeId: ids.ownerBId,
          serviceId: ids.serviceId,
          isActive: true,
          useCustomPricing: true,
        },
      ],
    });
    await prisma.serviceDurationOption.createMany({
      data: [
        {
          id: ids.durationOptionId,
          serviceId: ids.serviceId,
          deliveryType: 'IN_PERSON',
          label: '60 min',
          labelAr: '٦٠ دقيقة',
          durationMins: 60,
          price: 20_000,
          isDefault: true,
          isActive: true,
        },
        {
          id: ids.foreignDurationOptionId,
          serviceId: ids.serviceId,
          employeeServiceId: ids.ownerBServiceLinkId,
          deliveryType: 'IN_PERSON',
          label: 'B custom 60 min',
          labelAr: '٦٠ دقيقة مخصصة لب',
          durationMins: 60,
          price: 22_000,
          isDefault: false,
          isActive: true,
        },
      ],
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    if (ids.bookingId) {
      await prisma.packageCreditUsage.deleteMany({ where: { bookingId: ids.bookingId } });
    }
    if (ids.bookingId) await prisma.booking.delete({ where: { id: ids.bookingId } }).catch(() => undefined);
    if (ids.purchaseId) await prisma.packagePurchase.delete({ where: { id: ids.purchaseId } }).catch(() => undefined);
    if (ids.packageId) await prisma.sessionPackage.delete({ where: { id: ids.packageId } }).catch(() => undefined);
    await prisma.serviceBookingConfig.deleteMany({ where: { serviceId: ids.serviceId } });
    await prisma.serviceDurationOption.deleteMany({ where: { id: { in: [ids.durationOptionId, ids.foreignDurationOptionId] } } });
    await prisma.employeeService.deleteMany({ where: { employeeId: { in: [ids.ownerAId, ids.ownerBId] } } });
    await prisma.service.delete({ where: { id: ids.serviceId } }).catch(() => undefined);
    await prisma.client.delete({ where: { id: ids.clientId } }).catch(() => undefined);
    await prisma.employee.deleteMany({ where: { id: { in: [ids.ownerAId, ids.ownerBId] } } });
    await prisma.branch.delete({ where: { id: ids.branchId } }).catch(() => undefined);
    await app?.close();
  });

  it('preserves sold owner A constraints/net value after template owner changes to B', async () => {
    const created = await createPackage.execute({
      ownerEmployeeId: ids.ownerAId,
      nameAr: `phase3-${ids.packageId || randomUUID()}`,
      items: [
        {
          serviceId: ids.serviceId,
          employeeId: ids.ownerAId,
          durationOptionId: ids.durationOptionId,
          paidQuantity: 2,
          freeQuantity: 0,
          sortOrder: 0,
        },
        {
          constraints: [
            { dimension: PackageConstraintDimension.SERVICE, mode: PackageConstraintMode.ANY },
            { dimension: PackageConstraintDimension.PRACTITIONER, mode: PackageConstraintMode.ANY },
            { dimension: PackageConstraintDimension.DURATION, mode: PackageConstraintMode.ANY },
            { dimension: PackageConstraintDimension.DELIVERY_TYPE, mode: PackageConstraintMode.ANY },
          ],
          unitPrice: 15_000,
          paidQuantity: 2,
          freeQuantity: 0,
          sortOrder: 1,
        },
      ],
    });
    ids.packageId = created.id;

    const sale = await purchasePackage.execute({
      packageId: ids.packageId,
      clientId: ids.clientId,
      branchId: ids.branchId,
      method: PaymentMethod.CASH,
      idempotencyKey: randomUUID(),
    });
    ids.purchaseId = sale.purchase.id;
    const soldCredits = await prisma.packageCredit.findMany({
      where: { purchaseId: ids.purchaseId },
      include: { constraints: { include: { targets: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const beforeCredit = soldCredits.find((credit) => credit.durationOptionId === ids.durationOptionId);
    const flexibleCredit = soldCredits.find((credit) => credit.durationOptionId === null);
    expect(beforeCredit).toBeDefined();
    expect(flexibleCredit).toBeDefined();
    if (!beforeCredit || !flexibleCredit) throw new Error('Expected fixed and flexible package credits');

    await updatePackage.execute({
      packageId: ids.packageId,
      ownerEmployeeId: ids.ownerBId,
      items: [{
        serviceId: ids.serviceId,
        employeeId: ids.ownerBId,
        durationOptionId: ids.foreignDurationOptionId,
        paidQuantity: 2,
        freeQuantity: 0,
        sortOrder: 0,
      }, {
        constraints: [
          { dimension: PackageConstraintDimension.SERVICE, mode: PackageConstraintMode.ANY },
          { dimension: PackageConstraintDimension.PRACTITIONER, mode: PackageConstraintMode.ANY },
          { dimension: PackageConstraintDimension.DURATION, mode: PackageConstraintMode.ANY },
          { dimension: PackageConstraintDimension.DELIVERY_TYPE, mode: PackageConstraintMode.ANY },
        ],
        unitPrice: 15_000,
        paidQuantity: 2,
        freeQuantity: 0,
        sortOrder: 1,
      }],
    });

    const afterCredit = await prisma.packageCredit.findUniqueOrThrow({
      where: { id: beforeCredit.id },
      include: { constraints: { include: { targets: true } } },
    });
    expect(afterCredit.constraints).toEqual(beforeCredit.constraints);
    expect(afterCredit.netValue?.toString()).toBe(beforeCredit.netValue?.toString());
    expect(afterCredit.constraints).toEqual(expect.arrayContaining([
      expect.objectContaining({
        dimension: PackageConstraintDimension.PRACTITIONER,
        mode: PackageConstraintMode.INCLUDE,
        targets: [expect.objectContaining({ targetId: ids.ownerAId })],
      }),
    ]));

    const fixedSnapshotBeforeInvalid = {
      reservedQuantity: beforeCredit.reservedQuantity,
      usedQuantity: beforeCredit.usedQuantity,
      usageCount: await prisma.packageCreditUsage.count({ where: { creditId: beforeCredit.id } }),
      bookingCount: await prisma.booking.count({ where: { packageCreditId: beforeCredit.id } }),
    };
    const fixedInvalidTarget = {
      creditId: beforeCredit.id,
      clientId: ids.clientId,
      branchId: ids.branchId,
      serviceId: ids.serviceId,
      employeeId: ids.ownerBId,
      durationOptionId: ids.foreignDurationOptionId,
      scheduledAt: new Date(Date.now() + 3 * 86_400_000),
    };
    await expect(bookFromCredit.execute(fixedInvalidTarget)).rejects.toThrow(
      'The selected credit is not valid for this booking',
    );
    const afterFixedInvalid = await prisma.packageCredit.findUniqueOrThrow({ where: { id: beforeCredit.id } });
    expect(afterFixedInvalid.reservedQuantity).toBe(fixedSnapshotBeforeInvalid.reservedQuantity);
    expect(afterFixedInvalid.usedQuantity).toBe(fixedSnapshotBeforeInvalid.usedQuantity);
    expect(await prisma.packageCreditUsage.count({ where: { creditId: beforeCredit.id } })).toBe(fixedSnapshotBeforeInvalid.usageCount);
    expect(await prisma.booking.count({ where: { packageCreditId: beforeCredit.id } })).toBe(fixedSnapshotBeforeInvalid.bookingCount);

    const flexibleSnapshotBeforeInvalid = {
      reservedQuantity: flexibleCredit.reservedQuantity,
      usedQuantity: flexibleCredit.usedQuantity,
      usageCount: await prisma.packageCreditUsage.count({ where: { creditId: flexibleCredit.id } }),
      bookingCount: await prisma.booking.count({ where: { packageCreditId: flexibleCredit.id } }),
    };
    await expect(bookFromCredit.execute({
      creditId: flexibleCredit.id,
      clientId: ids.clientId,
      branchId: ids.branchId,
      serviceId: ids.serviceId,
      employeeId: ids.ownerAId,
      durationOptionId: ids.foreignDurationOptionId,
      scheduledAt: new Date(Date.now() + 4 * 86_400_000),
    })).rejects.toThrow('Selected duration option is not offered by this practitioner');
    await expect(bookFromCredit.execute({
      creditId: flexibleCredit.id,
      clientId: ids.clientId,
      branchId: ids.branchId,
      serviceId: ids.serviceId,
      employeeId: ids.ownerAId,
      durationOptionId: ids.durationOptionId,
      deliveryType: 'ONLINE',
      scheduledAt: new Date(Date.now() + 5 * 86_400_000),
    })).rejects.toThrow('Duration option delivery type (IN_PERSON) does not match requested delivery type (ONLINE)');

    const afterInvalid = await prisma.packageCredit.findUniqueOrThrow({ where: { id: flexibleCredit.id } });
    expect(afterInvalid.reservedQuantity).toBe(flexibleSnapshotBeforeInvalid.reservedQuantity);
    expect(afterInvalid.usedQuantity).toBe(flexibleSnapshotBeforeInvalid.usedQuantity);
    expect(await prisma.packageCreditUsage.count({ where: { creditId: flexibleCredit.id } })).toBe(flexibleSnapshotBeforeInvalid.usageCount);
    expect(await prisma.booking.count({ where: { packageCreditId: flexibleCredit.id } })).toBe(flexibleSnapshotBeforeInvalid.bookingCount);

    const booked = await bookFromCredit.execute({
      creditId: flexibleCredit.id,
      clientId: ids.clientId,
      branchId: ids.branchId,
      serviceId: ids.serviceId,
      employeeId: ids.ownerAId,
      durationOptionId: ids.durationOptionId,
      scheduledAt: new Date(Date.now() + 6 * 86_400_000),
    });
    ids.bookingId = booked.id;
    expect(booked.price.toString()).toBe('0');
    expect(booked.deliveryType).toBe('IN_PERSON');
    const afterValidBooking = await prisma.packageCredit.findUniqueOrThrow({ where: { id: flexibleCredit.id } });
    expect(afterValidBooking.reservedQuantity).toBe(flexibleSnapshotBeforeInvalid.reservedQuantity + 1);
  });
});
