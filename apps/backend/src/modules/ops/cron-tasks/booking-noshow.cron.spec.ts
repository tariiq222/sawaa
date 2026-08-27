import { BookingStatus } from '@prisma/client';
import { BookingNoShowCron } from './booking-noshow.cron';

const CRON_ACTOR = 'system:booking-noshow-cron';

const buildPrisma = (overrides: Record<string, unknown> = {}) => ({
  bookingSettings: {
    findFirst: jest.fn().mockResolvedValue({
      autoNoShowAfterMinutes: 30,
      autoNoShowAfterEnd: true,
    }),
  },
  booking: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  $executeRaw: jest.fn().mockResolvedValue(undefined),
  // cron-leader uses $executeRaw / bookingSettings; other tables not needed
  ...overrides,
});

const buildNoShowHandler = () => ({
  execute: jest.fn().mockResolvedValue(undefined),
});

// withCronLeader is a thin helper that checks for leader election via redis;
// we mock it to simply invoke the callback so we can test the cron body.
jest.mock('../../../common/helpers/cron-leader.helper', () => ({
  withCronLeader: jest.fn((_prisma: unknown, _key: string, fn: () => Promise<void>) => fn()),
}));

describe('BookingNoShowCron', () => {
  it('should be defined', () => {
    expect(BookingNoShowCron).toBeDefined();
  });

  it('does nothing when no eligible bookings are found', async () => {
    const prisma = buildPrisma();
    const handler = buildNoShowHandler();
    const cron = new BookingNoShowCron(prisma as never, handler as never);

    await cron.execute();

    expect(handler.execute).not.toHaveBeenCalled();
  });

  it('delegates each eligible booking to NoShowBookingHandler', async () => {
    const targets = [
      { id: 'book-1' },
      { id: 'book-2' },
    ];
    const prisma = buildPrisma({
      booking: { findMany: jest.fn().mockResolvedValue(targets) },
    });
    const handler = buildNoShowHandler();
    const cron = new BookingNoShowCron(prisma as never, handler as never);

    await cron.execute();

    expect(handler.execute).toHaveBeenCalledTimes(2);
    expect(handler.execute).toHaveBeenCalledWith({ bookingId: 'book-1', changedBy: CRON_ACTOR });
    expect(handler.execute).toHaveBeenCalledWith({ bookingId: 'book-2', changedBy: CRON_ACTOR });
  });

  it('skips a booking that has already transitioned and continues to the next', async () => {
    const targets = [{ id: 'book-1' }, { id: 'book-2' }];
    const prisma = buildPrisma({
      booking: { findMany: jest.fn().mockResolvedValue(targets) },
    });
    const handler = buildNoShowHandler();
    handler.execute
      .mockRejectedValueOnce(new Error('booking already in terminal status'))
      .mockResolvedValueOnce(undefined);

    const cron = new BookingNoShowCron(prisma as never, handler as never);
    await cron.execute();

    // Both attempted; second one succeeds
    expect(handler.execute).toHaveBeenCalledTimes(2);
  });

  it('queries only CONFIRMED bookings with no check-in, defaulting to endsAt cutoff', async () => {
    const prisma = buildPrisma();
    const handler = buildNoShowHandler();
    const cron = new BookingNoShowCron(prisma as never, handler as never);

    await cron.execute();

    const call = (prisma.booking.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where.status).toBe(BookingStatus.CONFIRMED);
    expect(call.where.checkedInAt).toBeNull();
    expect(call.where.isHistoricalImport).toBe(false);
    expect(call.where.endsAt).toHaveProperty('lte');
    expect(call.where.scheduledAt).toBeUndefined();
    expect(call.orderBy).toEqual([{ endsAt: 'asc' }, { id: 'asc' }]);
  });

  it('uses endsAt cutoff when autoNoShowAfterEnd is explicitly true', async () => {
    const prisma = buildPrisma({
      bookingSettings: {
        findFirst: jest.fn().mockResolvedValue({
          autoNoShowAfterMinutes: 30,
          autoNoShowAfterEnd: true,
        }),
      },
    });
    const handler = buildNoShowHandler();
    const cron = new BookingNoShowCron(prisma as never, handler as never);

    await cron.execute();

    const call = (prisma.booking.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where.endsAt).toHaveProperty('lte');
    expect(call.where.scheduledAt).toBeUndefined();
    expect(call.orderBy).toEqual([{ endsAt: 'asc' }, { id: 'asc' }]);
  });

  it('falls back to scheduledAt cutoff when autoNoShowAfterEnd is false (legacy)', async () => {
    const prisma = buildPrisma({
      bookingSettings: {
        findFirst: jest.fn().mockResolvedValue({
          autoNoShowAfterMinutes: 30,
          autoNoShowAfterEnd: false,
        }),
      },
    });
    const handler = buildNoShowHandler();
    const cron = new BookingNoShowCron(prisma as never, handler as never);

    await cron.execute();

    const call = (prisma.booking.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where.scheduledAt).toHaveProperty('lte');
    expect(call.where.endsAt).toBeUndefined();
    expect(call.orderBy).toEqual([{ scheduledAt: 'asc' }, { id: 'asc' }]);
  });

  it('defaults to endsAt when settings returns null', async () => {
    const prisma = buildPrisma({
      bookingSettings: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    });
    const handler = buildNoShowHandler();
    const cron = new BookingNoShowCron(prisma as never, handler as never);

    await cron.execute();

    const call = (prisma.booking.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where.endsAt).toHaveProperty('lte');
    expect(call.orderBy).toEqual([{ endsAt: 'asc' }, { id: 'asc' }]);
  });

  it('does not query bookings or delegate when autoNoShowAfterMinutes is 0', async () => {
    const prisma = buildPrisma({
      bookingSettings: {
        findFirst: jest.fn().mockResolvedValue({
          autoNoShowAfterMinutes: 0,
          autoNoShowAfterEnd: true,
        }),
      },
    });
    const handler = buildNoShowHandler();
    const cron = new BookingNoShowCron(prisma as never, handler as never);

    await cron.execute();

    expect(prisma.booking.findMany).not.toHaveBeenCalled();
    expect(handler.execute).not.toHaveBeenCalled();
  });

  it('queries and delegates when settings returns a positive autoNoShowAfterMinutes', async () => {
    const targets = [{ id: 'book-1' }];
    const prisma = buildPrisma({
      bookingSettings: {
        findFirst: jest.fn().mockResolvedValue({
          autoNoShowAfterMinutes: 45,
          autoNoShowAfterEnd: true,
        }),
      },
      booking: { findMany: jest.fn().mockResolvedValue(targets) },
    });
    const handler = buildNoShowHandler();
    const cron = new BookingNoShowCron(prisma as never, handler as never);

    await cron.execute();

    expect(prisma.booking.findMany).toHaveBeenCalledTimes(1);
    expect(handler.execute).toHaveBeenCalledTimes(1);
    expect(handler.execute).toHaveBeenCalledWith({ bookingId: 'book-1', changedBy: CRON_ACTOR });
  });
});
