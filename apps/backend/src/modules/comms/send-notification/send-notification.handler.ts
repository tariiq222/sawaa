import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { SendPushHandler } from '../send-push/send-push.handler';
import { SendEmailHandler } from '../send-email/send-email.handler';
import { SendSmsHandler } from '../send-sms/send-sms.handler';
import {
  ResilientNotificationDispatcher,
  CRITICAL_TYPES,
} from '../resilient-notification-dispatcher/resilient-notification-dispatcher.service';
import { SendNotificationDto } from './send-notification.dto';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export type SendNotificationCommand = SendNotificationDto & {
  /** Explicit override for background-bus event handlers where CLS isn't set. */
  organizationId?: string;
};

@Injectable()
export class SendNotificationHandler {
  private readonly logger = new Logger(SendNotificationHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: SendPushHandler,
    private readonly email: SendEmailHandler,
    private readonly sms: SendSmsHandler,
    private readonly dispatcher: ResilientNotificationDispatcher,
  ) {}

  async execute(dto: SendNotificationCommand): Promise<void> {
    const organizationId = dto.organizationId ?? DEFAULT_ORGANIZATION_ID;

    // ── 1. Persist in-app notification ────────────────────────────────────
    try {
      await this.prisma.notification.create({
        data: {
          recipientId: dto.recipientId,
          recipientType: dto.recipientType,
          type: dto.type,
          title: dto.title,
          body: dto.body,
          metadata: (dto.metadata as Prisma.InputJsonValue) ?? undefined,
        },
      });
    } catch (err) {
      this.logger.error('Failed to persist in-app notification', err);
      // Don't return — still attempt channel dispatches
    }

    const isCritical = CRITICAL_TYPES.has(dto.type);

    // ── 2a. CRITICAL — resilient dispatcher with retry ─────────────────────
    if (isCritical) {
      const channels: Array<'email' | 'sms' | 'push'> = [];

      if (dto.channels.includes('email') && dto.recipientEmail && dto.emailTemplateSlug) {
        channels.push('email');
      }
      if (dto.channels.includes('sms') && dto.recipientPhone) {
        channels.push('sms');
      }
      const fcmTokens = dto.fcmTokens ?? (dto.fcmToken ? [dto.fcmToken] : []);
      if (dto.channels.includes('push') && fcmTokens.length > 0) {
        channels.push('push');
      }

      if (channels.length > 0) {
        await this.dispatcher.dispatch(
          {
            organizationId,
            recipientId: dto.recipientId,
            type: dto.type,
            recipientEmail: dto.recipientEmail,
            emailTemplateSlug: dto.emailTemplateSlug,
            emailVars: dto.emailVars,
            recipientPhone: dto.recipientPhone,
            smsBody: dto.body,
            fcmTokens,
            pushTitle: dto.title,
            pushBody: dto.body,
          },
          channels,
        );
      }
      return;
    }

    // ── 2b. STANDARD — best-effort (existing behavior) ────────────────────
    const tasks: Promise<void>[] = [];

    if (dto.channels.includes('push')) {
      const tokens = dto.fcmTokens ?? (dto.fcmToken ? [dto.fcmToken] : []);
      for (const token of tokens) {
        tasks.push(this.push.execute({ token, title: dto.title, body: dto.body }));
      }
    }

    if (dto.channels.includes('email') && dto.recipientEmail && dto.emailTemplateSlug) {
      tasks.push(
        this.email.execute({
          to: dto.recipientEmail,
          templateSlug: dto.emailTemplateSlug,
          vars: dto.emailVars ?? {},
        }),
      );
    }

    if (dto.channels.includes('sms') && dto.recipientPhone) {
      tasks.push(this.sms.execute({ phone: dto.recipientPhone, body: dto.body }));
    }

    await Promise.allSettled(tasks);
  }
}
