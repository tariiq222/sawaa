import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RefundType } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';
import { BookingCancelApprovedEvent } from '../events/booking-cancel-approved.event';
import { assertTransition } from '../booking-state-machine';
import { GroupSessionCapacityService } from '../group-session/group-session-capacity.service';
import { updateBookingAtomically } from '../booking-lifecycle.helper';

export interface ApproveCancelBookingCommand {
  bookingId: string;
  approvedBy: string;
  approverNotes?: string;
  /** Refund decision recorded with the approval — informational only, no refund is executed here. */
  refundType?: RefundType;
  /** Refund amount in halalas — required iff refundType is PARTIAL. */
  refundAmount?: number;
}

@Injectable()
export class ApproveCancelBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly eventBus: EventBusService,
    private readonly settingsHandler: GetBookingSettingsHandler,
    private readonly groupSessionCapacity: GroupSessionCapacityService,
  ) {}

  async execute(cmd: ApproveCancelBookingCommand) {
    if (cmd.refundType === RefundType.PARTIAL && cmd.refundAmount === undefined) {
      throw new BadRequestException('refundAmount is required when refundType is PARTIAL');
    }
    if (cmd.refundType !== RefundType.PARTIAL && cmd.refundAmount !== undefined) {
      throw new BadRequestException('refundAmount is only allowed when refundType is PARTIAL');
    }

    const booking = await this.prisma.booking.findFirst({
      where: { id: cmd.bookingId },
    });
    if (!booking) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }
    const nextStatus = assertTransition(booking.status, 'APPROVE_CANCEL');

    const settings = await this.settingsHandler.execute({
      branchId: booking.branchId,
    });

    const autoRefund =
      'autoRefundOnCancel' in settings
        ? (settings as Record<string, unknown>).autoRefundOnCancel === true
        : true;

    const refundSummary = cmd.refundType
      ? ` — refund: ${cmd.refundType}${cmd.refundType === RefundType.PARTIAL ? ` ${cmd.refundAmount} halalas` : ''}`
      : '';
    const statusLogReason = `Cancel request approved${refundSummary}${cmd.approverNotes ? ` — ${cmd.approverNotes}` : ''}`;

    const [updated] = await this.rlsTransaction.withTransaction(async (tx) => {
      const results = await Promise.all([
        updateBookingAtomically(tx, {
          bookingId: cmd.bookingId,
          currentStatus: booking.status,
          actionLabel: 'cancelled',
          data: {
            status: nextStatus,
            cancelledAt: new Date(),
          },
        }),
        tx.bookingStatusLog.create({
          data: {
            bookingId: cmd.bookingId,
            fromStatus: booking.status,
            toStatus: nextStatus,
            changedBy: cmd.approvedBy,
            reason: statusLogReason,
          },
        }),
      ]);
      // Roll back sibling AWAITING_PAYMENT bookings for group sessions.
      if (booking.groupSessionId) {
        await this.groupSessionCapacity.recalculateGroupStatus(tx, booking.groupSessionId);
      }
      return results;
    });

    const event = new BookingCancelApprovedEvent({
      bookingId: booking.id,
      clientId: booking.clientId,
      employeeId: booking.employeeId,
      autoRefund,
      approverNotes: cmd.approverNotes,
      refundType: cmd.refundType,
      refundAmount: cmd.refundAmount,
    });
    await this.eventBus.publish(event.eventName, event.toEnvelope());

    return { ...updated, autoRefund };
  }
}
