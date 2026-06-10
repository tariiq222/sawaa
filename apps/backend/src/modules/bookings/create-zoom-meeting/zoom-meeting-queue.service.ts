// BullMQ producer for asynchronous Zoom meeting creation.
//
// Confirming a booking must not block on the Zoom API: the confirm request
// enqueues a job here and returns immediately; ZoomMeetingWorker drains the
// queue and runs CreateZoomMeetingHandler (which persists CREATED/FAILED on
// the booking exactly as the old inline call did).

import { Injectable } from '@nestjs/common';
import { BullMqService } from '../../../infrastructure/queue/bull-mq.service';

export const ZOOM_MEETING_QUEUE = 'zoom-meeting-create';

export type ZoomMeetingJobData = {
  bookingId: string;
};

@Injectable()
export class ZoomMeetingQueueService {
  constructor(private readonly bullmq: BullMqService) {}

  /** Enqueue Zoom meeting creation for a booking. No delay — the worker
   *  picks it up immediately; failures retry with exponential backoff. */
  async enqueue(bookingId: string): Promise<void> {
    await this.bullmq.getQueue(ZOOM_MEETING_QUEUE).add(
      'create-zoom-meeting',
      { bookingId } satisfies ZoomMeetingJobData,
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 24 * 3600 },
      },
    );
  }
}
