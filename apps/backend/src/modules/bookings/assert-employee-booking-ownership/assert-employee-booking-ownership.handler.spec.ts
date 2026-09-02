import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { AssertEmployeeBookingOwnershipHandler } from './assert-employee-booking-ownership.handler';

describe('AssertEmployeeBookingOwnershipHandler', () => {
  let handler: AssertEmployeeBookingOwnershipHandler;
  const prisma = {
    booking: { findFirst: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssertEmployeeBookingOwnershipHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    handler = module.get(AssertEmployeeBookingOwnershipHandler);
  });

  it('allows access when the booking is assigned to the employee', async () => {
    prisma.booking.findFirst.mockResolvedValue({ id: 'booking-1', employeeId: 'employee-1' });

    await expect(
      handler.execute({ bookingId: 'booking-1', employeeId: 'employee-1' }),
    ).resolves.toBeUndefined();
  });

  it('throws NotFoundException when the booking does not exist', async () => {
    prisma.booking.findFirst.mockResolvedValue(null);

    await expect(
      handler.execute({ bookingId: 'missing', employeeId: 'employee-1' }),
    ).rejects.toThrow(new NotFoundException('Booking missing not found'));
  });

  it('throws ForbiddenException when the booking belongs to another employee', async () => {
    prisma.booking.findFirst.mockResolvedValue({ id: 'booking-1', employeeId: 'employee-2' });

    await expect(
      handler.execute({ bookingId: 'booking-1', employeeId: 'employee-1' }),
    ).rejects.toThrow(new ForbiddenException('Booking is not assigned to you'));
  });
});
