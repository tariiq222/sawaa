import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { spawnSync } from 'node:child_process';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import type { Queue, Processor, Worker, WorkerOptions } from 'bullmq';
import { PrismaService, RlsTransactionService } from '../../src/infrastructure/database';
import { BullMqService } from '../../src/infrastructure/queue/bull-mq.service';
import { EventBusService } from '../../src/infrastructure/events';
import type { EventHandler } from '../../src/infrastructure/events/event-bus.service';
import { OutboxPublisherCron } from '../../src/modules/ops/cron-tasks/outbox-publisher.cron';
import { PaymentCompletedEventHandler } from '../../src/modules/bookings/payment-completed-handler/payment-completed.handler';
import { PaymentCompletedEvent, type PaymentCompletedPayload } from '../../src/modules/finance/events/payment-completed.event';
import { AppMetricsService } from '../../src/infrastructure/telemetry/app-metrics.service';
import { DEFAULT_ORG_ID } from '../../src/common/constants';

const PAYMENT_EVENT = 'finance.payment.completed';
const PAYMENT_CONSUMER = 'bookings.payment-completed-confirm.v1';
const REDIS_CONTAINER = process.env.OUTBOX_TEST_REDIS_CONTAINER!;
const WORKER_JEST = join(process.cwd(), '../../node_modules/jest/bin/jest.js');

/** Test-only transport bounds keep a stopped dedicated Redis from hanging Jest. */
class IntegrationBullMqService extends BullMqService {
  constructor(config: ConfigService, private readonly queuePrefix: string) {
    super(config);
  }

  override buildConnection() {
    return {
      ...super.buildConnection(),
      connectTimeout: 500,
      retryStrategy: () => null,
    };
  }

  override getQueue(name: string): Queue {
    return super.getQueue(`${this.queuePrefix}--${name}`);
  }

  override createWorker<TData = unknown, TResult = unknown>(
    name: string,
    processor: Processor<TData, TResult>,
    options?: Omit<WorkerOptions, 'connection'>,
  ): Worker<TData, TResult> {
    return super.createWorker(`${this.queuePrefix}--${name}`, processor, options);
  }
}

class RecordingEventBus extends EventBusService {
  constructor(
    bullmq: BullMqService,
    cls: ClsService,
    private readonly receipts: Array<{ eventId: string; consumerId: string }>,
    private readonly interruptAfterHandler: boolean,
  ) {
    super(bullmq, cls);
  }

  override subscribe<TPayload>(
    eventName: string,
    consumerId: string,
    handler: EventHandler<TPayload>,
  ): void {
    const wrapped: EventHandler<TPayload> = async (event) => {
      await handler(event);
      if (eventName !== PAYMENT_EVENT || consumerId !== PAYMENT_CONSUMER) return;
      this.receipts.push({ eventId: event.eventId, consumerId });
      if (this.interruptAfterHandler) process.kill(process.pid, 'SIGKILL');
    };
    super.subscribe(eventName, consumerId, wrapped);
  }
}

type Transport = {
  bullmq: IntegrationBullMqService;
  eventBus: RecordingEventBus;
  publisher: OutboxPublisherCron;
};

