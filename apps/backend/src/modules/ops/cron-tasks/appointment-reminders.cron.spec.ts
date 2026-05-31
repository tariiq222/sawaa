import { BookingStatus } from '@prisma/client';
import { AppointmentRemindersCron, REMINDER_WINDOW_MINUTES } from './appointment-reminders.cron';

type RedisClient = { get: jest.Mock; set: jest.Mock };

const buildPrisma = (
  bookings: Array<Record<string, unknown>> = [],
  reminderBeforeMinutes: number | null = 60,
) => ({
  // withCronLeader: first $queryRaw → lock id, second → acquired:true, third → unlock
  $queryRaw: jest
    .fn()
    .mockResolvedValueOnce([{ v: BigInt(98765) }])
    .mockResolvedValueOnce([{ acquired: true }])
    .mockResolvedValue([]),
  organizationSettings: {
    findFirst: jest
      .fn()
      .mockResolvedValue(reminderBeforeMinutes === null ? null : { reminderBeforeMinutes }),
  },
  booking: {
    findMany: jest.fn().mockResolvedValue(bookings),
  },
  client: {
    findUnique: jest
      .fn()
      .mockResolvedValue({ name: 'Sara', phone: '+966500000000', email: 'sara@example.com' }),
  },
  service: {
    findUnique: jest.fn().mockResolvedValue({ nameAr: 'استشارة', nameEn: 'Consultation' }),
  },
});

const buildRedis = (existing: string | null = null) => {
  const client: RedisClient = {
    get: jest.fn().mockResolvedValue(existing),
    set: jest.fn().mockResolvedValue('OK'),
  };
  return { service: { getClient: () => client }, client };
};

const buildEventBus = () => ({ publish: jest.fn().mockResolvedValue(undefined) });

describe('AppointmentRemindersCron', () => {
  it('executes without throwing when no bookings match', async () => {
    const prisma = buildPrisma([]);
    const { service: redis } = buildRedis();
    const cron = new AppointmentRemindersCron(prisma as never, redis as never, buildEventBus() as never);
    await expect(cron.execute()).resolves.not.toThrow();
  });

  it('selects CONFIRMED bookings inside the [lead, lead+window) slice', async () => {
    const lead = 60;
    const prisma = buildPrisma([], lead);
    const { service: redis } = buildRedis();
    const cron = new AppointmentRemindersCron(prisma as never, redis as never, buildEventBus() as never);

    const before = Date.now();
    await cron.execute();
    const after = Date.now();

    expect(prisma.booking.findMany).toHaveBeenCalledTimes(1);
    const arg = prisma.booking.findMany.mock.calls[0][0] as {
      where: { status: BookingStatus; scheduledAt: { gte: Date; lt: Date } };
    };
    expect(arg.where.status).toBe(BookingStatus.CONFIRMED);

    const gte = arg.where.scheduledAt.gte.getTime();
    const lt = arg.where.scheduledAt.lt.getTime();
    // window start ≈ now + lead minutes
    expect(gte).toBeGreaterThanOrEqual(before + lead * 60_000);
    expect(gte).toBeLessThanOrEqual(after + lead * 60_000);
    // window width is exactly REMINDER_WINDOW_MINUTES
    expect(lt - gte).toBe(REMINDER_WINDOW_MINUTES * 60_000);
  });

  it('falls back to the default lead time when OrgSettings is missing', async () => {
    const prisma = buildPrisma([], null);
    const { service: redis } = buildRedis();
    const cron = new AppointmentRemindersCron(prisma as never, redis as never, buildEventBus() as never);

    const t0 = Date.now();
    await cron.execute();

    const arg = prisma.booking.findMany.mock.calls[0][0] as {
      where: { scheduledAt: { gte: Date } };
    };
    // default lead = 60 minutes
    expect(arg.where.scheduledAt.gte.getTime()).toBeGreaterThanOrEqual(t0 + 60 * 60_000 - 1000);
  });

  it('publishes a reminder event and marks the booking as reminded in Redis', async () => {
    const booking = {
      id: 'bk-1',
      clientId: 'cl-1',
      scheduledAt: new Date('2026-06-01T10:00:00Z'),
      serviceId: 'sv-1',
      serviceNameSnapshot: null,
    };
    const prisma = buildPrisma([booking]);
    const { service: redis, client } = buildRedis(null);
    const eventBus = buildEventBus();
    const cron = new AppointmentRemindersCron(prisma as never, redis as never, eventBus as never);

    await cron.execute();

    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    const [eventName, envelope] = eventBus.publish.mock.calls[0] as [string, any];
    expect(eventName).toBe('ops.booking.reminder_due');
    expect(envelope.payload).toEqual(
      expect.objectContaining({
        bookingId: 'bk-1',
        clientId: 'cl-1',
        clientName: 'Sara',
        clientPhone: '+966500000000',
        clientEmail: 'sara@example.com',
        serviceName: 'استشارة',
      }),
    );
    // de-dup key written with TTL
    expect(client.set).toHaveBeenCalledWith('reminder:bk-1', '1', 'EX', expect.any(Number));
  });

  it('uses the snapshot service name without querying the service table', async () => {
    const booking = {
      id: 'bk-2',
      clientId: 'cl-2',
      scheduledAt: new Date('2026-06-01T10:00:00Z'),
      serviceId: 'sv-2',
      serviceNameSnapshot: 'جلسة فردية',
    };
    const prisma = buildPrisma([booking]);
    const { service: redis } = buildRedis(null);
    const eventBus = buildEventBus();
    const cron = new AppointmentRemindersCron(prisma as never, redis as never, eventBus as never);

    await cron.execute();

    expect(prisma.service.findUnique).not.toHaveBeenCalled();
    const [, envelope] = eventBus.publish.mock.calls[0] as [string, any];
    expect(envelope.payload.serviceName).toBe('جلسة فردية');
  });

  it('skips a booking that was already reminded (Redis key present)', async () => {
    const booking = {
      id: 'bk-3',
      clientId: 'cl-3',
      scheduledAt: new Date('2026-06-01T10:00:00Z'),
      serviceId: 'sv-3',
      serviceNameSnapshot: 'X',
    };
    const prisma = buildPrisma([booking]);
    const { service: redis, client } = buildRedis('1'); // already reminded
    const eventBus = buildEventBus();
    const cron = new AppointmentRemindersCron(prisma as never, redis as never, eventBus as never);

    await cron.execute();

    expect(eventBus.publish).not.toHaveBeenCalled();
    expect(client.set).not.toHaveBeenCalled();
    // skipped before fetching client/service details
    expect(prisma.client.findUnique).not.toHaveBeenCalled();
  });

  it('continues to other bookings when one publish fails', async () => {
    const bookings = [
      { id: 'bk-a', clientId: 'cl-a', scheduledAt: new Date(), serviceId: 'sv', serviceNameSnapshot: 'A' },
      { id: 'bk-b', clientId: 'cl-b', scheduledAt: new Date(), serviceId: 'sv', serviceNameSnapshot: 'B' },
    ];
    const prisma = buildPrisma(bookings);
    const { service: redis } = buildRedis(null);
    const eventBus = buildEventBus();
    eventBus.publish.mockRejectedValueOnce(new Error('bus down'));
    const cron = new AppointmentRemindersCron(prisma as never, redis as never, eventBus as never);

    await expect(cron.execute()).resolves.not.toThrow();
    expect(eventBus.publish).toHaveBeenCalledTimes(2);
  });
});
