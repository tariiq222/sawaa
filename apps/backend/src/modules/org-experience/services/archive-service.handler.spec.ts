import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { ArchiveServiceHandler } from './archive-service.handler';

const serviceId = '00000000-0000-0000-0000-000000000001';
const mockService = { id: serviceId, isHidden: false, category: null, durationOptions: [] };
type PackageReferenceModel = 'sessionPackageItem' | 'packagePurchaseGroup' | 'packageCredit';
const packageReferenceCases = [
  ['legacy package item service id', 'sessionPackageItem'],
  ['purchased package group service id', 'packagePurchaseGroup'],
  ['purchased credit legacy service id', 'packageCredit'],
] as const satisfies readonly (readonly [string, PackageReferenceModel])[];

const buildPrisma = () => ({
  service: {
    findFirst: jest.fn().mockResolvedValue(mockService),
    update: jest.fn().mockResolvedValue(mockService),
    delete: jest.fn().mockResolvedValue(mockService),
  },
  booking: {
    count: jest.fn().mockResolvedValue(0),
  },
  employeeService: {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  serviceDurationOption: {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  sessionPackageGroup: { findFirst: jest.fn().mockResolvedValue(null) },
  sessionPackageItem: { findFirst: jest.fn().mockResolvedValue(null) },
  sessionPackageItemConstraintTarget: { findFirst: jest.fn().mockResolvedValue(null) },
  packagePurchaseGroup: { findFirst: jest.fn().mockResolvedValue(null) },
  packageCredit: { findFirst: jest.fn().mockResolvedValue(null) },
  packageCreditConstraintTarget: { findFirst: jest.fn().mockResolvedValue(null) },
  packagePurchase: { findMany: jest.fn().mockResolvedValue([]) },
});

const buildRlsTransaction = (prisma: ReturnType<typeof buildPrisma>) => ({
  withTransaction: jest.fn((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
});

describe('ArchiveServiceHandler', () => {
  let handler: ArchiveServiceHandler;
  let prisma: ReturnType<typeof buildPrisma>;
  let rlsTransaction: ReturnType<typeof buildRlsTransaction>;

  beforeEach(async () => {
    prisma = buildPrisma();
    rlsTransaction = buildRlsTransaction(prisma);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArchiveServiceHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: RlsTransactionService, useValue: rlsTransaction },
        { provide: CacheService, useValue: { getOrSet: (_k: string, l: () => Promise<unknown>) => l(), invalidatePrefix: jest.fn() } },
      ],
    }).compile();

    handler = module.get<ArchiveServiceHandler>(ArchiveServiceHandler);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('hard deletes service in an RLS transaction when it has no bookings', async () => {
    const result = await handler.execute({ serviceId });

    expect(prisma.service.findFirst).toHaveBeenCalledWith({
      where: { id: serviceId, archivedAt: null },
      select: {
        id: true,
        isHidden: true,
        category: { select: { bookingMode: true } },
        durationOptions: { select: { id: true } },
      },
    });
    expect(prisma.booking.count).toHaveBeenCalledWith({ where: { serviceId } });
    expect(rlsTransaction.withTransaction).toHaveBeenCalledTimes(1);
    expect(prisma.employeeService.deleteMany).toHaveBeenCalledWith({ where: { serviceId } });
    expect(prisma.serviceDurationOption.deleteMany).toHaveBeenCalledWith({ where: { serviceId } });
    expect(prisma.service.delete).toHaveBeenCalledWith({ where: { id: serviceId } });
    expect(prisma.service.update).not.toHaveBeenCalled();
    expect(result).toEqual(mockService);
  });

  it('blocks deletion of an internal DIRECT clinic service even without bookings', async () => {
    prisma.service.findFirst.mockResolvedValue({
      ...mockService,
      isHidden: true,
      category: { bookingMode: 'DIRECT' },
    });

    const deletion = handler.execute({ serviceId });
    await expect(deletion).rejects.toThrow(ConflictException);
    await expect(deletion).rejects.toMatchObject({
      response: { code: 'DIRECT_CLINIC_SERVICE_CANNOT_BE_DELETED' },
    });
    expect(prisma.booking.count).not.toHaveBeenCalled();
    expect(prisma.service.delete).not.toHaveBeenCalled();
    expect(prisma.service.update).not.toHaveBeenCalled();
  });

  it('blocks deletion of an internal DIRECT clinic service with bookings', async () => {
    prisma.service.findFirst.mockResolvedValue({
      ...mockService,
      isHidden: true,
      category: { bookingMode: 'DIRECT' },
    });
    prisma.booking.count.mockResolvedValue(2);

    await expect(handler.execute({ serviceId })).rejects.toThrow(ConflictException);
    expect(prisma.service.delete).not.toHaveBeenCalled();
    expect(prisma.service.update).not.toHaveBeenCalled();
  });

  it('blocks deletion when a package definition references the service, with no bookings', async () => {
    prisma.sessionPackageGroup.findFirst.mockResolvedValue({ id: 'package-group-1' });

    await expect(handler.execute({ serviceId })).rejects.toMatchObject({ response: { code: 'SERVICE_REFERENCED_BY_PACKAGE' } });
    expect(prisma.booking.count).not.toHaveBeenCalled();
    expect(prisma.service.delete).not.toHaveBeenCalled();
    expect(prisma.service.update).not.toHaveBeenCalled();
  });

  it.each(packageReferenceCases)('blocks deletion for %s with no bookings', async (_label, model) => {
    prisma[model].findFirst.mockResolvedValue({ id: 'package-reference-1' });

    await expect(handler.execute({ serviceId })).rejects.toMatchObject({ response: { code: 'SERVICE_REFERENCED_BY_PACKAGE' } });
    expect(prisma.booking.count).not.toHaveBeenCalled();
    expect(prisma.service.delete).not.toHaveBeenCalled();
    expect(prisma.service.update).not.toHaveBeenCalled();
  });

  it('blocks deletion when purchased package credit constrains service, with no bookings', async () => {
    prisma.packageCreditConstraintTarget.findFirst.mockResolvedValue({ id: 'credit-target-1' });

    await expect(handler.execute({ serviceId })).rejects.toMatchObject({ response: { code: 'SERVICE_REFERENCED_BY_PACKAGE' } });
    expect(prisma.booking.count).not.toHaveBeenCalled();
    expect(prisma.service.delete).not.toHaveBeenCalled();
  });

  it('blocks deletion when a pending purchase snapshot references the service', async () => {
    prisma.packagePurchase.findMany.mockResolvedValue([{
      id: 'pending-purchase-1',
      creditSnapshot: [{
        serviceId,
        durationOptionId: null,
        constraints: [{ dimension: 'SERVICE', targets: [{ targetId: serviceId }] }],
      }],
      offerSnapshot: null,
    }]);

    await expect(handler.execute({ serviceId })).rejects.toMatchObject({ response: { code: 'SERVICE_REFERENCED_BY_PACKAGE' } });
    expect(prisma.booking.count).not.toHaveBeenCalled();
    expect(prisma.service.delete).not.toHaveBeenCalled();
  });

  it('blocks deletion when an option used by a package is owned by the service', async () => {
    prisma.service.findFirst.mockResolvedValue({
      ...mockService,
      durationOptions: [{ id: 'duration-option-1' }],
    });
    prisma.sessionPackageItem.findFirst.mockResolvedValue({ id: 'package-item-1' });

    await expect(handler.execute({ serviceId })).rejects.toMatchObject({ response: { code: 'SERVICE_REFERENCED_BY_PACKAGE' } });
    expect(prisma.booking.count).not.toHaveBeenCalled();
    expect(prisma.service.delete).not.toHaveBeenCalled();
  });

  it('does not treat an ordinary hidden service as an internal clinic service', async () => {
    prisma.service.findFirst.mockResolvedValue({ ...mockService, isHidden: true, category: { bookingMode: 'SERVICES' } });

    await expect(handler.execute({ serviceId })).resolves.toEqual(mockService);
    expect(prisma.service.delete).toHaveBeenCalledWith({ where: { id: serviceId } });
  });

  it('archives service when it has bookings', async () => {
    prisma.booking.count.mockResolvedValue(1);

    const result = await handler.execute({ serviceId });

    expect(prisma.booking.count).toHaveBeenCalledWith({ where: { serviceId } });
    expect(prisma.service.update).toHaveBeenCalledWith({
      where: { id: serviceId },
      data: { archivedAt: expect.any(Date), isActive: false },
    });
    expect(rlsTransaction.withTransaction).not.toHaveBeenCalled();
    expect(prisma.employeeService.deleteMany).not.toHaveBeenCalled();
    expect(prisma.serviceDurationOption.deleteMany).not.toHaveBeenCalled();
    expect(prisma.service.delete).not.toHaveBeenCalled();
    expect(result).toEqual(mockService);
  });

  it('throws NotFoundException when service is missing', async () => {
    prisma.service.findFirst.mockResolvedValue(null);

    await expect(handler.execute({ serviceId })).rejects.toThrow(NotFoundException);
    expect(prisma.booking.count).not.toHaveBeenCalled();
    expect(rlsTransaction.withTransaction).not.toHaveBeenCalled();
    expect(prisma.service.update).not.toHaveBeenCalled();
    expect(prisma.service.delete).not.toHaveBeenCalled();
  });
});
