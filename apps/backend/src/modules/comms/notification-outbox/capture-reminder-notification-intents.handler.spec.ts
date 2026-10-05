import { PrismaService } from '../../../infrastructure/database';
import { NotificationOutboxConfig } from './notification-outbox.config';
import { CaptureNotificationIntentHandler } from './capture-notification-intent.handler';
import { CaptureReminderNotificationIntentsHandler } from './capture-reminder-notification-intents.handler';

const booking = (id: string, scheduledAt: string) => ({
  id,
  clientId: `client-${id}`,
  scheduledAt: new Date(scheduledAt),
  serviceNameSnapshot: 'استشارة أسرية',
});

const client = (id: string) => ({
  id: `client-${id}`,
  name: `Client ${id}`,
  phone: '+966500000000',
  email: `${id}@example.com`,
});

describe('CaptureReminderNotificationIntentsHandler', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-09-05T10:00:00.000Z')));
  afterEach(() => jest.useRealTimers());

  it('pages beyond 200 bookings and captures all confirmed reminders due by scheduledAt', async () => {
    const firstPage = Array.from({ length: 200 }, (_, index) => booking(`booking-${index}`, '2026-09-05T11:00:00.000Z'));
    const secondPage = [booking('booking-200', '2026-09-05T11:01:00.000Z')];
    const prisma = {
      organizationSettings: { findFirst: jest.fn().mockResolvedValue({ reminderBeforeMinutes: 60 }) },
      booking: { findMany: jest.fn().mockResolvedValueOnce(firstPage).mockResolvedValueOnce(secondPage).mockResolvedValueOnce([]) },
      client: { findMany: jest.fn().mockResolvedValueOnce(firstPage.map((row) => client(row.id))).mockResolvedValueOnce(secondPage.map((row) => client(row.id))) },
      notificationIntent: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const capture = { execute: jest.fn().mockResolvedValue('intent') };
    const config = { shouldCapture: jest.fn().mockReturnValue(true) };
    const handler = new CaptureReminderNotificationIntentsHandler(
      prisma as unknown as PrismaService,
      capture as unknown as CaptureNotificationIntentHandler,
      config as unknown as NotificationOutboxConfig,
    );

    await expect(handler.execute()).resolves.toEqual({ examined: 201, changed: 201, failed: 0 });
    expect(capture.execute).toHaveBeenCalledTimes(201);
    expect(capture.execute).toHaveBeenCalledWith(expect.objectContaining({
      sourceKey: 'booking-reminder:booking-200:2026-09-05T11:01:00.000Z:v1',
      consumerKey: 'comms.booking-reminder-client.v2',
      payload: expect.objectContaining({ policyVersion: 1 }),
    }));
  });

  it('compares cutover to the computed reminder due instant, not scheduledAt', async () => {
    const beforeCutover = booking('booking-before-cutover', '2026-09-05T09:59:00.000Z');
    const atCutover = booking('booking-at-cutover', '2026-09-05T11:00:00.000Z');
    const prisma = {
      organizationSettings: { findFirst: jest.fn().mockResolvedValue({ reminderBeforeMinutes: 60 }) },
      booking: { findMany: jest.fn().mockResolvedValueOnce([beforeCutover, atCutover]).mockResolvedValueOnce([]) },
      client: { findMany: jest.fn().mockResolvedValue([client(beforeCutover.id), client(atCutover.id)]) },
      notificationIntent: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const capture = { execute: jest.fn().mockResolvedValue('intent') };
    const config = { shouldCapture: jest.fn((occurredAt: Date) => occurredAt.getTime() >= new Date('2026-09-05T10:00:00.000Z').getTime()) };
    const handler = new CaptureReminderNotificationIntentsHandler(
      prisma as unknown as PrismaService,
      capture as unknown as CaptureNotificationIntentHandler,
      config as unknown as NotificationOutboxConfig,
    );

    await handler.execute();

    expect(capture.execute).toHaveBeenCalledTimes(1);
    expect(capture.execute).toHaveBeenCalledWith(expect.objectContaining({ sourceKey: 'booking-reminder:booking-at-cutover:2026-09-05T11:00:00.000Z:v1' }));
    expect(config.shouldCapture).toHaveBeenCalledWith(new Date('2026-09-05T10:00:00.000Z'));
  });

  it('queries confirmed and deposit-paid upcoming bookings and never uses Redis for reminder deduplication', async () => {
    const prisma = {
      organizationSettings: { findFirst: jest.fn().mockResolvedValue({ reminderBeforeMinutes: 60 }) },
      booking: { findMany: jest.fn().mockResolvedValueOnce([]) },
      client: { findMany: jest.fn() },
      notificationIntent: { findUnique: jest.fn() },
    };
    const capture = { execute: jest.fn() };
    const handler = new CaptureReminderNotificationIntentsHandler(
      prisma as unknown as PrismaService,
      capture as unknown as CaptureNotificationIntentHandler,
      { shouldCapture: jest.fn().mockReturnValue(true) } as unknown as NotificationOutboxConfig,
    );

    await handler.execute();

    const query = prisma.booking.findMany.mock.calls[0][0];
    expect(query.where.lateEntryRecordedAt).toBeNull();
    expect(query.where.status).toEqual({ in: ['CONFIRMED', 'DEPOSIT_PAID'] });
    expect(query.where.scheduledAt.gt).toEqual(new Date('2026-09-05T10:00:00.000Z'));
    expect(query.where.scheduledAt.lte).toEqual(new Date('2026-09-05T11:00:00.000Z'));
    expect((prisma as unknown as Record<string, unknown>).redis).toBeUndefined();
  });
});
