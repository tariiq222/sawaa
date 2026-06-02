import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CancellationReason } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { BookingCancelRequestedEvent } from '../events/booking-cancel-requested.event';
import { assertTransition } from '../booking-state-machine';

export interface RequestCancelBookingCommand {
  bookingId: string;
  reason: CancellationReason;
  cancelNotes?: string;
  requestedBy: string;
}

@Injectable()
export class RequestCancelBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(cmd: RequestCancelBookingCommand) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: cmd.bookingId },
    });
    if (!booking) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }

    const nextStatus = assertTransition(booking.status, 'CLIENT_REQUEST_CANCEL');

    const [updated] = await this.rlsTransaction.withTransaction((tx) => Promise.all([
      tx.booking.update({
        where: { id: cmd.bookingId },
        data: {
          status: nextStatus,
          cancelReason: cmd.reason,
          cancelNotes: cmd.cancelNotes,
        },
      }),
      tx.bookingStatusLog.create({
        data: {
          bookingId: cmd.bookingId,
          fromStatus: booking.status,
          toStatus: nextStatus,
          changedBy: cmd.requestedBy,
          reason: cmd.reason,
        },
      }),
    ]));

    const event = new BookingCancelRequestedEvent({
      bookingId: booking.id,
      clientId: booking.clientId,
      employeeId: booking.employeeId,
      reason: cmd.reason,
      cancelNotes: cmd.cancelNotes,
    });
    await this.eventBus.publish(event.eventName, event.toEnvelope());

    return updated;
  }
}
