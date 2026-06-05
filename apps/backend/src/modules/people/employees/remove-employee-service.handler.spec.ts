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
    employeeService: { findUnique: jest.fn(), delete: jest.fn() },
    employeeServiceOption: { deleteMany: jest.fn() },
    $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
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

  it('removes orphan EmployeeServiceOption rows in the same transaction as the link', async () => {
    (prisma.employeeService.findUnique as jest.Mock).mockResolvedValue({ id: 'link-1' });
    await handler.execute({ employeeId: 'e1', serviceId: 's1' });

    expect((prisma.employeeServiceOption.deleteMany as jest.Mock)).toHaveBeenCalledWith({
      where: { employeeServiceId: 'link-1' },
    });
    expect((prisma.$transaction as jest.Mock)).toHaveBeenCalledTimes(1);
  });
});
