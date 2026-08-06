import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { ClientRescheduleBookingHandler } from './client-reschedule-booking.handler';
import { mockBooking, buildPrisma, buildRlsTransaction } from '../testing/booking-test-helpers';
import { DEFAULT_ORG_ID } from '../../../common/constants';

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

  it('calls zoom updateMeeting with the new time and duration when zoomMeetingId exists', async () => {
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

    const result = await handler.execute({
      bookingId: 'book-1',
      clientId: 'client-1',
      newScheduledAt: newScheduledAt.toISOString(),
      newDurationMins: 90,
    });

    expect(result.booking).toBeDefined();
    expect(zoomService.updateMeeting).toHaveBeenCalledWith(
      DEFAULT_ORG_ID,
      'zoom-123',
      {
        topic: 'Booking book-1',
        startTime: newScheduledAt.toISOString(),
        durationMins: 90,
      },
    );
  });

  it('swallows zoom updateMeeting rejection and still returns the committed booking', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique.mockResolvedValue({
      ...futureBooking,
      zoomMeetingId: 'zoom-123',
    });
    const zoomService = {
      updateMeeting: jest.fn().mockRejectedValue(new Error('zoom fail')),
    };
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
    expect(zoomService.updateMeeting).toHaveBeenCalledWith(
      DEFAULT_ORG_ID,
      'zoom-123',
      expect.objectContaining({ durationMins: 60 }),
    );
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
});
