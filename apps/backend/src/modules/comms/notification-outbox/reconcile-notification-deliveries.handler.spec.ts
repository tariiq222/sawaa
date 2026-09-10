import { ReconcileNotificationDeliveriesHandler } from './reconcile-notification-deliveries.handler';

describe('ReconcileNotificationDeliveriesHandler', () => {
  const expired = [
    { id: 'delivery-1', leaseToken: 'lease-1' },
    { id: 'delivery-2', leaseToken: 'lease-2' },
  ];
  const tx = {
    notificationDelivery: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    notificationDeliveryAttempt: { updateMany: jest.fn() },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  let handler: ReconcileNotificationDeliveriesHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.notificationDelivery.findMany.mockResolvedValue(expired);
    prisma.notificationDelivery.updateMany.mockResolvedValue({ count: 1 });
    prisma.notificationDeliveryAttempt.updateMany.mockResolvedValue({ count: 1 });
    handler = new ReconcileNotificationDeliveriesHandler(prisma as never, {} as never);
  });

  it('fences expired SENDING leases as UNKNOWN and reports partial races', async () => {
    const result = await handler.execute();

    expect(prisma.notificationDelivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'SENDING' }),
      }),
    );
    expect(prisma.notificationDelivery.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.notificationDelivery.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 'delivery-1', status: 'SENDING', leaseToken: 'lease-1' },
        data: expect.objectContaining({ status: 'UNKNOWN' }),
      }),
    );
    expect(result).toEqual({ examined: 2, changed: 2, failed: 0 });
  });

  it('does not retry UNKNOWN rows during lease recovery', async () => {
    prisma.notificationDelivery.findMany.mockResolvedValue([]);

    const result = await handler.execute();

    expect(prisma.notificationDelivery.updateMany).not.toHaveBeenCalled();
    expect(result).toEqual({ examined: 0, changed: 0, failed: 0 });
  });

  it('treats a stale owner race as an unchanged UNKNOWN transition', async () => {
    prisma.notificationDelivery.updateMany.mockResolvedValue({ count: 0 });

    const result = await handler.execute();

    expect(result).toEqual({ examined: 2, changed: 0, failed: 0 });
    expect(prisma.notificationDelivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'SENDING', leaseToken: 'lease-1' }),
        data: expect.objectContaining({ status: 'UNKNOWN' }),
      }),
    );
  });
});
