import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { EventBusService } from './event-bus.service';
import { BullMqService } from '../queue/bull-mq.service';

describe('EventBusService', () => {
  let service: EventBusService;
  let bullmq: BullMqService;
  let cls: ClsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventBusService,
        {
          provide: BullMqService,
          useValue: {
            getQueue: jest.fn().mockReturnValue({ add: jest.fn() }),
            createWorker: jest.fn().mockReturnValue({}),
          },
        },
        {
          provide: ClsService,
          useValue: {
            run: jest.fn((fn: any) => fn()),
            set: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EventBusService>(EventBusService);
    bullmq = module.get<BullMqService>(BullMqService);
    cls = module.get<ClsService>(ClsService);
  });

  it('should publish event', async () => {
    const queue = { add: jest.fn() };
    (bullmq.getQueue as jest.Mock).mockReturnValue(queue);
    await service.publish('test', { eventId: '1', source: 'src', version: 1, occurredAt: new Date(), payload: {} });
    expect(queue.add).toHaveBeenCalled();
  });

  it('should subscribe handler', () => {
    service.subscribe('test', jest.fn());
    expect(bullmq.createWorker).toHaveBeenCalled();
  });

  it('should not create duplicate worker on second subscribe', () => {
    service.subscribe('test1', jest.fn());
    service.subscribe('test2', jest.fn());
    expect(bullmq.createWorker).toHaveBeenCalledTimes(1);
  });
});
