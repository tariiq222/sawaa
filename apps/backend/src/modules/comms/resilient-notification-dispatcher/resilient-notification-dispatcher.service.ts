// Resilient notification dispatcher for CRITICAL notifications.
//
// Dispatch flow per channel:
//   1. Create NotificationDeliveryLog row (status=PENDING)
//   2. Attempt send immediately (attempt 1)
//   3a. Success → update status=SENT, sentAt=now
//   3b. Failure → update status=FAILED, errorMessage
//              → enqueue BullMQ retry job (delays: 30s, 2m, 5m for attempts 2/3/4)
//
// CRITICAL types: BOOKING_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_COMPLETED, PAYMENT_FAILED
// STANDARD types: best-effort via existing SendNotificationHandler path.

import { Injectable, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { PrismaService } from '../../../infrastructure/database';
import { BullMqService } from '../../../infrastructure/queue/bull-mq.service';
import { SendEmailHandler } from '../send-email/send-email.handler';
import { SendSmsHandler } from '../send-sms/send-sms.handler';
import { SendPushHandler } from '../send-push/send-push.handler';
import type { NotificationType } from '../send-notification/send-notification.dto';

export const CRITICAL_TYPES = new Set<NotificationType>([
  'BOOKING_CONFIRMED',
  'PAYMENT_RECEIVED',
  'PAYMENT_COMPLETED',
  'PAYMENT_FAILED',
]);

export const NOTIFICATION_RETRY_QUEUE = 'notification-retry';

export type DispatchPayload = {
  organizationId: string;
  recipientId: string;
  type: NotificationType;
  recipientEmail?: string;
  emailTemplateSlug?: string;
  emailVars?: Record<string, string>;
  recipientPhone?: string;
  smsBody?: string;
  fcmTokens?: string[];
  pushTitle?: string;
  pushBody?: string;
};

export type RetryJobData = {
  logId: string;
  channel: 'EMAIL' | 'SMS' | 'PUSH';
  payload: DispatchPayload;
  attempt: number;
};

// Retry delays indexed by (attempt - 1): attempt 2 → 30s, 3 → 2m, 4 → 5m
const RETRY_DELAYS_MS: ReadonlyArray<number> = [30_000, 120_000, 300_000];

type DeliveryChannelUpper = 'EMAIL' | 'SMS' | 'PUSH';
type DeliveryChannelLower = 'email' | 'sms' | 'push';

@Injectable()
export class ResilientNotificationDispatcher {
  private readonly logger = new Logger(ResilientNotificationDispatcher.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bullmq: BullMqService,
    private readonly email: SendEmailHandler,
    private readonly sms: SendSmsHandler,
    private readonly push: SendPushHandler,
  ) {}

  async dispatch(
    payload: DispatchPayload,
    channels: Array<DeliveryChannelLower>,
  ): Promise<void> {
    await Promise.allSettled(
      channels.map((channel) => this.dispatchChannel(channel, payload)),
    );
  }

  // ── per-channel dispatch ────────────────────────────────────────────────

  private async dispatchChannel(
    channel: DeliveryChannelLower,
    payload: DispatchPayload,
  ): Promise<void> {
    const upperChannel = channel.toUpperCase() as DeliveryChannelUpper;
    const toAddress = this.resolveToAddress(upperChannel, payload);

    const log = await this.prisma.notificationDeliveryLog.create({
      data: {
        recipientId: payload.recipientId,
        type: payload.type,
        priority: 'CRITICAL',
        channel: upperChannel,
        status: 'PENDING',
        toAddress: toAddress ?? null,
        attempts: 0,
      },
    });

    await this.attemptSend(log.id, upperChannel, payload, 1);
  }

  // ── public so the retry worker can call it ──────────────────────────────

  async attemptSend(
    logId: string,
    channel: DeliveryChannelUpper,
    payload: DispatchPayload,
    attemptNumber: number,
  ): Promise<void> {
    try {
      await this.runChannel(channel, payload);

      await this.prisma.notificationDeliveryLog.update({
        where: { id: logId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          attempts: attemptNumber,
          lastAttemptAt: new Date(),
          errorMessage: null,
        },
      });

      this.logger.log(
        `[${channel}] Delivered to ${payload.recipientId} (org: ${payload.organizationId}) attempt #${attemptNumber}`,
      );
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      this.logger.warn(
        `[${channel}] Attempt #${attemptNumber} failed for ${payload.recipientId}: ${errorMessage}`,
      );

      // RETRY_DELAYS_MS[0] is for attempt 1 failures (schedule attempt 2)
      const delayMs = RETRY_DELAYS_MS[attemptNumber - 1];

      if (delayMs !== undefined) {
        const queue = this.bullmq.getQueue(NOTIFICATION_RETRY_QUEUE);
        const job = await queue.add(
          'retry',
          {
            logId,
            channel,
            payload,
            attempt: attemptNumber + 1,
          } satisfies RetryJobData,
          {
            delay: delayMs,
            attempts: 1,
            // Bound Redis growth — completed retry jobs are pruned after 1h,
            // failed ones kept 24h for inspection (the queue has no worker-level
            // DEFAULT_JOB_OPTIONS since jobs are added via getQueue()).
            removeOnComplete: { age: 3600 },
            removeOnFail: { age: 86400 },
          },
        );

        await this.prisma.notificationDeliveryLog.update({
          where: { id: logId },
          data: {
            status: 'FAILED',
            attempts: attemptNumber,
            lastAttemptAt: new Date(),
            errorMessage,
            jobId: job.id ?? null,
          },
        });

        this.logger.log(
          `[${channel}] Scheduled retry attempt #${attemptNumber + 1} for log ${logId} in ${delayMs}ms`,
        );
      } else {
        await this.prisma.notificationDeliveryLog.update({
          where: { id: logId },
          data: {
            status: 'FAILED',
            attempts: attemptNumber,
            lastAttemptAt: new Date(),
            errorMessage,
            jobId: null,
          },
        });

        this.logger.error(
          `[${channel}] All retries exhausted for log ${logId} (org: ${payload.organizationId})`,
        );
        // Surface an exhausted CRITICAL delivery to Sentry — best-effort, must
        // not throw and must not mask the delivery failure already recorded.
        try {
          Sentry.captureException(err instanceof Error ? err : new Error(errorMessage), {
            level: 'error',
            tags: {
              area: 'notification-dispatch',
              channel,
              type: payload.type,
              logId,
            },
            extra: { recipientId: payload.recipientId, organizationId: payload.organizationId },
          });
        } catch {
          // ignore — alerting must never break the dispatch path
        }
      }
    }
  }

  // ── channel runners ─────────────────────────────────────────────────────

  private async runChannel(
    channel: DeliveryChannelUpper,
    payload: DispatchPayload,
  ): Promise<void> {
    switch (channel) {
      case 'EMAIL': {
        if (!payload.recipientEmail || !payload.emailTemplateSlug) {
          throw new Error('Missing email address or template slug');
        }
        await this.email.execute({
          to: payload.recipientEmail,
          templateSlug: payload.emailTemplateSlug,
          vars: payload.emailVars ?? {},
        });
        break;
      }
      case 'SMS': {
        if (!payload.recipientPhone || !payload.smsBody) {
          throw new Error('Missing phone or SMS body');
        }
        await this.sms.execute({ phone: payload.recipientPhone, body: payload.smsBody });
        break;
      }
      case 'PUSH': {
        const tokens = payload.fcmTokens ?? [];
        if (!tokens.length || !payload.pushTitle || !payload.pushBody) {
          throw new Error('Missing FCM tokens or push content');
        }
        const results = await Promise.allSettled(
          tokens.map((token) =>
            this.push.execute({
              token,
              title: payload.pushTitle!,
              body: payload.pushBody!,
            }),
          ),
        );
        const failures = results.filter((r) => r.status === 'rejected');
        if (failures.length > 0 && failures.length === results.length) {
          const errors = failures.map((r) =>
            r.status === 'rejected' ? String(r.reason?.message ?? r.reason) : '',
          );
          throw new Error(`All PUSH notifications failed: ${errors.join('; ')}`);
        }
        break;
      }
      default: {
        const exhaustiveCheck: never = channel;
        throw new Error(`Unsupported delivery channel: ${String(exhaustiveCheck)}`);
      }
    }
  }

  private resolveToAddress(
    channel: DeliveryChannelUpper,
    payload: DispatchPayload,
  ): string | undefined {
    switch (channel) {
      case 'EMAIL':
        return payload.recipientEmail;
      case 'SMS':
        return payload.recipientPhone;
      case 'PUSH':
        return payload.fcmTokens?.join(',');
      default:
        return undefined;
    }
  }
}
