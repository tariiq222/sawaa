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
