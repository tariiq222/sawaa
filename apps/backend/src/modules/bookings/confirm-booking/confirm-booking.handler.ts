import { Injectable, Logger } from '@nestjs/common';
import { BookingStatus, DeliveryType } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { BookingConfirmedEvent } from '../events/booking-confirmed.event';
import { ZoomMeetingQueueService } from '../create-zoom-meeting/zoom-meeting-queue.service';
import { fetchBookingOrFail, updateBookingAtomically } from '../booking-lifecycle.helper';
import { assertTransition } from '../booking-state-machine';

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
    ]));

    const event = new BookingConfirmedEvent({
      bookingId: booking.id,
      clientId: booking.clientId,
      employeeId: booking.employeeId,
      branchId: booking.branchId,
      serviceId: booking.serviceId,
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
        // Meeting creation runs in ZoomMeetingWorker (BullMQ) so the confirm
        // request never waits on Zoom latency. The worker persists the same
        // CREATED/FAILED states the old inline call did, with retries.
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
