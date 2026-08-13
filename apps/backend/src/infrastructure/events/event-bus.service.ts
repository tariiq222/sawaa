import { Injectable, Logger } from '@nestjs/common';
import type { Job, Queue, Worker } from 'bullmq';
import { ClsService } from 'nestjs-cls';
import { BullMqService } from '../queue/bull-mq.service';
import { SYSTEM_CONTEXT_CLS_KEY, TENANT_CLS_KEY } from '../../common/constants';

/**
 * Minimal envelope every domain event must produce. The full `BaseEvent`
 * class lives in `common/events/` (task p1-t9) — this type is just the
 * transport shape the bus needs to route. Keeping the definition local
 * avoids a circular dependency with `common/` during Phase 1.
 */
export interface DomainEventEnvelope<TPayload = unknown> {
  eventId: string;
  correlationId?: string;
  source: string;
  version: number;
  occurredAt: Date | string;
  payload: TPayload;
}

export type EventHandler<TPayload = unknown> = (
  event: DomainEventEnvelope<TPayload>,
) => Promise<void> | void;

type RegisteredHandler = {
  consumerId: string;
  handler: EventHandler;
};

type ConsumerJobData = {
  eventName: string;
  consumerId: string;
  event: DomainEventEnvelope;
};

const EVENT_QUEUE_NAME = 'domain-events';

/**
 * Inter-context event bus built on a single BullMQ queue.
 *
 * Publishers call {@link publish} with an event name and envelope; BullMQ
 * persists the job in Redis and a worker dispatches it to every handler
 * registered for that name via {@link subscribe}. This replaces direct
 * imports between Bounded Contexts with asynchronous message passing, so
 * `bookings` can react to `payment.completed` without importing `finance`.
 *
 * Only one worker is started per process (lazy, on first `subscribe`).
 * Handlers run sequentially inside the worker — callers that need
 * concurrency should fan out inside their handler.
 */
