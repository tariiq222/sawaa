import { BookingStatus } from '@prisma/client';
import { BookingNoShowCron } from './booking-noshow.cron';

const CRON_ACTOR = 'system:booking-noshow-cron';

const buildPrisma = (overrides: Record<string, unknown> = {}) => ({
  bookingSettings: {
    findFirst: jest.fn().mockResolvedValue({ autoNoShowAfterMinutes: 30 }),
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

  it('queries only CONFIRMED bookings with no check-in, within the cutoff window', async () => {
    const prisma = buildPrisma();
    const handler = buildNoShowHandler();
    const cron = new BookingNoShowCron(prisma as never, handler as never);

    await cron.execute();

    const call = (prisma.booking.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where.status).toBe(BookingStatus.CONFIRMED);
    expect(call.where.checkedInAt).toBeNull();
    expect(call.where.scheduledAt).toHaveProperty('lte');
  });
});
