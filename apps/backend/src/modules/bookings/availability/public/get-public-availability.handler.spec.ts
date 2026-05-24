import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GetPublicAvailabilityHandler } from './get-public-availability.handler';
import { PrismaService } from '../../../../infrastructure/database';
import { CheckAvailabilityHandler } from '../../check-availability/check-availability.handler';

describe('GetPublicAvailabilityHandler', () => {
  let handler: GetPublicAvailabilityHandler;
  let prisma: any;
  let checkAvailability: jest.Mocked<Partial<CheckAvailabilityHandler>>;

  beforeEach(async () => {
    prisma = {
      employee: { findFirst: jest.fn() },
      employeeBranch: { findFirst: jest.fn() },
      employeeService: { findFirst: jest.fn() },
    };
    checkAvailability = { execute: jest.fn().mockResolvedValue([{ start: '09:00', end: '10:00' }]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetPublicAvailabilityHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: CheckAvailabilityHandler, useValue: checkAvailability },
      ],
    }).compile();

    handler = module.get<GetPublicAvailabilityHandler>(GetPublicAvailabilityHandler);
  });

  it('should throw NotFoundException when employee not public/active', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ employeeId: 'emp-1', date: '2026-01-01' })).rejects.toThrow(NotFoundException);
  });

  // Soft-fail: when the employee exists but has no branch or service link,
  // we return an empty slot list (not 404). The FE distinguishes
  // "no openings on this date" from "configuration missing" via the
  // bookability metadata on /public/employees.
  it('returns [] when no branch link configured', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
    prisma.employeeBranch.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ employeeId: 'emp-1', date: '2026-01-01' })).resolves.toEqual([]);
  });

  it('returns [] when no service link configured', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
    prisma.employeeBranch.findFirst.mockResolvedValue({ branchId: 'branch-1' });
    prisma.employeeService.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ employeeId: 'emp-1', date: '2026-01-01' })).resolves.toEqual([]);
  });

  it('should use provided branchId and serviceId', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
    const result = await handler.execute({ employeeId: 'emp-1', branchId: 'branch-1', serviceId: 'svc-1', date: '2026-01-01' });
    expect(checkAvailability.execute).toHaveBeenCalledWith(expect.objectContaining({ branchId: 'branch-1', serviceId: 'svc-1' }));
    expect(result).toEqual([{ start: '09:00', end: '10:00' }]);
  });

  it('should resolve branchId and serviceId from DB when not provided', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
    prisma.employeeBranch.findFirst.mockResolvedValue({ branchId: 'branch-1' });
    prisma.employeeService.findFirst.mockResolvedValue({ serviceId: 'svc-1' });

    await handler.execute({ employeeId: 'emp-1', date: '2026-01-01' });
    expect(checkAvailability.execute).toHaveBeenCalledWith(expect.objectContaining({ branchId: 'branch-1', serviceId: 'svc-1' }));
  });
});
