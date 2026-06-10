// BullMQ producer for asynchronous transactional email delivery.
//
// Auth-flow request paths (email verification, password reset) must not
// block on the SMTP/provider round-trip: handlers enqueue here and return
// immediately; SendEmailWorker drains the queue and runs SendEmailHandler
// with the exact same payload/template selection.

import { Injectable } from '@nestjs/common';
import { BullMqService } from '../../../infrastructure/queue/bull-mq.service';
import type { SendEmailCommand } from './send-email.handler';

export const EMAIL_SEND_QUEUE = 'email-send';

export type EmailSendJobData = SendEmailCommand;

@Injectable()
export class SendEmailQueueService {
  constructor(private readonly bullmq: BullMqService) {}

  /** Enqueue an email send. Jobs carry no delay so time-sensitive mail
   *  (verification links, password resets, OTP) goes out promptly; provider
   *  failures retry with exponential backoff. */
  async enqueue(dto: EmailSendJobData): Promise<void> {
    await this.bullmq.getQueue(EMAIL_SEND_QUEUE).add(dto.templateSlug, dto, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 24 * 3600 },
    });
  }
}
