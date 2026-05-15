import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { RemoveHolidayHandler } from './remove-holiday.handler';

describe('RemoveHolidayHandler', () => {
  let handler: RemoveHolidayHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemoveHolidayHandler,
        { provide: PrismaService, useValue: {
    holiday: { findFirst: jest.fn(), delete: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<RemoveHolidayHandler>(RemoveHolidayHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute successfully', async () => {
    (prisma.holiday.findFirst as jest.Mock).mockResolvedValue({ id: 'test-id' });
    const result = await handler.execute({holidayId:"00000000-0000-0000-0000-000000000001"});
    expect(result).toBeDefined();
    
    (prisma.holiday.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({holidayId:"00000000-0000-0000-0000-000000000001"})).rejects.toThrow();
  });
});
