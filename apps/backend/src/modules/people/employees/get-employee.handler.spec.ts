import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { GetEmployeeHandler } from './get-employee.handler';

describe('GetEmployeeHandler', () => {
  let handler: GetEmployeeHandler;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      employee: { findFirst: jest.fn() },
      rating: { aggregate: jest.fn() },
      booking: { count: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetEmployeeHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get<GetEmployeeHandler>(GetEmployeeHandler);
  });

  it('throws NotFoundException when the employee does not exist', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);

    await expect(handler.execute({ employeeId: 'emp-1' })).rejects.toThrow(NotFoundException);
    expect(prisma.rating.aggregate).not.toHaveBeenCalled();
    expect(prisma.booking.count).not.toHaveBeenCalled();
  });

  it('looks the employee up by entity ref', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ employeeId: 'emp-1' })).rejects.toThrow(NotFoundException);
    expect(prisma.employee.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ref: 1 } }),
    );
  });

  it('aggregates rating and counts bookings for the resolved employee', async () => {
    prisma.employee.findFirst.mockResolvedValue({
      id: 'emp-1',
      branches: [],
      services: [],
      availability: [],
      exceptions: [],
    });
    prisma.rating.aggregate.mockResolvedValue({ _avg: { score: 4.2 }, _count: { _all: 9 } });
    prisma.booking.count.mockResolvedValue(15);

    const result = await handler.execute({ employeeId: 'emp-1' });

    expect(prisma.rating.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { employeeId: 'emp-1' } }),
    );
    expect(prisma.booking.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: { employeeId: 'emp-1' } }),
    );
    expect(result).toMatchObject({ exceptions: [] });
  });
});