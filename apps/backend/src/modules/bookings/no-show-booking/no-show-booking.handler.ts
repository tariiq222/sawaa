import { Injectable } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { RlsTransactionService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { fetchBookingOrFail } from '../booking-lifecycle.helper';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export interface NoShowBookingCommand {
  bookingId: string;
  changedBy: string;
}

@Injectable()
export class NoShowBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTx: RlsTransactionService,
  ) {}

  async execute(cmd: NoShowBookingCommand) {
    const booking = await fetchBookingOrFail(this.prisma, cmd.bookingId, [BookingStatus.CONFIRMED], 'marked as no-show');

    const [updated] = await this.rlsTx.withTransaction((tx) => Promise.all([
      tx.booking.update({
        where: { id: cmd.bookingId },
        data: { status: BookingStatus.NO_SHOW, noShowAt: new Date() },
      }),
      tx.bookingStatusLog.create({
        data: {
          bookingId: cmd.bookingId,
          fromStatus: booking.status,
          toStatus: BookingStatus.NO_SHOW,
          changedBy: cmd.changedBy,
        },
      }),
    ]));
    return updated;
  }
}
