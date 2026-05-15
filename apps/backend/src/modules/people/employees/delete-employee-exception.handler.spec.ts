import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { DeleteEmployeeExceptionHandler } from './delete-employee-exception.handler';

describe('DeleteEmployeeExceptionHandler', () => {
  let handler: DeleteEmployeeExceptionHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteEmployeeExceptionHandler,
        { provide: PrismaService, useValue: {
    employeeAvailabilityException: { findFirst: jest.fn(), delete: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<DeleteEmployeeExceptionHandler>(DeleteEmployeeExceptionHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    (prisma.employeeAvailabilityException.findFirst as jest.Mock).mockResolvedValue({ id: 'test' });
    await handler.execute({exceptionId:"00000000-0000-0000-0000-000000000001",employeeId:"00000000-0000-0000-0000-000000000001"});
    
    (prisma.employeeAvailabilityException.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({exceptionId:"00000000-0000-0000-0000-000000000001",employeeId:"00000000-0000-0000-0000-000000000001"})).rejects.toThrow();
  });
});
