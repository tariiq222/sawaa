import { Test } from '@nestjs/testing';
import { NotificationRetryWorker } from './notification-retry-worker';
import { BullMqService } from '../../../infrastructure/queue/bull-mq.service';
import { ResilientNotificationDispatcher } from './resilient-notification-dispatcher.service';
import { ClsService } from 'nestjs-cls';

describe('NotificationRetryWorker', () => {
  let worker: NotificationRetryWorker;
  let bullmq: { createWorker: jest.Mock };
  let dispatcher: { attemptSend: jest.Mock };
  let cls: { run: jest.Mock; set: jest.Mock };
  let workerCallback: Function;

  beforeEach(async () => {
    bullmq = {
      createWorker: jest.fn().mockImplementation((_queue, callback) => {
        workerCallback = callback;
      }),
    };
    dispatcher = { attemptSend: jest.fn().mockResolvedValue(undefined) };
    cls = {
      run: jest.fn().mockImplementation((cb) => cb()),
      set: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        NotificationRetryWorker,
        { provide: BullMqService, useValue: bullmq },
        { provide: ResilientNotificationDispatcher, useValue: dispatcher },
        { provide: ClsService, useValue: cls },
      ],
    }).compile();

    worker = module.get(NotificationRetryWorker);
    worker.onModuleInit();
  });

  it('registers worker on module init', () => {
    expect(bullmq.createWorker).toHaveBeenCalled();
  });

  it('processes retry job successfully', async () => {
    const job = {
      data: {
        logId: 'log-1',
        channel: 'EMAIL' as const,
        payload: { organizationId: 'org-1', recipientId: 'user-1', type: 'BOOKING_CONFIRMED' as const },
        attempt: 2,
      },
    };
    await workerCallback(job);
    expect(cls.run).toHaveBeenCalled();
    expect(dispatcher.attemptSend).toHaveBeenCalledWith('log-1', 'EMAIL', expect.anything(), 2);
  });

  it('throws when organizationId is missing', async () => {
    const job = {
      data: {
        logId: 'log-1',
        channel: 'EMAIL' as const,
        payload: { recipientId: 'user-1', type: 'BOOKING_CONFIRMED' as const },
        attempt: 2,
      },
    };
    await expect(workerCallback(job)).rejects.toThrow('missing organizationId');
  });

  it('throws when payload is missing', async () => {
    const job = {
      data: {
        logId: 'log-1',
        channel: 'EMAIL' as const,
        payload: undefined,
        attempt: 2,
      },
    };
    await expect(workerCallback(job)).rejects.toThrow('missing organizationId');
  });
});
