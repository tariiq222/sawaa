import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BookingStatus, DeliveryType } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { GetClientBookingForActionHandler } from './get-client-booking-for-action.handler';

describe('GetClientBookingForActionHandler', () => {
  const prisma = { booking: { findFirst: jest.fn() } };
  const handler = new GetClientBookingForActionHandler(prisma as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it('returns a joinable online booking owned by the client', async () => {
    const booking = {
      id: 'b-1',
      clientId: 'client-1',
      deliveryType: DeliveryType.ONLINE,
      status: BookingStatus.CONFIRMED,
      zoomJoinUrl: 'https://zoom.us/j/123',
      scheduledAt: new Date('2026-12-31T09:00:00Z'),
    };
    prisma.booking.findFirst.mockResolvedValue(booking);

    await expect(handler.executeForJoin('b-1', 'client-1')).resolves.toBe(booking);
  });

  it('rejects a cancelled booking even when a zoom url is stored', async () => {
    prisma.booking.findFirst.mockResolvedValue({
      id: 'b-1',
      clientId: 'client-1',
      deliveryType: DeliveryType.ONLINE,
      status: BookingStatus.CANCELLED,
      zoomJoinUrl: 'https://zoom.us/j/123',
    });

    await expect(handler.executeForJoin('b-1', 'client-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects an in-person booking without a zoom url', async () => {
    prisma.booking.findFirst.mockResolvedValue({
      id: 'b-1',
      clientId: 'client-1',
      deliveryType: DeliveryType.IN_PERSON,
      status: BookingStatus.CONFIRMED,
      zoomJoinUrl: null,
    });

    await expect(handler.executeForJoin('b-1', 'client-1')).rejects.toThrow('Join is only available for online bookings');
  });

  it('rejects a missing booking', async () => {
    prisma.booking.findFirst.mockResolvedValue(null);

    await expect(handler.executeForJoin('b-1', 'client-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the booking needed to submit a rating', async () => {
    prisma.booking.findFirst.mockResolvedValue({ id: 'b-1', clientId: 'client-1', employeeId: 'emp-1' });

    await expect(handler.executeForRate('b-1', 'client-1')).resolves.toEqual({
      id: 'b-1',
      clientId: 'client-1',
      employeeId: 'emp-1',
    });
  });

  it('rejects rating a booking owned by another client', async () => {
    prisma.booking.findFirst.mockResolvedValue({ id: 'b-1', clientId: 'other-client', employeeId: 'emp-1' });

    await expect(handler.executeForRate('b-1', 'client-1')).rejects.toThrow('Not your booking');
  });
});
