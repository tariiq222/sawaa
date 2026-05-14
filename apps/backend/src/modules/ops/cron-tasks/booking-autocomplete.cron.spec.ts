import { BookingAutocompleteCron } from './booking-autocomplete.cron';
import { BookingExpiryCron } from './booking-expiry.cron';
import { BookingNoShowCron } from './booking-noshow.cron';
import { RefreshTokenCleanupCron } from './refresh-token-cleanup.cron';
import { AppointmentRemindersCron } from './appointment-reminders.cron';
import { BookingStatus } from '@prisma/client';

const buildPrisma = () => ({
  $queryRaw: jest.fn()
    .mockResolvedValueOnce([{ v: BigInt(12345) }])
    .mockResolvedValueOnce([{ acquired: true }]),
  booking: {
    findMany: jest.fn().mockResolvedValue([{}]),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  bookingSettings: {
    findFirst: jest.fn().mockResolvedValue(null),
  },
  refreshToken: {
    deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
  },
  passwordResetToken: {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  waitlistEntry: {
    findMany: jest.fn().mockResolvedValue([]),
  },
});

describe('BookingAutocompleteCron', () => {
  it('executes without throwing', async () => {
    const prisma = buildPrisma();
    const cron = new BookingAutocompleteCron(prisma as never);
    await expect(cron.execute()).resolves.not.toThrow();
  });

  it('calls updateMany with CONFIRMED status and cutoff', async () => {
    const prisma = buildPrisma();
    const cron = new BookingAutocompleteCron(prisma as never);
    await cron.execute();
    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: BookingStatus.CONFIRMED,
        }),
        data: expect.objectContaining({ status: BookingStatus.COMPLETED }),
      }),
    );
  });

  it('reads bookingSettings once for default org', async () => {
    const prisma = buildPrisma();
    const cron = new BookingAutocompleteCron(prisma as never);
    await cron.execute();

    expect(prisma.bookingSettings.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.booking.updateMany).toHaveBeenCalledTimes(1);
  });
});

describe('BookingExpiryCron', () => {
  it('executes without throwing', async () => {
    const prisma = buildPrisma();
    const cron = new BookingExpiryCron(prisma as never);
    await expect(cron.execute()).resolves.not.toThrow();
  });

  it('calls findMany to discover expired bookings', async () => {
    const prisma = buildPrisma();
    prisma.booking.findMany = jest.fn().mockResolvedValue([]);
    prisma.booking.updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const cron = new BookingExpiryCron(prisma as never);
    await cron.execute();
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: expect.objectContaining({ in: expect.arrayContaining([BookingStatus.PENDING]) }),
          expiresAt: expect.anything(),
        }),
      }),
    );
  });
});

describe('BookingNoShowCron', () => {
  it('executes without throwing', async () => {
    const prisma = buildPrisma();
    const cron = new BookingNoShowCron(prisma as never);
    await expect(cron.execute()).resolves.not.toThrow();
  });

  it('marks confirmed bookings past cutoff as NO_SHOW', async () => {
    const prisma = buildPrisma();
    prisma.booking.updateMany = jest.fn().mockResolvedValue({ count: 2 });
    const cron = new BookingNoShowCron(prisma as never);
    await cron.execute();
    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: BookingStatus.CONFIRMED,
        }),
        data: expect.objectContaining({
          status: BookingStatus.NO_SHOW,
        }),
      }),
    );
  });

  it('reads bookingSettings once and calls updateMany once', async () => {
    const prisma = buildPrisma();
    const cron = new BookingNoShowCron(prisma as never);
    await cron.execute();

    expect(prisma.bookingSettings.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.booking.updateMany).toHaveBeenCalledTimes(1);
  });
});

describe('RefreshTokenCleanupCron', () => {
  it('deletes expired tokens', async () => {
    const prisma = buildPrisma();
    const cron = new RefreshTokenCleanupCron(prisma as never);
    await cron.execute();
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ expiresAt: expect.anything() }),
          ]),
        }),
      }),
    );
  });

  it('executes without throwing when no tokens to delete', async () => {
    const prisma = buildPrisma();
    prisma.refreshToken.deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const cron = new RefreshTokenCleanupCron(prisma as never);
    await expect(cron.execute()).resolves.not.toThrow();
  });
});

describe('AppointmentRemindersCron', () => {
  it('executes without throwing', async () => {
    const prisma = buildPrisma();
    const cron = new AppointmentRemindersCron(prisma as never);
    await expect(cron.execute()).resolves.not.toThrow();
  });

  it('checks waitlist entries', async () => {
    const prisma = buildPrisma();
    prisma.waitlistEntry.findMany = jest.fn().mockResolvedValue([{ id: 'w-1' }, { id: 'w-2' }]);
    const cron = new AppointmentRemindersCron(prisma as never);
    await cron.execute();
    expect(prisma.waitlistEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'WAITING' }),
        take: 50,
      }),
    );
  });
});
