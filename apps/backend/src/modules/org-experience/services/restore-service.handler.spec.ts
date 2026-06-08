import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { RestoreServiceHandler } from './restore-service.handler';

const serviceId = '00000000-0000-0000-0000-000000000001';
const archivedService = { id: serviceId, archivedAt: new Date('2026-06-01T00:00:00.000Z') };
const restoredService = { id: serviceId, archivedAt: null };

const buildPrisma = () => ({
  service: {
    findUnique: jest.fn().mockResolvedValue(archivedService),
    update: jest.fn().mockResolvedValue(restoredService),
  },
});

describe('RestoreServiceHandler', () => {
  let handler: RestoreServiceHandler;
  let prisma: ReturnType<typeof buildPrisma>;
  let cache: { invalidatePrefix: jest.Mock };

  beforeEach(async () => {
    prisma = buildPrisma();
    cache = { invalidatePrefix: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RestoreServiceHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();

    handler = module.get<RestoreServiceHandler>(RestoreServiceHandler);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('restores an archived service (archivedAt → null) and invalidates cache', async () => {
    const result = await handler.execute({ serviceId });

    expect(prisma.service.findUnique).toHaveBeenCalledWith({ where: { id: serviceId } });
    expect(prisma.service.update).toHaveBeenCalledWith({
      where: { id: serviceId },
      data: { archivedAt: null },
      include: {
        category: true,
        durationOptions: { orderBy: { sortOrder: 'asc' } },
      },
    });
    expect(cache.invalidatePrefix).toHaveBeenCalledTimes(1);
    expect(result).toEqual(restoredService);
  });

  it('throws NotFoundException when service is missing', async () => {
    prisma.service.findUnique.mockResolvedValue(null);

    await expect(handler.execute({ serviceId })).rejects.toThrow(NotFoundException);
    expect(prisma.service.update).not.toHaveBeenCalled();
    expect(cache.invalidatePrefix).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when service is not archived', async () => {
    prisma.service.findUnique.mockResolvedValue({ id: serviceId, archivedAt: null });

    await expect(handler.execute({ serviceId })).rejects.toThrow(BadRequestException);
    expect(prisma.service.update).not.toHaveBeenCalled();
    expect(cache.invalidatePrefix).not.toHaveBeenCalled();
  });
});
