import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { RescheduleBookingHandler } from './reschedule-booking.handler';
import { buildPrisma, mockBooking } from '../testing/booking-test-helpers';
import { DEFAULT_ORG_ID } from '../../../common/constants';

jest.mock('../booking-lifecycle.helper', () => ({
  fetchBookingOrFail: jest.fn(),
}));

import { fetchBookingOrFail } from '../booking-lifecycle.helper';

const buildSettingsHandler = (overrides = {}) => ({
  execute: jest.fn().mockResolvedValue({
    maxReschedulesPerBooking: 3,
    ...overrides,
  }),
});

const buildZoomService = () => ({
  updateMeeting: jest.fn().mockResolvedValue(undefined),
});

const makeBooking = (overrides = {}) => ({
  ...mockBooking,
  status: BookingStatus.PENDING,
  zoomMeetingId: null,
  ...overrides,
});

describe('RescheduleBookingHandler', () => {
  const futureDate = new Date(Date.now() + 48 * 3_600_000);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('1. throws BadRequestException when fetchBookingOrFail rejects due to wrong status', async () => {
    (fetchBookingOrFail as jest.Mock).mockRejectedValue(
      new BadRequestException('Booking cannot be rescheduled (status: COMPLETED)'),
    );

    const prisma = buildPrisma();
    const handler = new RescheduleBookingHandler(
      prisma as never,
      buildSettingsHandler() as never,
      buildZoomService() as never,
    );

    await expect(
      handler.execute({
        bookingId: 'book-1',
        newScheduledAt: futureDate,
        changedBy: 'user-1',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('2. throws ForbiddenException when clientId does not match booking owner', async () => {
    (fetchBookingOrFail as jest.Mock).mockResolvedValue(
      makeBooking({ clientId: 'client-a' }),
    );

    const prisma = buildPrisma();
    const handler = new RescheduleBookingHandler(
      prisma as never,
      buildSettingsHandler() as never,
      buildZoomService() as never,
    );

    await expect(
      handler.execute({
        bookingId: 'book-1',
        newScheduledAt: futureDate,
        changedBy: 'user-1',
        clientId: 'client-b',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('3. throws BadRequestException when newScheduledAt is in the past', async () => {
    (fetchBookingOrFail as jest.Mock).mockResolvedValue(makeBooking());

    const prisma = buildPrisma();
    const handler = new RescheduleBookingHandler(
      prisma as never,
      buildSettingsHandler() as never,
      buildZoomService() as never,
    );

    await expect(
      handler.execute({
        bookingId: 'book-1',
        newScheduledAt: new Date(Date.now() - 3600_000),
        changedBy: 'user-1',
      }),
    ).rejects.toThrow('New scheduled time must be in the future');
  });

  it('4. throws BadRequestException when max reschedules reached', async () => {
    (fetchBookingOrFail as jest.Mock).mockResolvedValue(makeBooking());
    const prisma = buildPrisma();
    (prisma as any).bookingStatusLog.count = jest.fn().mockResolvedValue(3);

    const handler = new RescheduleBookingHandler(
      prisma as never,
      buildSettingsHandler({ maxReschedulesPerBooking: 3 }) as never,
      buildZoomService() as never,
    );

    await expect(
      handler.execute({
        bookingId: 'book-1',
        newScheduledAt: futureDate,
        changedBy: 'user-1',
      }),
    ).rejects.toThrow('Maximum reschedules (3) reached for this booking');
  });

  it('5a. uses provided newDurationMins when given', async () => {
    (fetchBookingOrFail as jest.Mock).mockResolvedValue(
      makeBooking({ durationMins: 60 }),
    );
    const prisma = buildPrisma();
    prisma.booking.update = jest.fn().mockResolvedValue(makeBooking());

    const handler = new RescheduleBookingHandler(
      prisma as never,
      buildSettingsHandler() as never,
      buildZoomService() as never,
    );

    await handler.execute({
      bookingId: 'book-1',
      newScheduledAt: futureDate,
      changedBy: 'user-1',
      newDurationMins: 90,
    });

    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          durationMins: 90,
          endsAt: new Date(futureDate.getTime() + 90 * 60_000),
        }),
      }),
    );
  });

  it('5b. falls back to booking.durationMins when newDurationMins omitted', async () => {
    (fetchBookingOrFail as jest.Mock).mockResolvedValue(
      makeBooking({ durationMins: 60 }),
    );
    const prisma = buildPrisma();
    prisma.booking.update = jest.fn().mockResolvedValue(makeBooking());

    const handler = new RescheduleBookingHandler(
      prisma as never,
      buildSettingsHandler() as never,
      buildZoomService() as never,
    );

    await handler.execute({
      bookingId: 'book-1',
      newScheduledAt: futureDate,
      changedBy: 'user-1',
    });

    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          durationMins: 60,
          endsAt: new Date(futureDate.getTime() + 60 * 60_000),
        }),
      }),
    );
  });

  it('6. throws ConflictException when conflict found inside transaction', async () => {
    (fetchBookingOrFail as jest.Mock).mockResolvedValue(makeBooking());
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ id: 'conflict-booking' });

    const handler = new RescheduleBookingHandler(
      prisma as never,
      buildSettingsHandler() as never,
      buildZoomService() as never,
    );

    await expect(
      handler.execute({
        bookingId: 'book-1',
        newScheduledAt: futureDate,
        changedBy: 'user-1',
      }),
    ).rejects.toThrow('Employee already has a booking in the new time slot');
  });

  it('7. updates booking and creates status log when no conflict', async () => {
    const updated = makeBooking({ scheduledAt: futureDate });
    (fetchBookingOrFail as jest.Mock).mockResolvedValue(makeBooking());
    const prisma = buildPrisma();
    prisma.booking.update = jest.fn().mockResolvedValue(updated);

    const handler = new RescheduleBookingHandler(
      prisma as never,
      buildSettingsHandler() as never,
      buildZoomService() as never,
    );

    const result = await handler.execute({
      bookingId: 'book-1',
      newScheduledAt: futureDate,
      changedBy: 'user-1',
    });

    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'book-1' },
        data: expect.objectContaining({
          scheduledAt: futureDate,
        }),
      }),
    );
    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingId: 'book-1',
          fromStatus: BookingStatus.PENDING,
          toStatus: BookingStatus.PENDING,
          changedBy: 'user-1',
          reason: 'rescheduled',
        }),
      }),
    );
    expect(result).toBe(updated);
  });

  it('8. maps Prisma P2010+23P01 exclusion violation to ConflictException', async () => {
    const exclusionError = new Prisma.PrismaClientKnownRequestError(
      'exclusion constraint violation',
      { code: 'P2010', clientVersion: '5.0.0', meta: { code: '23P01' } },
    );
    (fetchBookingOrFail as jest.Mock).mockResolvedValue(makeBooking());
    const prisma = buildPrisma();
    prisma.$transaction = jest.fn().mockRejectedValueOnce(exclusionError);

    const handler = new RescheduleBookingHandler(
      prisma as never,
      buildSettingsHandler() as never,
      buildZoomService() as never,
    );

    await expect(
      handler.execute({
        bookingId: 'book-1',
        newScheduledAt: futureDate,
        changedBy: 'user-1',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('9. re-throws non-exclusion errors from transaction', async () => {
    const otherError = new Prisma.PrismaClientKnownRequestError(
      'unique constraint',
      { code: 'P2002', clientVersion: '5.0.0' },
    );
    (fetchBookingOrFail as jest.Mock).mockResolvedValue(makeBooking());
    const prisma = buildPrisma();
    prisma.$transaction = jest.fn().mockRejectedValueOnce(otherError);

    const handler = new RescheduleBookingHandler(
      prisma as never,
      buildSettingsHandler() as never,
      buildZoomService() as never,
    );

    await expect(
      handler.execute({
        bookingId: 'book-1',
        newScheduledAt: futureDate,
        changedBy: 'user-1',
      }),
    ).rejects.toThrow(otherError);
  });

  it('10. calls zoom updateMeeting and swallows rejection when zoomMeetingId exists', async () => {
    (fetchBookingOrFail as jest.Mock).mockResolvedValue(
      makeBooking({ zoomMeetingId: 'zoom-123' }),
    );
    const prisma = buildPrisma();
    const zoomService = {
      updateMeeting: jest.fn().mockRejectedValue(new Error('zoom fail')),
    };

    const handler = new RescheduleBookingHandler(
      prisma as never,
      buildSettingsHandler() as never,
      zoomService as never,
    );

    await expect(
      handler.execute({
        bookingId: 'book-1',
        newScheduledAt: futureDate,
        changedBy: 'user-1',
        newDurationMins: 90,
      }),
    ).resolves.toBeDefined();

    expect(zoomService.updateMeeting).toHaveBeenCalledWith(
      DEFAULT_ORG_ID,
      'zoom-123',
      expect.objectContaining({
        topic: 'Booking book-1',
        startTime: futureDate.toISOString(),
        durationMins: 90,
      }),
    );
  });

  it('11. skips zoom updateMeeting when booking has no zoomMeetingId', async () => {
    (fetchBookingOrFail as jest.Mock).mockResolvedValue(
      makeBooking({ zoomMeetingId: null }),
    );
    const prisma = buildPrisma();
    const zoomService = buildZoomService();

    const handler = new RescheduleBookingHandler(
      prisma as never,
      buildSettingsHandler() as never,
      zoomService as never,
    );

    await handler.execute({
      bookingId: 'book-1',
      newScheduledAt: futureDate,
      changedBy: 'user-1',
    });

    expect(zoomService.updateMeeting).not.toHaveBeenCalled();
  });
});
