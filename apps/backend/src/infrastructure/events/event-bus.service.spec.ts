import { Test, type TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { SYSTEM_CONTEXT_CLS_KEY, TENANT_CLS_KEY } from '../../common/constants';
import { BullMqService } from '../queue/bull-mq.service';
import {
  EventBusService,
  NoEventConsumersRegisteredError,
} from './event-bus.service';

describe('EventBusService', () => {
  let service: EventBusService;
  let bullmq: { getQueue: jest.Mock; createWorker: jest.Mock };
  let cls: { run: jest.Mock; set: jest.Mock };
  let queues: Map<string, { add: jest.Mock }>;
  let workers: Map<string, (job: any) => Promise<void>>;

  beforeEach(async () => {
    queues = new Map();
    workers = new Map();
    bullmq = {
      getQueue: jest.fn((name: string) => {
        if (!queues.has(name)) queues.set(name, { add: jest.fn().mockResolvedValue({}) });
        return queues.get(name);
      }),
      createWorker: jest.fn((name: string, callback: (job: any) => Promise<void>) => {
        workers.set(name, callback);
        return {};
      }),
    };
    cls = {
      run: jest.fn(async (fn) => await fn()),
      set: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventBusService,
        { provide: BullMqService, useValue: bullmq },
        { provide: ClsService, useValue: cls },
      ],
    }).compile();
    service = module.get(EventBusService);
  });

  const event = (eventId = 'event-1') => ({
    eventId, source: 'test', version: 1, occurredAt: new Date(), payload: {},
  });

  it('requires an explicit stable consumer ID', () => {
    expect(() => (service.subscribe as any)('test.event', jest.fn()))
      .toThrow('stable consumer id');
  });

  it('rejects a duplicate consumer ID globally, including across event names', () => {
    service.subscribe('test.event', 'consumer-a', jest.fn());
    expect(() => service.subscribe('other.event', 'consumer-a', jest.fn()))
      .toThrow('Duplicate event consumer');
  });

  it('creates one dedicated queue and worker for each consumer', () => {
    service.subscribe('test.event', 'consumer-a', jest.fn());
    service.subscribe('test.event', 'consumer-b', jest.fn());

    expect(bullmq.createWorker).toHaveBeenNthCalledWith(
      1, 'domain-events--consumer-a', expect.any(Function),
    );
    expect(bullmq.createWorker).toHaveBeenNthCalledWith(2, 'domain-events', expect.any(Function));
    expect(bullmq.createWorker).toHaveBeenNthCalledWith(3, 'domain-events--consumer-b', expect.any(Function));
  });

  it('bridges a 1ebce257 legacy job but refuses to ACK an unknown rolling event', async () => {
    const handler = jest.fn();
    service.subscribe('legacy.event', 'consumer-a', handler);
    const legacyEvent = event();
    await workers.get('domain-events')!({ name: 'legacy.event', data: legacyEvent });
    expect(handler).toHaveBeenCalledWith(legacyEvent);
    await expect(workers.get('domain-events')!({ name: 'new.event', data: event() }))
      .rejects.toThrow(NoEventConsumersRegisteredError);
  });

  it('unwraps a targeted 1ebce257 envelope and never broadcasts it to another consumer', async () => {
    const selected = jest.fn();
    const other = jest.fn();
    service.subscribe('legacy.event', 'consumer-selected', selected);
    service.subscribe('legacy.event', 'consumer-other', other);
    const original = event();
    await workers.get('domain-events')!({
      name: 'legacy.event',
      data: { eventName: 'legacy.event', consumerId: 'consumer-selected', event: original },
    });
    expect(selected).toHaveBeenCalledWith(original);
    expect(other).not.toHaveBeenCalled();
  });

  it('fans out in registration order with a stable event job ID per isolated queue', async () => {
    service.subscribe('test.event', 'consumer-a', jest.fn());
    service.subscribe('test.event', 'consumer-b', jest.fn());
    const envelope = event();

    await service.publish('test.event', envelope);

    const queueA = queues.get('domain-events--consumer-a')!;
    const queueB = queues.get('domain-events--consumer-b')!;
    expect(bullmq.getQueue.mock.calls.map(([name]) => name)).toEqual([
      'domain-events--consumer-a', 'domain-events--consumer-b',
    ]);
    expect(queueA.add).toHaveBeenCalledWith('test.event', {
      eventName: 'test.event', event: envelope,
    }, expect.objectContaining({
      jobId: 'event-1', attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
    }));
    expect(queueB.add.mock.calls[0][2].jobId).toBe('event-1');
  });

  it('reuses the same queue-scoped job identity when outbox dispatch is replayed', async () => {
    service.subscribe('test.event', 'consumer-a', jest.fn());
    const envelope = event();
    await service.publish('test.event', envelope);
    await service.publish('test.event', envelope);

    const add = queues.get('domain-events--consumer-a')!.add;
    expect(add).toHaveBeenCalledTimes(2);
    expect(add.mock.calls.map((call) => call[2].jobId)).toEqual(['event-1', 'event-1']);
  });

  it('keeps a new-version consumer job away from an old-version worker queue', async () => {
    const oldHandler = jest.fn().mockResolvedValue(undefined);
    service.subscribe('test.event', 'consumer-old', oldHandler);

    // A rolling new process owns a different queue. BullMQ will never feed it
    // to the callback bound to the old queue.
    expect(workers.has('domain-events--consumer-old')).toBe(true);
    expect(workers.has('domain-events--consumer-new')).toBe(false);
    expect(queues.has('domain-events--consumer-new')).toBe(false);
    expect(oldHandler).not.toHaveBeenCalled();
  });

  it('does not acknowledge an event until a compatible consumer is registered', async () => {
    await expect(service.publish('new.event', event()))
      .rejects.toBeInstanceOf(NoEventConsumersRegisteredError);
    expect(bullmq.getQueue).not.toHaveBeenCalled();
  });

  it('treats an explicitly optional event with no consumers as a successful no-op', async () => {
    expect(typeof (service as any).publishOptional).toBe('function');

    await expect(
      (service as any).publishOptional('optional.event', event()),
    ).resolves.toBeUndefined();
    expect(bullmq.getQueue).not.toHaveBeenCalled();
  });

  it('publishes an explicitly optional event when a consumer is registered', async () => {
    service.subscribe('optional.event', 'optional-consumer', jest.fn());
    expect(typeof (service as any).publishOptional).toBe('function');

    await (service as any).publishOptional('optional.event', event());

    expect(queues.get('domain-events--optional-consumer')?.add).toHaveBeenCalledTimes(1);
  });

  it('dispatches only the owning handler and bubbles failures for BullMQ retry', async () => {
    const handlerA = jest.fn().mockResolvedValue(undefined);
    const handlerB = jest.fn().mockRejectedValue(new Error('transient consumer failure'));
    service.subscribe('test.event', 'consumer-a', handlerA);
    service.subscribe('test.event', 'consumer-b', handlerB);
    const envelope = event();

    await workers.get('domain-events--consumer-a')!({ name: 'test.event', data: {
      eventName: 'test.event', event: envelope,
    } });
    await expect(workers.get('domain-events--consumer-b')!({ name: 'test.event', data: {
      eventName: 'test.event', event: envelope,
    } })).rejects.toThrow('transient consumer failure');

    expect(handlerA).toHaveBeenCalledTimes(1);
    expect(handlerB).toHaveBeenCalledTimes(1);
  });

  it('preserves tenant context for legacy organization events and system context otherwise', async () => {
    service.subscribe('tenant.event', 'tenant-consumer', jest.fn());
    service.subscribe('system.event', 'system-consumer', jest.fn());
    await workers.get('domain-events--tenant-consumer')!({ name: 'tenant.event', data: {
      eventName: 'tenant.event',
      event: { ...event('tenant-1'), payload: { organizationId: 'org-1' } },
    } });
    await workers.get('domain-events--system-consumer')!({ name: 'system.event', data: {
      eventName: 'system.event', event: event('system-1'),
    } });

    expect(cls.set).toHaveBeenCalledWith(TENANT_CLS_KEY, expect.objectContaining({ organizationId: 'org-1' }));
    expect(cls.set).toHaveBeenCalledWith(SYSTEM_CONTEXT_CLS_KEY, true);
  });

  it('rejects a mismatched event name on a consumer queue instead of misrouting it', async () => {
    service.subscribe('test.event', 'consumer-a', jest.fn());
    await expect(workers.get('domain-events--consumer-a')!({
      name: 'new.event', data: { eventName: 'new.event', event: event() },
    })).rejects.toThrow('cannot handle');
  });
});