@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);
  private readonly handlers = new Map<string, RegisteredHandler[]>();
  private worker?: Worker;

  constructor(
    private readonly bullmq: BullMqService,
    private readonly cls: ClsService,
  ) {}

  /**
   * Publish a domain event. The job name is the event name so subscribers
   * can dispatch without inspecting the payload.
   */
  async publish<TPayload>(
    eventName: string,
    event: DomainEventEnvelope<TPayload>,
  ): Promise<void> {
    const queue = this.getQueue();
    const options = (consumerId: string) => ({
      // At-least-once delivery: a handler that throws must be retried, not
      // dropped. Set attempts + backoff explicitly so the contract holds
      // regardless of the queue's defaultJobOptions.
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 24 * 3600 },
      jobId: this.consumerJobId(event.eventId, consumerId),
    });

    const consumers = this.handlers.get(eventName) ?? [];
    if (consumers.length === 0) {
      // Backward compatibility for publishers that run before subscribers are
      // registered. The worker understands the legacy envelope and will fan it
      // out to whichever consumers are present when the job is processed.
      await queue.add(eventName, event, options('unrouted'));
      return;
    }

    // One durable job per consumer isolates retries: a later failing consumer
    // cannot replay an earlier successful one. Stable job IDs also make an
    // outbox enqueue/update crash safe to retry.
    for (const consumer of consumers) {
      await queue.add(eventName, {
        eventName,
        consumerId: consumer.consumerId,
        event,
      } satisfies ConsumerJobData, options(consumer.consumerId));
    }
  }

  /**
   * Register a handler for an event name. The first call also boots the
   * worker that drains the queue — we defer worker creation so test suites
   * and modules that only publish don't open a Redis connection.
   */
  subscribe<TPayload>(eventName: string, handler: EventHandler<TPayload>): void;
  subscribe<TPayload>(
    eventName: string,
    consumerId: string,
    handler: EventHandler<TPayload>,
  ): void;
  subscribe<TPayload>(
    eventName: string,
    consumerIdOrHandler: string | EventHandler<TPayload>,
    maybeHandler?: EventHandler<TPayload>,
  ): void {
    const list = this.handlers.get(eventName) ?? [];
    const handler = typeof consumerIdOrHandler === 'function'
      ? consumerIdOrHandler
      : maybeHandler;
    if (!handler) throw new Error(`Event consumer handler is required for "${eventName}"`);
    const consumerId = typeof consumerIdOrHandler === 'string'
      ? consumerIdOrHandler
      : `legacy.${eventName}.${list.length + 1}`;
    if (list.some((registered) => registered.consumerId === consumerId)) {
      throw new Error(`Duplicate event consumer "${consumerId}" for "${eventName}"`);
    }
    list.push({ consumerId, handler: handler as EventHandler });
    this.handlers.set(eventName, list);
    this.ensureWorker();
    this.logger.log(`Handler "${consumerId}" registered for event "${eventName}"`);
  }

  private getQueue(): Queue {
    return this.bullmq.getQueue(EVENT_QUEUE_NAME);
  }

  private ensureWorker(): void {
    if (this.worker) return;
    this.worker = this.bullmq.createWorker(EVENT_QUEUE_NAME, async (job: Job) => {
      const data = job.data as DomainEventEnvelope | ConsumerJobData;
      if (this.isConsumerJob(data)) {
        await this.dispatchConsumer(data.eventName, data.consumerId, data.event);
      } else {
        await this.dispatch(job.name, data);
      }
    });
  }

  /**
   * Run every handler registered for `eventName` sequentially inside a CLS
   * context. Single-tenant/system events run under the system context so
   * non-request handlers can read through the Prisma context guard. If a
   * legacy event payload still carries `organizationId`, keep setting the
   * tenant CLS key so older handlers and tests remain compatible.
   *
   * A failing handler throws, which causes BullMQ to retry the job per its
   * policy — at-least-once delivery is the contract.
   */
  private async dispatch(
    eventName: string,
    event: DomainEventEnvelope,
  ): Promise<void> {
    const list = this.handlers.get(eventName);
    if (!list || list.length === 0) return;

    const organizationId = (event.payload as Record<string, unknown>)?.organizationId as string | undefined;

    await this.cls.run(async () => {
      if (organizationId) {
        // Legacy compatibility: some events still carry organizationId and
        // downstream handlers may expect the tenant CLS key to be present.
        this.cls.set(TENANT_CLS_KEY, {
          organizationId,
          id: '',
          role: '',
          isSuperAdmin: false,
        });
      } else {
        this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
      }

      for (const registered of list) {
        await registered.handler(event);
      }
    });
  }

  private async dispatchConsumer(
    eventName: string,
    consumerId: string,
    event: DomainEventEnvelope,
  ): Promise<void> {
    const registered = this.handlers.get(eventName)
      ?.find((candidate) => candidate.consumerId === consumerId);
    if (!registered) {
      // A rolling-start worker may receive a job before its module registers.
      // Throwing keeps the job retryable; acknowledging here would lose it.
      throw new Error(`Event consumer "${consumerId}" is not registered for "${eventName}"`);
    }

    const organizationId = (event.payload as Record<string, unknown>)?.organizationId as string | undefined;
    await this.cls.run(async () => {
      if (organizationId) {
        this.cls.set(TENANT_CLS_KEY, {
          organizationId,
          id: '',
          role: '',
          isSuperAdmin: false,
        });
      } else {
        this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
      }
      await registered.handler(event);
    });
  }

  private isConsumerJob(value: DomainEventEnvelope | ConsumerJobData): value is ConsumerJobData {
    return Boolean(
      value
      && typeof value === 'object'
      && 'eventName' in value
      && 'consumerId' in value
      && 'event' in value,
    );
  }

  private consumerJobId(eventId: string, consumerId: string): string {
    const safeEventId = eventId.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 100);
    const safeConsumerId = consumerId.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 80);
    return `${safeEventId}--${safeConsumerId}`;
  }
}
