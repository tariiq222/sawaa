import { Test } from '@nestjs/testing';
import { ZoomMeetingQueueService, ZOOM_MEETING_QUEUE } from './zoom-meeting-queue.service';
import { BullMqService } from '../../../infrastructure/queue/bull-mq.service';

describe('ZoomMeetingQueueService', () => {
  let service: ZoomMeetingQueueService;
  let queueAdd: jest.Mock;
  let bullmq: { getQueue: jest.Mock };

  beforeEach(async () => {
    queueAdd = jest.fn().mockResolvedValue({ id: 'job-1' });
    bullmq = { getQueue: jest.fn().mockReturnValue({ add: queueAdd }) };

    const module = await Test.createTestingModule({
      providers: [
        ZoomMeetingQueueService,
        { provide: BullMqService, useValue: bullmq },
      ],
    }).compile();

    service = module.get(ZoomMeetingQueueService);
  });

  it('enqueues a job on the zoom-meeting-create queue with the bookingId payload', async () => {
    await service.enqueue('book-1');

    expect(bullmq.getQueue).toHaveBeenCalledWith(ZOOM_MEETING_QUEUE);
    expect(queueAdd).toHaveBeenCalledWith(
      'create-zoom-meeting',
      { bookingId: 'book-1' },
      expect.objectContaining({
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      }),
    );
  });

  it('enqueues with no delay — the worker should pick the job up immediately', async () => {
    await service.enqueue('book-1');
    const opts = queueAdd.mock.calls[0][2];
    expect(opts.delay).toBeUndefined();
  });
});
