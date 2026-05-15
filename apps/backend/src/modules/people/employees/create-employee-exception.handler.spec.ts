import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateEmployeeExceptionHandler } from './create-employee-exception.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('CreateEmployeeExceptionHandler', () => {
  let handler: CreateEmployeeExceptionHandler;
  let prisma: { employee: { findFirst: jest.Mock }; employeeAvailabilityException: { create: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      employee: { findFirst: jest.fn() },
      employeeAvailabilityException: { create: jest.fn().mockResolvedValue({}) },
    };

    const module = await Test.createTestingModule({
      providers: [
        CreateEmployeeExceptionHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get(CreateEmployeeExceptionHandler);
  });

  it('throws when employee not found', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ employeeId: 'e1', startDate: '2026-01-01', endDate: '2026-01-02' })).rejects.toThrow(NotFoundException);
  });

  it('throws when endDate is before startDate', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'e1' });
    await expect(handler.execute({ employeeId: 'e1', startDate: '2026-01-02', endDate: '2026-01-01' })).rejects.toThrow(BadRequestException);
  });

  it('throws when endTime is before startDate', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'e1' });
    await expect(handler.execute({ employeeId: 'e1', startDate: '2026-01-02T10:00:00Z', endDate: '2026-01-03', endTime: '2026-01-02T09:00:00Z' })).rejects.toThrow('endTime must be at or after');
  });

  it('creates exception with defaults', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'e1' });
    await handler.execute({ employeeId: 'e1', startDate: '2026-01-01', endDate: '2026-01-02' });
    expect(prisma.employeeAvailabilityException.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isStartTimeOnly: false, endTime: null }) }),
    );
  });

  it('creates exception with all fields', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'e1' });
    await handler.execute({
      employeeId: 'e1',
      startDate: '2026-01-01T08:00:00Z',
      endDate: '2026-01-02',
      endTime: '2026-01-02T18:00:00Z',
      isStartTimeOnly: true,
      reason: 'Vacation',
    });
    expect(prisma.employeeAvailabilityException.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isStartTimeOnly: true, reason: 'Vacation', endTime: expect.any(Date) }),
      }),
    );
  });
});
