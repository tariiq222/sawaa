import { Injectable, Logger } from '@nestjs/common';
import { NotificationType, RecipientType } from '@prisma/client';
import { EventBusService, type DomainEventEnvelope } from '../../../infrastructure/events';
import { SendNotificationHandler } from '../send-notification/send-notification.handler';
import { GetStaffTargetsHandler } from '../notifications/get-staff-targets.handler';

interface PaymentCompletedPayload {
  paymentId: string;
  invoiceId: string;
  bookingId: string;
  amount: number;
  currency: string;
  organizationId?: string;
}

@Injectable()
export class OnPaymentCompletedStaffHandler {
  private readonly logger = new Logger(OnPaymentCompletedStaffHandler.name);

  constructor(
    private readonly notify: SendNotificationHandler,
    private readonly staffTargets: GetStaffTargetsHandler,
  ) {}

  register(eventBus: EventBusService): void {
    eventBus.subscribe<PaymentCompletedPayload>('finance.payment.completed', (e) => this.handle(e));
  }

  async handle(envelope: DomainEventEnvelope<PaymentCompletedPayload>): Promise<void> {
    const { payload } = envelope;
    if (!payload.organizationId) return;
    try {
      const targets = await this.staffTargets.execute({
        organizationId: payload.organizationId,
        roles: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],
      });

      const amountStr = `${payload.amount} ${payload.currency}`;
      await Promise.allSettled(
        targets.map((target) =>
          this.notify.execute({
            organizationId: payload.organizationId!,
            recipientId: target.userId,
            recipientType: RecipientType.EMPLOYEE,
            type: NotificationType.PAYMENT_COMPLETED,
            title: 'دفع مكتمل',
            body: `تم استلام دفع بقيمة ${amountStr}`,
            channels: ['in-app'],
          }),
        ),
      );
    } catch (err) {
      this.logger.error(`Failed to handle staff payment.completed for payment ${payload.paymentId}`, err);
    }
  }
}
