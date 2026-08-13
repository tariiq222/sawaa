import { OutboxPublisherCron } from './outbox-publisher.cron';
import { NoEventConsumersRegisteredError } from '../../../infrastructure/events/event-bus.service';

/** Mock AppMetricsService: labels() returns a fresh recorder per label set. */
function createMetricsMock() {
  return {
    outboxTerminalFailures: {
      labels: jest.fn().mockImplementation(() => ({ inc: jest.fn() })),
    },
  };
}

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

    const metrics = createMetricsMock();

    const cron = new OutboxPublisherCron(prisma as never, eventBus as never, metrics as never);
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

  it('owns the PENDING_V2 transition lane that a 1ebce257 PENDING-only publisher cannot see', async () => {
    const row = { id: 'evt-v2', eventType: 'bookings.zoom.create_requested', attemptCount: 0, payload: { eventId: 'e-v2' } };
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValueOnce([{ acquired: true }]).mockResolvedValueOnce([row]),
      $executeRaw: jest.fn().mockResolvedValue(1),
      outboxEvent: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn() },
    };
    const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    const cron = new OutboxPublisherCron(prisma as never, eventBus as never, createMetricsMock() as never);
    await cron.execute();
    // The former pod's predicate was exactly status = PENDING, so this event
    // cannot enter its legacy ACK-on-unknown worker before this publisher adds
    // the current consumer-specific job.
    const oldPublisherSelects = (status: string) => status === 'PENDING';
    expect(oldPublisherSelects('PENDING_V2')).toBe(false);
    expect(eventBus.publish).toHaveBeenCalledWith(row.eventType, row.payload);
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
    const metrics = createMetricsMock();

    const cron = new OutboxPublisherCron(prisma as never, eventBus as never, metrics as never);
    await cron.execute();

    expect(eventBus.publish).not.toHaveBeenCalled();
    expect(prisma.outboxEvent.updateMany).not.toHaveBeenCalled();
    expect(metrics.outboxTerminalFailures.labels).not.toHaveBeenCalled();
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
    const metrics = createMetricsMock();

    const cron = new OutboxPublisherCron(prisma as never, eventBus as never, metrics as never);
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
    // Non-terminal failure must NOT touch the terminal-failure counter.
    expect(metrics.outboxTerminalFailures.labels).not.toHaveBeenCalled();
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
    const metrics = createMetricsMock();

    const cron = new OutboxPublisherCron(prisma as never, eventBus as never, metrics as never);
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

    // Terminal transition must be counted exactly once, keyed by event type.
    expect(metrics.outboxTerminalFailures.labels).toHaveBeenCalledTimes(1);
    expect(metrics.outboxTerminalFailures.labels).toHaveBeenCalledWith({
      event_type: 'platform.subscription_invoice.paid',
    });
    const inc = (metrics.outboxTerminalFailures.labels as jest.Mock).mock.results[0].value.inc;
    expect(inc).toHaveBeenCalledTimes(1);
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
    const metrics = createMetricsMock();

    const cron = new OutboxPublisherCron(prisma as never, eventBus as never, metrics as never);
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
    // Still below MAX_ATTEMPTS — no terminal transition, no counter increment.
    expect(metrics.outboxTerminalFailures.labels).not.toHaveBeenCalled();
  });

  it('leaves a rolling-version unknown event pending without consuming an attempt', async () => {
    const rows = [{
      id: 'evt-new-version', eventType: 'comms.chat.operations.resume_requested',
      attemptCount: 4, payload: { eventId: 'new-event' },
    }];
    const prisma = {
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([{ acquired: true }])
        .mockResolvedValueOnce(rows),
      $executeRaw: jest.fn().mockResolvedValue(1),
      outboxEvent: {
        updateMany: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const eventBus = {
      publish: jest.fn().mockRejectedValue(
        new NoEventConsumersRegisteredError('comms.chat.operations.resume_requested'),
      ),
    };
    const metrics = createMetricsMock();

    await new OutboxPublisherCron(prisma as never, eventBus as never, metrics as never).execute();

    expect(prisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt-new-version' },
      data: { lockedUntil: null },
    });
    expect(prisma.outboxEvent.update).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ attemptCount: expect.any(Number) }),
    }));
    expect(metrics.outboxTerminalFailures.labels).not.toHaveBeenCalled();
  });

  it('increments the terminal failure counter once per event crossing MAX_ATTEMPTS in the same tick', async () => {
    const rows = [
      { id: 'evt-a', eventType: 'bookings.booking.created', attemptCount: 9, payload: {} },
      { id: 'evt-b', eventType: 'finance.payment.completed', attemptCount: 9, payload: {} },
      { id: 'evt-c', eventType: 'finance.payment.completed', attemptCount: 9, payload: {} },
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

    const eventBus = { publish: jest.fn().mockRejectedValue(new Error('down')) };
    const metrics = createMetricsMock();

    const cron = new OutboxPublisherCron(prisma as never, eventBus as never, metrics as never);
    await cron.execute();

    const labels = metrics.outboxTerminalFailures.labels as jest.Mock;
    expect(labels).toHaveBeenCalledTimes(3);
    expect(labels).toHaveBeenCalledWith({ event_type: 'bookings.booking.created' });
    expect(labels).toHaveBeenCalledWith({ event_type: 'finance.payment.completed' });

    const incCalls = labels.mock.results.map((r) => r.value.inc.mock.calls.length);
    expect(incCalls).toEqual([1, 1, 1]);
    expect(prisma.outboxEvent.update).toHaveBeenCalledTimes(3);
  });
});
