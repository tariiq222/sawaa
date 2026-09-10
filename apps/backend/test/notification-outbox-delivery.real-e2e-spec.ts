import { randomUUID, createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { BullMqService } from '../src/infrastructure/queue/bull-mq.service';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { NotificationOutboxConfig, NOTIFICATION_OUTBOX_QUEUE } from '../src/modules/comms/notification-outbox/notification-outbox.config';
import { NotificationDeliveryWorker } from '../src/modules/comms/notification-outbox/notification-delivery-worker';
import { NotificationDeliveryPublisher } from '../src/modules/comms/notification-outbox/notification-delivery-publisher';
import { NotificationChannelSender } from '../src/modules/comms/notification-outbox/notification-channel-sender';
import { ReconcileSmsDeliveryReceiptsHandler } from '../src/modules/comms/notification-outbox/reconcile-sms-delivery-receipts.handler';
import { ReconcileNotificationDeliveriesHandler } from '../src/modules/comms/notification-outbox/reconcile-notification-deliveries.handler';

function testUrl(name: string, protocol: string): URL {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required; this suite never falls back to development infrastructure`);
  const url = new URL(value);
  if (!url.protocol.startsWith(protocol) || !['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
    throw new Error(`${name} must point at dedicated local test infrastructure`);
  }
  if (protocol === 'postgres' && !/test|e2e/i.test(url.pathname)) throw new Error('A test-only database name is required');
  return url;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('Notification outbox delivery — real PostgreSQL and Redis, fake providers', () => {
  let prisma: PrismaClient;
  let bullmq: BullMqService;
  let clientId: string;
  let clientEmail: string;
  const ownedIntents: string[] = [];
  const ownedJobs: string[] = [];
  const ownedReceipts: string[] = [];
  const enabled = new NotificationOutboxConfig(new ConfigService({
    NOTIFICATION_OUTBOX_CAPTURE_ENABLED: 'true', NOTIFICATION_OUTBOX_DELIVERY_ENABLED: 'true',
    NOTIFICATION_OUTBOX_CUTOVER_AT: '2026-09-05T00:00:00.000Z',
  }));
  const disabled = new NotificationOutboxConfig(new ConfigService({}));
  const db = () => prisma as unknown as PrismaService;

  beforeAll(async () => {
    const database = testUrl('NOTIFICATION_OUTBOX_TEST_DATABASE_URL', 'postgres');
    const redis = testUrl('NOTIFICATION_OUTBOX_TEST_REDIS_URL', 'redis');
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: database.toString() }) });
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    bullmq = new BullMqService(new ConfigService({
      REDIS_HOST: redis.hostname, REDIS_PORT: Number(redis.port || 6379),
      REDIS_DB: Number(redis.pathname.slice(1) || 0), REDIS_PASSWORD: redis.password || undefined,
    }));
    await bullmq.getQueue(NOTIFICATION_OUTBOX_QUEUE).waitUntilReady();
    clientEmail = `outbox-delivery-${randomUUID()}@example.test`;
    const client = await prisma.client.create({ data: { name: 'Outbox delivery test', email: clientEmail, isActive: true, pushEnabled: true } });
    clientId = client.id;
  });

  afterEach(async () => {
    if (!prisma) return;
    if (ownedIntents.length) {
      await prisma.notificationIntent.deleteMany({ where: { id: { in: ownedIntents.splice(0) } } });
    }
    if (ownedReceipts.length) await prisma.smsDelivery.deleteMany({ where: { id: { in: ownedReceipts.splice(0) } } });
    if (bullmq) for (const jobId of ownedJobs.splice(0)) {
      const job = await bullmq.getQueue(NOTIFICATION_OUTBOX_QUEUE).getJob(jobId);
      if (job) await job.remove();
    }
    if (clientId) await prisma.fcmToken.deleteMany({ where: { clientId } });
    if (clientId) await prisma.client.update({ where: { id: clientId }, data: { pushEnabled: true } });
  });

  afterAll(async () => {
    if (bullmq) await bullmq.onModuleDestroy();
    if (prisma) {
      if (clientId) await prisma.client.delete({ where: { id: clientId } });
      await prisma.$disconnect();
    }
  });

  async function delivery(options: { expiresAt?: Date; attempts?: number; nextAttemptAt?: Date; push?: boolean } = {}) {
    const intent = await prisma.notificationIntent.create({ data: {
      sourceKey: `real-delivery-test:${randomUUID()}`, consumerKey: 'comms.client-enrolled-client.v2',
      payloadVersion: 1, payload: { kind: 'client-enrolled-client', clientId, name: 'Outbox delivery test', email: clientEmail },
      payloadHash: 'synthetic-test', status: 'MATERIALIZED', expiresAt: options.expiresAt,
    } });
    ownedIntents.push(intent.id);
    const target = options.push ? `test-token-${randomUUID()}` : clientEmail;
    if (options.push) await prisma.fcmToken.create({ data: { clientId, token: target, platform: 'ANDROID' } });
    return prisma.notificationDelivery.create({ data: {
      intentId: intent.id, recipientType: 'CLIENT', recipientId: clientId,
      channel: options.push ? 'PUSH' : 'EMAIL', targetAddress: target,
      targetKey: createHash('sha256').update(target).digest('hex'),
      channelPayload: options.push
        ? { channel: 'PUSH', title: 'Test', body: 'Test' }
        : { channel: 'EMAIL', templateSlug: 'welcome', subject: 'Frozen test subject', html: '<p>Frozen test</p>' },
      status: 'READY', attempts: options.attempts ?? 0, nextAttemptAt: options.nextAttemptAt, enqueueGeneration: 1,
    } });
  }

  function worker(send: (row: unknown) => Promise<unknown>, config = enabled, client = db()) {
    return new NotificationDeliveryWorker(client, { send } as unknown as NotificationChannelSender, config);
  }

  it('does not send an already queued delivery while delivery is paused', async () => {
    const row = await delivery();
    let calls = 0;
    await worker(async () => { calls++; return { outcome: 'ACCEPTED', providerMessageId: 'fake-1' }; }, disabled).process(row.id, 1);
    expect(calls).toBe(0);
    expect((await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: row.id } })).attempts).toBe(0);
  });

  it('allows only one of two concurrent workers to send the same delivery', async () => {
    const row = await delivery();
    let calls = 0;
    const send = async () => { calls++; return { outcome: 'ACCEPTED', providerName: 'FAKE', providerMessageId: 'fake-race' }; };
    await Promise.all([worker(send).process(row.id, 1), worker(send).process(row.id, 1)]);
    expect(calls).toBe(1);
    expect(await prisma.notificationDeliveryAttempt.count({ where: { deliveryId: row.id } })).toBe(1);
    expect((await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('ACCEPTED');
  });

  it('honors parent intent expiry before making any provider call', async () => {
    const row = await delivery({ expiresAt: new Date(Date.now() - 1000) });
    let calls = 0;
    await worker(async () => { calls++; return { outcome: 'ACCEPTED' }; }).process(row.id, 1);
    expect(calls).toBe(0);
    expect((await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('EXPIRED');
  });

  it('rechecks a client push preference changed after materialization', async () => {
    const row = await delivery({ push: true });
    await prisma.client.update({ where: { id: clientId }, data: { pushEnabled: false } });
    let calls = 0;
    await worker(async () => { calls++; return { outcome: 'ACCEPTED' }; }).process(row.id, 1);
    expect(calls).toBe(0);
    expect((await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('SKIPPED');
  });

  it('does not let an expired worker overwrite UNKNOWN or its attempt outcome', async () => {
    const row = await delivery();
    const entered = deferred<void>();
    const release = deferred<void>();
    const sending = worker(async () => { entered.resolve(); await release.promise; return { outcome: 'ACCEPTED', providerMessageId: 'fake-late' }; }).process(row.id, 1);
    await entered.promise;
    try {
      await prisma.notificationDelivery.update({ where: { id: row.id }, data: { leaseUntil: new Date(Date.now() - 1000) } });
      await new ReconcileNotificationDeliveriesHandler(db(), enabled).execute();
    } finally {
      release.resolve();
      await sending;
    }
    const current = await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: row.id }, include: { deliveryAttempts: true } });
    expect(current.status).toBe('UNKNOWN');
    expect(current.deliveryAttempts).toHaveLength(1);
    expect(current.deliveryAttempts[0].outcome).toBe('UNKNOWN');
  });

  it('does not replay an accepted provider request when persisting acceptance fails', async () => {
    const row = await delivery();
    let failOnce = true;
    const faulty = prisma.$extends({ query: { notificationDelivery: { async updateMany({ args, query }) {
      if (args.data.status === 'ACCEPTED' && failOnce) { failOnce = false; throw new Error('Injected outcome-write failure'); }
      return query(args);
    } } } });
    let calls = 0;
    await worker(async () => { calls++; return { outcome: 'ACCEPTED', providerMessageId: 'fake-accepted' }; }, enabled, faulty as unknown as PrismaService).process(row.id, 1).catch(() => undefined);
    let current = await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: row.id } });
    expect(failOnce).toBe(false);
    expect(['SENDING', 'UNKNOWN']).toContain(current.status);
    if (current.status === 'SENDING') {
      await prisma.notificationDelivery.update({ where: { id: row.id }, data: { leaseUntil: new Date(Date.now() - 1000) } });
      await new ReconcileNotificationDeliveriesHandler(db(), enabled).execute();
    }
    await worker(async () => { calls++; return { outcome: 'ACCEPTED' }; }).process(row.id, 1);
    current = await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: row.id } });
    expect(current.status).toBe('UNKNOWN');
    expect(calls).toBe(1);
  });

  it('uses a longer second retry interval rather than retrying every thirty seconds', async () => {
    const row = await delivery({ attempts: 1 });
    const before = Date.now();
    await worker(async () => ({ outcome: 'RETRY_WAIT', reason: 'SAFE_TRANSIENT', errorCode: 'RATE_LIMITED' })).process(row.id, 1);
    const current = await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: row.id } });
    expect(current.status).toBe('RETRY_WAIT');
    expect(current.attempts).toBe(2);
    expect(current.nextAttemptAt!.getTime() - before).toBeGreaterThanOrEqual(60000);
    expect(current.nextAttemptAt!.getTime() - before).toBeLessThan(180000);
  });

  it('recovers a removed Redis job from the unchanged durable delivery row', async () => {
    const row = await delivery();
    const publisher = new NotificationDeliveryPublisher(db(), bullmq, enabled);
    await publisher.execute();
    const first = await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: row.id } });
    const queue = bullmq.getQueue(NOTIFICATION_OUTBOX_QUEUE);
    const firstId = `${row.id}-${first.enqueueGeneration}`;
    ownedJobs.push(firstId);
    const firstJob = await queue.getJob(firstId);
    expect(firstJob).toBeDefined();
    expect(firstJob!.data).toEqual({ deliveryId: row.id, generation: first.enqueueGeneration });
    expect(firstJob!.opts.attempts).toBe(1);
    await firstJob!.remove();
    await prisma.notificationDelivery.update({ where: { id: row.id }, data: { nextEnqueueAt: new Date(Date.now() - 1000) } });
    await publisher.execute();
    const recovered = await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: row.id } });
    const recoveredId = `${row.id}-${recovered.enqueueGeneration}`;
    ownedJobs.push(recoveredId);
    expect(await queue.getJob(recoveredId)).toBeDefined();
    expect(recovered.attempts).toBe(0);
  });

  it('does not rotate the generation of a healthy waiting job and starve it', async () => {
    const row = await delivery();
    const publisher = new NotificationDeliveryPublisher(db(), bullmq, enabled);
    await publisher.execute();
    const first = await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: row.id } });
    ownedJobs.push(`${row.id}-${first.enqueueGeneration}`);
    await prisma.notificationDelivery.update({ where: { id: row.id }, data: { nextEnqueueAt: new Date(Date.now() - 1000) } });
    await publisher.execute();
    const after = await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: row.id } });
    ownedJobs.push(`${row.id}-${after.enqueueGeneration}`);
    expect(after.enqueueGeneration).toBe(first.enqueueGeneration);
  });

  it('does not publish a future provider retry before it is due', async () => {
    const row = await delivery({ nextAttemptAt: new Date(Date.now() + 600000) });
    await new NotificationDeliveryPublisher(db(), bullmq, enabled).execute();
    const after = await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: row.id } });
    const id = `${row.id}-${after.enqueueGeneration}`;
    ownedJobs.push(id);
    expect(await bullmq.getQueue(NOTIFICATION_OUTBOX_QUEUE).getJob(id)).toBeUndefined();
    expect(after.enqueueGeneration).toBe(1);
  });

  it('rejects an obsolete generation without spending a provider attempt', async () => {
    const row = await delivery();
    await prisma.notificationDelivery.update({ where: { id: row.id }, data: { enqueueGeneration: 2 } });
    let calls = 0;
    await worker(async () => { calls++; return { outcome: 'ACCEPTED' }; }).process(row.id, 1);
    expect(calls).toBe(0);
    expect(await prisma.notificationDeliveryAttempt.count({ where: { deliveryId: row.id } })).toBe(0);
  });

  it('stops safe retries after the fifth lifetime attempt', async () => {
    const row = await delivery({ attempts: 4 });
    let calls = 0;
    const send = async () => { calls++; return { outcome: 'RETRY_WAIT', reason: 'SAFE_TRANSIENT' }; };
    await worker(send).process(row.id, 1);
    await worker(send).process(row.id, 1);
    const current = await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: row.id } });
    expect(current.status).toBe('DEAD');
    expect(current.attempts).toBe(5);
    expect(calls).toBe(1);
  });

  it('does not replay a successful push token when another token has an ambiguous result', async () => {
    const first = await delivery({ push: true });
    const second = await prisma.notificationDelivery.create({ data: {
      intentId: first.intentId, recipientType: 'CLIENT', recipientId: clientId, channel: 'PUSH',
      channelPayload: { channel: 'PUSH', title: 'Test', body: 'Test' }, status: 'READY', enqueueGeneration: 1,
      targetKey: createHash('sha256').update('second-test-token').digest('hex'), targetAddress: 'second-test-token',
    } });
    await prisma.fcmToken.create({ data: { clientId, token: 'second-test-token', platform: 'ANDROID' } });
    const calls: string[] = [];
    const send = async (value: unknown) => {
      const row = value as { id: string };
      calls.push(row.id);
      return row.id === first.id ? { outcome: 'ACCEPTED' } : { outcome: 'UNKNOWN', reason: 'AMBIGUOUS_PROVIDER_OUTCOME' };
    };
    await worker(send).process(first.id, 1);
    await worker(send).process(second.id, 1);
    await worker(send).process(first.id, 1);
    await worker(send).process(second.id, 1);
    expect(calls).toEqual([first.id, second.id]);
    expect((await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: first.id } })).status).toBe('ACCEPTED');
    expect((await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: second.id } })).status).toBe('UNKNOWN');
  });

  it('keeps a provider connection failure ambiguous on duplicate jobs', async () => {
    const row = await delivery();
    let calls = 0;
    const send = async () => { calls++; throw new Error('Synthetic provider connection reset'); };
    await worker(send).process(row.id, 1);
    await worker(send).process(row.id, 1);
    expect((await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('UNKNOWN');
    expect(calls).toBe(1);
  });

  async function smsReceipt(status: 'DELIVERED' | 'FAILED') {
    const row = await delivery();
    const messageId = `real-receipt-${randomUUID()}`;
    await prisma.notificationDelivery.update({ where: { id: row.id }, data: {
      channel: 'SMS', status: 'ACCEPTED', providerName: 'TAQNYAT', providerMessageId: messageId, acceptedAt: new Date(),
    } });
    const receipt = await prisma.smsDelivery.create({ data: {
      provider: 'TAQNYAT', toPhone: '+966500000000', body: 'Synthetic receipt test', bodyHash: 'test',
      status, providerMessageId: messageId,
    } });
    ownedReceipts.push(receipt.id);
    return row;
  }

  it('promotes an accepted SMS only after the existing receipt confirms delivery', async () => {
    const row = await smsReceipt('DELIVERED');
    await new ReconcileSmsDeliveryReceiptsHandler(db(), enabled).execute();
    expect((await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('DELIVERED');
  });

  it('does not classify an already accepted but failed SMS receipt as safe to resend', async () => {
    const row = await smsReceipt('FAILED');
    await new ReconcileSmsDeliveryReceiptsHandler(db(), enabled).execute();
    const current = await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: row.id } });
    expect(current.status).toBe('DEAD');
    expect(['NO_PROVIDER', 'TEMPLATE_UNAVAILABLE', 'SAFE_TRANSIENT']).not.toContain(current.outcomeReason);
  });


  it('finds a delivered receipt beyond one hundred older accepted SMS rows', async () => {
    const row = await smsReceipt('DELIVERED');
    await prisma.notificationDelivery.createMany({ data: Array.from({ length: 101 }, (_, index) => ({
      intentId: row.intentId, recipientType: 'CLIENT' as const, recipientId: clientId, channel: 'SMS' as const,
      targetKey: `pending-receipt-${index}`, targetAddress: '+966500000000', channelPayload: { channel: 'SMS', body: 'Test' },
      status: 'ACCEPTED' as const, providerName: 'TAQNYAT', providerMessageId: `no-receipt-${randomUUID()}`,
      updatedAt: new Date('2020-01-01T00:00:00Z'),
    })) });
    await new ReconcileSmsDeliveryReceiptsHandler(db(), enabled).execute();
    expect((await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('DELIVERED');
  });


  it.each(['ACCEPTED', 'UNKNOWN'] as const)('preserves %s if validity expires during an already-started provider call', async (outcome) => {
    const row = await delivery({ expiresAt: new Date(Date.now() + 500) });
    let calls = 0;
    await worker(async () => {
      calls++;
      await new Promise((resolve) => setTimeout(resolve, 550));
      return { outcome };
    }).process(row.id, 1);
    expect(calls).toBe(1);
    expect((await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: row.id } })).status).toBe(outcome);
  });

});
