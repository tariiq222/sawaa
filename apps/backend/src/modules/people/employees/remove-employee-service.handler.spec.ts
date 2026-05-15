import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { RemoveEmployeeServiceHandler } from './remove-employee-service.handler';

describe('RemoveEmployeeServiceHandler', () => {
  let handler: RemoveEmployeeServiceHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemoveEmployeeServiceHandler,
        { provide: PrismaService, useValue: {
    employeeService: { findUnique: jest.fn(), delete: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<RemoveEmployeeServiceHandler>(RemoveEmployeeServiceHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    (prisma.employeeService.findUnique as jest.Mock).mockResolvedValue({ id: 'test' });
    await handler.execute({employeeId:"00000000-0000-0000-0000-000000000001",serviceId:"00000000-0000-0000-0000-000000000001"});
    
    (prisma.employeeService.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({employeeId:"00000000-0000-0000-0000-000000000001",serviceId:"00000000-0000-0000-0000-000000000001"})).rejects.toThrow();
  });
});
