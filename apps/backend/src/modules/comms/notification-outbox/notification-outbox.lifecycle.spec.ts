import {
  NOTIFICATION_OUTBOX_BACKLOG_WARNING_MS,
  NOTIFICATION_OUTBOX_JOB,
  NOTIFICATION_OUTBOX_QUEUE,
} from './notification-outbox.config';
import { NotificationOutboxLifecycle } from './notification-outbox.lifecycle';

const tick = () => ({ execute: jest.fn().mockResolvedValue({ examined: 0, changed: 0, failed: 0 }) });

describe('NotificationOutboxLifecycle', () => {
  const bullmq = { createWorker: jest.fn() };
  const worker = { process: jest.fn().mockResolvedValue(undefined) };
  const sources = tick();
  const reminders = tick();
  const intents = tick();
  const deliveries = tick();
  const receipts = tick();
  const publisher = tick();

  beforeEach(() => jest.clearAllMocks());

  it('continues durable DB reconciliation while both rollout controls are disabled', async () => {
    const lifecycle = new NotificationOutboxLifecycle(
      { captureEnabled: false, deliveryEnabled: false } as never,
      bullmq as never,
      worker as never,
      sources as never,
      reminders as never,
      intents as never,
      deliveries as never,
      receipts as never,
      publisher as never,
    );

    await lifecycle.execute();

    expect(sources.execute).not.toHaveBeenCalled();
    expect(reminders.execute).not.toHaveBeenCalled();
    expect(intents.execute).toHaveBeenCalledTimes(1);
    expect(deliveries.execute).toHaveBeenCalledTimes(1);
    expect(receipts.execute).toHaveBeenCalledTimes(1);
    expect(publisher.execute).not.toHaveBeenCalled();
  });

  it('registers one payload-free delivery worker and routes ids to the fenced processor', async () => {
    let processor: ((job: { name: string; data: { deliveryId: string; generation: number } }) => Promise<void>) | undefined;
    bullmq.createWorker.mockImplementation((_queue, callback) => {
      processor = callback;
      return { on: jest.fn() };
    });
    const lifecycle = new NotificationOutboxLifecycle(
      { captureEnabled: true, deliveryEnabled: true } as never,
      bullmq as never,
      worker as never,
      sources as never,
      reminders as never,
      intents as never,
      deliveries as never,
      receipts as never,
      publisher as never,
    );

    lifecycle.onModuleInit();
    await processor?.({
      name: NOTIFICATION_OUTBOX_JOB,
      data: { deliveryId: 'delivery-1', generation: 4 },
    });
    await lifecycle.onModuleDestroy();

    expect(bullmq.createWorker).toHaveBeenCalledTimes(1);
    expect(bullmq.createWorker).toHaveBeenCalledWith(
      NOTIFICATION_OUTBOX_QUEUE,
      expect.any(Function),
      expect.any(Object),
    );
    expect(worker.process).toHaveBeenCalledWith('delivery-1', 4);
  });

  it('does not overlap local reconciliation ticks', async () => {
    let release: (() => void) | undefined;
    sources.execute.mockImplementationOnce(
      () => new Promise((resolve) => {
        release = () => resolve({ examined: 1, changed: 1, failed: 0 });
      }),
    );
    const lifecycle = new NotificationOutboxLifecycle(
      { captureEnabled: true, deliveryEnabled: false } as never,
      bullmq as never,
      worker as never,
      sources as never,
      reminders as never,
      intents as never,
      deliveries as never,
      receipts as never,
      publisher as never,
    );

    const first = lifecycle.execute();
    const overlapping = lifecycle.execute();
    release?.();
    await Promise.all([first, overlapping]);

    expect(sources.execute).toHaveBeenCalledTimes(1);
  });

  it('does not advance the successful heartbeat when a component reports failed rows', async () => {
    const failedIntents = {
      execute: jest.fn().mockResolvedValue({ examined: 1, changed: 0, failed: 1 }),
    };
    const metrics = {
      recordReconciliation: jest.fn(),
      setLastSuccessfulHeartbeat: jest.fn(),
    };
    const lifecycle = new NotificationOutboxLifecycle(
      { captureEnabled: false, deliveryEnabled: false } as never,
      bullmq as never,
      worker as never,
      sources as never,
      reminders as never,
      failedIntents as never,
      deliveries as never,
      receipts as never,
      publisher as never,
      undefined,
      metrics as never,
    );

    await lifecycle.execute();

    expect(metrics.recordReconciliation).toHaveBeenCalledWith('intents', 'failure');
    expect(metrics.setLastSuccessfulHeartbeat).not.toHaveBeenCalled();
  });

  it('contains backlog metric query failures so the periodic lifecycle can recover', async () => {
    const prisma = {
      notificationDelivery: {
        count: jest.fn().mockRejectedValue(new Error('database unavailable')),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const metrics = {
      recordReconciliation: jest.fn(),
      setLastSuccessfulHeartbeat: jest.fn(),
    };
    const lifecycle = new NotificationOutboxLifecycle(
      { captureEnabled: false, deliveryEnabled: false } as never,
      bullmq as never,
      worker as never,
      sources as never,
      reminders as never,
      intents as never,
      deliveries as never,
      receipts as never,
      publisher as never,
      prisma as never,
      metrics as never,
    );

    await expect(lifecycle.execute()).resolves.toBeUndefined();

    expect(metrics.recordReconciliation).toHaveBeenCalledWith('backlog-metrics', 'failure');
    expect(metrics.setLastSuccessfulHeartbeat).not.toHaveBeenCalled();
  });

  it('treats a newer oldest due row as progress when backlog count stays constant', async () => {
    const firstCreatedAt = new Date('2026-09-05T10:00:00.000Z');
    const nextCreatedAt = new Date('2026-09-05T10:01:00.000Z');
    const prisma = {
      notificationDelivery: {
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn()
          .mockResolvedValueOnce({ createdAt: firstCreatedAt })
          .mockResolvedValueOnce({ createdAt: nextCreatedAt }),
      },
    };
    const metrics = {
      setBacklog: jest.fn(),
      recordReconciliation: jest.fn(),
      setLastSuccessfulHeartbeat: jest.fn(),
    };
    const lifecycle = new NotificationOutboxLifecycle(
      { captureEnabled: false, deliveryEnabled: false } as never,
      bullmq as never,
      worker as never,
      sources as never,
      reminders as never,
      intents as never,
      deliveries as never,
      receipts as never,
      publisher as never,
      prisma as never,
      metrics as never,
    );
    const internal = lifecycle as unknown as {
      lastBacklogProgressAt: number;
      logger: { warn: (...args: unknown[]) => void };
    };
    const warning = jest.spyOn(internal.logger, 'warn').mockImplementation(() => undefined);

    await lifecycle.execute();
    internal.lastBacklogProgressAt = Date.now() - NOTIFICATION_OUTBOX_BACKLOG_WARNING_MS - 1;
    await lifecycle.execute();

    expect(warning).not.toHaveBeenCalled();
  });
});
