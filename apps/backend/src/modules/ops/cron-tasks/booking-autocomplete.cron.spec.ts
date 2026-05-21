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
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  bookingStatusLog: {
    create: jest.fn().mockResolvedValue({}),
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

// Lightweight mock — invokes the callback with a tx mirror so update + log
// calls land on tracked jest.fn()s.
const buildRlsTx = (prisma: ReturnType<typeof buildPrisma>) => ({
  withTransaction: jest.fn(async (cb: (tx: any) => Promise<unknown>) => {
    const tx = {
      booking: { update: prisma.booking.update },
      bookingStatusLog: { create: prisma.bookingStatusLog.create },
    };
    return cb(tx);
  }),
});

describe('BookingAutocompleteCron', () => {
  it('executes without throwing', async () => {
    const prisma = buildPrisma();
    const cron = new BookingAutocompleteCron(prisma as never, buildRlsTx(prisma) as never);
    await expect(cron.execute()).resolves.not.toThrow();
  });

  it('selects CONFIRMED bookings past cutoff with checkedInAt set', async () => {
    const prisma = buildPrisma();
    const cron = new BookingAutocompleteCron(prisma as never, buildRlsTx(prisma) as never);
    await cron.execute();
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: BookingStatus.CONFIRMED,
          checkedInAt: { not: null },
        }),
      }),
    );
  });

  it('writes a BookingStatusLog entry for each completed booking', async () => {
    const prisma = buildPrisma();
    prisma.booking.findMany = jest.fn().mockResolvedValue([
      { id: 'b-1', status: BookingStatus.CONFIRMED },
      { id: 'b-2', status: BookingStatus.CONFIRMED },
    ]);
    const rls = buildRlsTx(prisma);
    const cron = new BookingAutocompleteCron(prisma as never, rls as never);
    await cron.execute();
    expect(rls.withTransaction).toHaveBeenCalledTimes(2);
    expect(prisma.bookingStatusLog.create).toHaveBeenCalledTimes(2);
  });

  it('reads bookingSettings once for default org', async () => {
    const prisma = buildPrisma();
    const cron = new BookingAutocompleteCron(prisma as never, buildRlsTx(prisma) as never);
    await cron.execute();
    expect(prisma.bookingSettings.findFirst).toHaveBeenCalledTimes(1);
  });
});

describe('BookingExpiryCron', () => {
  const buildHandler = () => ({ execute: jest.fn().mockResolvedValue(undefined) });

  it('executes without throwing', async () => {
    const prisma = buildPrisma();
    const handler = buildHandler();
    const cron = new BookingExpiryCron(prisma as never, handler as never);
    await expect(cron.execute()).resolves.not.toThrow();
  });

  it('calls findMany to discover expired bookings', async () => {
    const prisma = buildPrisma();
    prisma.booking.findMany = jest.fn().mockResolvedValue([]);
    const handler = buildHandler();
    const cron = new BookingExpiryCron(prisma as never, handler as never);
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
    const cron = new BookingNoShowCron(prisma as never, buildRlsTx(prisma) as never);
    await expect(cron.execute()).resolves.not.toThrow();
  });

  it('selects confirmed bookings past cutoff (no check-in)', async () => {
    const prisma = buildPrisma();
    const cron = new BookingNoShowCron(prisma as never, buildRlsTx(prisma) as never);
    await cron.execute();
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: BookingStatus.CONFIRMED,
          checkedInAt: null,
        }),
      }),
    );
  });

  it('writes a BookingStatusLog entry for each NO_SHOW booking', async () => {
    const prisma = buildPrisma();
    prisma.booking.findMany = jest.fn().mockResolvedValue([
      { id: 'b-1', status: BookingStatus.CONFIRMED },
    ]);
    const rls = buildRlsTx(prisma);
    const cron = new BookingNoShowCron(prisma as never, rls as never);
    await cron.execute();
    expect(rls.withTransaction).toHaveBeenCalledTimes(1);
    expect(prisma.bookingStatusLog.create).toHaveBeenCalledTimes(1);
  });

  it('reads bookingSettings once', async () => {
    const prisma = buildPrisma();
    const cron = new BookingNoShowCron(prisma as never, buildRlsTx(prisma) as never);
    await cron.execute();
    expect(prisma.bookingSettings.findFirst).toHaveBeenCalledTimes(1);
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
