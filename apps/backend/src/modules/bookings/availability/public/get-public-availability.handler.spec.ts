import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GetPublicAvailabilityHandler } from './get-public-availability.handler';
import { CheckAvailabilityHandler } from '../../check-availability/check-availability.handler';
import { PrismaService } from '../../../../infrastructure/database';

describe('GetPublicAvailabilityHandler', () => {
  let handler: GetPublicAvailabilityHandler;

  const mockPrisma = {
    employee: { findFirst: jest.fn() },
    employeeBranch: { findFirst: jest.fn() },
    employeeService: { findFirst: jest.fn() },
  };

  const mockCheckAvailability = {
    execute: jest.fn().mockResolvedValue([
      { startTime: new Date('2026-04-20T09:00:00'), endTime: new Date('2026-04-20T09:30:00') },
    ]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetPublicAvailabilityHandler,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CheckAvailabilityHandler, useValue: mockCheckAvailability },
      ],
    }).compile();

    handler = module.get<GetPublicAvailabilityHandler>(GetPublicAvailabilityHandler);
  });

  it('should throw NotFoundException when employee not found', async () => {
    mockPrisma.employee.findFirst.mockResolvedValue(null);
    await expect(handler.execute({
      employeeId: 'non-existent',
      date: '2026-04-20',
    })).rejects.toThrow(NotFoundException);
  });

  it('should return available slots for valid employee', async () => {
    mockPrisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
    mockPrisma.employeeBranch.findFirst.mockResolvedValue({ branchId: 'branch-1' });
    mockPrisma.employeeService.findFirst.mockResolvedValue({ serviceId: 'service-1' });

    const result = await handler.execute({
      employeeId: 'emp-1',
      date: '2026-04-20',
      serviceId: 'service-1',
      branchId: 'branch-1',
    });

    expect(result).toHaveLength(1);
    expect(mockCheckAvailability.execute).toHaveBeenCalled();
  });
});
