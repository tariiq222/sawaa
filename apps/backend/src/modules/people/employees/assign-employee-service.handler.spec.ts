import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { AssignEmployeeServiceHandler } from './assign-employee-service.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('AssignEmployeeServiceHandler', () => {
  let handler: AssignEmployeeServiceHandler;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      employee: { findFirst: jest.fn() },
      service: { findFirst: jest.fn() },
      employeeService: { findUnique: jest.fn(), create: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AssignEmployeeServiceHandler, { provide: PrismaService, useValue: prisma }],
    }).compile();

    handler = module.get<AssignEmployeeServiceHandler>(AssignEmployeeServiceHandler);
  });

  it('should throw NotFoundException when employee not found', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ employeeId: 'missing', serviceId: 'svc-1' })).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException when serviceId is missing', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
    await expect(handler.execute({ employeeId: 'emp-1', serviceId: undefined as never })).rejects.toThrow(BadRequestException);
    expect(prisma.employeeService.create).not.toHaveBeenCalled();
  });

  it('should throw NotFoundException when service not found or archived', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
    prisma.service.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ employeeId: 'emp-1', serviceId: 'svc-1' })).rejects.toThrow(NotFoundException);
    expect(prisma.employeeService.create).not.toHaveBeenCalled();
  });

  it('should throw ConflictException when already assigned', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
    prisma.service.findFirst.mockResolvedValue({ id: 'svc-1' });
    prisma.employeeService.findUnique.mockResolvedValue({ id: 'link-1' });
    await expect(handler.execute({ employeeId: 'emp-1', serviceId: 'svc-1' })).rejects.toThrow(ConflictException);
  });

  it('should create assignment when not existing', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
    prisma.service.findFirst.mockResolvedValue({ id: 'svc-1' });
    prisma.employeeService.findUnique.mockResolvedValue(null);
    prisma.employeeService.create.mockResolvedValue({ id: 'link-1' });

    const result = await handler.execute({ employeeId: 'emp-1', serviceId: 'svc-1' });
    expect(prisma.employeeService.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { employeeId: 'emp-1', serviceId: 'svc-1' },
    }));
    expect(result.id).toBe('link-1');
  });

  // ─── Track B — practitioner integrity ──────────────────────────────────────
  // The EmployeeService link is the "specialty match" for availability
  // filtering. An inactive employee must not gain new service assignments,
  // otherwise they would silently start appearing in service lists that
  // re-filter on Employee.isActive.

  it('rejects assignment when the employee is inactive (isActive=false)', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', isActive: false });
    await expect(
      handler.execute({ employeeId: 'emp-1', serviceId: 'svc-1' }),
    ).rejects.toThrow('Employee is not active');
    expect(prisma.employeeService.create).not.toHaveBeenCalled();
  });
});
