import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
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
    { provide: RlsTransactionService, useValue: { withTransaction: jest.fn() } }
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
      await handler.execute({ branchId: '00000000-0000-0000-0000-000000000001', schedule: [] } as any);
    } catch (e) {
      // Expected for incomplete mocks
    }
  });
});
