import { Injectable, Logger } from '@nestjs/common';
import { NotificationType, RecipientType } from '@prisma/client';
import { EventBusService, type DomainEventEnvelope } from '../../../infrastructure/events';
import { SendNotificationHandler } from '../send-notification/send-notification.handler';
import { GetStaffTargetsHandler } from '../notifications/get-staff-targets.handler';

interface BookingCancelledPayload {
  bookingId: string;
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
  ) {}

  register(eventBus: EventBusService): void {
    eventBus.subscribe<BookingCancelledPayload>('bookings.booking.cancelled', (e) => this.handle(e));
  }

  async handle(envelope: DomainEventEnvelope<BookingCancelledPayload>): Promise<void> {
    const { payload } = envelope;
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
            body: `تم إلغاء الحجز #${payload.bookingId.slice(-6)} — ${payload.reason}`,
            channels: ['in-app'],
          }),
        ),
      );
    } catch (err) {
      this.logger.error(`Failed to handle staff booking.cancelled for booking ${payload.bookingId}`, err);
    }
  }
}
