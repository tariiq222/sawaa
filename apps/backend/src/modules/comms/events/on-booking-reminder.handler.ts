import { Injectable, Logger } from '@nestjs/common';
import { NotificationType, RecipientType } from '@prisma/client';
import { EventBusService, type DomainEventEnvelope } from '../../../infrastructure/events';
import { SendNotificationHandler } from '../send-notification/send-notification.handler';
import { GetClientPushTargetsHandler } from '../fcm-tokens/get-client-push-targets.handler';

interface BookingReminderPayload {
  bookingId: string;
  clientId: string;
  scheduledAt: Date | string;
  clientPhone?: string;
}

@Injectable()
export class OnBookingReminderHandler {
  private readonly logger = new Logger(OnBookingReminderHandler.name);

  constructor(
    private readonly notify: SendNotificationHandler,
    private readonly pushTargets: GetClientPushTargetsHandler,
  ) {}

  register(eventBus: EventBusService): void {
    eventBus.subscribe<BookingReminderPayload>('ops.booking.reminder_due', (e) => this.handle(e));
  }

  async handle(envelope: DomainEventEnvelope<BookingReminderPayload>): Promise<void> {
    const { payload } = envelope;
    const scheduledAt = new Date(payload.scheduledAt);
    const timeStr = scheduledAt.toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
    });
    try {
      const { pushEnabled, tokens } = await this.pushTargets.execute({ clientId: payload.clientId });
      const channels: Array<'in-app' | 'push' | 'sms' | 'email'> = ['in-app', 'sms'];
      if (pushEnabled && tokens.length > 0) channels.push('push');
      await this.notify.execute({
        recipientId: payload.clientId,
        recipientType: RecipientType.CLIENT,
        type: NotificationType.BOOKING_REMINDER,
        title: 'تذكير بموعدك',
        body: `موعدك غداً الساعة ${timeStr}`,
        channels,
        fcmTokens: tokens,
        recipientPhone: payload.clientPhone,
      });
    } catch (err) {
      this.logger.error(
        `Failed to handle reminder for booking ${payload.bookingId}`,
        err,
      );
    }
  }
}
