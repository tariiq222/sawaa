import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { GetAvailabilityHandler } from './get-availability.handler';

describe('GetAvailabilityHandler', () => {
  let handler: GetAvailabilityHandler;
  let prisma: { employee: { findFirst: jest.Mock }; employeeAvailability: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      employee: { findFirst: jest.fn() },
      employeeAvailability: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetAvailabilityHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get<GetAvailabilityHandler>(GetAvailabilityHandler);
  });

  it('throws NotFoundException when the employee does not exist', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);

    await expect(handler.execute({ employeeId: 'emp-1' })).rejects.toThrow(NotFoundException);
    expect(prisma.employeeAvailability.findMany).not.toHaveBeenCalled();
  });

  it('returns the schedule ordered by dayOfWeek then startTime', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
    const schedule = [
      { id: 'sa-1', dayOfWeek: 1, startTime: '09:00', endTime: '12:00' },
      { id: 'sa-2', dayOfWeek: 1, startTime: '13:00', endTime: '17:00' },
    ];
    prisma.employeeAvailability.findMany.mockResolvedValue(schedule);

    const result = await handler.execute({ employeeId: 'emp-1' });

    expect(result.schedule).toBe(schedule);
    expect(prisma.employeeAvailability.findMany).toHaveBeenCalledWith({
      where: { employeeId: 'emp-1' },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  });
});