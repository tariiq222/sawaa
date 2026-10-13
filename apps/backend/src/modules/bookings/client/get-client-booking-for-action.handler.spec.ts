import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BookingStatus, DeliveryType } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { GetClientBookingForActionHandler } from './get-client-booking-for-action.handler';

describe('GetClientBookingForActionHandler', () => {
  const prisma = { booking: { findFirst: jest.fn() } };
  const handler = new GetClientBookingForActionHandler(prisma as unknown as PrismaService);

  beforeEach(() => jest.resetAllMocks());

  it.each([BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.DEPOSIT_PAID])('returns an owned online booking with joinable status %s', async (status) => {
    const booking = {
      id: 'b-1',
      clientId: 'client-1',
      deliveryType: DeliveryType.ONLINE,
      status,
      zoomJoinUrl: 'https://zoom.us/j/123',
      scheduledAt: new Date('2026-12-31T09:00:00Z'),
    };
    prisma.booking.findFirst.mockResolvedValue(booking);

    await expect(handler.executeForJoin('b-1', 'client-1')).resolves.toBe(booking);
  });

  it.each([BookingStatus.CANCELLED, BookingStatus.COMPLETED, BookingStatus.NO_SHOW, BookingStatus.EXPIRED, BookingStatus.PENDING_GROUP_FILL, BookingStatus.AWAITING_PAYMENT, BookingStatus.CANCEL_REQUESTED])('rejects an owned booking with status %s even when a zoom url is stored', async (status) => {
    prisma.booking.findFirst.mockResolvedValue({
      id: 'b-1',
      clientId: 'client-1',
      deliveryType: DeliveryType.ONLINE,
      status,
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

  it.each(['executeForJoin', 'executeForRate'] as const)('%s scopes the lookup to the authenticated client', async (action) => {
    const foreignBooking = {
      id: 'b-1', clientId: 'other-client', employeeId: 'emp-1',
      deliveryType: DeliveryType.ONLINE, status: BookingStatus.CONFIRMED,
      zoomJoinUrl: 'https://zoom.us/j/123', scheduledAt: new Date('2026-12-31T09:00:00Z'),
    };
    // Model Prisma ownership filtering: an unscoped query exposes the row.
    prisma.booking.findFirst.mockImplementation(({ where }: { where: { id: string; clientId?: string } }) =>
      Promise.resolve(where.id === foreignBooking.id && (!where.clientId || where.clientId === foreignBooking.clientId)
        ? foreignBooking : null));

    await expect(handler[action]('b-1', 'client-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.booking.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'b-1', clientId: 'client-1' },
    }));
  });

  it.each(['executeForJoin', 'executeForRate'] as const)('%s reports missing rows as not found', async (action) => {
    prisma.booking.findFirst.mockResolvedValue(null);
    await expect(handler[action]('missing', 'client-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
