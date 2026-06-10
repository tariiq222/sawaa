// BullMQ worker that processes zoom-meeting-create jobs.
// Registered once on module init — runs CreateZoomMeetingHandler off the
// request path so confirming a booking never waits on the Zoom API.

import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ZoomMeetingStatus } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { BullMqService } from '../../../infrastructure/queue/bull-mq.service';
import { SYSTEM_CONTEXT_CLS_KEY } from '../../../common/constants';
import { CreateZoomMeetingHandler } from './create-zoom-meeting.handler';
import { ZOOM_MEETING_QUEUE, type ZoomMeetingJobData } from './zoom-meeting-queue.service';

@Injectable()
export class ZoomMeetingWorker implements OnModuleInit {
  private readonly logger = new Logger(ZoomMeetingWorker.name);

  constructor(
    private readonly bullmq: BullMqService,
    private readonly createZoomMeeting: CreateZoomMeetingHandler,
    private readonly cls: ClsService,
  ) {}

  onModuleInit(): void {
    this.bullmq.createWorker<ZoomMeetingJobData>(
      ZOOM_MEETING_QUEUE,
      async (job) => {
        const { bookingId } = job.data;

        await this.cls.run(async () => {
          // Worker jobs run outside a request — use the system context so the
          // Prisma context guard allows reads/writes (same as EventBusService).
          this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);

          this.logger.log(
            `Creating Zoom meeting for booking ${bookingId} (attempt #${job.attemptsMade + 1})`,
          );

          let booking;
          try {
            booking = await this.createZoomMeeting.execute({ bookingId });
          } catch (err) {
            // Permanent conditions — booking gone or no longer ONLINE.
            // Retrying cannot fix these, so swallow instead of rethrowing.
            if (err instanceof NotFoundException || err instanceof BadRequestException) {
              this.logger.warn(
                `Skipping Zoom meeting for booking ${bookingId}: ${err.message}`,
              );
              return;
            }
            throw err;
          }

          // The handler persists FAILED + zoomMeetingError itself (same states
          // as the old inline path). Throw so BullMQ retries per the job's
          // attempts/backoff config; a later success overwrites to CREATED.
          if (booking.zoomMeetingStatus === ZoomMeetingStatus.FAILED) {
            throw new Error(
              `Zoom meeting creation failed for booking ${bookingId}: ${booking.zoomMeetingError ?? 'unknown error'}`,
            );
          }
        });
      },
    );
    this.logger.log(`Worker registered for queue: ${ZOOM_MEETING_QUEUE}`);
  }
}
