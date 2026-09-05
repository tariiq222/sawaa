import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationOutboxDeliveryStatus } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/database';
import { NOTIFICATION_OUTBOX_MAX_PROVIDER_ATTEMPTS } from './notification-outbox.config';
import { NOTIFICATION_OUTBOX_OUTCOME_REASONS } from './notification-outbox.types';
import {
  notificationEmailDefinition,
  renderFrozenNotificationEmail,
} from './notification-email-renderer';

const OPERATOR_RETRYABLE_REASONS = new Set<string>([
  NOTIFICATION_OUTBOX_OUTCOME_REASONS.NO_PROVIDER,
  NOTIFICATION_OUTBOX_OUTCOME_REASONS.TEMPLATE_UNAVAILABLE,
  NOTIFICATION_OUTBOX_OUTCOME_REASONS.SAFE_TRANSIENT,
]);

export type RetryDeadNotificationDeliveryCommand = {
  deliveryId: string;
  actor: string;
  reason: string;
};

@Injectable()
export class RetryDeadNotificationDeliveryHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: RetryDeadNotificationDeliveryCommand): Promise<void> {
    const actor = command.actor.trim().slice(0, 128);
    const reason = command.reason.trim().slice(0, 256);
    if (!actor || !reason) {
      throw new BadRequestException('Operator actor and reason are required');
    }

    // This scoped operator command has no request context. Sawaa is single-tenant
    // and RLS has been removed; the direct transaction keeps retry and audit atomic.
    // eslint-disable-next-line no-restricted-syntax
    await this.prisma.$transaction(async (tx) => {
      const row = await tx.notificationDelivery.findUnique({
        where: { id: command.deliveryId },
        select: {
          id: true,
          status: true,
          attempts: true,
          outcomeReason: true,
          channel: true,
          channelPayload: true,
          intent: { select: { consumerKey: true, payload: true } },
        },
      });
      if (!row) throw new NotFoundException('Notification delivery not found');
      if (
        row.status !== NotificationOutboxDeliveryStatus.DEAD ||
        row.attempts >= NOTIFICATION_OUTBOX_MAX_PROVIDER_ATTEMPTS ||
        !row.outcomeReason ||
        !OPERATOR_RETRYABLE_REASONS.has(row.outcomeReason)
      ) {
        throw new BadRequestException('Notification delivery is not safe to retry');
      }

      let repairedPayload;
      if (row.outcomeReason === NOTIFICATION_OUTBOX_OUTCOME_REASONS.TEMPLATE_UNAVAILABLE) {
        if (row.channel !== 'EMAIL') {
          throw new BadRequestException('Notification delivery template cannot be repaired');
        }
        const payload = row.intent.payload as Record<string, unknown>;
        const clientId = typeof payload.clientId === 'string' ? payload.clientId : undefined;
        const client = clientId
          ? await tx.client.findUnique({ where: { id: clientId }, select: { name: true } })
          : null;
        const definition = notificationEmailDefinition(
          row.intent.consumerKey,
          row.intent.payload,
          client?.name,
        );
        if (!definition) {
          throw new BadRequestException('Notification delivery template cannot be repaired');
        }
        const template = await tx.emailTemplate.findFirst({
          where: { slug: definition.templateSlug, isActive: true },
          select: { subject: true, htmlBody: true },
        });
        if (!template) {
          throw new BadRequestException('Notification delivery template is still unavailable');
        }
        repairedPayload = renderFrozenNotificationEmail(definition, template);
      }

      const updated = await tx.notificationDelivery.updateMany({
        where: {
          id: row.id,
          status: NotificationOutboxDeliveryStatus.DEAD,
          attempts: row.attempts,
          outcomeReason: row.outcomeReason,
        },
        data: {
          status: NotificationOutboxDeliveryStatus.READY,
          nextAttemptAt: null,
          nextEnqueueAt: null,
          leaseToken: null,
          leaseUntil: null,
          outcomeReason: null,
          ...(repairedPayload ? { channelPayload: repairedPayload } : {}),
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Notification delivery changed during retry');
      }

      await tx.activityLog.create({
        data: {
          action: 'SYSTEM',
          entity: 'NotificationDelivery',
          entityId: row.id,
          description: 'notification_delivery_operator_requeued',
          metadata: {
            actor,
            reason,
            priorOutcomeReason: row.outcomeReason,
            priorAttempts: row.attempts,
          },
        },
      });
    });
  }
}
