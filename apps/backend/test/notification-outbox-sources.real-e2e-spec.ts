import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { EventBusService } from '../src/infrastructure/events';
import {
  CaptureNotificationIntentHandler,
} from '../src/modules/comms/notification-outbox/capture-notification-intent.handler';
import {
  CaptureReminderNotificationIntentsHandler,
} from '../src/modules/comms/notification-outbox/capture-reminder-notification-intents.handler';
import {
  MaterializeNotificationIntentHandler,
} from '../src/modules/comms/notification-outbox/materialize-notification-intent.handler';
import {
  NotificationOutboxConfig,
} from '../src/modules/comms/notification-outbox/notification-outbox.config';
import {
  NOTIFICATION_OUTBOX_CONSUMERS,
  notificationSourceKey,
  type CaptureNotificationIntent,
} from '../src/modules/comms/notification-outbox/notification-outbox.types';
import {
  ReconcileNotificationSourcesHandler,
} from '../src/modules/comms/notification-outbox/reconcile-notification-sources.handler';
import { RetryDeadNotificationDeliveryHandler } from '../src/modules/comms/notification-outbox/retry-dead-notification-delivery.handler';
import { CreateClientHandler } from '../src/modules/people/clients/create-client.handler';

function testDatabaseUrl(): URL {
  const value = process.env.NOTIFICATION_OUTBOX_TEST_DATABASE_URL;
  if (!value) {
    throw new Error(
      'NOTIFICATION_OUTBOX_TEST_DATABASE_URL is required; this suite never falls back to development infrastructure',
    );
  }
  const url = new URL(value);
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new Error('NOTIFICATION_OUTBOX_TEST_DATABASE_URL must use PostgreSQL');
  }
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
    throw new Error('NOTIFICATION_OUTBOX_TEST_DATABASE_URL must point at local test infrastructure');
  }
  if (!/test|e2e/i.test(url.pathname)) {
    throw new Error('A test-only database name is required');
  }
  return url;
}

type AnyPrisma = PrismaClient & Record<string, any>;

