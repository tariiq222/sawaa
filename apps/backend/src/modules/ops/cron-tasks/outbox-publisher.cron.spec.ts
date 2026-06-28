import { OutboxPublisherCron } from './outbox-publisher.cron';

describe('OutboxPublisherCron', () => {
  it('publishes pending outbox events and stamps publishedAt', async () => {
    const rows = [
      { id: 'evt-1', eventType: 'bookings.booking.created', attemptCount: 0, payload: { eventId: 'e1', source: 'bookings', version: 1, occurredAt: new Date(), payload: {} } },
      { id: 'evt-2', eventType: 'bookings.booking.created', attemptCount: 0, payload: { eventId: 'e2', source: 'bookings', version: 1, occurredAt: new Date(), payload: {} } },
    ];

    const prisma = {
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([{ acquired: true }])
        .mockResolvedValueOnce(rows),
      $executeRaw: jest.fn().mockResolvedValue(2),
      outboxEvent: {
        findMany: jest.fn().mockResolvedValue(rows),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };

    const cron = new OutboxPublisherCron(prisma as never, eventBus as never);
    await cron.execute();

    expect(eventBus.publish).toHaveBeenCalledTimes(2);
    expect(eventBus.publish).toHaveBeenCalledWith('bookings.booking.created', rows[0].payload);
    expect(eventBus.publish).toHaveBeenCalledWith('bookings.booking.created', rows[1].payload);

    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['evt-1', 'evt-2'] } },
      data: { status: 'PUBLISHED', publishedAt: expect.any(Date), lockedUntil: null },
    });
  });

  it('is a no-op when no pending events exist', async () => {
    const prisma = {
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([{ acquired: true }])
        .mockResolvedValueOnce([]),
      $executeRaw: jest.fn().mockResolvedValue(1),
      outboxEvent: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
    };
    const eventBus = { publish: jest.fn() };

    const cron = new OutboxPublisherCron(prisma as never, eventBus as never);
    await cron.execute();

    expect(eventBus.publish).not.toHaveBeenCalled();
    expect(prisma.outboxEvent.updateMany).not.toHaveBeenCalled();
  });

  it('skips a failing event but still stamps the successful ones', async () => {
    const rows = [
      { id: 'evt-fail', eventType: 'bookings.booking.created', attemptCount: 0, payload: { eventId: 'bad' } },
      { id: 'evt-ok', eventType: 'bookings.booking.created', attemptCount: 0, payload: { eventId: 'good' } },
    ];

    const prisma = {
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([{ acquired: true }])
        .mockResolvedValueOnce(rows),
      $executeRaw: jest.fn().mockResolvedValue(1),
      outboxEvent: {
        findMany: jest.fn().mockResolvedValue(rows),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    const eventBus = {
      publish: jest.fn()
        .mockRejectedValueOnce(new Error('redis down'))
        .mockResolvedValueOnce(undefined),
    };

    const cron = new OutboxPublisherCron(prisma as never, eventBus as never);
    await cron.execute();

    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['evt-ok'] } },
      data: { status: 'PUBLISHED', publishedAt: expect.any(Date), lockedUntil: null },
    });
    // Failed event should have its attemptCount incremented
    expect(prisma.outboxEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'evt-fail' },
        data: expect.objectContaining({ attemptCount: 1 }),
      }),
    );
  });

  it('marks event as FAILED after max attempts (attemptCount reaches 10)', async () => {
    const rows = [
      { id: 'evt-terminal', eventType: 'platform.subscription_invoice.paid', attemptCount: 9, payload: { organizationId: 'org-A' } },
    ];

    const prisma = {
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([{ acquired: true }])
        .mockResolvedValueOnce(rows),
      $executeRaw: jest.fn().mockResolvedValue(1),
      outboxEvent: {
        findMany: jest.fn().mockResolvedValue(rows),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    const eventBus = {
      publish: jest.fn().mockRejectedValue(new Error('zoho timeout')),
    };

    const cron = new OutboxPublisherCron(prisma as never, eventBus as never);
    await cron.execute();

    const updateManyCalls = (prisma.outboxEvent.updateMany as jest.Mock).mock.calls;
    expect(updateManyCalls.length === 0 || updateManyCalls[0][0].where.id.in.length === 0).toBe(true);

    expect(prisma.outboxEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'evt-terminal' },
        data: expect.objectContaining({
          attemptCount: 10,
          status: 'FAILED',
          failedAt: expect.any(Date),
          failureReason: expect.stringContaining('zoho timeout'),
        }),
      }),
    );
  });

  it('increments attemptCount without marking terminal when below max attempts', async () => {
    const rows = [
      { id: 'evt-retry', eventType: 'platform.subscription_invoice.paid', attemptCount: 3, payload: {} },
    ];

    const prisma = {
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([{ acquired: true }])
        .mockResolvedValueOnce(rows),
      $executeRaw: jest.fn().mockResolvedValue(1),
      outboxEvent: {
        findMany: jest.fn().mockResolvedValue(rows),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    const eventBus = {
      publish: jest.fn().mockRejectedValue(new Error('transient error')),
    };

    const cron = new OutboxPublisherCron(prisma as never, eventBus as never);
    await cron.execute();

    expect(prisma.outboxEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'evt-retry' },
        data: expect.objectContaining({ attemptCount: 4 }),
      }),
    );
    const updateCall = (prisma.outboxEvent.update as jest.Mock).mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(updateCall.data.failedAt).toBeUndefined();
    expect(updateCall.data.status).toBeUndefined();
  });
});
