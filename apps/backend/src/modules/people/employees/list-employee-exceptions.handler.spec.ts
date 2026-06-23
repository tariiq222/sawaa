import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ListEmployeeExceptionsHandler } from './list-employee-exceptions.handler';

describe('ListEmployeeExceptionsHandler', () => {
  let handler: ListEmployeeExceptionsHandler;
  let prisma: { employee: { findFirst: jest.Mock }; employeeAvailabilityException: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      employee: { findFirst: jest.fn() },
      employeeAvailabilityException: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListEmployeeExceptionsHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get<ListEmployeeExceptionsHandler>(ListEmployeeExceptionsHandler);
  });

  it('throws NotFoundException when the employee does not exist', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);

    await expect(handler.execute({ employeeId: 'emp-1' })).rejects.toThrow(NotFoundException);
    expect(prisma.employeeAvailabilityException.findMany).not.toHaveBeenCalled();
  });

  it('returns the exception list ordered by startDate asc', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
    const exceptions = [{ id: 'ex-1', startDate: new Date('2026-06-01') }];
    prisma.employeeAvailabilityException.findMany.mockResolvedValue(exceptions);

    const result = await handler.execute({ employeeId: 'emp-1' });

    expect(result).toBe(exceptions);
    expect(prisma.employeeAvailabilityException.findMany).toHaveBeenCalledWith({
      where: { employeeId: 'emp-1' },
      orderBy: { startDate: 'asc' },
    });
  });

  it('returns [] when the employee has no exceptions', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
    prisma.employeeAvailabilityException.findMany.mockResolvedValue([]);

    const result = await handler.execute({ employeeId: 'emp-1' });

    expect(result).toEqual([]);
  });
});