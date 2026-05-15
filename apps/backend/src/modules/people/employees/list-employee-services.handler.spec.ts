import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { ListEmployeeServicesHandler } from './list-employee-services.handler';

describe('ListEmployeeServicesHandler', () => {
  let handler: ListEmployeeServicesHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListEmployeeServicesHandler,
        { provide: PrismaService, useValue: {
          employee: { findFirst: jest.fn() },
          employeeService: { findMany: jest.fn() },
          service: { findMany: jest.fn() },
        } },
      ],
    }).compile();

    handler = module.get<ListEmployeeServicesHandler>(ListEmployeeServicesHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should return empty when no links', async () => {
    (prisma.employee.findFirst as jest.Mock).mockResolvedValue({ id: 'emp' });
    (prisma.employeeService.findMany as jest.Mock).mockResolvedValue([]);
    const result = await handler.execute({ employeeId: 'emp' });
    expect(result).toEqual([]);
  });

  it('should list services', async () => {
    (prisma.employee.findFirst as jest.Mock).mockResolvedValue({ id: 'emp' });
    (prisma.employeeService.findMany as jest.Mock).mockResolvedValue([{ id: 'l1', serviceId: 's1', employeeId: 'emp' }]);
    (prisma.service.findMany as jest.Mock).mockResolvedValue([{ id: 's1', name: 'Test' }]);
    const result = await handler.execute({ employeeId: 'emp' });
    expect(result[0].service).toBeDefined();
  });

  it('should throw when employee not found', async () => {
    (prisma.employee.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({ employeeId: 'emp' })).rejects.toThrow();
  });
});
