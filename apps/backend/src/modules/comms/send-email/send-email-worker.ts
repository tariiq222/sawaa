// BullMQ worker that processes email-send jobs.
// Registered once on module init — runs SendEmailHandler off the request
// path so auth flows never wait on the email provider round-trip.

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { BullMqService } from '../../../infrastructure/queue/bull-mq.service';
import { SYSTEM_CONTEXT_CLS_KEY } from '../../../common/constants';
import { SendEmailHandler } from './send-email.handler';
import { EMAIL_SEND_QUEUE, type EmailSendJobData } from './send-email-queue.service';

@Injectable()
export class SendEmailWorker implements OnModuleInit {
  private readonly logger = new Logger(SendEmailWorker.name);

  constructor(
    private readonly bullmq: BullMqService,
    private readonly sendEmail: SendEmailHandler,
    private readonly cls: ClsService,
  ) {}

  onModuleInit(): void {
    this.bullmq.createWorker<EmailSendJobData>(
      EMAIL_SEND_QUEUE,
      async (job) => {
        await this.cls.run(async () => {
          // Worker jobs run outside a request — use the system context so the
          // Prisma context guard allows reads (same as EventBusService).
          this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);

          this.logger.log(
            `Sending "${job.data.templateSlug}" email (attempt #${job.attemptsMade + 1})`,
          );
          // SendEmailHandler throws on provider/adapter failure, which fails
          // the job and triggers BullMQ retry per the job's attempts/backoff.
          await this.sendEmail.execute(job.data);
        });
      },
      { concurrency: 5 },
    );
    this.logger.log(`Worker registered for queue: ${EMAIL_SEND_QUEUE}`);
  }
}
