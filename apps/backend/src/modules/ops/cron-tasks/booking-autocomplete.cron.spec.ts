import { BookingAutocompleteCron } from './booking-autocomplete.cron';
import { BookingExpiryCron } from './booking-expiry.cron';
import { BookingNoShowCron } from './booking-noshow.cron';
import { RefreshTokenCleanupCron } from './refresh-token-cleanup.cron';
import { BookingStatus } from '@prisma/client';

const buildPrisma = () => ({
  $queryRaw: jest.fn()
    .mockResolvedValueOnce([{ acquired: true }]),
  $executeRaw: jest.fn().mockResolvedValue(1),
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
  const buildCompleteHandler = () => ({ execute: jest.fn().mockResolvedValue(undefined) });

  it('executes without throwing', async () => {
    const prisma = buildPrisma();
    const completeHandler = buildCompleteHandler();
    const cron = new BookingAutocompleteCron(prisma as never, completeHandler as never);
    await expect(cron.execute()).resolves.not.toThrow();
  });

  it('selects CONFIRMED bookings past cutoff with checkedInAt set', async () => {
    const prisma = buildPrisma();
    const completeHandler = buildCompleteHandler();
    const cron = new BookingAutocompleteCron(prisma as never, completeHandler as never);
    await cron.execute();
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: BookingStatus.CONFIRMED,
          checkedInAt: { not: null },
        }),
        orderBy: [{ endsAt: 'asc' }, { id: 'asc' }],
        take: 100,
      }),
    );
  });

  it('delegates each autocomplete to CompleteBookingHandler', async () => {
    const prisma = buildPrisma();
    prisma.booking.findMany = jest.fn().mockResolvedValue([
      { id: 'b-1', status: BookingStatus.CONFIRMED },
      { id: 'b-2', status: BookingStatus.CONFIRMED },
    ]);
    const completeHandler = buildCompleteHandler();
    const cron = new BookingAutocompleteCron(prisma as never, completeHandler as never);
    await cron.execute();
    expect(completeHandler.execute).toHaveBeenCalledTimes(2);
    expect(completeHandler.execute).toHaveBeenCalledWith({
      bookingId: 'b-1',
      changedBy: 'system:booking-autocomplete-cron',
    });
    expect(completeHandler.execute).toHaveBeenCalledWith({
      bookingId: 'b-2',
      changedBy: 'system:booking-autocomplete-cron',
    });
  });

  it('reads bookingSettings once for default org', async () => {
    const prisma = buildPrisma();
    const completeHandler = buildCompleteHandler();
    const cron = new BookingAutocompleteCron(prisma as never, completeHandler as never);
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
  const buildNoShowHandler = () => ({ execute: jest.fn().mockResolvedValue(undefined) });

  it('executes without throwing', async () => {
    const prisma = buildPrisma();
    const cron = new BookingNoShowCron(prisma as never, buildNoShowHandler() as never);
    await expect(cron.execute()).resolves.not.toThrow();
  });

  it('selects confirmed bookings past cutoff (no check-in)', async () => {
    const prisma = buildPrisma();
    const cron = new BookingNoShowCron(prisma as never, buildNoShowHandler() as never);
    await cron.execute();
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: BookingStatus.CONFIRMED,
          checkedInAt: null,
        }),
        orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
        take: 100,
      }),
    );
  });

  it('delegates each no-show to NoShowBookingHandler', async () => {
    const prisma = buildPrisma();
    prisma.booking.findMany = jest.fn().mockResolvedValue([
      { id: 'b-1', status: BookingStatus.CONFIRMED },
    ]);
    const noShowHandler = buildNoShowHandler();
    const cron = new BookingNoShowCron(prisma as never, noShowHandler as never);
    await cron.execute();
    expect(noShowHandler.execute).toHaveBeenCalledTimes(1);
    expect(noShowHandler.execute).toHaveBeenCalledWith({
      bookingId: 'b-1',
      changedBy: 'system:booking-noshow-cron',
    });
  });

  it('reads bookingSettings once', async () => {
    const prisma = buildPrisma();
    const cron = new BookingNoShowCron(prisma as never, buildNoShowHandler() as never);
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

// AppointmentRemindersCron has full coverage in appointment-reminders.cron.spec.ts.
