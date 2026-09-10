import { PrismaService } from '../../../infrastructure/database';
import { MaterializeNotificationIntentHandler } from './materialize-notification-intent.handler';

const baseIntent = (payload: Record<string, unknown>) => ({
  id: 'intent-1',
  sourceKey: 'domain-event:event-1',
  consumerKey: 'comms.booking-created-staff.v2',
  payloadVersion: 1,
  payload,
  payloadHash: 'hash',
  status: 'PENDING',
  expiresAt: null,
});

describe('MaterializeNotificationIntentHandler', () => {
  const build = (intent: Record<string, unknown>) => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'intent-1' }]),
      notificationIntent: {
        findUnique: jest.fn().mockResolvedValue(intent),
        update: jest.fn().mockResolvedValue({}),
      },
      notification: { create: jest.fn().mockImplementation(({ data }) => ({ id: `notification-${data.recipientId}` })) },
      notificationDelivery: { create: jest.fn().mockResolvedValue({}), createMany: jest.fn().mockResolvedValue({ count: 0 }) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      booking: { findUnique: jest.fn().mockResolvedValue(null) },
      client: { findUnique: jest.fn().mockResolvedValue(null) },
      fcmToken: { findMany: jest.fn().mockResolvedValue([]) },
      emailTemplate: { findFirst: jest.fn().mockResolvedValue({ subject: 'مرحباً {{client_name}}', htmlBody: '<p>{{client_name}}</p>' }) },
      organizationSettings: { findFirst: jest.fn().mockResolvedValue({ reminderBeforeMinutes: 60 }) },
      service: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const prisma = {
      ...tx,
      $transaction: jest.fn((callback: (value: typeof tx) => unknown) => callback(tx)),
    };
    return { handler: new MaterializeNotificationIntentHandler(prisma as unknown as PrismaService), prisma, tx };
  };

  it('marks an already materialized intent complete without creating duplicate rows', async () => {
    const { handler, prisma } = build({ ...baseIntent({ kind: 'booking-created-staff', bookingId: 'booking-1' }), status: 'MATERIALIZED' });

    await expect(handler.execute('intent-1')).resolves.toBeUndefined();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('marks a semantically invalid captured intent DEAD before creating notifications', async () => {
    const { handler, tx } = build({
      ...baseIntent({ kind: 'client-enrolled-staff', name: 'سارة' }),
      consumerKey: 'comms.client-enrolled-staff.v2',
    });
    tx.user.findMany.mockResolvedValue([{ id: 'admin-1', role: 'ADMIN' }]);

    await handler.execute('intent-1');

    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(tx.notificationDelivery.createMany).not.toHaveBeenCalled();
    expect(tx.notificationIntent.update).toHaveBeenCalledWith({
      where: { id: 'intent-1' },
      data: { status: 'DEAD' },
    });
  });

  it('materializes an empty audience and still marks the intent MATERIALIZED', async () => {
    const { handler, tx } = build(baseIntent({ kind: 'booking-created-staff', bookingId: 'booking-1' }));

    await handler.execute('intent-1');

    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(tx.notificationDelivery.createMany).not.toHaveBeenCalled();
    expect(tx.notificationIntent.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'intent-1' },
      data: expect.objectContaining({ status: 'MATERIALIZED' }),
    }));
  });

  it('freezes one in-app notification and delivery per eligible audience member with a stable target', async () => {
    const { handler, tx } = build(baseIntent({ kind: 'booking-created-staff', bookingId: 'booking-1', bookingNumber: 42, employeeId: 'employee-1' }));
    tx.user.findMany.mockResolvedValue([
      { id: 'admin-1', role: 'ADMIN' },
      { id: 'employee-1', role: 'EMPLOYEE' },
    ]);

    await handler.execute('intent-1');

    expect(tx.notification.create).toHaveBeenCalledTimes(2);
    expect(tx.notificationDelivery.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          intentId: 'intent-1',
          recipientId: 'admin-1',
          channel: 'IN_APP',
          targetKey: 'in-app',
          targetAddress: 'in-app',
        }),
        expect.objectContaining({
          intentId: 'intent-1',
          recipientId: 'employee-1',
          channel: 'IN_APP',
          targetKey: 'in-app',
          targetAddress: 'in-app',
        }),
      ]),
    });
  });

  it('creates one delivery for every push token and hashes external target keys', async () => {
    const { handler, tx } = build({
      ...baseIntent({ kind: 'booking-cancelled-client', bookingId: 'booking-1', clientId: 'client-1', reason: 'OTHER' }),
      consumerKey: 'comms.booking-cancelled-client.v2',
    });
    tx.client.findUnique.mockResolvedValue({ id: 'client-1', isActive: true, deletedAt: null, pushEnabled: true, email: 'client@example.com', phone: '+966500000000', name: 'Client' });
    tx.fcmToken.findMany.mockResolvedValue([{ token: 'token-a' }, { token: 'token-b' }]);

    await handler.execute('intent-1');

    const deliveryRows = tx.notificationDelivery.createMany.mock.calls[0][0].data;
    expect(deliveryRows.filter((row: Record<string, unknown>) => row.channel === 'PUSH')).toHaveLength(2);
    expect(deliveryRows.filter((row: Record<string, unknown>) => row.channel === 'PUSH').map((row: Record<string, unknown>) => row.targetAddress)).toEqual(['token-a', 'token-b']);
    expect(deliveryRows.filter((row: Record<string, unknown>) => row.channel === 'PUSH').every((row: Record<string, unknown>) => row.targetKey !== row.targetAddress)).toBe(true);
  });

  it('rolls back all materialization writes when a delivery write fails', async () => {
    const { handler, tx } = build(baseIntent({ kind: 'booking-created-staff', bookingId: 'booking-1' }));
    tx.user.findMany.mockResolvedValue([{ id: 'admin-1', role: 'ADMIN' }]);
    tx.notificationDelivery.createMany.mockRejectedValue(new Error('delivery insert failed'));

    await expect(handler.execute('intent-1')).rejects.toThrow('delivery insert failed');
    expect(tx.notificationIntent.update).not.toHaveBeenCalled();
  });

  it('resolves current booking contact fields when the captured payload omitted them', async () => {
    const { handler, tx } = build({
      ...baseIntent({ kind: 'booking-cancelled-client', bookingId: 'booking-1', clientId: 'client-1', reason: 'OTHER' }),
      consumerKey: 'comms.booking-cancelled-client.v2',
    });
    tx.client.findUnique.mockResolvedValue({ id: 'client-1', isActive: true, deletedAt: null, pushEnabled: false, email: 'current@example.com', phone: '+966511111111', name: 'Current Name' });

    await handler.execute('intent-1');

    expect(tx.client.findUnique).toHaveBeenCalled();
    expect(tx.notificationDelivery.createMany).toHaveBeenCalledWith({ data: expect.any(Array) });
    const rows = tx.notificationDelivery.createMany.mock.calls[0][0].data;
    expect(rows.some((row: Record<string, unknown>) => row.channel === 'EMAIL' && row.targetAddress === 'current@example.com')).toBe(true);
  });

  it('locks the intent and freezes rendered template content while marking in-app delivered', async () => {
    const { handler, tx } = build({
      ...baseIntent({ kind: 'client-enrolled-client', clientId: 'client-1', name: '<سارة>' }),
      consumerKey: 'comms.client-enrolled-client.v2',
    });
    tx.client.findUnique.mockResolvedValue({ id: 'client-1', isActive: true, deletedAt: null, pushEnabled: false, email: 'client@example.com', phone: null });

    await handler.execute('intent-1');

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    const rows = tx.notificationDelivery.createMany.mock.calls[0][0].data;
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ channel: 'IN_APP', status: 'DELIVERED', deliveredAt: expect.any(Date) }),
      expect.objectContaining({ channel: 'EMAIL', channelPayload: expect.objectContaining({ subject: 'مرحباً <سارة>', html: '<p>&lt;سارة&gt;</p>' }) }),
    ]));
  });
});
