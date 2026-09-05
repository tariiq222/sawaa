import { NotificationOutboxDeliveryStatus } from '@prisma/client';

import { RetryDeadNotificationDeliveryHandler } from './retry-dead-notification-delivery.handler';

describe('RetryDeadNotificationDeliveryHandler', () => {
  const delivery = { findUnique: jest.fn(), updateMany: jest.fn() };
  const activityLog = { create: jest.fn() };
  const emailTemplate = { findFirst: jest.fn() };
  const client = { findUnique: jest.fn() };
  const tx = { notificationDelivery: delivery, activityLog, emailTemplate, client };
  const prisma = {
    $transaction: jest.fn(async (run: (client: typeof tx) => Promise<void>) => run(tx)),
  };
  const handler = new RetryDeadNotificationDeliveryHandler(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('requeues a known-safe DEAD outcome and appends a sanitized audit entry', async () => {
    delivery.findUnique.mockResolvedValue({
      id: 'delivery-1',
      status: NotificationOutboxDeliveryStatus.DEAD,
      attempts: 2,
      outcomeReason: 'NO_PROVIDER',
    });
    delivery.updateMany.mockResolvedValue({ count: 1 });

    await handler.execute({
      deliveryId: 'delivery-1',
      actor: 'operator@example.test',
      reason: 'provider configuration repaired',
    });

    expect(delivery.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'delivery-1',
        status: NotificationOutboxDeliveryStatus.DEAD,
        attempts: 2,
        outcomeReason: 'NO_PROVIDER',
      },
      data: {
        status: NotificationOutboxDeliveryStatus.READY,
        nextAttemptAt: null,
        nextEnqueueAt: null,
        leaseToken: null,
        leaseUntil: null,
        outcomeReason: null,
      },
    });
    expect(activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'SYSTEM',
        entity: 'NotificationDelivery',
        entityId: 'delivery-1',
        description: 'notification_delivery_operator_requeued',
        metadata: {
          actor: 'operator@example.test',
          reason: 'provider configuration repaired',
          priorOutcomeReason: 'NO_PROVIDER',
          priorAttempts: 2,
        },
      }),
    });
  });

  it.each([
    [NotificationOutboxDeliveryStatus.UNKNOWN, 1, 'AMBIGUOUS_PROVIDER_OUTCOME'],
    [NotificationOutboxDeliveryStatus.DEAD, 5, 'SAFE_TRANSIENT'],
    [NotificationOutboxDeliveryStatus.DEAD, 1, 'INVALID_PAYLOAD'],
  ])('rejects unsafe or exhausted state %s without mutation', async (status, attempts, outcomeReason) => {
    delivery.findUnique.mockResolvedValue({ id: 'delivery-1', status, attempts, outcomeReason });

    await expect(
      handler.execute({
        deliveryId: 'delivery-1',
        actor: 'operator@example.test',
        reason: 'manual retry',
      }),
    ).rejects.toThrow();

    expect(delivery.updateMany).not.toHaveBeenCalled();
    expect(activityLog.create).not.toHaveBeenCalled();
  });

  it('repairs and freezes a missing-template email before requeueing it', async () => {
    delivery.findUnique.mockResolvedValue({
      id: 'delivery-1',
      status: NotificationOutboxDeliveryStatus.DEAD,
      attempts: 1,
      outcomeReason: 'TEMPLATE_UNAVAILABLE',
      channel: 'EMAIL',
      channelPayload: { channel: 'EMAIL', templateSlug: 'welcome', subject: '', html: '' },
      intent: {
        consumerKey: 'comms.client-enrolled-client.v2',
        payload: { kind: 'client-enrolled-client', clientId: 'client-1', name: '<سارة>' },
      },
    });
    emailTemplate.findFirst.mockResolvedValue({
      subject: 'مرحباً {{client_name}}',
      htmlBody: '<p>{{client_name}}</p>',
    });
    client.findUnique.mockResolvedValue({ name: 'Current Name' });
    delivery.updateMany.mockResolvedValue({ count: 1 });

    await handler.execute({
      deliveryId: 'delivery-1',
      actor: 'operator@example.test',
      reason: 'template restored',
    });

    expect(delivery.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: NotificationOutboxDeliveryStatus.READY,
        channelPayload: {
          channel: 'EMAIL',
          templateSlug: 'welcome',
          subject: 'مرحباً <سارة>',
          html: '<p>&lt;سارة&gt;</p>',
        },
      }),
    }));
  });

  it('leaves a missing-template delivery DEAD until the template is actually repaired', async () => {
    delivery.findUnique.mockResolvedValue({
      id: 'delivery-1',
      status: NotificationOutboxDeliveryStatus.DEAD,
      attempts: 1,
      outcomeReason: 'TEMPLATE_UNAVAILABLE',
      channel: 'EMAIL',
      channelPayload: { channel: 'EMAIL', templateSlug: 'welcome', subject: '', html: '' },
      intent: {
        consumerKey: 'comms.client-enrolled-client.v2',
        payload: { kind: 'client-enrolled-client', clientId: 'client-1', name: 'سارة' },
      },
    });
    emailTemplate.findFirst.mockResolvedValue(null);

    await expect(handler.execute({
      deliveryId: 'delivery-1',
      actor: 'operator@example.test',
      reason: 'template restored',
    })).rejects.toThrow('template is still unavailable');

    expect(delivery.updateMany).not.toHaveBeenCalled();
    expect(activityLog.create).not.toHaveBeenCalled();
  });
});
