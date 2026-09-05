import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';

import { EmailProviderNotConfiguredError } from '../../../infrastructure/email/email-provider.interface';
import { EmailProviderFactory } from '../../../infrastructure/email/email-provider.factory';
import { FcmService } from '../../../infrastructure/mail/fcm.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  SmsProviderFactory,
} from '../../../infrastructure/sms/sms-provider.factory';
import {
  SmsProviderNotConfiguredError,
} from '../../../infrastructure/sms/sms-provider.interface';
import { NOTIFICATION_OUTBOX_OUTCOME_REASONS } from './notification-outbox.types';

export type ClaimedNotificationDelivery = {
  id: string;
  channel: 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP';
  targetAddress: string;
  channelPayload: Record<string, unknown>;
};

export type NotificationChannelSendResult = {
  outcome: 'ACCEPTED' | 'DELIVERED' | 'SKIPPED' | 'DEAD' | 'UNKNOWN' | 'RETRY_WAIT';
  providerName?: string;
  providerMessageId?: string;
  errorCode?: string;
  reason?: string;
  retryAfterMs?: number;
};

/** Sends one already-materialized delivery. Provider calls are deliberately
 * kept outside worker transactions and return only bounded, safe metadata. */
@Injectable()
export class NotificationChannelSender {
  constructor(
    private readonly prisma: PrismaService,
    private readonly smsFactory: SmsProviderFactory,
    private readonly emailFactory: EmailProviderFactory,
    private readonly fcm: FcmService,
  ) {}

  async send(delivery: ClaimedNotificationDelivery): Promise<NotificationChannelSendResult> {
    if (!delivery.targetAddress) {
      return { outcome: 'SKIPPED', reason: NOTIFICATION_OUTBOX_OUTCOME_REASONS.MISSING_TARGET };
    }

    try {
      switch (delivery.channel) {
        case 'IN_APP':
          return { outcome: 'DELIVERED', reason: 'in-app-created' };
        case 'SMS':
          return await this.sendSms(delivery);
        case 'EMAIL':
          return await this.sendEmail(delivery);
        case 'PUSH':
          return await this.sendPush(delivery);
        default:
          return { outcome: 'DEAD', errorCode: 'UNSUPPORTED_CHANNEL' };
      }
    } catch (error) {
      if (error instanceof SmsProviderNotConfiguredError || error instanceof EmailProviderNotConfiguredError) {
        return {
          outcome: 'DEAD',
          errorCode: NOTIFICATION_OUTBOX_OUTCOME_REASONS.NO_PROVIDER,
          reason: NOTIFICATION_OUTBOX_OUTCOME_REASONS.NO_PROVIDER,
        };
      }
      return {
        outcome: 'UNKNOWN',
        errorCode: this.safeErrorCode(error),
        reason: NOTIFICATION_OUTBOX_OUTCOME_REASONS.AMBIGUOUS_PROVIDER_OUTCOME,
      };
    }
  }

  private async sendSms(
    delivery: ClaimedNotificationDelivery,
  ): Promise<NotificationChannelSendResult> {
    const payload = delivery.channelPayload as { body?: unknown };
    const body = typeof payload.body === 'string' ? payload.body : '';
    if (!body) {
      return {
        outcome: 'DEAD',
        errorCode: NOTIFICATION_OUTBOX_OUTCOME_REASONS.INVALID_PAYLOAD,
        reason: NOTIFICATION_OUTBOX_OUTCOME_REASONS.INVALID_PAYLOAD,
      };
    }

    const provider = await this.smsFactory.resolve();
    if (provider.name === 'NONE') {
      return {
        outcome: 'DEAD',
        errorCode: NOTIFICATION_OUTBOX_OUTCOME_REASONS.NO_PROVIDER,
        reason: NOTIFICATION_OUTBOX_OUTCOME_REASONS.NO_PROVIDER,
      };
    }
    let result;
    try {
      result = await provider.send(delivery.targetAddress, body, null);
    } catch (error) {
      const retry = this.knownRateLimit(error, provider.name);
      if (retry) return retry;
      throw error;
    }
    await this.prisma.smsDelivery.create({
      data: {
        provider: provider.name,
        toPhone: delivery.targetAddress,
        body,
        bodyHash: createHash('sha256').update(body).digest('hex'),
        status: result.status === 'SENT' ? 'SENT' : 'QUEUED',
        providerMessageId: result.providerMessageId,
        sentAt: result.status === 'SENT' ? new Date() : undefined,
      },
    });
    return {
      outcome: 'ACCEPTED',
      providerName: provider.name,
      providerMessageId: result.providerMessageId,
    };
  }

