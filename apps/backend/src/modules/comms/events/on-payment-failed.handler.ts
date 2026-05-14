import { Injectable, Logger } from '@nestjs/common';
import { NotificationType, RecipientType } from '@prisma/client';
import { EventBusService, type DomainEventEnvelope } from '../../../infrastructure/events';
import { SendNotificationHandler } from '../send-notification/send-notification.handler';
import { GetClientPushTargetsHandler } from '../fcm-tokens/get-client-push-targets.handler';

interface PaymentFailedPayload {
  paymentId: string;
  clientId: string;
  amount: number;
  currency: string;
  clientEmail?: string;
  clientName?: string;
}

@Injectable()
export class OnPaymentFailedHandler {
  private readonly logger = new Logger(OnPaymentFailedHandler.name);

  constructor(
    private readonly notify: SendNotificationHandler,
    private readonly pushTargets: GetClientPushTargetsHandler,
  ) {}

  register(eventBus: EventBusService): void {
    eventBus.subscribe<PaymentFailedPayload>('finance.payment.failed', (e) => this.handle(e));
  }

  async handle(envelope: DomainEventEnvelope<PaymentFailedPayload>): Promise<void> {
    const { payload } = envelope;
    try {
      const { pushEnabled, tokens } = await this.pushTargets.execute({ clientId: payload.clientId });
      const channels: Array<'in-app' | 'push' | 'email' | 'sms'> = ['in-app', 'email'];
      if (pushEnabled && tokens.length > 0) channels.push('push');
      await this.notify.execute({
        recipientId: payload.clientId,
        recipientType: RecipientType.CLIENT,
        type: NotificationType.PAYMENT_FAILED,
        title: 'فشل الدفع',
        body: `لم تتم معالجة دفعتك بقيمة ${payload.amount} ${payload.currency}. يرجى المحاولة مرة أخرى.`,
        channels,
        fcmTokens: tokens,
        recipientEmail: payload.clientEmail,
        emailTemplateSlug: 'payment-failed',
        emailVars: {
          client_name: payload.clientName ?? '',
          amount: String(payload.amount),
          currency: payload.currency,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to handle payment failed for payment ${payload.paymentId}`,
        err,
      );
    }
  }
}
