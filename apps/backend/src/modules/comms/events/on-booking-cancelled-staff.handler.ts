import { Injectable, Logger, Optional } from '@nestjs/common';
import { NotificationType, RecipientType } from '@prisma/client';
import { EventBusService, type DomainEventEnvelope } from '../../../infrastructure/events';
import { SendNotificationHandler } from '../send-notification/send-notification.handler';
import { GetStaffTargetsHandler } from '../notifications/get-staff-targets.handler';
import { formatBookingRef } from './booking-ref.util';
import { CaptureNotificationIntentHandler } from '../notification-outbox/capture-notification-intent.handler';
import { MaterializeNotificationIntentHandler } from '../notification-outbox/materialize-notification-intent.handler';
import { ResolveNotificationIntentOwnershipHandler } from '../notification-outbox/resolve-notification-intent-ownership.handler';
import { NotificationOutboxConfig } from '../notification-outbox/notification-outbox.config';
import { NOTIFICATION_OUTBOX_CONSUMERS, NOTIFICATION_OUTBOX_PAYLOAD_VERSION, notificationSourceKey } from '../notification-outbox/notification-outbox.types';

interface BookingCancelledPayload {
  bookingId: string;
  bookingNumber?: number;
  clientId: string;
  employeeId: string;
  organizationId?: string;
  reason: string;
  cancelNotes?: string;
}

@Injectable()
export class OnBookingCancelledStaffHandler {
  private readonly logger = new Logger(OnBookingCancelledStaffHandler.name);

  constructor(
    private readonly notify: SendNotificationHandler,
    private readonly staffTargets: GetStaffTargetsHandler,
    @Optional() private readonly ownership?: ResolveNotificationIntentOwnershipHandler,
    @Optional() private readonly capture?: CaptureNotificationIntentHandler,
    @Optional() private readonly materialize?: MaterializeNotificationIntentHandler,
    @Optional() private readonly outboxConfig?: NotificationOutboxConfig,
  ) {}

  register(eventBus: EventBusService): void {
    eventBus.subscribe<BookingCancelledPayload>(
      'bookings.booking.cancelled',
      'comms.booking-cancelled-staff.v1',
      (e) => this.handle(e),
    );
  }

  async handle(envelope: DomainEventEnvelope<BookingCancelledPayload>): Promise<void> {
    const { payload } = envelope;
    if (await this.routeV2(envelope)) return;
    if (!payload.organizationId) return;
    try {
      const targets = await this.staffTargets.execute({
        organizationId: payload.organizationId,
        roles: ['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST'],
        includeUserId: payload.employeeId || undefined,
      });

      await Promise.allSettled(
        targets.map((target) =>
          this.notify.execute({
            organizationId: payload.organizationId!,
            recipientId: target.userId,
            recipientType: RecipientType.EMPLOYEE,
            type: NotificationType.BOOKING_CANCELLED,
            title: 'تم إلغاء حجز',
            body: `تم إلغاء الحجز ${formatBookingRef(payload.bookingNumber, payload.bookingId)} — ${payload.reason}`,
            channels: ['in-app'],
          }),
        ),
      );
    } catch (err) {
      this.logger.error(`Failed to handle staff booking.cancelled for booking ${payload.bookingId}`, err);
    }
  }

  private async routeV2(envelope: DomainEventEnvelope<BookingCancelledPayload>): Promise<boolean> {
    if (!this.ownership || !this.capture || !this.materialize || !this.outboxConfig || !envelope.eventId) return false;
    const sourceKey = notificationSourceKey.domainEvent(envelope.eventId);
    const consumerKey = NOTIFICATION_OUTBOX_CONSUMERS.BOOKING_CANCELLED_STAFF;
    const owned = await this.ownership.execute({ sourceKey, consumerKey });
    if (owned) { await this.materialize.execute(owned); return true; }
    if (envelope.version !== NOTIFICATION_OUTBOX_PAYLOAD_VERSION) throw new Error(`Unsupported notification envelope version: ${envelope.version}`);
    if (!this.outboxConfig.shouldCapture(envelope.occurredAt)) return false;
    const payload = envelope.payload;
    const intentId = await this.capture.execute({
      sourceKey, consumerKey, payloadVersion: NOTIFICATION_OUTBOX_PAYLOAD_VERSION,
      occurredAt: new Date(envelope.occurredAt),
      payload: { kind: 'booking-cancelled-staff', bookingId: payload.bookingId, bookingNumber: payload.bookingNumber, employeeId: payload.employeeId, reason: payload.reason },
    });
    await this.materialize.execute(intentId);
    return true;
  }
}
