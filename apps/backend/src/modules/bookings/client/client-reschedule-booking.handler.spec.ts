import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { ClientRescheduleBookingHandler } from './client-reschedule-booking.handler';
import { mockBooking, buildPrisma, buildRlsTx } from '../testing/booking-test-helpers';

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

describe('ClientRescheduleBookingHandler', () => {
  it('reschedules a PENDING booking to a new time slot', async () => {
    const prisma = buildPrisma();
    const updatedBooking = {
      ...futureBooking,
      scheduledAt: new Date(Date.now() + 72 * 3_600_000),
      endsAt: new Date(Date.now() + 73 * 3_600_000),
    };
    prisma.booking.findUnique.mockResolvedValue(futureBooking);
    prisma.booking.update.mockResolvedValue(updatedBooking);
    const settings = buildSettingsHandler();
    const handler = new ClientRescheduleBookingHandler(prisma as never, buildRlsTx(prisma) as never, settings as never);

    const result = await handler.execute({
      bookingId: 'book-1',
      clientId: 'client-1',
      newScheduledAt: new Date(Date.now() + 72 * 3_600_000).toISOString(),
    });

    expect(prisma.booking.update).toHaveBeenCalledWith(
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
        reason: 'CLIENT_RESCHEDULE',
        changedBy: 'client-1',
      }),
    });
    expect(result.booking).toBeDefined();
  });

  it('throws ForbiddenException when client does not own the booking', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique.mockResolvedValue(futureBooking);
    const handler = new ClientRescheduleBookingHandler(prisma as never, buildRlsTx(prisma) as never, buildSettingsHandler() as never);

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
    const handler = new ClientRescheduleBookingHandler(prisma as never, buildRlsTx(prisma) as never, buildSettingsHandler() as never);

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
    const handler = new ClientRescheduleBookingHandler(prisma as never, buildRlsTx(prisma) as never, buildSettingsHandler() as never);

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
    const handler = new ClientRescheduleBookingHandler(prisma as never, buildRlsTx(prisma) as never, settings as never);

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
    const handler = new ClientRescheduleBookingHandler(prisma as never, buildRlsTx(prisma) as never, settings as never);

    await expect(
      handler.execute({
        bookingId: 'book-1',
        clientId: 'client-1',
        newScheduledAt: new Date(Date.now() + 72 * 3_600_000).toISOString(),
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
