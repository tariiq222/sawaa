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

  it.each(['CONFIRMED', 'DEPOSIT_PAID'])('materializes a current future reminder for %s', async status => {
    const scheduledAt = new Date(Date.now() + 3600000);
    const { handler, tx } = build({ ...baseIntent({ kind: 'booking-reminder-client', bookingId: 'booking-1', clientId: 'client-1', scheduledAt: scheduledAt.toISOString(), policyVersion: 1 }), consumerKey: 'comms.booking-reminder-client.v2' });
    tx.booking.findUnique.mockResolvedValue({ status, clientId: 'client-1', scheduledAt });
    tx.client.findUnique.mockResolvedValue({ id: 'client-1', isActive: true, deletedAt: null, pushEnabled: false });
    await handler.execute('intent-1');
    expect(tx.notification.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: 'BOOKING_REMINDER', recipientId: 'client-1' }) }));
  });

  it.each([
    { status: 'CANCELLED', offset: 3600000, changed: false },
    { status: 'DEPOSIT_PAID', offset: -1000, changed: false },
    { status: 'DEPOSIT_PAID', offset: 3600000, changed: true },
  ])('does not materialize an ineligible reminder %p', async ({ status, offset, changed }) => {
    const scheduledAt = new Date(Date.now() + offset);
    const { handler, tx } = build({ ...baseIntent({ kind: 'booking-reminder-client', bookingId: 'booking-1', clientId: 'client-1', scheduledAt: scheduledAt.toISOString(), policyVersion: 1 }), consumerKey: 'comms.booking-reminder-client.v2' });
    tx.booking.findUnique.mockResolvedValue({ status, clientId: 'client-1', scheduledAt: changed ? new Date(scheduledAt.getTime() + 1000) : scheduledAt });
    await handler.execute('intent-1');
    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(tx.notificationIntent.update).toHaveBeenCalledWith({ where: { id: 'intent-1' }, data: { status: 'EXPIRED' } });
  });

  it('freezes client processing/refund details into cancellation notifications', async () => {
    const { handler, tx } = build({ ...baseIntent({ kind: 'booking-cancelled-client', bookingId: 'booking-1', clientId: 'client-1', reason: 'CLIENT_REQUESTED', clientCancellation: { version: 1, initiatedBy: 'CLIENT', refund: { status: 'PROCESSING', refundAmount: 5000, pendingRefundAmount: 0, currency: 'SAR' } } }), consumerKey: 'comms.booking-cancelled-client.v2' });
    tx.client.findUnique.mockResolvedValue({ id: 'client-1', isActive: true, deletedAt: null, pushEnabled: false });
    await handler.execute('intent-1');
    expect(tx.notification.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ body: 'تم إلغاء موعدك. استرداد 50.00 SAR قيد المعالجة.' }) }));
  });

  it('announces program cancellation for retained terminal participants without a false appointment cancellation claim', async () => {
    const { handler, tx } = build({ ...baseIntent({ kind: 'booking-cancelled-client', bookingId: 'booking-1', clientId: 'client-1', reason: 'CENTER', centerCancellation: { version: 1, initiatedBy: 'CENTER', reason: 'إلغاء البرنامج أسرة: تعذر التنفيذ', refund: { refundAmount: 2500, pendingRefundAmount: 0, currency: 'SAR' } } }), consumerKey: 'comms.booking-cancelled-client.v2' });
    tx.client.findUnique.mockResolvedValue({ id: 'client-1', isActive: true, deletedAt: null, pushEnabled: false });
    await handler.execute('intent-1');
    expect(tx.notification.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ title: 'تم إلغاء البرنامج', body: expect.stringContaining('25.00 SAR') }) }));
    expect(tx.notification.create.mock.calls[0][0].data.body).not.toContain('إلغاء موعدك');
  });

  it('freezes truthful center email without using the appointment template and escapes reason text', async () => {
    const { handler, tx } = build({ ...baseIntent({ kind: 'booking-cancelled-client', bookingId: 'booking-1', clientId: 'client-1', reason: 'CENTER', centerCancellation: { version: 1, initiatedBy: 'CENTER', reason: 'إلغاء البرنامج <script>bad</script>', refund: { refundAmount: 2500, pendingRefundAmount: 0, currency: 'SAR' } } }), consumerKey: 'comms.booking-cancelled-client.v2' });
    tx.client.findUnique.mockResolvedValue({ id: 'client-1', name: 'Sara', email: 'sara@example.test', isActive: true, deletedAt: null, pushEnabled: false });
    await handler.execute('intent-1');
    const email = tx.notificationDelivery.createMany.mock.calls[0][0].data.find((row: any) => row.channel === 'EMAIL');
    expect(email.channelPayload.subject).toBe('تم إلغاء البرنامج');
    expect(email.channelPayload.html).toContain('&lt;script&gt;bad&lt;/script&gt;');
    expect(email.channelPayload.html).not.toContain('<script>');
    expect(tx.emailTemplate.findFirst).not.toHaveBeenCalled();
  });

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
    // The mobile app routes a tapped push from these string-only FCM data keys.
    expect(
      deliveryRows
        .filter((row: Record<string, unknown>) => row.channel === 'PUSH')
        .map((row: Record<string, unknown>) => (row.channelPayload as { data?: Record<string, string> }).data),
    ).toEqual([
      { notificationType: 'BOOKING_CANCELLED', bookingId: 'booking-1' },
      { notificationType: 'BOOKING_CANCELLED', bookingId: 'booking-1' },
    ]);
  });

  it('freezes appointment terminology for client cancellation in-app and push content', async () => {
    const { handler, tx } = build({
      ...baseIntent({ kind: 'booking-cancelled-client', bookingId: 'booking-1', clientId: 'client-1', reason: 'OTHER' }),
      consumerKey: 'comms.booking-cancelled-client.v2',
    });
    tx.client.findUnique.mockResolvedValue({ id: 'client-1', isActive: true, deletedAt: null, pushEnabled: true });
    tx.fcmToken.findMany.mockResolvedValue([{ token: 'token-a' }]);

    await handler.execute('intent-1');

    const copy = { title: 'تم إلغاء الموعد', body: 'نأسف، تم إلغاء موعدك.' };
    expect(tx.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining(copy),
    }));
    expect(tx.notificationDelivery.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining(['IN_APP', 'PUSH'].map((channel) => expect.objectContaining({
        channel,
        channelPayload: expect.objectContaining(copy),
      }))),
    });
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
