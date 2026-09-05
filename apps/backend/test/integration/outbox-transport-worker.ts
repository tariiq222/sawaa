import { AsyncLocalStorage } from 'node:async_hooks';
import { ConfigService } from '@nestjs/config';
import type { Processor, Queue, Worker, WorkerOptions } from 'bullmq';
import { ClsService } from 'nestjs-cls';
import { PrismaService, RlsTransactionService } from '../../src/infrastructure/database';
import { BullMqService } from '../../src/infrastructure/queue/bull-mq.service';
import { EventBusService } from '../../src/infrastructure/events';
import type { EventHandler } from '../../src/infrastructure/events/event-bus.service';
import { OutboxPublisherCron } from '../../src/modules/ops/cron-tasks/outbox-publisher.cron';
import { PaymentCompletedEventHandler } from '../../src/modules/bookings/payment-completed-handler/payment-completed.handler';
import { AppMetricsService } from '../../src/infrastructure/telemetry/app-metrics.service';

const eventId = process.env.OUTBOX_TEST_EVENT_ID;
const queuePrefix = process.env.OUTBOX_TEST_QUEUE_PREFIX;
const mode = process.env.OUTBOX_TEST_MODE;
if (!eventId || !queuePrefix || !['crash-after-handler', 'recover'].includes(mode ?? '')) {
  throw new Error('outbox worker fixture arguments are incomplete');
}

const PAYMENT_EVENT = 'finance.payment.completed';
const PAYMENT_CONSUMER = 'bookings.payment-completed-confirm.v1';

class IntegrationBullMqService extends BullMqService {
  private readonly prefix: string;

  constructor(config: ConfigService, prefix: string) {
    super(config);
    this.prefix = prefix;
  }

  override buildConnection() {
    return {
      ...super.buildConnection(),
      connectTimeout: 500,
      retryStrategy: () => null,
    };
  }

  override getQueue(name: string): Queue {
    return super.getQueue(`${this.prefix}--${name}`);
  }

  override createWorker<TData = unknown, TResult = unknown>(
    name: string,
    processor: Processor<TData, TResult>,
    options?: Omit<WorkerOptions, 'connection'>,
  ): Worker<TData, TResult> {
    return super.createWorker(`${this.prefix}--${name}`, processor, {
      ...options,
      lockDuration: 1_000,
      stalledInterval: 1_000,
    });
  }
}

class RecordingEventBus extends EventBusService {
  private readonly interruptAfterHandler: boolean;
  private readonly onReceipt: () => void;

  constructor(
    bullmq: BullMqService,
    cls: ClsService,
    interruptAfterHandler: boolean,
    onReceipt: () => void,
  ) {
    super(bullmq, cls);
    this.interruptAfterHandler = interruptAfterHandler;
    this.onReceipt = onReceipt;
  }

  override subscribe<TPayload>(
    eventName: string,
    consumerId: string,
    handler: EventHandler<TPayload>,
  ): void {
    const wrapped: EventHandler<TPayload> = async (event) => {
      await handler(event);
      if (eventName !== PAYMENT_EVENT || consumerId !== PAYMENT_CONSUMER) return;
      this.onReceipt();
      console.log(`RECEIPT ${event.eventId} ${consumerId}`);
      // The production handler has committed, but this wrapper has not
      // returned to BullMQ, so the active job remains eligible for retry.
      if (this.interruptAfterHandler) process.kill(process.pid, 'SIGKILL');
    };
    super.subscribe(eventName, consumerId, wrapped);
  }
}

describe('outbox transport worker harness', () => {
  it('runs the real payment consumer until receipt', async () => {
    let received = false;
    const prisma = new PrismaService();
    const bullmq = new IntegrationBullMqService(new ConfigService(process.env), queuePrefix!);
    const cls = new ClsService(new AsyncLocalStorage());
    const eventBus = new RecordingEventBus(
      bullmq,
      cls,
      mode === 'crash-after-handler',
      () => { received = true; },
    );
    const handler = new PaymentCompletedEventHandler(
      prisma,
      new RlsTransactionService(prisma),
      eventBus,
      cls,
    );
    const publisher = new OutboxPublisherCron(prisma, eventBus, new AppMetricsService());

    await prisma.$connect();
    try {
      handler.register();
      console.log('READY');
      if (process.env.OUTBOX_TEST_RUN_PUBLISHER === '1') await publisher.execute();
      const deadline = Date.now() + 15_000;
      while (!received && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (!received) throw new Error(`outbox worker did not receive event ${eventId}`);
    } finally {
      await bullmq.onModuleDestroy().catch(() => undefined);
      await prisma.$disconnect().catch(() => undefined);
    }
  }, 20_000);
});
