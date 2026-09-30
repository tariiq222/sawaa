import { Injectable, Logger, Optional } from '@nestjs/common';
import { NotificationType, RecipientType } from '@prisma/client';
import { EventBusService, type DomainEventEnvelope } from '../../../infrastructure/events';
import { SendNotificationHandler } from '../send-notification/send-notification.handler';
import { GetClientPushTargetsHandler } from '../fcm-tokens/get-client-push-targets.handler';
import { PrismaService } from '../../../infrastructure/database';
import { BUSINESS_TZ } from '../../../common/timezone';
import { CaptureNotificationIntentHandler } from '../notification-outbox/capture-notification-intent.handler';
import { MaterializeNotificationIntentHandler } from '../notification-outbox/materialize-notification-intent.handler';
import { ResolveNotificationIntentOwnershipHandler } from '../notification-outbox/resolve-notification-intent-ownership.handler';
import { NotificationOutboxConfig } from '../notification-outbox/notification-outbox.config';
import { NOTIFICATION_OUTBOX_CONSUMERS, NOTIFICATION_OUTBOX_PAYLOAD_VERSION, NOTIFICATION_OUTBOX_REMINDER_POLICY_VERSION, notificationSourceKey } from '../notification-outbox/notification-outbox.types';

interface BookingReminderPayload {
  bookingId: string;
  clientId: string;
  scheduledAt: Date | string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  serviceName?: string;
  organizationId?: string;
}

@Injectable()
export class OnBookingReminderHandler {
  private readonly logger = new Logger(OnBookingReminderHandler.name);

  constructor(
    private readonly notify: SendNotificationHandler,
    private readonly pushTargets: GetClientPushTargetsHandler,
    @Optional() private readonly ownership?: ResolveNotificationIntentOwnershipHandler,
    @Optional() private readonly capture?: CaptureNotificationIntentHandler,
    @Optional() private readonly materialize?: MaterializeNotificationIntentHandler,
    @Optional() private readonly outboxConfig?: NotificationOutboxConfig,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  register(eventBus: EventBusService): void {
    eventBus.subscribe<BookingReminderPayload>(
      'ops.booking.reminder_due',
      'comms.booking-reminder.v1',
      (e) => this.handle(e),
    );
  }

  async handle(envelope: DomainEventEnvelope<BookingReminderPayload>): Promise<void> {
    const { payload } = envelope;
    if (await this.routeV2(envelope)) return;
    const scheduledAt = new Date(payload.scheduledAt);
    const timeStr = scheduledAt.toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: BUSINESS_TZ,
    });
    try {
      const { pushEnabled, tokens } = await this.pushTargets.execute({ clientId: payload.clientId });
      const channels: Array<'in-app' | 'push' | 'sms' | 'email'> = ['in-app', 'sms'];
      if (pushEnabled && tokens.length > 0) channels.push('push');
      if (payload.clientEmail) channels.push('email');
      await this.notify.execute({
        recipientId: payload.clientId,
        recipientType: RecipientType.CLIENT,
        type: NotificationType.BOOKING_REMINDER,
        title: 'تذكير بموعدك',
        // SECURITY (P1): redact exact time from the lock-screen push body.
        // The SMS/email channels carry the full detail.
        body: 'تذكير بموعدك غداً. افتح التطبيق للتفاصيل.',
        channels,
        fcmTokens: tokens,
        recipientPhone: payload.clientPhone,
        recipientEmail: payload.clientEmail,
        emailTemplateSlug: payload.clientEmail ? 'booking-reminder' : undefined,
        emailVars: payload.clientEmail
          ? {
              client_name: payload.clientName ?? '',
              service_name: payload.serviceName ?? '',
              time: timeStr,
            }
          : undefined,
      });
    } catch (err) {
      this.logger.error(
        `Failed to handle reminder for booking ${payload.bookingId}`,
        err,
      );
    }
  }

  private async routeV2(envelope: DomainEventEnvelope<BookingReminderPayload>): Promise<boolean> {
    if (!this.ownership || !this.capture || !this.materialize || !this.outboxConfig) return false;
    const sourceKey = notificationSourceKey.reminder(envelope.payload.bookingId, envelope.payload.scheduledAt, NOTIFICATION_OUTBOX_REMINDER_POLICY_VERSION);
    const consumerKey = NOTIFICATION_OUTBOX_CONSUMERS.BOOKING_REMINDER_CLIENT;
    const owned = await this.ownership.execute({ sourceKey, consumerKey });
    if (owned) { await this.materialize.execute(owned); return true; }
    if (envelope.version !== NOTIFICATION_OUTBOX_PAYLOAD_VERSION) throw new Error(`Unsupported notification envelope version: ${envelope.version}`);
    let reminderBeforeMinutes = 60;
    if (this.prisma) {
      const settings = await this.prisma.organizationSettings.findFirst({ select: { reminderBeforeMinutes: true } });
      if (typeof settings?.reminderBeforeMinutes === 'number' && settings.reminderBeforeMinutes > 0) reminderBeforeMinutes = settings.reminderBeforeMinutes;
    }
    const dueAt = new Date(new Date(envelope.payload.scheduledAt).getTime() - reminderBeforeMinutes * 60_000);
    if (!this.outboxConfig.shouldCapture(dueAt)) return false;
    const intentId = await this.capture.execute({
      sourceKey, consumerKey, payloadVersion: NOTIFICATION_OUTBOX_PAYLOAD_VERSION,
      occurredAt: new Date(envelope.occurredAt), expiresAt: new Date(envelope.payload.scheduledAt),
      payload: { kind: 'booking-reminder-client', bookingId: envelope.payload.bookingId, clientId: envelope.payload.clientId, scheduledAt: new Date(envelope.payload.scheduledAt).toISOString(), clientName: envelope.payload.clientName, clientPhone: envelope.payload.clientPhone, clientEmail: envelope.payload.clientEmail, serviceName: envelope.payload.serviceName, policyVersion: NOTIFICATION_OUTBOX_REMINDER_POLICY_VERSION },
    });
    await this.materialize.execute(intentId);
    return true;
  }
}
