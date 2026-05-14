import { Injectable, Logger } from '@nestjs/common';
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
}

interface GroupSessionPaymentLinksReadyPayload {
  groupSessionKey: string;
  paymentLinks: PaymentLink[];
}

/**
 * Subscribes to group_session.payment_links_ready.
 *
 * Sends an in-app + push notification to each client in the group session
 * informing them that the minimum has been reached and they need to pay
 * within 24 hours to secure their spot.
 */
@Injectable()
export class OnGroupSessionPaymentLinksReadyHandler {
  private readonly logger = new Logger(OnGroupSessionPaymentLinksReadyHandler.name);

  constructor(
    private readonly notify: SendNotificationHandler,
    private readonly pushTargets: GetClientPushTargetsHandler,
  ) {}

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
      await this.notify.execute({
        recipientId: link.clientId,
        recipientType: RecipientType.CLIENT,
        type: NotificationType.PAYMENT_REMINDER,
        title: 'اكتمل الحد الأدنى للجلسة الجماعية',
        body: `تم تأكيد الجلسة. يرجى إتمام الدفع خلال 24 ساعة لتأمين مقعدك.`,
        channels,
        fcmTokens: tokens,
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
