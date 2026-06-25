import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { ArchiveServiceHandler } from './archive-service.handler';

const serviceId = '00000000-0000-0000-0000-000000000001';
const mockService = { id: serviceId };

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
    });
    expect(prisma.booking.count).toHaveBeenCalledWith({ where: { serviceId } });
    expect(rlsTransaction.withTransaction).toHaveBeenCalledTimes(1);
    expect(prisma.employeeService.deleteMany).toHaveBeenCalledWith({ where: { serviceId } });
    expect(prisma.service.delete).toHaveBeenCalledWith({ where: { id: serviceId } });
    expect(prisma.service.update).not.toHaveBeenCalled();
    expect(result).toEqual(mockService);
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
