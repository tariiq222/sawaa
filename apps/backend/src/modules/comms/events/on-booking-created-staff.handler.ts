import { Injectable, Logger } from '@nestjs/common';
import { NotificationType, RecipientType } from '@prisma/client';
import { EventBusService, type DomainEventEnvelope } from '../../../infrastructure/events';
import { SendNotificationHandler } from '../send-notification/send-notification.handler';
import { GetStaffTargetsHandler } from '../notifications/get-staff-targets.handler';

interface BookingCreatedPayload {
  bookingId: string;
  clientId: string;
  employeeId: string;
  organizationId: string;
  scheduledAt: Date;
  serviceId: string;
}

@Injectable()
export class OnBookingCreatedStaffHandler {
  private readonly logger = new Logger(OnBookingCreatedStaffHandler.name);

  constructor(
    private readonly notify: SendNotificationHandler,
    private readonly staffTargets: GetStaffTargetsHandler,
  ) {}

  register(eventBus: EventBusService): void {
    eventBus.subscribe<BookingCreatedPayload>('bookings.booking.created', (e) => this.handle(e));
  }

  async handle(envelope: DomainEventEnvelope<BookingCreatedPayload>): Promise<void> {
    const { payload } = envelope;
    try {
      const targets = await this.staffTargets.execute({
        organizationId: payload.organizationId,
        roles: ['OWNER', 'ADMIN', 'RECEPTIONIST'],
        includeUserId: payload.employeeId || undefined,
      });

      await Promise.allSettled(
        targets.map((target) =>
          this.notify.execute({
            organizationId: payload.organizationId,
            recipientId: target.userId,
            recipientType: RecipientType.EMPLOYEE,
            type: NotificationType.BOOKING_CREATED,
            title: 'حجز جديد',
            body: `تم إنشاء حجز جديد #${payload.bookingId.slice(-6)}`,
            channels: ['in-app'],
          }),
        ),
      );
    } catch (err) {
      this.logger.error(`Failed to handle bookings.booking.created for booking ${payload.bookingId}`, err);
    }
  }
}
