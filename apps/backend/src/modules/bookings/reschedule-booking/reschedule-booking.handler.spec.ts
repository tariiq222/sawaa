import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { BookingStatus, Prisma } from '@prisma/client';
import { RescheduleBookingHandler } from './reschedule-booking.handler';
import { buildPrisma, buildRlsTransaction, mockBooking } from '../testing/booking-test-helpers';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';
import { ZoomMeetingService } from '../zoom-meeting.service';
import { CheckAvailabilityHandler } from '../check-availability/check-availability.handler';
import { DEFAULT_ORG_ID } from '../../../common/constants';

jest.mock('../booking-lifecycle.helper', () => ({
  ...jest.requireActual('../booking-lifecycle.helper'),
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

// Always reports the requested date as an available slot so success-path
// tests exercise the availability gate without having to know the exact time.
const buildAvailabilityHandler = () => ({
  execute: jest.fn().mockImplementation((query: { date: Date; durationMins?: number }) => [
    {
      startTime: query.date,
      endTime: new Date(query.date.getTime() + (query.durationMins ?? 60) * 60_000),
    },
  ]),
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
      buildRlsTransaction(prisma) as never,
      buildSettingsHandler() as never,
      buildZoomService() as never,
      buildAvailabilityHandler() as never,
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
      buildRlsTransaction(prisma) as never,
      buildSettingsHandler() as never,
      buildZoomService() as never,
      buildAvailabilityHandler() as never,
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
      buildRlsTransaction(prisma) as never,
      buildSettingsHandler() as never,
      buildZoomService() as never,
      buildAvailabilityHandler() as never,
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
      buildRlsTransaction(prisma) as never,
      buildSettingsHandler({ maxReschedulesPerBooking: 3 }) as never,
      buildZoomService() as never,
      buildAvailabilityHandler() as never,
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
      buildRlsTransaction(prisma) as never,
      buildSettingsHandler() as never,
      buildZoomService() as never,
      buildAvailabilityHandler() as never,
    );

    await handler.execute({
      bookingId: 'book-1',
      newScheduledAt: futureDate,
      changedBy: 'user-1',
      newDurationMins: 90,
    });

    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
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
      buildRlsTransaction(prisma) as never,
      buildSettingsHandler() as never,
      buildZoomService() as never,
      buildAvailabilityHandler() as never,
    );

    await handler.execute({
      bookingId: 'book-1',
      newScheduledAt: futureDate,
      changedBy: 'user-1',
    });

    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
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
      buildRlsTransaction(prisma) as never,
      buildSettingsHandler() as never,
      buildZoomService() as never,
      buildAvailabilityHandler() as never,
    );

    await expect(
      handler.execute({
        bookingId: 'book-1',
        newScheduledAt: futureDate,
        changedBy: 'user-1',
      }),
    ).rejects.toThrow('Employee already has a booking in the new time slot');
  });

  it('6b. acquires pg_advisory_xact_lock before the in-transaction conflict check', async () => {
    (fetchBookingOrFail as jest.Mock).mockResolvedValue(makeBooking());
    const prisma = buildPrisma();

    const callOrder: string[] = [];
    (prisma.$executeRaw as jest.Mock).mockImplementation(async () => {
      callOrder.push('$executeRaw');
    });
    const conflictCheck = prisma.booking.findFirst as jest.Mock;
    prisma.booking.findFirst = jest.fn(async (args: unknown) => {
      callOrder.push('booking.findFirst');
      return conflictCheck(args);
    });

    const handler = new RescheduleBookingHandler(
      prisma as never,
      buildRlsTransaction(prisma) as never,
      buildSettingsHandler() as never,
      buildZoomService() as never,
      buildAvailabilityHandler() as never,
    );

    await handler.execute({
      bookingId: 'book-1',
      newScheduledAt: futureDate,
      changedBy: 'user-1',
    });

    expect(callOrder.indexOf('$executeRaw')).toBeGreaterThanOrEqual(0);
    expect(callOrder.indexOf('$executeRaw')).toBeLessThan(callOrder.indexOf('booking.findFirst'));

    const rawCall = (prisma.$executeRaw as jest.Mock).mock.calls[0];
    expect(rawCall[0].join('')).toMatch(/pg_advisory_xact_lock/);
  });

  it('6c. applies bufferMinutes to the conflict overlap window', async () => {
    (fetchBookingOrFail as jest.Mock).mockResolvedValue(makeBooking({ durationMins: 60 }));
    const prisma = buildPrisma();

    const handler = new RescheduleBookingHandler(
      prisma as never,
      buildRlsTransaction(prisma) as never,
      buildSettingsHandler({ bufferMinutes: 15 }) as never,
      buildZoomService() as never,
      buildAvailabilityHandler() as never,
    );

    await handler.execute({
      bookingId: 'book-1',
      newScheduledAt: futureDate,
      changedBy: 'user-1',
    });

    const newEndsAt = new Date(futureDate.getTime() + 60 * 60_000);
    const bufferMs = 15 * 60_000;
    expect(prisma.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employeeId: 'emp-1',
          id: { not: 'book-1' },
          scheduledAt: { lt: new Date(newEndsAt.getTime() + bufferMs) },
          endsAt: { gt: new Date(futureDate.getTime() - bufferMs) },
        }),
      }),
    );
  });

  it('7. updates booking and creates status log when no conflict', async () => {
    const updated = makeBooking({ scheduledAt: futureDate });
    (fetchBookingOrFail as jest.Mock).mockResolvedValue(makeBooking());
    const prisma = buildPrisma();
    prisma.booking.findUnique.mockResolvedValue(updated);

    const handler = new RescheduleBookingHandler(
      prisma as never,
      buildRlsTransaction(prisma) as never,
      buildSettingsHandler() as never,
      buildZoomService() as never,
      buildAvailabilityHandler() as never,
    );

    const result = await handler.execute({
      bookingId: 'book-1',
      newScheduledAt: futureDate,
      changedBy: 'user-1',
    });

    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'book-1', status: BookingStatus.PENDING }),
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
    const rlsTx = { withTransaction: jest.fn().mockRejectedValueOnce(exclusionError) };

    const handler = new RescheduleBookingHandler(
      prisma as never,
      rlsTx as never,
      buildSettingsHandler() as never,
      buildZoomService() as never,
      buildAvailabilityHandler() as never,
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
    const rlsTx = { withTransaction: jest.fn().mockRejectedValueOnce(otherError) };

    const handler = new RescheduleBookingHandler(
      prisma as never,
      rlsTx as never,
      buildSettingsHandler() as never,
      buildZoomService() as never,
      buildAvailabilityHandler() as never,
    );

    await expect(
      handler.execute({
        bookingId: 'book-1',
        newScheduledAt: futureDate,
        changedBy: 'user-1',
      }),
    ).rejects.toThrow(otherError);
  });

  it('10. writes revisioned Zoom desired state and never PATCHes directly when zoomMeetingId exists', async () => {
    (fetchBookingOrFail as jest.Mock).mockResolvedValue(
      makeBooking({ zoomMeetingId: 'zoom-123' }),
    );
    const prisma = buildPrisma();
    const zoomService = {
      updateMeeting: jest.fn().mockRejectedValue(new Error('zoom fail')),
    };

    const handler = new RescheduleBookingHandler(
      prisma as never,
      buildRlsTransaction(prisma) as never,
      buildSettingsHandler() as never,
      zoomService as never,
      buildAvailabilityHandler() as never,
    );

    await expect(
      handler.execute({
        bookingId: 'book-1',
        newScheduledAt: futureDate,
        changedBy: 'user-1',
        newDurationMins: 90,
      }),
    ).resolves.toBeDefined();

    expect(zoomService.updateMeeting).not.toHaveBeenCalled();
    expect(prisma.bookingZoomSync.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ zoomMeetingId: 'zoom-123', revision: 1, desiredStartAt: futureDate }),
    }));
    expect(prisma.outboxEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ eventType: 'bookings.zoom.reschedule_requested', status: 'PENDING_V2' }),
    }));
  });

  it('11. skips zoom updateMeeting when booking has no zoomMeetingId', async () => {
    (fetchBookingOrFail as jest.Mock).mockResolvedValue(
      makeBooking({ zoomMeetingId: null }),
    );
    const prisma = buildPrisma();
    const zoomService = buildZoomService();

    const handler = new RescheduleBookingHandler(
      prisma as never,
      buildRlsTransaction(prisma) as never,
      buildSettingsHandler() as never,
      zoomService as never,
      buildAvailabilityHandler() as never,
    );

    await handler.execute({
      bookingId: 'book-1',
      newScheduledAt: futureDate,
      changedBy: 'user-1',
    });

    expect(zoomService.updateMeeting).not.toHaveBeenCalled();
  });

  it('12. runs availability validation before rescheduling (with excludeBookingId)', async () => {
    (fetchBookingOrFail as jest.Mock).mockResolvedValue(makeBooking());
    const prisma = buildPrisma();
    const availability = buildAvailabilityHandler();

    const handler = new RescheduleBookingHandler(
      prisma as never,
      buildRlsTransaction(prisma) as never,
      buildSettingsHandler() as never,
      buildZoomService() as never,
      availability as never,
    );

    await handler.execute({
      bookingId: 'book-1',
      newScheduledAt: futureDate,
      changedBy: 'user-1',
    });

    // The availability gate must be consulted for the target slot, excluding
    // the booking being moved (no self-conflict), and BEFORE the DB update.
    expect(availability.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        serviceId: 'svc-1',
        date: futureDate,
        durationMins: 60,
        excludeBookingId: 'book-1',
      }),
    );
    expect(availability.execute.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.booking.updateMany.mock.invocationCallOrder[0],
    );
  });

  it('13. rejects when the new time is not in availability slots', async () => {
    (fetchBookingOrFail as jest.Mock).mockResolvedValue(makeBooking());
    const prisma = buildPrisma();
    const availability = {
      execute: jest.fn().mockResolvedValue([]),
    };

    const handler = new RescheduleBookingHandler(
      prisma as never,
      buildRlsTransaction(prisma) as never,
      buildSettingsHandler() as never,
      buildZoomService() as never,
      availability as never,
    );

    await expect(
      handler.execute({
        bookingId: 'book-1',
        newScheduledAt: futureDate,
        changedBy: 'user-1',
      }),
    ).rejects.toThrow('Selected booking time is not available');
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
  });

  it('14. fails Nest construction when CheckAvailabilityHandler is not provided (no silent bypass)', async () => {
    // Omit CheckAvailabilityHandler from the providers — the handler must not
    // be constructible without it, so a misconfigured container fails loudly
    // instead of silently skipping availability validation.
    const prisma = buildPrisma();
    const moduleBuilder = Test.createTestingModule({
      providers: [
        RescheduleBookingHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: RlsTransactionService, useValue: buildRlsTransaction(prisma) },
        { provide: GetBookingSettingsHandler, useValue: buildSettingsHandler() },
        { provide: ZoomMeetingService, useValue: buildZoomService() },
      ],
    });

    await expect(moduleBuilder.compile()).rejects.toThrow(/CheckAvailabilityHandler/);
  });
});
