import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { BookingStatus, CancellationReason } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { RlsTransactionService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { EventBusService } from '../../../infrastructure/events';
import { BookingCancelRequestedEvent } from '../events/booking-cancel-requested.event';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

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
    private readonly rlsTx: RlsTransactionService,
    private readonly tenant: TenantContextService,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(cmd: RequestCancelBookingCommand) {
    const _organizationId = DEFAULT_ORGANIZATION_ID;
    const booking = await this.prisma.booking.findFirst({
      where: { id: cmd.bookingId },
    });
    if (!booking) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }

    const cancellable: BookingStatus[] = [
      BookingStatus.PENDING,
      BookingStatus.CONFIRMED,
    ];
    if (!cancellable.includes(booking.status)) {
      throw new BadRequestException(
        `Booking cannot be cancelled (status: ${booking.status})`,
      );
    }

    const [updated] = await this.rlsTx.withTransaction((tx) => Promise.all([
      tx.booking.update({
        where: { id: cmd.bookingId },
        data: {
          status: 'CANCEL_REQUESTED' as BookingStatus,
          cancelReason: cmd.reason,
          cancelNotes: cmd.cancelNotes,
        },
      }),
      tx.bookingStatusLog.create({
        data: {
          bookingId: cmd.bookingId,
          fromStatus: booking.status,
          toStatus: 'CANCEL_REQUESTED' as BookingStatus,
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
