import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType, RecipientType } from '@prisma/client';
import { EventBusService, type DomainEventEnvelope } from '../../../infrastructure/events';
import { SendNotificationHandler } from '../send-notification/send-notification.handler';
import { GetClientPushTargetsHandler } from '../fcm-tokens/get-client-push-targets.handler';

interface PaymentLink {
  bookingId: string;
  clientId: string;
  invoiceId: string;
  amount: number;
  currency: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
}

interface GroupSessionPaymentLinksReadyPayload {
  groupSessionKey: string;
  paymentLinks: PaymentLink[];
}

/**
 * Subscribes to group_session.payment_links_ready.
 *
 * Notifies each client in the group session via every available channel
 * (in-app + push + email + sms) that the minimum has been reached and
 * they have 24 hours to pay. Email/SMS act as durable channels for clients
 * who don't have the app installed.
 */
@Injectable()
export class OnGroupSessionPaymentLinksReadyHandler {
  private readonly logger = new Logger(OnGroupSessionPaymentLinksReadyHandler.name);
  private readonly clientPaymentUrlBase: string;

  constructor(
    private readonly notify: SendNotificationHandler,
    private readonly pushTargets: GetClientPushTargetsHandler,
    config: ConfigService,
  ) {
    this.clientPaymentUrlBase =
      config.get<string>('CLIENT_PAYMENT_URL_BASE') ??
      config.get<string>('WEBSITE_URL') ??
      'https://sawaa.net';
  }

  register(eventBus: EventBusService): void {
    eventBus.subscribe<GroupSessionPaymentLinksReadyPayload>(
      'group_session.payment_links_ready',
      (e) => this.handle(e),
    );
  }

  async handle(
    envelope: DomainEventEnvelope<GroupSessionPaymentLinksReadyPayload>,
  ): Promise<void> {
    const { paymentLinks } = envelope.payload;

    await Promise.allSettled(
      paymentLinks.map((link) => this.notifyClient(link)),
    );
  }

  private async notifyClient(link: PaymentLink): Promise<void> {
    try {
      const { pushEnabled, tokens } = await this.pushTargets.execute({ clientId: link.clientId });
      const channels: Array<'in-app' | 'push' | 'email' | 'sms'> = ['in-app'];
      if (pushEnabled && tokens.length > 0) channels.push('push');
      if (link.clientEmail) channels.push('email');
      if (link.clientPhone) channels.push('sms');

      const paymentUrl = `${this.clientPaymentUrlBase.replace(/\/$/, '')}/invoices/${link.invoiceId}`;

      await this.notify.execute({
        recipientId: link.clientId,
        recipientType: RecipientType.CLIENT,
        type: NotificationType.PAYMENT_REMINDER,
        title: 'اكتمل الحد الأدنى للجلسة الجماعية',
        body: 'تم تأكيد الجلسة. يرجى إتمام الدفع خلال 24 ساعة لتأمين مقعدك.',
        channels,
        fcmTokens: tokens,
        recipientEmail: link.clientEmail,
        recipientPhone: link.clientPhone,
        emailTemplateSlug: link.clientEmail ? 'group-session-payment-due' : undefined,
        emailVars: link.clientEmail
          ? {
              client_name: link.clientName ?? '',
              amount: String(link.amount),
              currency: link.currency,
              payment_url: paymentUrl,
            }
          : undefined,
        metadata: {
          invoiceId: link.invoiceId,
          bookingId: link.bookingId,
          amount: link.amount,
          currency: link.currency,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to notify client ${link.clientId} for group session payment (booking ${link.bookingId})`,
        err,
      );
    }
  }
}
