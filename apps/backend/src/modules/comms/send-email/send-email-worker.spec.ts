import { Test } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { SendEmailWorker } from './send-email-worker';
import { EMAIL_SEND_QUEUE } from './send-email-queue.service';
import { SendEmailHandler } from './send-email.handler';
import { BullMqService } from '../../../infrastructure/queue/bull-mq.service';

describe('SendEmailWorker', () => {
  let worker: SendEmailWorker;
  let bullmq: { createWorker: jest.Mock };
  let sendEmail: { execute: jest.Mock };
  let cls: { run: jest.Mock; set: jest.Mock };
  let workerCallback: (job: { data: Record<string, unknown>; attemptsMade: number }) => Promise<void>;

  const jobData = {
    to: 'user@example.com',
    templateSlug: 'user_password_reset',
    vars: { userName: 'Alice', resetUrl: 'https://app.test/reset-password?token=abc' },
  };

  beforeEach(async () => {
    bullmq = {
      createWorker: jest.fn().mockImplementation((_queue, callback) => {
        workerCallback = callback;
      }),
    };
    sendEmail = { execute: jest.fn().mockResolvedValue(undefined) };
    cls = {
      run: jest.fn().mockImplementation((cb) => cb()),
      set: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        SendEmailWorker,
        { provide: BullMqService, useValue: bullmq },
        { provide: SendEmailHandler, useValue: sendEmail },
        { provide: ClsService, useValue: cls },
      ],
    }).compile();

    worker = module.get(SendEmailWorker);
    worker.onModuleInit();
  });

  it('registers worker for the email-send queue on module init', () => {
    expect(bullmq.createWorker).toHaveBeenCalledWith(EMAIL_SEND_QUEUE, expect.any(Function));
  });

  it('runs SendEmailHandler with the job payload inside a CLS context', async () => {
    await workerCallback({ data: jobData, attemptsMade: 0 });
    expect(cls.run).toHaveBeenCalled();
    expect(cls.set).toHaveBeenCalledWith('systemContext', true);
    expect(sendEmail.execute).toHaveBeenCalledWith(jobData);
  });

  it('propagates send failures so BullMQ retries the job', async () => {
    sendEmail.execute.mockRejectedValue(new Error('SMTP connection refused'));
    await expect(
      workerCallback({ data: jobData, attemptsMade: 0 }),
    ).rejects.toThrow('SMTP connection refused');
  });
});
