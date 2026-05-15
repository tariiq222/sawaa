import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { ListHolidaysHandler } from './list-holidays.handler';

describe('ListHolidaysHandler', () => {
  let handler: ListHolidaysHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListHolidaysHandler,
        { provide: PrismaService, useValue: {
    branch: { findFirst: jest.fn() },
    holiday: { findMany: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<ListHolidaysHandler>(ListHolidaysHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    (prisma.branch.findFirst as jest.Mock).mockResolvedValue({ id: 'test' });
    await handler.execute({branchId:"00000000-0000-0000-0000-000000000001",year:"test"});
    
    (prisma.branch.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({branchId:"00000000-0000-0000-0000-000000000001",year:"test"})).rejects.toThrow();
  });
});
