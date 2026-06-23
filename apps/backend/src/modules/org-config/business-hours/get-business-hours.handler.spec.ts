import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { BUSINESS_HOURS_CACHE_PREFIX } from './business-hours.cache';
import { GetBusinessHoursHandler } from './get-business-hours.handler';

describe('GetBusinessHoursHandler', () => {
  let handler: GetBusinessHoursHandler;
  let prisma: { branch: { findFirst: jest.Mock }; businessHour: { findMany: jest.Mock } };
  let cache: { getOrSet: jest.Mock };

  beforeEach(async () => {
    prisma = {
      branch: { findFirst: jest.fn() },
      businessHour: { findMany: jest.fn() },
    };
    cache = { getOrSet: jest.fn((_k: string, l: () => Promise<unknown>) => l()) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetBusinessHoursHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();

    handler = module.get<GetBusinessHoursHandler>(GetBusinessHoursHandler);
  });

  it('throws NotFoundException when the branch does not exist (and bypasses cache)', async () => {
    prisma.branch.findFirst.mockResolvedValue(null);

    await expect(handler.execute({ branchId: 'b-1' })).rejects.toThrow(NotFoundException);
    expect(cache.getOrSet).not.toHaveBeenCalled();
  });

  it('looks the branch up uncached (existence must always be fresh)', async () => {
    prisma.branch.findFirst.mockResolvedValue({ id: 'b-1' });

    await handler.execute({ branchId: 'b-1' });

    expect(prisma.branch.findFirst).toHaveBeenCalledWith({ where: { id: 'b-1' } });
  });

  it('caches the hours payload under the branch-keyed prefix', async () => {
    prisma.branch.findFirst.mockResolvedValue({ id: 'b-1' });
    prisma.businessHour.findMany.mockResolvedValue([]);

    await handler.execute({ branchId: 'b-1' });

    expect(cache.getOrSet).toHaveBeenCalledWith(
      `${BUSINESS_HOURS_CACHE_PREFIX}b-1`,
      expect.any(Function),
    );
    expect(prisma.businessHour.findMany).toHaveBeenCalledWith({
      where: { branchId: 'b-1' },
      orderBy: { dayOfWeek: 'asc' },
    });
  });
});