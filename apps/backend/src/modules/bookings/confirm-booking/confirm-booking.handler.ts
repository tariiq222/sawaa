import { Injectable, Logger } from '@nestjs/common';
import { BookingStatus, DeliveryType, Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { BookingConfirmedEvent } from '../events/booking-confirmed.event';
import { BookingZoomCreateRequestedEvent } from '../events/booking-zoom-create-requested.event';
import { ZoomMeetingQueueService } from '../create-zoom-meeting/zoom-meeting-queue.service';
import { fetchBookingOrFail, updateBookingAtomically } from '../booking-lifecycle.helper';
import { assertTransition } from '../booking-state-machine';
import { DEFAULT_ORG_ID } from '../../../common/constants';

export interface ConfirmBookingCommand {
  bookingId: string;
  changedBy: string;
}

@Injectable()
export class ConfirmBookingHandler {
  private readonly logger = new Logger(ConfirmBookingHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly eventBus: EventBusService,
    private readonly zoomMeetingQueue: ZoomMeetingQueueService,
  ) {}

  async execute(cmd: ConfirmBookingCommand) {
    const booking = await fetchBookingOrFail(this.prisma, cmd.bookingId, [BookingStatus.PENDING], 'confirmed');
    const nextStatus = assertTransition(booking.status, 'CONFIRM');
    const zoomEvent = booking.deliveryType === DeliveryType.ONLINE
      ? new BookingZoomCreateRequestedEvent({ organizationId: DEFAULT_ORG_ID, bookingId: booking.id })
      : null;

    const [updated] = await this.rlsTransaction.withTransaction((tx) => Promise.all([
      updateBookingAtomically(tx, {
        bookingId: cmd.bookingId,
        currentStatus: booking.status,
        actionLabel: 'confirmed',
        data: { status: nextStatus, confirmedAt: new Date() },
      }),
      tx.bookingStatusLog.create({
        data: {
          bookingId: cmd.bookingId,
          fromStatus: booking.status,
          toStatus: nextStatus,
          changedBy: cmd.changedBy,
        },
      }),
      ...(zoomEvent ? [tx.outboxEvent.create({
        data: {
          id: zoomEvent.eventId,
          aggregateId: booking.id,
          eventType: zoomEvent.eventName,
          status: 'PENDING_V2',
          payload: zoomEvent.toEnvelope() as unknown as Prisma.InputJsonValue,
        },
      })] : []),
    ]));

    const event = new BookingConfirmedEvent({
      bookingId: booking.id,
      clientId: booking.clientId,
      employeeId: booking.employeeId,
      branchId: booking.branchId,
      serviceId: booking.serviceId!,
      scheduledAt: booking.scheduledAt,
      price: Number(booking.price),
      currency: booking.currency,
      couponCode: (booking as Record<string, unknown>).couponCode as string | null ?? null,
      discountedPrice: (booking as Record<string, unknown>).discountedPrice
        ? Number((booking as Record<string, unknown>).discountedPrice)
        : null,
      bookingType: booking.bookingType,
    });
    await this.eventBus.publish(event.eventName, event.toEnvelope());

    if (booking.deliveryType === DeliveryType.ONLINE) {
      try {
        // The transactional outbox above is the durability boundary. This
        // enqueue is only a low-latency wake-up; stable leases make duplicate
        // deliveries safe and an enqueue failure cannot lose the work.
        await this.zoomMeetingQueue.enqueue(cmd.bookingId);
      } catch (err) {
        // Never fail the confirm because of queue infrastructure; the meeting
        // can still be created via the retry endpoint or the lazy client path.
        this.logger.error(
          `Failed to enqueue Zoom meeting creation for booking ${cmd.bookingId}`,
          err instanceof Error ? err.stack : undefined,
        );
      }
    }

    return updated;
  }
}
