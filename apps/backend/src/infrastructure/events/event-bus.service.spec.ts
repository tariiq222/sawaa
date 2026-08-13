import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { SYSTEM_CONTEXT_CLS_KEY, TENANT_CLS_KEY } from '../../common/constants';
import { BullMqService } from '../queue/bull-mq.service';
import { EventBusService } from './event-bus.service';

describe('EventBusService', () => {
  let service: EventBusService;
  let bullmq: any;
  let cls: any;
  let mockQueue: any;
  let mockWorker: any;

  beforeEach(async () => {
    mockQueue = { add: jest.fn().mockResolvedValue({}) };
    mockWorker = {};
    bullmq = {
      getQueue: jest.fn().mockReturnValue(mockQueue),
      createWorker: jest.fn().mockReturnValue(mockWorker),
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

    service = module.get<EventBusService>(EventBusService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  it('should publish event to queue', async () => {
    const event = { eventId: 'e1', source: 'test', version: 1, occurredAt: new Date(), payload: {} };
    await service.publish('test.event', event);
    expect(mockQueue.add).toHaveBeenCalledWith('test.event', event, expect.any(Object));
  });

  it('should publish with attempts>1 and exponential backoff for at-least-once delivery', async () => {
    const event = { eventId: 'e1', source: 'test', version: 1, occurredAt: new Date(), payload: {} };
    await service.publish('test.event', event);

    const [, , opts] = mockQueue.add.mock.calls.at(-1);
    expect(opts.attempts).toBeGreaterThan(1);
    expect(opts.backoff).toEqual(
      expect.objectContaining({ type: 'exponential', delay: 2000 }),
    );
  });

  it('fans one outbox event into stable per-consumer BullMQ jobs', async () => {
    service.subscribe('test.event', 'consumer-a', jest.fn());
    service.subscribe('test.event', 'consumer-b', jest.fn());
    const event = { eventId: 'event-1', source: 'test', version: 1, occurredAt: new Date(), payload: {} };

    await service.publish('test.event', event);

    expect(mockQueue.add).toHaveBeenCalledTimes(2);
    expect(mockQueue.add).toHaveBeenNthCalledWith(1, 'test.event', {
      eventName: 'test.event', consumerId: 'consumer-a', event,
    }, expect.objectContaining({ jobId: 'event-1--consumer-a' }));
    expect(mockQueue.add).toHaveBeenNthCalledWith(2, 'test.event', {
      eventName: 'test.event', consumerId: 'consumer-b', event,
    }, expect.objectContaining({ jobId: 'event-1--consumer-b' }));
  });

  it('reuses the same consumer job identity when outbox publish is replayed after enqueue', async () => {
    service.subscribe('test.event', 'consumer-a', jest.fn());
    const event = { eventId: 'event-1', source: 'test', version: 1, occurredAt: new Date(), payload: {} };

    await service.publish('test.event', event);
    await service.publish('test.event', event);

    expect(mockQueue.add).toHaveBeenCalledTimes(2);
    expect(mockQueue.add.mock.calls[0][2].jobId).toBe('event-1--consumer-a');
    expect(mockQueue.add.mock.calls[1][2].jobId).toBe('event-1--consumer-a');
  });

  it('dispatches a consumer job only to its named consumer', async () => {
    const handlerA = jest.fn().mockResolvedValue(undefined);
    const handlerB = jest.fn().mockResolvedValue(undefined);
    service.subscribe('test.event', 'consumer-a', handlerA);
    service.subscribe('test.event', 'consumer-b', handlerB);
    const workerCallback = bullmq.createWorker.mock.calls[0][1];
    const event = { eventId: 'event-1', source: 'test', version: 1, occurredAt: new Date(), payload: {} };

    await workerCallback({
      name: 'test.event',
      data: { eventName: 'test.event', consumerId: 'consumer-b', event },
    });

    expect(handlerA).not.toHaveBeenCalled();
    expect(handlerB).toHaveBeenCalledTimes(1);
    expect(handlerB).toHaveBeenCalledWith(event);
  });

  it('retries rather than acknowledging a targeted job before its consumer is registered', async () => {
    service.subscribe('test.event', 'consumer-a', jest.fn());
    const workerCallback = bullmq.createWorker.mock.calls[0][1];
    const event = { eventId: 'event-1', source: 'test', version: 1, occurredAt: new Date(), payload: {} };

    await expect(workerCallback({
      name: 'test.event',
      data: { eventName: 'test.event', consumerId: 'consumer-b', event },
    })).rejects.toThrow('consumer-b');
  });

  it('should subscribe and create worker on first subscription', () => {
    const handler = jest.fn();
    service.subscribe('test.event', handler);
    expect(bullmq.createWorker).toHaveBeenCalledWith('domain-events', expect.any(Function));
  });

  it('should not create duplicate workers', () => {
    const handler = jest.fn();
    service.subscribe('test.event', handler);
    service.subscribe('test.event', handler);
    expect(bullmq.createWorker).toHaveBeenCalledTimes(1);
  });

  it('should dispatch to registered handlers', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    service.subscribe('test.event', handler);

    const workerCallback = bullmq.createWorker.mock.calls[0][1];
    const event = { eventId: 'e1', source: 'test', version: 1, occurredAt: new Date(), payload: { organizationId: 'org1' } };
    await workerCallback({ name: 'test.event', data: event });

    expect(handler).toHaveBeenCalledWith(event);
    expect(cls.set).toHaveBeenCalledWith(TENANT_CLS_KEY, expect.objectContaining({ organizationId: 'org1' }));
  });

  it('should dispatch to multiple handlers', async () => {
    const handler1 = jest.fn().mockResolvedValue(undefined);
    const handler2 = jest.fn().mockResolvedValue(undefined);
    service.subscribe('test.event', handler1);
    service.subscribe('test.event', handler2);

    const workerCallback = bullmq.createWorker.mock.calls[0][1];
    const event = { eventId: 'e1', source: 'test', version: 1, occurredAt: new Date(), payload: {} };
    await workerCallback({ name: 'test.event', data: event });

    expect(handler1).toHaveBeenCalled();
    expect(handler2).toHaveBeenCalled();
    expect(cls.set).toHaveBeenCalledWith(SYSTEM_CONTEXT_CLS_KEY, true);
  });

  it('should not dispatch when no handlers registered', async () => {
    service.subscribe('other.event', jest.fn());

    const workerCallback = bullmq.createWorker.mock.calls[0][1];
    const event = { eventId: 'e1', source: 'test', version: 1, occurredAt: new Date(), payload: {} };
    await workerCallback({ name: 'test.event', data: event });

    expect(cls.run).not.toHaveBeenCalled();
  });

  it('should run handlers sequentially', async () => {
    const order: number[] = [];
    const handler1 = jest.fn().mockImplementation(async () => { order.push(1); });
    const handler2 = jest.fn().mockImplementation(async () => { order.push(2); });
    service.subscribe('test.event', handler1);
    service.subscribe('test.event', handler2);

    const workerCallback = bullmq.createWorker.mock.calls[0][1];
    const event = { eventId: 'e1', source: 'test', version: 1, occurredAt: new Date(), payload: {} };
    await workerCallback({ name: 'test.event', data: event });

    expect(order).toEqual([1, 2]);
  });
});
