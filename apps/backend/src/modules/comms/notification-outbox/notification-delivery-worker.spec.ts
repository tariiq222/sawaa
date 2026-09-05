import { NotificationDeliveryWorker } from './notification-delivery-worker';

describe('NotificationDeliveryWorker', () => {
  const sender = { send: jest.fn() };
  const config = { deliveryEnabled: true } as never;
  let inProviderCall = false;
  const tx = {
    notificationDelivery: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    notificationDeliveryAttempt: {
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    client: { findUnique: jest.fn(), },
    user: { findUnique: jest.fn(), },
    fcmToken: { findFirst: jest.fn(), },
    booking: { findUnique: jest.fn(), },
  };
  const prisma = {
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    notificationDelivery: tx.notificationDelivery,
    notificationDeliveryAttempt: tx.notificationDeliveryAttempt,
  };
  let worker: NotificationDeliveryWorker;

  beforeEach(() => {
    jest.clearAllMocks();
    inProviderCall = false;
    tx.notificationDelivery.findFirst.mockResolvedValue({
      id: 'delivery-1',
      status: 'READY',
      attempts: 1,
      channel: 'EMAIL',
      recipientType: 'CLIENT',
      recipientId: 'client-1',
      targetAddress: 'client@example.com',
      channelPayload: {
        channel: 'EMAIL',
        templateSlug: 'booking-created',
        subject: 'موعد',
        html: '<p>موعد</p>',
      },
      leaseToken: null,
      expiresAt: null,
      intent: { expiresAt: null, consumerKey: 'comms.client-enrolled-client.v2', payload: { kind: 'client-enrolled-client', clientId: 'client-1' } },
    });
    tx.client.findUnique.mockResolvedValue({ isActive: true, deletedAt: null, pushEnabled: true });
    tx.user.findUnique.mockResolvedValue({ isActive: true });
    tx.fcmToken.findFirst.mockResolvedValue({ id: 'token-1' });
    tx.notificationDeliveryAttempt.create.mockResolvedValue({ id: 'attempt-1' });
    tx.notificationDelivery.updateMany.mockImplementation(async () => {
      expect(inProviderCall).toBe(false);
      return { count: 1 };
    });
    tx.notificationDeliveryAttempt.updateMany.mockResolvedValue({ count: 1 });
    worker = new NotificationDeliveryWorker(prisma as never, sender as never, config);
  });

  it('claims before calling the provider and schedules only a proven safe retry', async () => {
    sender.send.mockImplementation(async () => {
      inProviderCall = true;
      try {
        return {
          outcome: 'RETRY_WAIT',
          errorCode: 'RATE_LIMITED',
          retryAfterMs: 120_000,
        };
      } finally {
        inProviderCall = false;
      }
    });

    await worker.process('delivery-1', 3);

    expect(tx.notificationDeliveryAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deliveryId: 'delivery-1',
          attemptNumber: 2,
          leaseToken: expect.any(String),
          outcome: 'STARTED',
        }),
      }),
    );
    expect(sender.send).toHaveBeenCalledTimes(1);
    expect(tx.notificationDelivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'delivery-1',
          leaseToken: expect.any(String),
        }),
        data: expect.objectContaining({
          status: 'RETRY_WAIT',
          outcomeReason: expect.any(String),
        }),
      }),
    );
  });

  it('records UNKNOWN after an ambiguous provider outcome and never blind-resends it', async () => {
    sender.send.mockResolvedValue({ outcome: 'UNKNOWN', errorCode: 'PROVIDER_TIMEOUT' });

    await worker.process('delivery-1', 3);
    expect(sender.send).toHaveBeenCalledTimes(1);

    tx.notificationDelivery.findFirst.mockResolvedValue(null);
    await worker.process('delivery-1', 3);

    expect(sender.send).toHaveBeenCalledTimes(1);
    expect(tx.notificationDelivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'delivery-1', leaseToken: expect.any(String) }),
        data: expect.objectContaining({ status: 'UNKNOWN' }),
      }),
    );
  });

  it('no-ops expired or stale-generation jobs before any provider call', async () => {
    tx.notificationDelivery.findFirst.mockResolvedValue(null);

    await worker.process('expired-or-stale', 99);

    expect(sender.send).not.toHaveBeenCalled();
    expect(tx.notificationDeliveryAttempt.create).not.toHaveBeenCalled();
  });

  it('uses the full retry schedule for later lifetime attempts', async () => {
    tx.notificationDelivery.findFirst.mockResolvedValue({
      id: 'delivery-retry-3',
      status: 'RETRY_WAIT',
      attempts: 2,
      channel: 'EMAIL',
      recipientType: 'CLIENT',
      recipientId: 'client-1',
      targetAddress: 'client@example.com',
      channelPayload: {
        channel: 'EMAIL',
        templateSlug: 'booking-created',
        subject: 'موعد',
        html: '<p>موعد</p>',
      },
      leaseToken: null,
      expiresAt: null,
      intent: { expiresAt: null, consumerKey: 'comms.client-enrolled-client.v2', payload: { kind: 'client-enrolled-client', clientId: 'client-1' } },
    });
    sender.send.mockResolvedValue({ outcome: 'RETRY_WAIT', errorCode: 'RATE_LIMITED' });
    const before = Date.now();

    await worker.process('delivery-retry-3', 4);

    const completion = tx.notificationDelivery.updateMany.mock.calls.find(
      ([args]) => args.data?.status === 'RETRY_WAIT',
    )?.[0];
    expect(completion.data.nextAttemptAt.getTime() - before).toBeGreaterThanOrEqual(270_000);
    expect(completion.data.nextAttemptAt.getTime() - before).toBeLessThan(330_000);
  });

  it('does not claim when delivery is paused', async () => {
    const paused = new NotificationDeliveryWorker(
      prisma as never,
      sender as never,
      { deliveryEnabled: false } as never,
    );

    await paused.process('delivery-1', 3);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('times out a bounded provider call as UNKNOWN without retrying it', async () => {
    jest.useFakeTimers();
    try {
      sender.send.mockReturnValue(new Promise(() => undefined));
      const running = worker.process('delivery-1', 3);

      await jest.advanceTimersByTimeAsync(30_001);
      await expect(running).resolves.toBeUndefined();
      expect(tx.notificationDelivery.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'UNKNOWN',
            outcomeReason: 'AMBIGUOUS_PROVIDER_OUTCOME',
          }),
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('marks an in-app delivery DELIVERED while external success is ACCEPTED', async () => {
    tx.notificationDelivery.findFirst.mockResolvedValue({
      id: 'delivery-in-app',
      status: 'READY',
      attempts: 1,
      channel: 'IN_APP',
      recipientType: 'CLIENT',
      recipientId: 'client-1',
      targetAddress: 'in-app',
      channelPayload: {
        channel: 'IN_APP',
        notificationType: 'BOOKING_CREATED',
        title: 'موعد',
        body: 'تم إنشاء الموعد',
      },
      leaseToken: 'lease-in-app',
      expiresAt: null,
      intent: { expiresAt: null, consumerKey: 'comms.client-enrolled-client.v2', payload: { kind: 'client-enrolled-client', clientId: 'client-1' } },
    });
    sender.send.mockResolvedValue({ outcome: 'DELIVERED' });

    await worker.process('delivery-in-app', 1);

    expect(tx.notificationDelivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'DELIVERED' }),
      }),
    );
  });
});
