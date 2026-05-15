import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { GetBusinessHoursHandler } from './get-business-hours.handler';

describe('GetBusinessHoursHandler', () => {
  let handler: GetBusinessHoursHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetBusinessHoursHandler,
        { provide: PrismaService, useValue: {
    branch: { findFirst: jest.fn() },
    businessHour: { findMany: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<GetBusinessHoursHandler>(GetBusinessHoursHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    (prisma.branch.findFirst as jest.Mock).mockResolvedValue({ id: 'test' });
    await handler.execute({branchId:"00000000-0000-0000-0000-000000000001"});
    
    (prisma.branch.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({branchId:"00000000-0000-0000-0000-000000000001"})).rejects.toThrow();
  });
});
