import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { ClientRescheduleBookingHandler } from './client-reschedule-booking.handler';
import { stableEventId } from '../../../common/events';
import { mockBooking, buildPrisma, buildRlsTransaction } from '../testing/booking-test-helpers';

const futureBooking = {
  ...mockBooking,
  scheduledAt: new Date(Date.now() + 48 * 3_600_000),
  endsAt: new Date(Date.now() + 49 * 3_600_000),
};

const buildSettingsHandler = (overrides = {}) => ({
  execute: jest.fn().mockResolvedValue({
    clientRescheduleMinHoursBefore: 24,
    maxReschedulesPerBooking: 3,
    ...overrides,
  }),
});

// Always reports the requested date as an available slot so success-path
// tests exercise the availability gate without having to know the exact time.
const buildAvailabilityHandler = () => ({
  execute: jest
    .fn()
    .mockImplementation((query: { date: Date; durationMins: number }) => [
      {
        startTime: query.date,
        endTime: new Date(query.date.getTime() + (query.durationMins ?? 60) * 60_000),
      },
    ]),
});

const buildZoomService = () => ({
  updateMeeting: jest.fn().mockResolvedValue(undefined),
});

describe('ClientRescheduleBookingHandler', () => {
  it('reschedules a PENDING booking to a new time slot', async () => {
    const prisma = buildPrisma();
    const updatedBooking = {
      ...futureBooking,
      scheduledAt: new Date(Date.now() + 72 * 3_600_000),
      endsAt: new Date(Date.now() + 73 * 3_600_000),
    };
    prisma.booking.findUnique.mockResolvedValue(futureBooking);
    prisma.booking.findUnique.mockResolvedValue(updatedBooking);
    const settings = buildSettingsHandler();
    const handler = new ClientRescheduleBookingHandler(
      prisma as never,
      buildRlsTransaction(prisma) as never,
      settings as never,
      buildZoomService() as never,
      buildAvailabilityHandler() as never,
    );

    const result = await handler.execute({
      bookingId: 'book-1',
      clientId: 'client-1',
      newScheduledAt: new Date(Date.now() + 72 * 3_600_000).toISOString(),
    });

    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scheduledAt: expect.any(Date),
          durationMins: 60,
        }),
      }),
    );
    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookingId: 'book-1',
        reason: 'rescheduled',
        changedBy: 'client-1',
      }),
    });
    expect(result.booking).toBeDefined();
  });

  it('throws ForbiddenException when client does not own the booking', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique.mockResolvedValue(futureBooking);
    const handler = new ClientRescheduleBookingHandler(
      prisma as never,
      buildRlsTransaction(prisma) as never,
      buildSettingsHandler() as never,
      buildZoomService() as never,
      buildAvailabilityHandler() as never,
    );

    await expect(
      handler.execute({
        bookingId: 'book-1',
        clientId: 'other-client',
        newScheduledAt: new Date(Date.now() + 72 * 3_600_000).toISOString(),
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws BadRequestException when booking status is not reschedulable', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique.mockResolvedValue({
      ...futureBooking,
      status: BookingStatus.COMPLETED,
    });
    const handler = new ClientRescheduleBookingHandler(
      prisma as never,
      buildRlsTransaction(prisma) as never,
      buildSettingsHandler() as never,
      buildZoomService() as never,
      buildAvailabilityHandler() as never,
    );

    await expect(
      handler.execute({
        bookingId: 'book-1',
        clientId: 'client-1',
        newScheduledAt: new Date(Date.now() + 72 * 3_600_000).toISOString(),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when newScheduledAt is in the past', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique.mockResolvedValue(futureBooking);
    const handler = new ClientRescheduleBookingHandler(
      prisma as never,
      buildRlsTransaction(prisma) as never,
      buildSettingsHandler() as never,
      buildZoomService() as never,
      buildAvailabilityHandler() as never,
    );

    await expect(
      handler.execute({
        bookingId: 'book-1',
        clientId: 'client-1',
        newScheduledAt: new Date(Date.now() - 3600_000).toISOString(),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when < clientRescheduleMinHoursBefore', async () => {
    const soonBooking = {
      ...futureBooking,
      scheduledAt: new Date(Date.now() + 12 * 3_600_000),
      endsAt: new Date(Date.now() + 13 * 3_600_000),
    };
    const prisma = buildPrisma();
    prisma.booking.findUnique.mockResolvedValue(soonBooking);
    const settings = buildSettingsHandler({ clientRescheduleMinHoursBefore: 24 });
    const handler = new ClientRescheduleBookingHandler(
      prisma as never,
      buildRlsTransaction(prisma) as never,
      settings as never,
      buildZoomService() as never,
      buildAvailabilityHandler() as never,
    );

    await expect(
      handler.execute({
        bookingId: 'book-1',
        clientId: 'client-1',
        newScheduledAt: new Date(Date.now() + 36 * 3_600_000).toISOString(),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when maxReschedulesPerBooking is exceeded', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique.mockResolvedValue(futureBooking);
    prisma.bookingStatusLog.count = jest.fn().mockResolvedValue(3);
    const settings = buildSettingsHandler({ maxReschedulesPerBooking: 3 });
    const handler = new ClientRescheduleBookingHandler(
      prisma as never,
      buildRlsTransaction(prisma) as never,
      settings as never,
      buildZoomService() as never,
      buildAvailabilityHandler() as never,
    );

    await expect(
      handler.execute({
        bookingId: 'book-1',
        clientId: 'client-1',
        newScheduledAt: new Date(Date.now() + 72 * 3_600_000).toISOString(),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('commits the existing duration as durable Zoom desired state plus outbox event', async () => {
    const prisma = buildPrisma();
    const newScheduledAt = new Date(Date.now() + 72 * 3_600_000);
    prisma.booking.findUnique.mockResolvedValue({
      ...futureBooking,
      zoomMeetingId: 'zoom-123',
    });
    const zoomService = buildZoomService();
    const availability = buildAvailabilityHandler();
    const handler = new ClientRescheduleBookingHandler(
      prisma as never,
      buildRlsTransaction(prisma) as never,
      buildSettingsHandler() as never,
      zoomService as never,
      availability as never,
    );

    const sourceActionId = '11111111-1111-4111-8111-111111111111';
    const result = await handler.execute({
      bookingId: 'book-1',
      clientId: 'client-1',
      newScheduledAt: newScheduledAt.toISOString(),
      sourceActionId,
    });

    expect(result.booking).toBeDefined();
    expect(prisma.bookingZoomSync.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookingId: 'book-1',
        zoomMeetingId: 'zoom-123',
        desiredStartAt: newScheduledAt,
        desiredDurationMins: 60,
        desiredTopic: 'Booking book-1',
        eventId: stableEventId(`booking:book-1:zoom-reschedule:${sourceActionId}`),
        sourceActionId,
      }),
    });
    expect(prisma.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'bookings.zoom.reschedule_requested',
        id: stableEventId(`booking:book-1:zoom-reschedule:${sourceActionId}`),
        payload: expect.objectContaining({
          payload: expect.objectContaining({ bookingId: 'book-1' }),
        }),
      }),
    });
    expect(zoomService.updateMeeting).not.toHaveBeenCalled();
  });

  it('never calls Zoom inline, so provider availability cannot roll back the booking mutation', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique.mockResolvedValue({
      ...futureBooking,
      zoomMeetingId: 'zoom-123',
    });
    const zoomService = buildZoomService();
    const availability = buildAvailabilityHandler();
    const handler = new ClientRescheduleBookingHandler(
      prisma as never,
      buildRlsTransaction(prisma) as never,
      buildSettingsHandler() as never,
      zoomService as never,
      availability as never,
    );

    const result = await handler.execute({
      bookingId: 'book-1',
      clientId: 'client-1',
      newScheduledAt: new Date(Date.now() + 72 * 3_600_000).toISOString(),
    });

    expect(result.booking).toBeDefined();
    expect(zoomService.updateMeeting).not.toHaveBeenCalled();
    expect(prisma.bookingZoomSync.create).toHaveBeenCalledTimes(1);
  });

  it('skips zoom updateMeeting when booking has no zoomMeetingId', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique.mockResolvedValue({
      ...futureBooking,
      zoomMeetingId: null,
    });
    const zoomService = buildZoomService();
    const availability = buildAvailabilityHandler();
    const handler = new ClientRescheduleBookingHandler(
      prisma as never,
      buildRlsTransaction(prisma) as never,
      buildSettingsHandler() as never,
      zoomService as never,
      availability as never,
    );

    const result = await handler.execute({
      bookingId: 'book-1',
      clientId: 'client-1',
      newScheduledAt: new Date(Date.now() + 72 * 3_600_000).toISOString(),
    });

    expect(result.booking).toBeDefined();
    expect(zoomService.updateMeeting).not.toHaveBeenCalled();
    expect(prisma.bookingZoomSync.create).not.toHaveBeenCalled();
  });

  it('calls availability handler with excludeBookingId for the rescheduled booking', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique.mockResolvedValue(futureBooking);
    const availability = buildAvailabilityHandler();
    const handler = new ClientRescheduleBookingHandler(
      prisma as never,
      buildRlsTransaction(prisma) as never,
      buildSettingsHandler() as never,
      buildZoomService() as never,
      availability as never,
    );

    await handler.execute({
      bookingId: 'book-1',
      clientId: 'client-1',
      newScheduledAt: new Date(Date.now() + 72 * 3_600_000).toISOString(),
    });

    expect(availability.execute).toHaveBeenCalledWith(
      expect.objectContaining({ excludeBookingId: 'book-1' }),
    );
  });

  it('joins a supplied transaction, locks client before slot, and stores a durable action result', async () => {
    const prisma = buildPrisma();
    const tx = buildPrisma();
    tx.booking.findUnique.mockResolvedValue(futureBooking);
    const rls = buildRlsTransaction(prisma);
    const availability = buildAvailabilityHandler();
    const handler = new ClientRescheduleBookingHandler(
      prisma as never,
      rls as never,
      buildSettingsHandler() as never,
      buildZoomService() as never,
      availability as never,
    );
    const scheduledAt = new Date(Date.now() + 72 * 3_600_000).toISOString();

    await handler.execute({
      bookingId: 'book-1', clientId: 'client-1', newScheduledAt: scheduledAt,
      sourceActionId: '11111111-1111-4111-8111-111111111111', transaction: tx as never,
    });

    expect(rls.withTransaction).not.toHaveBeenCalled();
    expect(prisma.booking.findUnique).not.toHaveBeenCalled();
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(availability.execute).toHaveBeenCalledWith(expect.objectContaining({ transaction: tx }));
    expect(tx.bookingStatusLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceActionId: '11111111-1111-4111-8111-111111111111',
        sourceActionHash: expect.any(String),
        sourceActionResult: expect.objectContaining({ kind: 'RESCHEDULE', bookingId: 'book-1' }),
      }),
    });
  });

  it('recovers the same result by sourceActionId without mutating again', async () => {
    const tx = buildPrisma();
    tx.booking.findUnique.mockResolvedValue(futureBooking);
    const scheduledAt = new Date(Date.now() + 72 * 3_600_000).toISOString();
    const sourceActionId = '11111111-1111-4111-8111-111111111111';
    const handler = new ClientRescheduleBookingHandler(
      buildPrisma() as never,
      buildRlsTransaction() as never,
      buildSettingsHandler() as never,
      buildZoomService() as never,
      buildAvailabilityHandler() as never,
    );

    await handler.execute({
      bookingId: 'book-1', clientId: 'client-1', newScheduledAt: scheduledAt,
      sourceActionId, transaction: tx as never,
    });
    const created = tx.bookingStatusLog.create.mock.calls[0][0].data;
    tx.bookingStatusLog.findUnique.mockResolvedValue(created);
    tx.booking.updateMany.mockClear();
    tx.bookingStatusLog.create.mockClear();

    const replay = await handler.execute({
      bookingId: 'book-1', clientId: 'client-1', newScheduledAt: scheduledAt,
      sourceActionId, transaction: tx as never,
    });

    expect(replay.booking.id).toBe('book-1');
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
    expect(tx.bookingStatusLog.create).not.toHaveBeenCalled();
  });

  it('recovers the durable result even when the rescheduled time has since passed', async () => {
    const tx = buildPrisma();
    tx.booking.findUnique.mockResolvedValue(futureBooking);
    const scheduledAt = new Date(Date.now() + 72 * 3_600_000);
    const sourceActionId = '11111111-1111-4111-8111-111111111111';
    const handler = new ClientRescheduleBookingHandler(
      buildPrisma() as never, buildRlsTransaction() as never,
      buildSettingsHandler() as never, buildZoomService() as never,
      buildAvailabilityHandler() as never,
    );

    await handler.execute({
      bookingId: 'book-1', clientId: 'client-1', newScheduledAt: scheduledAt.toISOString(),
      sourceActionId, transaction: tx as never,
    });
    tx.bookingStatusLog.findUnique.mockResolvedValue(tx.bookingStatusLog.create.mock.calls[0][0].data);
    tx.booking.updateMany.mockClear();
    jest.useFakeTimers().setSystemTime(new Date(scheduledAt.getTime() + 1));
    try {
      const replay = await handler.execute({
        bookingId: 'book-1', clientId: 'client-1', newScheduledAt: scheduledAt.toISOString(),
        sourceActionId, transaction: tx as never,
      });
      expect(replay.booking.id).toBe('book-1');
      expect(tx.booking.updateMany).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects reuse of a sourceActionId with different immutable input', async () => {
    const tx = buildPrisma();
    tx.bookingStatusLog.findUnique.mockResolvedValue({
      sourceActionId: '11111111-1111-4111-8111-111111111111',
      sourceActionHash: 'different',
      sourceActionResult: { kind: 'RESCHEDULE', bookingId: 'book-1' },
    });
    const handler = new ClientRescheduleBookingHandler(
      buildPrisma() as never, buildRlsTransaction() as never,
      buildSettingsHandler() as never, buildZoomService() as never,
      buildAvailabilityHandler() as never,
    );

    await expect(handler.execute({
      bookingId: 'book-1', clientId: 'client-1',
      newScheduledAt: new Date(Date.now() + 72 * 3_600_000).toISOString(),
      sourceActionId: '11111111-1111-4111-8111-111111111111', transaction: tx as never,
    })).rejects.toThrow(ConflictException);
  });
});
