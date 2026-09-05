import {
  NOTIFICATION_OUTBOX_JOB,
  NOTIFICATION_OUTBOX_QUEUE,
} from './notification-outbox.config';
import { NotificationDeliveryPublisher } from './notification-delivery-publisher';

describe('NotificationDeliveryPublisher', () => {
  const claimed = [
    { id: 'delivery-1', enqueueGeneration: 4 },
    { id: 'delivery-2', enqueueGeneration: 9 },
  ];
  const queue = { add: jest.fn(), getJob: jest.fn() };
  const bullmq = { getQueue: jest.fn(() => queue) };
  const config = { deliveryEnabled: true } as never;
  const prisma = { $queryRaw: jest.fn(), notificationDelivery: { findMany: jest.fn() } };
  let publisher: NotificationDeliveryPublisher;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$queryRaw.mockResolvedValue(claimed);
    prisma.notificationDelivery.findMany.mockResolvedValue([
      { id: 'delivery-1', enqueueGeneration: 3 },
      { id: 'delivery-2', enqueueGeneration: 8 },
    ]);
    queue.getJob.mockResolvedValue(undefined);
    queue.add.mockResolvedValue({});
    publisher = new NotificationDeliveryPublisher(
      prisma as never,
      bullmq as never,
      config,
    );
  });

  it('claims due rows once and enqueues payload-free generation jobs', async () => {
    const result = await publisher.execute();

    expect(bullmq.getQueue).toHaveBeenCalledWith(NOTIFICATION_OUTBOX_QUEUE);
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(queue.add).toHaveBeenNthCalledWith(
      1,
      NOTIFICATION_OUTBOX_JOB,
      { deliveryId: 'delivery-1', generation: 4 },
      { jobId: 'delivery-1-4', attempts: 1 },
    );
    expect(queue.add).toHaveBeenNthCalledWith(
      2,
      NOTIFICATION_OUTBOX_JOB,
      { deliveryId: 'delivery-2', generation: 9 },
      { jobId: 'delivery-2-9', attempts: 1 },
    );
    expect(queue.add.mock.calls[0][1]).not.toHaveProperty('channelPayload');
    expect(result).toEqual({ examined: 2, changed: 2, failed: 0 });
  });

  it('does not enqueue a duplicate when the atomic claim finds no due rows', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]);

    const result = await publisher.execute();

    expect(queue.add).not.toHaveBeenCalled();
    expect(result).toEqual({ examined: 2, changed: 0, failed: 0 });
  });

  it('does not rotate a generation while the current Redis job is healthy', async () => {
    queue.getJob.mockResolvedValue({ getState: jest.fn().mockResolvedValue('waiting') });

    const result = await publisher.execute();

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
    expect(result).toEqual({ examined: 2, changed: 0, failed: 0 });
  });

  it('does not claim or enqueue while delivery is paused', async () => {
    const paused = new NotificationDeliveryPublisher(
      prisma as never,
      bullmq as never,
      { deliveryEnabled: false } as never,
    );

    const result = await paused.execute();

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
    expect(result).toEqual({ examined: 0, changed: 0, failed: 0 });
  });

  it('reports queue I/O failure without consuming a provider attempt', async () => {
    queue.add.mockRejectedValueOnce(new Error('redis unavailable'));

    const result = await publisher.execute();

    expect(result).toEqual({ examined: 2, changed: 1, failed: 1 });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
