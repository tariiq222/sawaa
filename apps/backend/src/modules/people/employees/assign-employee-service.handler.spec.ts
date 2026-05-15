import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { AssignEmployeeServiceHandler } from './assign-employee-service.handler';

describe('AssignEmployeeServiceHandler', () => {
  let handler: AssignEmployeeServiceHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignEmployeeServiceHandler,
        { provide: PrismaService, useValue: {
    employee: { findFirst: jest.fn() },
    employeeService: { findUnique: jest.fn(), create: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<AssignEmployeeServiceHandler>(AssignEmployeeServiceHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    (prisma.employee.findFirst as jest.Mock).mockResolvedValue({ id: 'test' });
    await handler.execute({employeeId:"00000000-0000-0000-0000-000000000001",serviceId:"00000000-0000-0000-0000-000000000001"});
    
    (prisma.employee.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({employeeId:"00000000-0000-0000-0000-000000000001",serviceId:"00000000-0000-0000-0000-000000000001"})).rejects.toThrow();
  });
});