  private async sendEmail(
    delivery: ClaimedNotificationDelivery,
  ): Promise<NotificationChannelSendResult> {
    const payload = delivery.channelPayload as {
      subject?: unknown;
      html?: unknown;
    };
    const subject = typeof payload.subject === 'string' ? payload.subject : '';
    const html = typeof payload.html === 'string' ? payload.html : '';
    if (!subject || !html) {
      return {
        outcome: 'DEAD',
        errorCode: NOTIFICATION_OUTBOX_OUTCOME_REASONS.INVALID_PAYLOAD,
        reason: NOTIFICATION_OUTBOX_OUTCOME_REASONS.INVALID_PAYLOAD,
      };
    }

    const provider = await this.emailFactory.resolve();
    if (!provider.isAvailable() || provider.name === 'NONE') {
      return {
        outcome: 'DEAD',
        errorCode: NOTIFICATION_OUTBOX_OUTCOME_REASONS.NO_PROVIDER,
        reason: NOTIFICATION_OUTBOX_OUTCOME_REASONS.NO_PROVIDER,
      };
    }
    let result;
    try {
      result = await provider.sendMail({ to: delivery.targetAddress, subject, html });
    } catch (error) {
      const retry = this.knownRateLimit(error, provider.name);
      if (retry) return retry;
      throw error;
    }
    return {
      outcome: 'ACCEPTED',
      providerName: provider.name,
      providerMessageId: result.messageId,
    };
  }

  private async sendPush(
    delivery: ClaimedNotificationDelivery,
  ): Promise<NotificationChannelSendResult> {
    const payload = delivery.channelPayload as {
      title?: unknown;
      body?: unknown;
      data?: Record<string, string>;
    };
    const title = typeof payload.title === 'string' ? payload.title : '';
    const body = typeof payload.body === 'string' ? payload.body : '';
    if (!title || !body) {
      return {
        outcome: 'DEAD',
        errorCode: NOTIFICATION_OUTBOX_OUTCOME_REASONS.INVALID_PAYLOAD,
        reason: NOTIFICATION_OUTBOX_OUTCOME_REASONS.INVALID_PAYLOAD,
      };
    }
    if (!this.fcm.isAvailable()) {
      return {
        outcome: 'DEAD',
        errorCode: NOTIFICATION_OUTBOX_OUTCOME_REASONS.NO_PROVIDER,
        reason: NOTIFICATION_OUTBOX_OUTCOME_REASONS.NO_PROVIDER,
      };
    }
    const providerMessageId = await this.fcm.sendPush(
      delivery.targetAddress,
      title,
      body,
      payload.data,
    );
    return { outcome: 'ACCEPTED', providerName: 'FCM', providerMessageId };
  }

  private safeErrorCode(error: unknown): string {
    if (error && typeof error === 'object' && 'code' in error) {
      const code = (error as { code?: unknown }).code;
      if (typeof code === 'string' && ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN'].includes(code)) return code;
    }
    return 'PROVIDER_ERROR';
  }

  private knownRateLimit(error: unknown, provider: string): NotificationChannelSendResult | null {
    // These exact prefixes originate in the existing adapters only after an
    // HTTP rejection. Restrict this check to the provider call: a later audit
    // write failure must remain UNKNOWN even if its error text looks similar.
    const prefixes: Record<string, string> = {
      TAQNYAT: 'Taqnyat HTTP 429:', UNIFONIC: 'Unifonic HTTP 429:',
      RESEND: 'Resend API error 429:', SENDGRID: 'SendGrid API error 429:',
      MAILCHIMP: 'Mailchimp Transactional API error 429:',
    };
    const prefix = prefixes[provider];
    if (!(error instanceof Error) || !prefix || !error.message.startsWith(prefix)) return null;
    // Current adapters discard Retry-After; do not parse untrusted response
    // bodies or invent a delay. The worker applies the durable backoff policy.
    return { outcome: 'RETRY_WAIT', reason: NOTIFICATION_OUTBOX_OUTCOME_REASONS.SAFE_TRANSIENT, errorCode: 'RATE_LIMITED' };
  }
}
