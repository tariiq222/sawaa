import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { BUSINESS_HOURS_CACHE_PREFIX } from './business-hours.cache';
import { SetBusinessHoursHandler } from './set-business-hours.handler';

describe('SetBusinessHoursHandler', () => {
  let handler: SetBusinessHoursHandler;
  let prisma: any;
  let cache: { invalidatePrefix: jest.Mock };

  beforeEach(async () => {
    prisma = {
      branch: { findFirst: jest.fn() },
      businessHour: { upsert: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    };
    cache = { invalidatePrefix: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SetBusinessHoursHandler,
        { provide: PrismaService, useValue: prisma },
        {
          provide: RlsTransactionService,
          useValue: { withTransaction: jest.fn((cb: any) => cb(prisma)) },
        },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();

    handler = module.get<SetBusinessHoursHandler>(SetBusinessHoursHandler);
  });

  it('throws NotFoundException when the branch does not exist', async () => {
    prisma.branch.findFirst.mockResolvedValue(null);

    await expect(
      handler.execute({ branchId: 'b-1', schedule: [{ dayOfWeek: 0, startTime: '09:00', endTime: '17:00', isOpen: true }] } as never),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.businessHour.upsert).not.toHaveBeenCalled();
    expect(cache.invalidatePrefix).not.toHaveBeenCalled();
  });

  it('rejects out-of-range dayOfWeek before touching the DB', async () => {
    prisma.branch.findFirst.mockResolvedValue({ id: 'b-1' });

    await expect(
      handler.execute({
        branchId: 'b-1',
        schedule: [{ dayOfWeek: 7, startTime: '09:00', endTime: '17:00', isOpen: true }],
      } as never),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.businessHour.upsert).not.toHaveBeenCalled();
  });

  it('rejects negative dayOfWeek', async () => {
    prisma.branch.findFirst.mockResolvedValue({ id: 'b-1' });

    await expect(
      handler.execute({
        branchId: 'b-1',
        schedule: [{ dayOfWeek: -1, startTime: '09:00', endTime: '17:00', isOpen: true }],
      } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('upserts each slot by (branchId, dayOfWeek) within an RLS transaction', async () => {
    prisma.branch.findFirst.mockResolvedValue({ id: 'b-1' });

    await handler.execute({
      branchId: 'b-1',
      schedule: [
        { dayOfWeek: 0, startTime: '09:00', endTime: '17:00', isOpen: true },
        { dayOfWeek: 1, startTime: '10:00', endTime: '18:00', isOpen: true },
      ],
    } as never);

    expect(prisma.businessHour.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.businessHour.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { branchId_dayOfWeek: { branchId: 'b-1', dayOfWeek: 0 } },
        create: expect.objectContaining({ startTime: '09:00', endTime: '17:00', isOpen: true }),
      }),
    );
  });

  it('invalidates the business-hours cache prefix scoped by branch', async () => {
    prisma.branch.findFirst.mockResolvedValue({ id: 'b-1' });

    await handler.execute({
      branchId: 'b-1',
      schedule: [{ dayOfWeek: 0, startTime: '09:00', endTime: '17:00', isOpen: true }],
    } as never);

    expect(cache.invalidatePrefix).toHaveBeenCalledWith(`${BUSINESS_HOURS_CACHE_PREFIX}b-1`);
  });
});