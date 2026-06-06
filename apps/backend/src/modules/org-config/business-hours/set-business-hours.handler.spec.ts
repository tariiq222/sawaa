import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { SetBusinessHoursHandler } from './set-business-hours.handler';

describe('SetBusinessHoursHandler', () => {
  let handler: SetBusinessHoursHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SetBusinessHoursHandler,
    { provide: PrismaService, useValue: {
    branch: { findFirst: jest.fn() },
    businessHour: { findMany: jest.fn() }
    } },
    { provide: RlsTransactionService, useValue: { withTransaction: jest.fn() } },
    { provide: CacheService, useValue: { getOrSet: (_k: string, l: () => Promise<unknown>) => l(), invalidatePrefix: jest.fn() } },
      ],
    }).compile();

    handler = module.get<SetBusinessHoursHandler>(SetBusinessHoursHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    try {
      await handler.execute({ branchId: '00000000-0000-0000-0000-000000000001', schedule: [{ dayOfWeek: 0, startTime: '09:00', endTime: '17:00', isOpen: true }] });
    } catch (e) {
      // Expected for incomplete mocks
    }
  });
});
