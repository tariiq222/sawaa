import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { AddHolidayHandler } from './add-holiday.handler';

describe('AddHolidayHandler', () => {
  let handler: AddHolidayHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AddHolidayHandler,
        { provide: PrismaService, useValue: {
    branch: { findFirst: jest.fn() },
    holiday: { findUnique: jest.fn(), create: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<AddHolidayHandler>(AddHolidayHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    (prisma.branch.findFirst as jest.Mock).mockResolvedValue({ id: 'test' });
    await handler.execute({branchId:"00000000-0000-0000-0000-000000000001",date:"2026-05-14T13:50:08.257Z",nameAr:"Test",nameEn:"Test"});
    
    (prisma.branch.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({branchId:"00000000-0000-0000-0000-000000000001",date:"2026-05-14T13:50:08.257Z",nameAr:"Test",nameEn:"Test"})).rejects.toThrow();
  });
});
