import { BadRequestException } from '@nestjs/common';
import { BookingStatus, DeliveryType } from '@prisma/client';
import { ConfirmBookingHandler } from './confirm-booking.handler';
import { buildPrisma, buildRlsTransaction, buildZoomQueue, mockBooking } from '../testing/booking-test-helpers';

describe('ConfirmBookingHandler', () => {
  it('confirms PENDING booking and emits BookingConfirmedEvent', async () => {
    const prisma = buildPrisma();
    const zoomQueue = buildZoomQueue();
    await new ConfirmBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, zoomQueue as never).execute({
      bookingId: 'book-1', changedBy: 'user-42',
    });
    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: BookingStatus.CONFIRMED }) }),
    );
    expect(prisma.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventType: 'bookings.booking.confirmed' }),
    });
    // IN_PERSON booking (mockBooking default) — no Zoom job enqueued
    expect(zoomQueue.enqueue).not.toHaveBeenCalled();
  });

  it('confirms and retains the invoice fallback event while Redis is unavailable', async () => {
    const prisma = buildPrisma();
    const zoomQueue = buildZoomQueue();
    zoomQueue.enqueue.mockRejectedValue(new Error('redis down'));
    prisma.booking.findUnique.mockResolvedValue({ ...mockBooking, deliveryType: DeliveryType.ONLINE });
    const tx = { ...prisma, outboxEvent: { create: jest.fn().mockResolvedValue({}) } };
    const transaction = { withTransaction: (work: any) => work(tx) };
    await expect(new ConfirmBookingHandler(prisma as never, transaction as never, zoomQueue as never)
      .execute({ bookingId: 'book-1', changedBy: 'user-42' })).resolves.toBeDefined();
    const row = tx.outboxEvent.create.mock.calls.find(([arg]) => arg.data.eventType === 'bookings.booking.confirmed')?.[0].data;
    expect(row).toEqual(expect.objectContaining({
      aggregateId: 'book-1', status: 'PENDING_V2', deliveryLane: 'PENDING_V2',
      payload: expect.objectContaining({ payload: expect.objectContaining({ bookingId: 'book-1', price: 200 }) }),
    }));
    expect(row.payload.eventId).toBe(row.id);
    expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('fails the transaction before enqueueing when confirmation delivery cannot be persisted', async () => {
    const prisma = buildPrisma();
    const zoomQueue = buildZoomQueue();
    prisma.booking.findUnique.mockResolvedValue({ ...mockBooking, deliveryType: DeliveryType.ONLINE });
    prisma.outboxEvent.create.mockImplementation(async ({ data }: any) => {
      if (data.eventType === 'bookings.booking.confirmed') throw new Error('outbox write failed');
      return { id: 'zoom-event' };
    });
    const handler = new ConfirmBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, zoomQueue as never);
    await expect(handler.execute({ bookingId: 'book-1', changedBy: 'user-42' })).rejects.toThrow('outbox write failed');
    expect(zoomQueue.enqueue).not.toHaveBeenCalled();
  });

  it('enqueues Zoom meeting creation when the delivery type is online', async () => {
    const prisma = buildPrisma();
    const zoomQueue = buildZoomQueue();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, deliveryType: DeliveryType.ONLINE });

    await new ConfirmBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, zoomQueue as never).execute({
      bookingId: 'book-1', changedBy: 'user-42',
    });

    expect(zoomQueue.enqueue).toHaveBeenCalledWith('book-1');
    expect(prisma.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        aggregateId: 'book-1',
        eventType: 'bookings.zoom.create_requested',
      }),
    });
  });

  it('still confirms the booking when the Zoom enqueue fails', async () => {
    const prisma = buildPrisma();
    const zoomQueue = buildZoomQueue();
    zoomQueue.enqueue.mockRejectedValue(new Error('redis down'));
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, deliveryType: DeliveryType.ONLINE });

    const result = await new ConfirmBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, zoomQueue as never).execute({
      bookingId: 'book-1', changedBy: 'user-42',
    });

    expect(result).toBeDefined();
    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: BookingStatus.CONFIRMED }) }),
    );
    expect(prisma.outboxEvent.create).toHaveBeenCalled();
  });

  it('throws BadRequestException when booking is already CONFIRMED', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });
    await expect(
      new ConfirmBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, buildZoomQueue() as never).execute({
        bookingId: 'book-1', changedBy: 'user-42',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('ConfirmBookingHandler — status log', () => {
  it('writes a BookingStatusLog entry on confirm', async () => {
    const prisma = buildPrisma();
    const handler = new ConfirmBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, buildZoomQueue() as never);

    await handler.execute({ bookingId: 'book-1', changedBy: 'user-42' });

    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookingId: 'book-1',
        fromStatus: BookingStatus.PENDING,
        toStatus: BookingStatus.CONFIRMED,
        changedBy: 'user-42',
      }),
    });
  });
});
