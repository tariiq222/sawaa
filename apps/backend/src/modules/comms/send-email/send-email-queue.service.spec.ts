import { Test } from '@nestjs/testing';
import { SendEmailQueueService, EMAIL_SEND_QUEUE } from './send-email-queue.service';
import { BullMqService } from '../../../infrastructure/queue/bull-mq.service';

describe('SendEmailQueueService', () => {
  let service: SendEmailQueueService;
  let queueAdd: jest.Mock;
  let bullmq: { getQueue: jest.Mock };

  const dto = {
    to: 'user@example.com',
    templateSlug: 'user_email_verification',
    vars: { userName: 'Test', verifyUrl: 'https://app.test/verify-email?token=abc' },
  };

  beforeEach(async () => {
    queueAdd = jest.fn().mockResolvedValue({ id: 'job-1' });
    bullmq = { getQueue: jest.fn().mockReturnValue({ add: queueAdd }) };

    const module = await Test.createTestingModule({
      providers: [
        SendEmailQueueService,
        { provide: BullMqService, useValue: bullmq },
      ],
    }).compile();

    service = module.get(SendEmailQueueService);
  });

  it('enqueues the full email payload on the email-send queue', async () => {
    await service.enqueue(dto);

    expect(bullmq.getQueue).toHaveBeenCalledWith(EMAIL_SEND_QUEUE);
    expect(queueAdd).toHaveBeenCalledWith(
      'user_email_verification',
      dto,
      expect.objectContaining({
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      }),
    );
  });

  it('enqueues with no delay — auth emails must be delivered promptly', async () => {
    await service.enqueue(dto);
    const opts = queueAdd.mock.calls[0][2];
    expect(opts.delay).toBeUndefined();
  });
});
