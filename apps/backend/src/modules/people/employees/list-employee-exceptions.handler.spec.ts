import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { ListEmployeeExceptionsHandler } from './list-employee-exceptions.handler';

describe('ListEmployeeExceptionsHandler', () => {
  let handler: ListEmployeeExceptionsHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListEmployeeExceptionsHandler,
        { provide: PrismaService, useValue: {
    employee: { findFirst: jest.fn() },
    employeeAvailabilityException: { findMany: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<ListEmployeeExceptionsHandler>(ListEmployeeExceptionsHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    (prisma.employee.findFirst as jest.Mock).mockResolvedValue({ id: 'test' });
    await handler.execute({employeeId:"00000000-0000-0000-0000-000000000001"});
    
    (prisma.employee.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({employeeId:"00000000-0000-0000-0000-000000000001"})).rejects.toThrow();
  });
});
