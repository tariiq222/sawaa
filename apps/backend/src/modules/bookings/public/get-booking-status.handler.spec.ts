import { NotFoundException } from '@nestjs/common';
import { GetBookingStatusHandler } from './get-booking-status.handler';

const mockPrisma = {
  booking: { findUnique: jest.fn() },
  payment: { findFirst: jest.fn() },
};

describe('GetBookingStatusHandler', () => {
  let handler: GetBookingStatusHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new GetBookingStatusHandler(mockPrisma as never);
  });

  it('returns booking and payment status', async () => {
    mockPrisma.booking.findUnique.mockResolvedValue({ id: 'b1', status: 'CONFIRMED' });
    mockPrisma.payment.findFirst.mockResolvedValue({ status: 'COMPLETED' });

    const result = await handler.execute('b1');

    expect(result).toEqual({ bookingId: 'b1', status: 'CONFIRMED', paymentStatus: 'COMPLETED' });
  });

  it('returns NONE when no payment exists', async () => {
    mockPrisma.booking.findUnique.mockResolvedValue({ id: 'b1', status: 'AWAITING_PAYMENT' });
    mockPrisma.payment.findFirst.mockResolvedValue(null);

    const result = await handler.execute('b1');

    expect(result).toEqual({ bookingId: 'b1', status: 'AWAITING_PAYMENT', paymentStatus: 'NONE' });
  });

  it('throws NotFoundException when booking does not exist', async () => {
    mockPrisma.booking.findUnique.mockResolvedValue(null);

    await expect(handler.execute('nonexistent')).rejects.toThrow(NotFoundException);
  });
});
