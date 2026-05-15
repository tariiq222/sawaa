import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { GetAvailabilityHandler } from './get-availability.handler';

describe('GetAvailabilityHandler', () => {
  let handler: GetAvailabilityHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetAvailabilityHandler,
        { provide: PrismaService, useValue: {
    employee: { findFirst: jest.fn() },
    employeeAvailability: { findMany: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<GetAvailabilityHandler>(GetAvailabilityHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute successfully', async () => {
    (prisma.employee.findFirst as jest.Mock).mockResolvedValue({ id: 'test-id' });
    const result = await handler.execute({employeeId:"00000000-0000-0000-0000-000000000001"});
    expect(result).toBeDefined();
    
    (prisma.employee.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({employeeId:"00000000-0000-0000-0000-000000000001"})).rejects.toThrow();
  });
});
