import { Injectable, Logger, Optional } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { NotificationType, RecipientType } from '@prisma/client';
import { EventBusService, type DomainEventEnvelope } from '../../../infrastructure/events';
import { SendNotificationHandler } from '../send-notification/send-notification.handler';
import { GetClientPushTargetsHandler } from '../fcm-tokens/get-client-push-targets.handler';
import { CaptureNotificationIntentHandler } from '../notification-outbox/capture-notification-intent.handler';
import { MaterializeNotificationIntentHandler } from '../notification-outbox/materialize-notification-intent.handler';
import { ResolveNotificationIntentOwnershipHandler } from '../notification-outbox/resolve-notification-intent-ownership.handler';
import { NotificationOutboxConfig } from '../notification-outbox/notification-outbox.config';
import { NOTIFICATION_OUTBOX_CONSUMERS, NOTIFICATION_OUTBOX_PAYLOAD_VERSION, notificationSourceKey } from '../notification-outbox/notification-outbox.types';

interface BookingCancelledPayload {
  bookingId: string;
  clientId: string;
  employeeId: string;
  reason: string;
  cancelNotes?: string;
  clientEmail?: string;
  clientName?: string;
  clientPhone?: string;
}

@Injectable()
export class OnBookingCancelledHandler {
  private readonly logger = new Logger(OnBookingCancelledHandler.name);

  constructor(
    private readonly notify: SendNotificationHandler,
    private readonly pushTargets: GetClientPushTargetsHandler,
    @Optional() private readonly ownership?: ResolveNotificationIntentOwnershipHandler,
    @Optional() private readonly capture?: CaptureNotificationIntentHandler,
    @Optional() private readonly materialize?: MaterializeNotificationIntentHandler,
    @Optional() private readonly outboxConfig?: NotificationOutboxConfig,
  ) {}

  register(eventBus: EventBusService): void {
    eventBus.subscribe<BookingCancelledPayload>(
      'bookings.booking.cancelled',
      'comms.booking-cancelled-notify.v1',
      (e) => this.handle(e),
    );
  }

  async handle(envelope: DomainEventEnvelope<BookingCancelledPayload>): Promise<void> {
    const { payload } = envelope;
    if (await this.routeV2(envelope)) return;
    try {
      const { pushEnabled, tokens } = await this.pushTargets.execute({ clientId: payload.clientId });
      const channels: Array<'in-app' | 'push' | 'email' | 'sms'> = ['in-app', 'email'];
      if (pushEnabled && tokens.length > 0) channels.push('push');
      await this.notify.execute({
        recipientId: payload.clientId,
        recipientType: RecipientType.CLIENT,
        type: NotificationType.BOOKING_CANCELLED,
        title: 'تم إلغاء الموعد',
        body: 'نأسف، تم إلغاء موعدك.',
        channels,
        fcmTokens: tokens,
        recipientEmail: payload.clientEmail,
        emailTemplateSlug: 'booking-cancelled',
        emailVars: {
          client_name: payload.clientName ?? '',
          booking_id: payload.bookingId,
          reason: payload.reason,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to handle bookings.booking.cancelled for booking ${payload.bookingId}`,
        err,
      );
      Sentry.captureException(err, { tags: { event: 'bookings.booking.cancelled', bookingId: payload.bookingId } });
    }
  }

  private async routeV2(envelope: DomainEventEnvelope<BookingCancelledPayload>): Promise<boolean> {
    if (!this.ownership || !this.capture || !this.materialize || !this.outboxConfig || !envelope.eventId) return false;
    const sourceKey = notificationSourceKey.domainEvent(envelope.eventId);
    const consumerKey = NOTIFICATION_OUTBOX_CONSUMERS.BOOKING_CANCELLED_CLIENT;
    const owned = await this.ownership.execute({ sourceKey, consumerKey });
    if (owned) { await this.materialize.execute(owned); return true; }
    if (envelope.version !== NOTIFICATION_OUTBOX_PAYLOAD_VERSION) throw new Error(`Unsupported notification envelope version: ${envelope.version}`);
    if (!this.outboxConfig.shouldCapture(envelope.occurredAt)) return false;
    const payload = envelope.payload;
    const intentId = await this.capture.execute({
      sourceKey, consumerKey, payloadVersion: NOTIFICATION_OUTBOX_PAYLOAD_VERSION,
      occurredAt: new Date(envelope.occurredAt),
      payload: { kind: 'booking-cancelled-client', bookingId: payload.bookingId, clientId: payload.clientId, reason: payload.reason, clientName: payload.clientName, clientPhone: payload.clientPhone, clientEmail: payload.clientEmail },
    });
    await this.materialize.execute(intentId);
    return true;
  }
}