describe('Notification outbox sources — real PostgreSQL acceptance', () => {
  let prisma: AnyPrisma;
  let capture: CaptureNotificationIntentHandler;
  let materialize: MaterializeNotificationIntentHandler;
  let reminderLeadMinutes: number;
  let seededWelcomeTemplate: { slug: string; subject: string; htmlBody: string };
  let seededStaffIds: string[];
  let bookingNumber = 8_000_000;
  let fixtureSettingsId: string | undefined;
  let fixtureTemplateId: string | undefined;
  let fixtureStaffId: string | undefined;

  const ownedClientIds: string[] = [];
  const ownedBookingIds: string[] = [];
  const ownedOutboxIds: string[] = [];
  const ownedIntentIds: string[] = [];
  const ownedSourceKeys: string[] = [];
  const ownedAuditDeliveryIds: string[] = [];

  const db = () => prisma as unknown as PrismaService;

  function config(cutoverAt = new Date(Date.now() - 5 * 60_000)): NotificationOutboxConfig {
    return new NotificationOutboxConfig(
      new ConfigService({
        NOTIFICATION_OUTBOX_CAPTURE_ENABLED: 'true',
        NOTIFICATION_OUTBOX_DELIVERY_ENABLED: 'false',
        NOTIFICATION_OUTBOX_CUTOVER_AT: cutoverAt.toISOString(),
      }),
    );
  }

  function command(
    sourceKey: string,
    consumerKey: (typeof NOTIFICATION_OUTBOX_CONSUMERS)[keyof typeof NOTIFICATION_OUTBOX_CONSUMERS],
    payload: Record<string, unknown>,
    occurredAt = new Date(),
  ): CaptureNotificationIntent {
    return {
      sourceKey,
      consumerKey,
      payloadVersion: 1,
      payload: payload as CaptureNotificationIntent['payload'],
      occurredAt,
    };
  }

  async function createClient(name = `Outbox source ${randomUUID()}`) {
    const id = randomUUID();
    const client = await prisma.client.create({
      data: {
        id,
        name,
        email: `outbox-source-${id}@example.test`,
        isActive: true,
        pushEnabled: false,
      },
    });
    ownedClientIds.push(client.id);
    return client;
  }

  async function createBooking(
    clientId: string,
    scheduledAt: Date,
    status: 'CONFIRMED' | 'CANCELLED' = 'CONFIRMED',
  ) {
    const id = randomUUID();
    const booking = await prisma.booking.create({
      data: {
        id,
        branchId: `branch-${randomUUID()}`,
        clientId,
        employeeId: `employee-${randomUUID()}`,
        deliveryType: 'IN_PERSON',
        status,
        scheduledAt,
        endsAt: new Date(scheduledAt.getTime() + 60 * 60_000),
        durationMins: 60,
        price: '100.00',
        bookingNumber: bookingNumber++,
        serviceNameSnapshot: 'Outbox source acceptance',
      },
    });
    ownedBookingIds.push(booking.id);
    return booking;
  }

  async function captureOwned(input: CaptureNotificationIntent) {
    ownedSourceKeys.push(input.sourceKey);
    const id = await capture.execute(input);
    ownedIntentIds.push(id);
    return id;
  }

  async function ownedNotificationIds() {
    if (!ownedIntentIds.length && !ownedSourceKeys.length && !ownedOutboxIds.length) return [];
    const intents = await prisma.notificationIntent.findMany({
      where: {
        OR: [
          ...(ownedIntentIds.length ? [{ id: { in: ownedIntentIds } }] : []),
          ...(ownedSourceKeys.length ? [{ sourceKey: { in: ownedSourceKeys } }] : []),
        ...(ownedOutboxIds.length ? [{ sourceOutboxId: { in: ownedOutboxIds } }] : []),
        ],
      },
      select: { id: true },
    });
    if (!intents.length) return [];
    const deliveries = await prisma.notificationDelivery.findMany({
      where: { intentId: { in: intents.map((intent) => intent.id) } },
      select: { notificationId: true },
    });
    return deliveries.flatMap((delivery) => (delivery.notificationId ? [delivery.notificationId] : []));
  }

  beforeAll(async () => {
    const database = testDatabaseUrl();
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: database.toString() }),
    }) as AnyPrisma;
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;

    let settings = await prisma.organizationSettings.findFirst({
      select: { reminderBeforeMinutes: true },
    });
    if (!settings) {
      const created = await prisma.organizationSettings.create({ data: { contactEmail: 'test@example.test' } });
      fixtureSettingsId = created.id;
      settings = created;
    }
    reminderLeadMinutes = settings.reminderBeforeMinutes;

    let welcome = await prisma.emailTemplate.findFirst({
      where: { slug: 'welcome', isActive: true },
      select: { slug: true, subject: true, htmlBody: true },
    });
    if (!welcome) {
      const created = await prisma.emailTemplate.create({ data: { slug: 'welcome', name: 'Outbox acceptance welcome', subject: 'Welcome', htmlBody: '<p>{{client_name}}</p>', isActive: true } });
      fixtureTemplateId = created.id;
      welcome = created;
    }
    seededWelcomeTemplate = welcome;

    const staff = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: ['SUPER_ADMIN', 'ADMIN'] },
      },
      select: { id: true },
    });
    if (!staff.length) {
      const created = await prisma.user.create({ data: { name: 'Outbox acceptance admin', email: `outbox-admin-${randomUUID()}@example.test`, passwordHash: '!test-no-login!', role: 'ADMIN', isActive: true } });
      fixtureStaffId = created.id;
      staff.push({ id: created.id });
    }
    seededStaffIds = staff.map((user) => user.id);

    capture = new CaptureNotificationIntentHandler(db());
    materialize = new MaterializeNotificationIntentHandler(db());
  });

  afterEach(async () => {
    if (!prisma) return;

    if (ownedAuditDeliveryIds.length) await prisma.activityLog.deleteMany({ where: { entity: 'NotificationDelivery', entityId: { in: ownedAuditDeliveryIds.splice(0) } } });
    const notificationIds = await ownedNotificationIds();
    if (notificationIds.length) {
      await prisma.notification.deleteMany({ where: { id: { in: notificationIds } } });
    }

    const intentWhere = {
      OR: [
        ...(ownedIntentIds.length ? [{ id: { in: ownedIntentIds } }] : []),
        ...(ownedSourceKeys.length ? [{ sourceKey: { in: ownedSourceKeys } }] : []),
        ...(ownedOutboxIds.length ? [{ sourceOutboxId: { in: ownedOutboxIds } }] : []),
      ],
    };
    if (ownedIntentIds.length || ownedSourceKeys.length || ownedOutboxIds.length) {
      await prisma.notificationIntent.deleteMany({ where: intentWhere });
    }
    if (ownedOutboxIds.length) {
      await prisma.outboxEvent.deleteMany({ where: { id: { in: ownedOutboxIds } } });
    }
    if (ownedBookingIds.length) {
      await prisma.booking.deleteMany({ where: { id: { in: ownedBookingIds } } });
    }
    if (ownedClientIds.length) {
      await prisma.client.deleteMany({ where: { id: { in: ownedClientIds } } });
    }

    ownedClientIds.splice(0);
    ownedBookingIds.splice(0);
    ownedOutboxIds.splice(0);
    ownedIntentIds.splice(0);
    ownedSourceKeys.splice(0);
  });

  afterAll(async () => {
    if (!prisma) return;
    if (fixtureStaffId) await prisma.user.delete({ where: { id: fixtureStaffId } });
    if (fixtureTemplateId) await prisma.emailTemplate.delete({ where: { id: fixtureTemplateId } });
    if (fixtureSettingsId) await prisma.organizationSettings.delete({ where: { id: fixtureSettingsId } });
    await prisma.$disconnect();
  });

  it('rolls back a client and its captured intent in one transaction after an injected failure', async () => {
    const clientId = randomUUID();
    const sourceKey = notificationSourceKey.clientEnrolled(clientId);
    const input = command(
      sourceKey,
      NOTIFICATION_OUTBOX_CONSUMERS.CLIENT_ENROLLED_CLIENT,
      { kind: 'client-enrolled-client', clientId, name: 'Rollback client', email: `rollback-${clientId}@example.test` },
    );

    await expect(
      prisma.$transaction(async (tx: any) => {
        await tx.client.create({
          data: {
            id: clientId,
            name: 'Rollback client',
            email: `rollback-${clientId}@example.test`,
            isActive: true,
          },
        });
        await capture.execute(input, tx);
        throw new Error('injected transaction failure');
      }),
    ).rejects.toThrow('injected transaction failure');

    expect(await prisma.client.findUnique({ where: { id: clientId } })).toBeNull();
    expect(await prisma.notificationIntent.findUnique({ where: { sourceKey_consumerKey: { sourceKey, consumerKey: input.consumerKey } } })).toBeNull();
  });

  it('keeps the real client enrollment row and both source intents atomic when the second capture fails', async () => {
    const email = `atomic-client-${randomUUID()}@example.test`;
    const beforeIntentIds = new Set((await prisma.notificationIntent.findMany({ select: { id: true } })).map((intent) => intent.id));
    let intentCreates = 0;
    const faulty = prisma.$extends({
      query: {
        notificationIntent: {
          async create({ args, query }) {
            intentCreates += 1;
            if (intentCreates === 2) throw new Error('injected second intent failure');
            return query(args);
          },
        },
      },
    });
    const faultyPrisma = faulty as unknown as PrismaService;
    const fakeEventBus = { publish: jest.fn().mockResolvedValue(undefined) } as unknown as EventBusService;
    const handler = new CreateClientHandler(
      faultyPrisma,
      fakeEventBus,
      new CaptureNotificationIntentHandler(faultyPrisma),
      config(new Date(Date.now() - 5 * 60_000)),
    );

    await expect(handler.execute({
      firstName: 'Atomic',
      lastName: 'Enrollment',
      phone: `+9665${String(Math.floor(Math.random() * 100_000_000)).padStart(8, '0')}`,
      email,
      isActive: true,
    })).rejects.toThrow('injected second intent failure');

    expect(await prisma.client.findFirst({ where: { email } })).toBeNull();
    const afterIntentIds = new Set((await prisma.notificationIntent.findMany({ select: { id: true } })).map((intent) => intent.id));
    expect(afterIntentIds).toEqual(beforeIntentIds);
    expect(fakeEventBus.publish).not.toHaveBeenCalled();
  });

  it('deduplicates concurrent captures, rejects a payload hash conflict, and treats undefined optionals as absent', async () => {
    const client = await createClient('Concurrent capture client');
    const sourceKey = notificationSourceKey.clientEnrolled(client.id);
    const withoutOptional = command(
      sourceKey,
      NOTIFICATION_OUTBOX_CONSUMERS.CLIENT_ENROLLED_CLIENT,
      { kind: 'client-enrolled-client', clientId: client.id, name: client.name, email: client.email },
    );
    const ids = await Promise.all(Array.from({ length: 6 }, () => captureOwned(withoutOptional)));
    expect(new Set(ids).size).toBe(1);

    const equivalentWithUndefined = command(
      sourceKey,
      NOTIFICATION_OUTBOX_CONSUMERS.CLIENT_ENROLLED_CLIENT,
      { kind: 'client-enrolled-client', clientId: client.id, name: client.name, email: client.email, phone: undefined },
    );
    expect(await capture.execute(equivalentWithUndefined)).toBe(ids[0]);

    await expect(
      capture.execute(command(
        sourceKey,
        NOTIFICATION_OUTBOX_CONSUMERS.CLIENT_ENROLLED_CLIENT,
        { kind: 'client-enrolled-client', clientId: client.id, name: 'Changed capture payload', email: client.email },
      )),
    ).rejects.toThrow(/conflict/i);

    expect(await prisma.notificationIntent.count({ where: { sourceKey } })).toBe(1);
  });

  it('materializes one notification per frozen staff recipient under concurrent replay with no duplicate deliveries', async () => {
    const client = await createClient('Materialization race client');
    const sourceKey = notificationSourceKey.clientEnrolled(client.id);
    const intentId = await captureOwned(command(
      sourceKey,
      NOTIFICATION_OUTBOX_CONSUMERS.CLIENT_ENROLLED_STAFF,
      { kind: 'client-enrolled-staff', clientId: client.id, name: client.name },
    ));

    await Promise.all([
      materialize.execute(intentId),
      materialize.execute(intentId),
      materialize.execute(intentId),
    ]);

    const deliveries = await prisma.notificationDelivery.findMany({ where: { intentId } });
    expect(deliveries).toHaveLength(seededStaffIds.length);
    expect(new Set(deliveries.map((delivery) => `${delivery.recipientType}:${delivery.recipientId}:${delivery.channel}:${delivery.targetKey}`)).size).toBe(deliveries.length);
    expect(new Set(deliveries.map((delivery) => delivery.notificationId)).size).toBe(seededStaffIds.length);
    expect(deliveries.every((delivery) => delivery.targetKey === 'in-app' && delivery.targetAddress === 'in-app')).toBe(true);
    expect((await prisma.notificationIntent.findUniqueOrThrow({ where: { id: intentId } })).status).toBe('MATERIALIZED');
  });

  it('rolls back notification rows when delivery createMany fails and leaves the intent pending', async () => {
    const client = await createClient('Materialization rollback client');
    const sourceKey = notificationSourceKey.clientEnrolled(client.id);
    const intentId = await captureOwned(command(
      sourceKey,
      NOTIFICATION_OUTBOX_CONSUMERS.CLIENT_ENROLLED_STAFF,
      { kind: 'client-enrolled-staff', clientId: client.id, name: client.name },
    ));
    const before = await prisma.notification.findMany({ where: { recipientId: { in: seededStaffIds } }, select: { id: true } });
    const faulty = prisma.$extends({
      query: {
        notificationDelivery: {
          async createMany() {
            throw new Error('injected delivery createMany failure');
          },
        },
      },
    });

    await expect(new MaterializeNotificationIntentHandler(faulty as unknown as PrismaService).execute(intentId)).rejects.toThrow('injected delivery createMany failure');
    expect((await prisma.notificationIntent.findUniqueOrThrow({ where: { id: intentId } })).status).toBe('PENDING');
    expect(await prisma.notificationDelivery.count({ where: { intentId } })).toBe(0);
    const after = await prisma.notification.findMany({ where: { recipientId: { in: seededStaffIds } }, select: { id: true } });
    expect(after.map((row) => row.id).sort()).toEqual(before.map((row) => row.id).sort());
  });

  it('renders the active legacy welcome template and keeps frozen email content on repeat materialization', async () => {
    const client = await createClient('Welcome <Alice>');
    const sourceKey = notificationSourceKey.clientEnrolled(client.id);
    const intentId = await captureOwned(command(
      sourceKey,
      NOTIFICATION_OUTBOX_CONSUMERS.CLIENT_ENROLLED_CLIENT,
      { kind: 'client-enrolled-client', clientId: client.id, name: client.name, email: client.email },
    ));

    await materialize.execute(intentId);
    const firstEmail = await prisma.notificationDelivery.findFirstOrThrow({ where: { intentId, channel: 'EMAIL' } });
    const firstPayload = firstEmail.channelPayload as { templateSlug: string; subject: string; html: string };
    expect(firstEmail.targetAddress).toBe(client.email);
    expect(firstPayload.templateSlug).toBe(seededWelcomeTemplate.slug);
    expect(firstPayload.subject).toBe(seededWelcomeTemplate.subject);
    expect(firstPayload.html).toContain('Welcome &lt;Alice&gt;');
    expect(firstPayload.html).not.toBe(seededWelcomeTemplate.htmlBody);

    await materialize.execute(intentId);
    const repeatedEmails = await prisma.notificationDelivery.findMany({ where: { intentId, channel: 'EMAIL' } });
    expect(repeatedEmails).toHaveLength(1);
    expect(repeatedEmails[0].channelPayload).toEqual(firstEmail.channelPayload);
    expect(await prisma.emailTemplate.findFirstOrThrow({ where: { slug: 'welcome' }, select: { subject: true, htmlBody: true } })).toEqual({ subject: seededWelcomeTemplate.subject, htmlBody: seededWelcomeTemplate.htmlBody });
  });

  it('recovers a published source by envelope eventId, deduplicates repeated scans, and preserves the direct enrollment source key', async () => {
    const client = await createClient('Recovered enrollment client');
    const physicalRowId = randomUUID();
    const envelopeEventId = randomUUID();
    const occurredAt = new Date(Date.now() - 1_000);
    const row = await prisma.outboxEvent.create({
      data: {
        id: physicalRowId,
        aggregateId: client.id,
        eventType: 'people.client.enrolled',
        status: 'PUBLISHED',
        payload: {
          eventId: envelopeEventId,
          source: 'people',
          version: 1,
          occurredAt: occurredAt.toISOString(),
          payload: { clientId: client.id, name: client.name, email: client.email },
        },
      },
    });
    ownedOutboxIds.push(row.id);
    const sourceConfig = config(new Date(Date.now() - 5 * 60_000));
    const sourceReconciler = new ReconcileNotificationSourcesHandler(db(), capture, sourceConfig);

    await sourceReconciler.execute();
    await sourceReconciler.execute();

    const sourceKey = notificationSourceKey.clientEnrolled(client.id);
    ownedSourceKeys.push(sourceKey);
    const recovered = await prisma.notificationIntent.findMany({ where: { sourceKey }, orderBy: { consumerKey: 'asc' } });
    expect(recovered).toHaveLength(2);
    expect(recovered.every((intent) => intent.sourceOutboxId === physicalRowId)).toBe(true);
    expect(recovered.map((intent) => intent.sourceKey)).toEqual([sourceKey, sourceKey]);
    expect(await capture.execute(command(
      sourceKey,
      NOTIFICATION_OUTBOX_CONSUMERS.CLIENT_ENROLLED_CLIENT,
      { kind: 'client-enrolled-client', clientId: client.id, name: client.name, email: client.email },
      occurredAt,
    ))).toBe(recovered.find((intent) => intent.consumerKey === NOTIFICATION_OUTBOX_CONSUMERS.CLIENT_ENROLLED_CLIENT)!.id);
    expect(await prisma.notificationIntent.count({ where: { sourceKey } })).toBe(2);

    const unsupportedRow = await prisma.outboxEvent.create({
      data: {
        id: randomUUID(),
        aggregateId: client.id,
        eventType: 'bookings.booking.created',
        status: 'PUBLISHED',
        payload: { eventId: randomUUID(), source: 'bookings', version: 99, occurredAt: occurredAt.toISOString(), payload: { bookingId: randomUUID() } },
      },
    });
    ownedOutboxIds.push(unsupportedRow.id);
    await sourceReconciler.execute();
    const unsupported = await prisma.notificationIntent.findMany({ where: { sourceOutboxId: unsupportedRow.id } });
    expect(unsupported).toHaveLength(1);
    expect(unsupported[0].status).toBe('DEAD');
  });

  it('captures more than one reminder page while excluding a reminder whose dueAt is still in the future', async () => {
    const now = new Date();
    const dueScheduledAt = new Date(now.getTime() + reminderLeadMinutes * 60_000 - 3 * 60_000);
    const futureScheduledAt = new Date(now.getTime() + reminderLeadMinutes * 60_000 + 60 * 60_000);
    const clients = Array.from({ length: 206 }, (_, index) => {
      const id = randomUUID();
      return { id, name: `Reminder client ${index}`, email: `outbox-reminder-${id}@example.test`, isActive: true, pushEnabled: false };
    });
    ownedClientIds.push(...clients.map((client) => client.id));
    const bookings = clients.map((client, index) => ({
      id: randomUUID(),
      branchId: `branch-${randomUUID()}`,
      clientId: client.id,
      employeeId: `employee-${randomUUID()}`,
      deliveryType: 'IN_PERSON' as const,
      status: 'CONFIRMED' as const,
      scheduledAt: index === 205 ? futureScheduledAt : dueScheduledAt,
      endsAt: new Date((index === 205 ? futureScheduledAt : dueScheduledAt).getTime() + 60 * 60_000),
      durationMins: 60,
      price: '100.00',
      bookingNumber: bookingNumber++,
      serviceNameSnapshot: 'Reminder acceptance',
    }));
    ownedBookingIds.push(...bookings.map((booking) => booking.id));
    await prisma.client.createMany({ data: clients });
    await prisma.booking.createMany({ data: bookings });

    const reminderConfig = config(new Date(now.getTime() - 5 * 60_000));
    const result = await new CaptureReminderNotificationIntentsHandler(
      db(),
      capture,
      reminderConfig,
    ).execute();
    const dueKeys = bookings.slice(0, 205).map((booking) => notificationSourceKey.reminder(booking.id, booking.scheduledAt, 1));
    const futureKey = notificationSourceKey.reminder(bookings[205].id, bookings[205].scheduledAt, 1);
    ownedSourceKeys.push(...dueKeys, futureKey);
    const captured = await prisma.notificationIntent.findMany({ where: { sourceKey: { in: [...dueKeys, futureKey] } } });
    ownedIntentIds.push(...captured.map((intent) => intent.id));
    expect(result.failed).toBe(0);
    expect(captured).toHaveLength(205);
    expect(captured.map((intent) => intent.sourceKey)).not.toContain(futureKey);
  });

  it('expires cancelled, rescheduled, and elapsed reminders before materializing any notification', async () => {
    const cancelledClient = await createClient('Cancelled reminder client');
    const rescheduledClient = await createClient('Rescheduled reminder client');
    const elapsedClient = await createClient('Elapsed reminder client');
    const oldScheduledAt = new Date(Date.now() + 30 * 60_000);
    const cancelled = await createBooking(cancelledClient.id, oldScheduledAt);
    const rescheduled = await createBooking(rescheduledClient.id, oldScheduledAt);
    const elapsed = await createBooking(elapsedClient.id, new Date(Date.now() - 30 * 60_000));
    await prisma.booking.update({ where: { id: cancelled.id }, data: { status: 'CANCELLED' } });
    await prisma.booking.update({ where: { id: rescheduled.id }, data: { scheduledAt: new Date(Date.now() + 2 * 60 * 60_000), endsAt: new Date(Date.now() + 3 * 60 * 60_000) } });

    const reminderInputs = ([
      [cancelled, cancelledClient],
      [rescheduled, rescheduledClient],
      [elapsed, elapsedClient],
    ] as const).map(([booking, client]) => {
      const sourceKey = notificationSourceKey.reminder(booking.id, booking.scheduledAt, 1);
      return command(
        sourceKey,
        NOTIFICATION_OUTBOX_CONSUMERS.BOOKING_REMINDER_CLIENT,
        { kind: 'booking-reminder-client', bookingId: booking.id, clientId: client.id, scheduledAt: booking.scheduledAt.toISOString(), clientName: client.name, clientEmail: client.email, policyVersion: 1 },
        new Date(Date.now() - 2 * 60_000),
      );
    });
    const intentIds = await Promise.all(reminderInputs.map(captureOwned));
    await Promise.all(intentIds.map((intentId) => materialize.execute(intentId)));

    const states = await prisma.notificationIntent.findMany({ where: { id: { in: intentIds } }, select: { status: true } });
    expect(states).toHaveLength(3);
    expect(states.every((intent) => intent.status === 'EXPIRED')).toBe(true);
    expect(await prisma.notificationDelivery.count({ where: { intentId: { in: intentIds } } })).toBe(0);
  });

  it('rejects an unsupported payload version without materializing it, either by bounded rejection or DEAD state', async () => {
    const sourceKey = `unsupported-payload:${randomUUID()}`;
    ownedSourceKeys.push(sourceKey);
    const intent = await prisma.notificationIntent.create({
      data: {
        sourceKey,
        consumerKey: NOTIFICATION_OUTBOX_CONSUMERS.CLIENT_ENROLLED_STAFF,
        payloadVersion: 99,
        payload: { kind: 'client-enrolled-staff', clientId: randomUUID(), name: 'Unsupported payload' },
        payloadHash: randomUUID(),
      },
    });
    ownedIntentIds.push(intent.id);

    let rejected = false;
    try {
      await materialize.execute(intent.id);
    } catch {
      rejected = true;
    }
    const current = await prisma.notificationIntent.findUniqueOrThrow({ where: { id: intent.id } });
    expect(rejected || current.status === 'DEAD').toBe(true);
    expect(await prisma.notificationDelivery.count({ where: { intentId: intent.id } })).toBe(0);
  });

  it('recovers a booking by its envelope identity despite a neighboring malformed timestamp', async () => {
    const client = await createClient('Booking event identity');
    const booking = await createBooking(client.id, new Date(Date.now() + 3_600_000));
    const eventId = randomUUID();
    const malformed = await prisma.outboxEvent.create({ data: {
      aggregateId: booking.id, eventType: 'bookings.booking.created', status: 'PUBLISHED',
      payload: { eventId: randomUUID(), source: 'bookings', version: 1, occurredAt: 'invalid-timestamp', payload: { bookingId: booking.id } },
    } });
    ownedOutboxIds.push(malformed.id);
    const valid = await prisma.outboxEvent.create({ data: {
      aggregateId: booking.id, eventType: 'bookings.booking.created', status: 'PUBLISHED',
      payload: { eventId, source: 'bookings', version: 1, occurredAt: new Date().toISOString(), payload: { bookingId: booking.id, bookingNumber: booking.bookingNumber } },
    } });
    ownedOutboxIds.push(valid.id);
    ownedSourceKeys.push(notificationSourceKey.domainEvent(eventId));
    await new ReconcileNotificationSourcesHandler(db(), capture, config()).execute();
    expect(await prisma.notificationIntent.findUnique({ where: { sourceKey_consumerKey: {
      sourceKey: notificationSourceKey.domainEvent(eventId), consumerKey: NOTIFICATION_OUTBOX_CONSUMERS.BOOKING_CREATED_STAFF,
    } } })).toMatchObject({ sourceOutboxId: valid.id, status: 'PENDING' });
    expect(await prisma.notificationIntent.count({ where: { sourceKey: notificationSourceKey.domainEvent(valid.id) } })).toBe(0);
    expect(await prisma.notificationIntent.findFirst({ where: { sourceOutboxId: malformed.id } })).toMatchObject({ status: 'DEAD' });
  });


  it('returns the committed client and durable notifications after the Redis wake-up fails', async () => {
    const email = `committed-client-${randomUUID()}@example.test`;
    const handler = new CreateClientHandler(db(), { publish: jest.fn().mockRejectedValue(new Error('Synthetic Redis outage')) } as unknown as EventBusService, capture, config());
    let result;
    try {
      result = await handler.execute({ firstName: 'Committed', lastName: 'Client', phone: `+9665${String(Math.floor(Math.random() * 100_000_000)).padStart(8, '0')}`, email });
    } finally {
      const client = await prisma.client.findFirst({ where: { email } });
      if (client) { ownedClientIds.push(client.id); ownedSourceKeys.push(notificationSourceKey.clientEnrolled(client.id)); }
    }
    expect(result).toMatchObject({ isExisting: false, email });
    expect(await prisma.notificationIntent.count({ where: { sourceKey: notificationSourceKey.clientEnrolled(result!.id) } })).toBe(2);
  });


  it.each([
    ['people.client.enrolled', { name: 'Missing client identity' }, 2],
    ['bookings.booking.created', { bookingNumber: 123 }, 1],
    ['bookings.booking.cancelled', { bookingId: randomUUID(), clientId: randomUUID(), reason: 42 }, 2],
  ] as const)('quarantines semantically malformed %s sources', async (eventType, payload, count) => {
    const row = await prisma.outboxEvent.create({ data: {
      aggregateId: randomUUID(), eventType, status: 'PUBLISHED',
      payload: { eventId: randomUUID(), source: 'test', version: 1, occurredAt: new Date().toISOString(), payload },
    } });
    ownedOutboxIds.push(row.id);
    await new ReconcileNotificationSourcesHandler(db(), capture, config()).execute();
    const intents = await prisma.notificationIntent.findMany({ where: { sourceOutboxId: row.id } });
    expect(intents).toHaveLength(count);
    expect(intents.every((intent) => intent.status === 'DEAD')).toBe(true);
    expect(await prisma.notificationDelivery.count({ where: { intentId: { in: intents.map((intent) => intent.id) } } })).toBe(0);
  });


  it('repairs a missing-template delivery once within the audited operator transaction', async () => {
    const client = await createClient('Dead <Template>');
    const intentId = await captureOwned(command(notificationSourceKey.clientEnrolled(client.id), NOTIFICATION_OUTBOX_CONSUMERS.CLIENT_ENROLLED_CLIENT,
      { kind: 'client-enrolled-client', clientId: client.id, name: client.name, email: client.email }));
    const row = await prisma.notificationDelivery.create({ data: {
      intentId, recipientType: 'CLIENT', recipientId: client.id, channel: 'EMAIL', targetAddress: client.email!, targetKey: 'frozen-test-target',
      channelPayload: { channel: 'EMAIL', templateSlug: 'welcome', subject: '', html: '' }, status: 'DEAD', outcomeReason: 'TEMPLATE_UNAVAILABLE',
    } });
    ownedAuditDeliveryIds.push(row.id);
    await new RetryDeadNotificationDeliveryHandler(db()).execute({ deliveryId: row.id, actor: 'source-test-operator', reason: 'Template restored' });
    const repaired = await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: row.id } });
    expect(repaired).toMatchObject({ status: 'READY', attempts: 0, targetAddress: client.email, targetKey: 'frozen-test-target' });
    expect((repaired.channelPayload as { html: string }).html).toContain('Dead &lt;Template&gt;');
    expect(await prisma.activityLog.count({ where: { entity: 'NotificationDelivery', entityId: row.id } })).toBe(1);
  });

});