describe('real outbox publisher and payment consumer transport', () => {
  let prisma: PrismaService;
  let transport: Transport | undefined;
  const bookingIds: string[] = [];
  const outboxIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    await ensureRedisRunning();
    const pendingOutboxRows = await prisma.outboxEvent.count({
      where: {
        status: { in: ['PENDING', 'PENDING_V2'] },
        failedAt: null,
      },
    });
    if (pendingOutboxRows !== 0) {
      throw new Error(
        `Outbox transport tests require a clean dedicated database; found ${pendingOutboxRows} pending row(s).`,
      );
    }
  });

  afterEach(async () => {
    if (transport) {
      await transport.bullmq.onModuleDestroy().catch(() => undefined);
      transport = undefined;
    }
    await ensureRedisRunning();
  });

  afterAll(async () => {
    await ensureRedisRunning();
    if (bookingIds.length > 0) {
      await prisma.bookingStatusLog.deleteMany({ where: { bookingId: { in: bookingIds } } });
      await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
    }
    if (outboxIds.length > 0) {
      await prisma.outboxEvent.deleteMany({ where: { id: { in: outboxIds } } });
    }
    await prisma.$disconnect();
  });

  it('keeps a committed payment event pending while Redis is unavailable, then delivers it after the real lease expires', async () => {
    const fixture = await createFixture();
    const receipts: Array<{ eventId: string; consumerId: string }> = [];
    const queuePrefix = `outbox-transport-${randomUUID()}`;
    transport = createTransport(queuePrefix, receipts, false);

    await stopDedicatedRedis();
    await transport.publisher.execute();
    const pending = await prisma.outboxEvent.findUnique({ where: { id: fixture.eventId } });
    expect(pending?.status).toBe('PENDING');
    expect(pending?.attemptCount).toBe(1);
    expect(pending?.lockedUntil).toBeInstanceOf(Date);

    await transport.bullmq.onModuleDestroy().catch(() => undefined);
    transport = undefined;
    await startDedicatedRedis();
    await waitUntil(async () => {
      const row = await prisma.outboxEvent.findUnique({ where: { id: fixture.eventId } });
      return !row?.lockedUntil || row.lockedUntil <= new Date();
    }, 35_000);

    transport = createTransport(queuePrefix, receipts, false);
    await transport.publisher.execute();
    await waitUntil(async () => (await prisma.booking.findUnique({ where: { id: fixture.bookingId } }))?.status === 'CONFIRMED');

    expect(receipts).toEqual([{ eventId: fixture.eventId, consumerId: PAYMENT_CONSUMER }]);
    expect(await prisma.bookingStatusLog.count({ where: { bookingId: fixture.bookingId } })).toBe(1);
    expect((await prisma.outboxEvent.findUnique({ where: { id: fixture.eventId } }))?.status).toBe('PUBLISHED');
  }, 60_000);

  it('retries after a worker process interruption without duplicating the real payment confirmation effect', async () => {
    const fixture = await createFixture();
    const consumerId = PAYMENT_CONSUMER;
    const queuePrefix = `outbox-transport-${randomUUID()}`;
    const first = spawnWorkerProcess(fixture, queuePrefix, 'crash-after-handler', true);
    const firstExit = await waitForWorkerExit(first);
    if (firstExit.signal !== 'SIGKILL') {
      throw new Error(`expected the payment consumer worker to be interrupted; observed ${firstExit.signal ?? `exit ${firstExit.code}`}: ${firstExit.output.slice(-2_000)}`);
    }

    const recovery = spawnWorkerProcess(fixture, queuePrefix, 'recover', false);
    const recoveryExit = await waitForWorkerExit(recovery);
    expect(recoveryExit.output).toContain(`RECEIPT ${fixture.eventId} ${consumerId}`);
    expect(recoveryExit.code).toBe(0);

    expect((await prisma.booking.findUnique({ where: { id: fixture.bookingId } }))?.status).toBe('CONFIRMED');
    expect(await prisma.bookingStatusLog.count({ where: { bookingId: fixture.bookingId } })).toBe(1);
  }, 45_000);

  function createTransport(
    queuePrefix: string,
    receipts: Array<{ eventId: string; consumerId: string }>,
    interruptAfterHandler: boolean,
  ): Transport {
    const config = new ConfigService(process.env);
    const bullmq = new IntegrationBullMqService(config, queuePrefix);
    const cls = new ClsService(new AsyncLocalStorage());
    const eventBus = new RecordingEventBus(bullmq, cls, receipts, interruptAfterHandler);
    const handler = new PaymentCompletedEventHandler(
      prisma,
      new RlsTransactionService(prisma),
      eventBus,
      cls,
    );
    handler.register();
    const publisher = new OutboxPublisherCron(prisma, eventBus, new AppMetricsService());
    return { bullmq, eventBus, publisher };
  }

  async function createFixture(): Promise<{ bookingId: string; eventId: string }> {
    const bookingId = randomUUID();
    const paymentId = randomUUID();
    const invoiceId = randomUUID();
    const event = new PaymentCompletedEvent({
      paymentId,
      invoiceId,
      bookingId,
      amount: 100,
      currency: 'SAR',
      organizationId: DEFAULT_ORG_ID,
    } satisfies PaymentCompletedPayload);
    await prisma.$transaction(async (tx) => {
      await tx.booking.create({
        data: {
          id: bookingId,
          // These are cross-BC string references in the Booking schema, so
          // UUIDs are safe fixture values without creating unrelated records.
          branchId: randomUUID(),
          clientId: randomUUID(),
          employeeId: randomUUID(),
          bookingType: 'INDIVIDUAL',
          deliveryType: 'IN_PERSON',
          source: 'RECEPTION',
          status: 'PENDING',
          scheduledAt: new Date(),
          endsAt: new Date(Date.now() + 60 * 60 * 1000),
          durationMins: 60,
          price: '100.00',
          bookingNumber: 900_000_000 + bookingIds.length + Math.floor(Math.random() * 100_000_000),
        },
      });
      await tx.outboxEvent.create({
        data: {
          id: event.eventId,
          aggregateId: bookingId,
          eventType: event.eventName,
          payload: {
            ...event.toEnvelope(),
            occurredAt: event.occurredAt.toISOString(),
            payload: { ...event.payload },
          },
          // Ensure the synthetic event is selected ahead of historical rows.
          createdAt: new Date(0),
        },
      });
    });
    bookingIds.push(bookingId);
    outboxIds.push(event.eventId);
    return { bookingId, eventId: event.eventId };
  }

  function runDocker(command: 'start' | 'stop'): void {
    if (process.env.OUTBOX_TEST_ALLOW_REDIS_FAULT !== '1') {
      throw new Error('Redis fault injection is disabled; set OUTBOX_TEST_ALLOW_REDIS_FAULT=1 for the dedicated lane.');
    }
    const image = spawnSync('docker', ['inspect', '--format', '{{.Config.Image}}', REDIS_CONTAINER], { encoding: 'utf8' });
    if (image.status !== 0 || !/^redis(?::|@)/.test(image.stdout.trim())) {
      throw new Error('fault target is not a Redis container');
    }
    const name = spawnSync('docker', ['inspect', '--format', '{{.Name}}', REDIS_CONTAINER], { encoding: 'utf8' });
    if (name.status !== 0 || !/(test|e2e|ci|safe)/i.test(name.stdout.trim())) {
      throw new Error('fault target container name is not marked test-only');
    }
    const result = spawnSync('docker', [command, REDIS_CONTAINER], { stdio: 'ignore' });
    if (result.status !== 0) throw new Error(`docker ${command} failed for dedicated test Redis`);
  }

  async function stopDedicatedRedis(): Promise<void> {
    runDocker('stop');
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  async function startDedicatedRedis(): Promise<void> {
    runDocker('start');
    await waitForRedis();
  }

  async function ensureRedisRunning(): Promise<void> {
    const probe = redisPing();
    if (probe.status !== 0 || probe.stdout.trim() !== 'PONG') runDocker('start');
    await waitForRedis();
  }

  async function waitForRedis(): Promise<void> {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const result = redisPing();
      if (result.status === 0 && result.stdout.trim() === 'PONG') return;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error('dedicated test Redis did not become ready');
  }

  function redisPing() {
    return spawnSync('docker', ['exec', REDIS_CONTAINER, 'redis-cli', 'ping'], { encoding: 'utf8' });
  }

  async function waitUntil(predicate: () => Promise<boolean>, timeoutMs = 15_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error('timed out waiting for outbox transport state');
  }

  function spawnWorkerProcess(
    fixture: { bookingId: string; eventId: string },
    queuePrefix: string,
    mode: 'crash-after-handler' | 'recover',
    runPublisher: boolean,
  ) {
    return spawn(process.execPath, [WORKER_JEST, '--config', 'test/jest-outbox-worker.json', '--runInBand'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        OUTBOX_TEST_BOOKING_ID: fixture.bookingId,
        OUTBOX_TEST_EVENT_ID: fixture.eventId,
        OUTBOX_TEST_QUEUE_PREFIX: queuePrefix,
        OUTBOX_TEST_MODE: mode,
        OUTBOX_TEST_RUN_PUBLISHER: runPublisher ? '1' : '0',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }

  function waitForWorkerExit(child: ReturnType<typeof spawn>): Promise<{ code: number | null; signal: NodeJS.Signals | null; output: string }> {
    return new Promise((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('outbox worker process did not exit within its test timeout'));
      }, 20_000);
      child.stdout?.on('data', (chunk: Buffer) => { output += chunk.toString(); });
      child.stderr?.on('data', (chunk: Buffer) => { output += chunk.toString(); });
      child.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once('exit', (code, signal) => {
        clearTimeout(timeout);
        resolve({ code, signal, output });
      });
    });
  }
});
