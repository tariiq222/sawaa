import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ListServiceEmployeesHandler } from './list-service-employees.handler';
import { PrismaService } from '../../../infrastructure/database';

const buildPrisma = () => ({
  service: { findFirst: jest.fn() },
  employeeService: { findMany: jest.fn() },
  employee: { findMany: jest.fn() },
  serviceBookingConfig: { findMany: jest.fn() },
  employeeServiceOption: { findMany: jest.fn().mockResolvedValue([]) },
  serviceDurationOption: { findMany: jest.fn().mockResolvedValue([]) },
});

describe('ListServiceEmployeesHandler', () => {
  let handler: ListServiceEmployeesHandler;
  let prisma: ReturnType<typeof buildPrisma>;

  beforeEach(async () => {
    prisma = buildPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [ListServiceEmployeesHandler, { provide: PrismaService, useValue: prisma }],
    }).compile();
    handler = module.get<ListServiceEmployeesHandler>(ListServiceEmployeesHandler);
  });

  it('should throw NotFoundException when service not found', async () => {
    prisma.service.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ serviceId: 'svc-1' })).rejects.toThrow(NotFoundException);
  });

  it('should return empty array when no employee-service links', async () => {
    prisma.service.findFirst.mockResolvedValue({ id: 'svc-1' });
    prisma.employeeService.findMany.mockResolvedValue([]);
    const result = await handler.execute({ serviceId: 'svc-1' });
    expect(result).toEqual([]);
  });

  it('should return shaped employees with service types', async () => {
    prisma.service.findFirst.mockResolvedValue({ id: 'svc-1' });
    prisma.employeeService.findMany.mockResolvedValue([
      { id: 'link-1', employeeId: 'emp-1', serviceId: 'svc-1', isActive: true },
      { id: 'link-2', employeeId: 'emp-2', serviceId: 'svc-1', isActive: false },
    ]);
    prisma.employee.findMany.mockResolvedValue([
      { id: 'emp-1', name: 'Ahmed Ali', nameAr: 'أحمد علي', nameEn: null, title: 'Dr', avatarUrl: null, isActive: true, branches: [{ branchId: 'branch-1' }, { branchId: 'branch-2' }] },
      { id: 'emp-2', name: 'Sara', nameAr: null, nameEn: 'Sara Smith', title: 'Nurse', avatarUrl: 'url', isActive: true, branches: [] },
    ]);
    prisma.serviceBookingConfig.findMany.mockResolvedValue([
      { serviceId: 'svc-1', deliveryType: 'ONLINE', price: 100, durationMins: 30, isActive: true },
    ]);

    const result = await handler.execute({ serviceId: 'svc-1' });
    expect(result).toHaveLength(2);
    expect(result[0].employee.user.firstName).toBe('أحمد');
    expect(result[0].employee.user.lastName).toBe('علي');
    expect(result[1].employee.user.firstName).toBe('Sara');
    expect(result[1].employee.user.lastName).toBe('Smith');
    expect(result[0].serviceTypes).toHaveLength(1);
    expect(result[0].availableTypes).toContain('ONLINE');
    // Reflects the per-assignment isActive column, not a hardcoded true.
    expect(result[0].isActive).toBe(true);
    expect(result[1].isActive).toBe(false);
    // branchIds populated from EmployeeBranch relations — no N+1 fallback needed.
    expect(result[0].employee.branchIds).toEqual(['branch-1', 'branch-2']);
    expect(result[1].employee.branchIds).toEqual([]);
  });

  it('should use full name when ar and en are null', async () => {
    prisma.service.findFirst.mockResolvedValue({ id: 'svc-1' });
    prisma.employeeService.findMany.mockResolvedValue([{ id: 'link-1', employeeId: 'emp-1', serviceId: 'svc-1' }]);
    prisma.employee.findMany.mockResolvedValue([
      { id: 'emp-1', name: 'John Doe', nameAr: null, nameEn: null, title: null, avatarUrl: null, isActive: true, branches: [] },
    ]);
    prisma.serviceBookingConfig.findMany.mockResolvedValue([]);

    const result = await handler.execute({ serviceId: 'svc-1' });
    expect(result[0].employee.user.firstName).toBe('John');
    expect(result[0].employee.user.lastName).toBe('Doe');
  });

  it('should handle single-word name', async () => {
    prisma.service.findFirst.mockResolvedValue({ id: 'svc-1' });
    prisma.employeeService.findMany.mockResolvedValue([{ id: 'link-1', employeeId: 'emp-1', serviceId: 'svc-1' }]);
    prisma.employee.findMany.mockResolvedValue([
      { id: 'emp-1', name: 'Mononym', nameAr: null, nameEn: null, title: null, avatarUrl: null, isActive: true, branches: [] },
    ]);
    prisma.serviceBookingConfig.findMany.mockResolvedValue([]);

    const result = await handler.execute({ serviceId: 'svc-1' });
    expect(result[0].employee.user.firstName).toBe('Mononym');
    expect(result[0].employee.user.lastName).toBe('');
  });

  it('should include effectiveDurations with inherited service defaults when employee has no owned rows', async () => {
    prisma.service.findFirst.mockResolvedValue({ id: 'svc-1' });
    prisma.employeeService.findMany.mockResolvedValue([
      { id: 'link-1', employeeId: 'emp-1', serviceId: 'svc-1', isActive: true, bufferMinutes: 0 },
    ]);
    prisma.employee.findMany.mockResolvedValue([
      { id: 'emp-1', name: 'Ahmed Ali', nameAr: 'أحمد علي', nameEn: null, title: 'Dr', avatarUrl: null, isActive: true, branches: [] },
    ]);
    prisma.serviceBookingConfig.findMany.mockResolvedValue([
      { serviceId: 'svc-1', deliveryType: 'IN_PERSON', price: 200, durationMins: 45, isActive: true },
    ]);
    // Two service-default duration options for IN_PERSON (employeeServiceId === null)
    prisma.serviceDurationOption.findMany.mockResolvedValue([
      { id: 'opt-1', serviceId: 'svc-1', deliveryType: 'IN_PERSON', employeeServiceId: null, label: '45 min', labelAr: '٤٥ د', durationMins: 45, price: 200, isActive: true, sortOrder: 0 },
      { id: 'opt-2', serviceId: 'svc-1', deliveryType: 'IN_PERSON', employeeServiceId: null, label: '60 min', labelAr: '٦٠ د', durationMins: 60, price: 250, isActive: true, sortOrder: 1 },
    ]);

    const result = await handler.execute({ serviceId: 'svc-1' });

    expect(result).toHaveLength(1);
    const emp = result[0];
    expect(emp.effectiveDurations).toBeDefined();
    const inPersonGroup = emp.effectiveDurations.find((g: { deliveryType: string }) => g.deliveryType === 'IN_PERSON');
    expect(inPersonGroup).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(inPersonGroup!.durations).toHaveLength(2);
    expect(inPersonGroup!.durations[0].isInherited).toBe(true);
    expect(inPersonGroup!.durations[1].isInherited).toBe(true);
  });
});
