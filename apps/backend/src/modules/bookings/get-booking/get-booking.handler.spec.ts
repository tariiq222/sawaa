import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { GetBookingHandler } from './get-booking.handler';
import { mapBookingRow } from '../booking-row.mapper';
import { PrismaService } from '../../../infrastructure/database';

jest.mock('../booking-row.mapper', () => ({
  mapBookingRow: jest.fn().mockReturnValue({ id: 'mapped-booking' }),
}));

describe('GetBookingHandler', () => {
  let handler: GetBookingHandler;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      booking: { findFirst: jest.fn() },
      client: { findFirst: jest.fn() },
      employee: { findFirst: jest.fn() },
      service: { findFirst: jest.fn() },
      invoice: { findFirst: jest.fn().mockResolvedValue(null) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [GetBookingHandler, { provide: PrismaService, useValue: prisma }],
    }).compile();

    handler = module.get<GetBookingHandler>(GetBookingHandler);
  });

  it('should throw NotFoundException when booking not found', async () => {
    prisma.booking.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ bookingId: 'missing' })).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException when clientId does not match', async () => {
    prisma.booking.findFirst.mockResolvedValue({ id: 'b1', clientId: 'c1', employeeId: 'e1', serviceId: 's1' });
    await expect(handler.execute({ bookingId: 'b1', clientId: 'c2' })).rejects.toThrow(ForbiddenException);
  });

  it('should return mapped booking without clientId check', async () => {
    prisma.booking.findFirst.mockResolvedValue({ id: 'b1', clientId: 'c1', employeeId: 'e1', serviceId: 's1' });
    prisma.client.findFirst.mockResolvedValue({ id: 'c1', name: 'Client' });
    prisma.employee.findFirst.mockResolvedValue({ id: 'e1', name: 'Employee' });
    prisma.service.findFirst.mockResolvedValue({ id: 's1', name: 'Service' });

    const result = await handler.execute({ bookingId: 'b1' });
    expect(result.id).toBe('mapped-booking');
  });

  it('should return mapped booking when clientId matches', async () => {
    prisma.booking.findFirst.mockResolvedValue({ id: 'b1', clientId: 'c1', employeeId: 'e1', serviceId: 's1' });
    prisma.client.findFirst.mockResolvedValue(null);
    prisma.employee.findFirst.mockResolvedValue(null);
    prisma.service.findFirst.mockResolvedValue(null);

    const result = await handler.execute({ bookingId: 'b1', clientId: 'c1' });
    expect(result.id).toBe('mapped-booking');
  });

  // AUTHZ-005: EMPLOYEE may only read bookings assigned to them.
  it('forbids EMPLOYEE from reading another employee booking (IDOR)', async () => {
    // Booking belongs to employee "emp-B"; caller resolves to "emp-A".
    prisma.booking.findFirst.mockResolvedValue({ id: 'b1', clientId: 'c1', employeeId: 'emp-B', serviceId: 's1' });
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-A' });

    await expect(
      handler.execute({ bookingId: 'b1', role: 'EMPLOYEE', userId: 'user-A' }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.employee.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-A' },
      select: { id: true },
    });
  });

  it('forbids EMPLOYEE with no employee profile from reading any booking', async () => {
    prisma.booking.findFirst.mockResolvedValue({ id: 'b1', clientId: 'c1', employeeId: 'emp-B', serviceId: 's1' });
    prisma.employee.findFirst.mockResolvedValue(null);

    await expect(
      handler.execute({ bookingId: 'b1', role: 'EMPLOYEE', userId: 'user-orphan' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows EMPLOYEE to read their own assigned booking', async () => {
    prisma.booking.findFirst.mockResolvedValue({ id: 'b1', clientId: 'c1', employeeId: 'emp-A', serviceId: 's1' });
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-A' });
    prisma.client.findFirst.mockResolvedValue(null);
    prisma.service.findFirst.mockResolvedValue(null);

    const result = await handler.execute({ bookingId: 'b1', role: 'EMPLOYEE', userId: 'user-A' });
    expect(result.id).toBe('mapped-booking');
  });

  it('does not scope privileged roles (ADMIN reads any booking)', async () => {
    prisma.booking.findFirst.mockResolvedValue({ id: 'b1', clientId: 'c1', employeeId: 'emp-B', serviceId: 's1' });
    prisma.client.findFirst.mockResolvedValue(null);
    prisma.service.findFirst.mockResolvedValue(null);

    const result = await handler.execute({ bookingId: 'b1', role: 'ADMIN', userId: 'user-admin' });
    expect(result.id).toBe('mapped-booking');
    // Privileged path must NOT perform the employee-ownership lookup.
    expect(prisma.employee.findFirst).not.toHaveBeenCalledWith({
      where: { userId: 'user-admin' },
      select: { id: true },
    });
  });

  it('passes Payment.amount through verbatim — already in halalas', async () => {
    prisma.booking.findFirst.mockResolvedValue({ id: 'b1', clientId: 'c1', employeeId: 'e1', serviceId: 's1' });
    prisma.client.findFirst.mockResolvedValue(null);
    prisma.employee.findFirst.mockResolvedValue(null);
    prisma.service.findFirst.mockResolvedValue(null);
    prisma.invoice.findFirst.mockResolvedValue({
      bookingId: 'b1',
      payments: [
        { id: 'pay-1', amount: 12000, refundedAmount: 3000, method: 'ONLINE_CARD', status: 'COMPLETED' },
      ],
    });

    (mapBookingRow as jest.Mock).mockClear();
    await handler.execute({ bookingId: 'b1' });

    const relations = (mapBookingRow as jest.Mock).mock.calls[0][1];
    const payment = relations.paymentsByBookingId.get('b1');
    expect(payment.amount).toBe(12000);
    expect(payment.amount).not.toBe(1200000);
    expect(payment.refundedAmount).toBe(3000);
    expect(payment.refundedAmount).not.toBe(300000);
  });
});
