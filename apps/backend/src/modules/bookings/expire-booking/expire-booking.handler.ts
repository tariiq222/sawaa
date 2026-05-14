import { Injectable } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { RlsTransactionService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { fetchBookingOrFail } from '../booking-lifecycle.helper';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export interface ExpireBookingCommand {
  bookingId: string;
  changedBy: string;
}

@Injectable()
export class ExpireBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTx: RlsTransactionService,
  ) {}

  async execute(cmd: ExpireBookingCommand) {
    const booking = await fetchBookingOrFail(
      this.prisma,
      cmd.bookingId,
      [BookingStatus.PENDING, BookingStatus.PENDING_GROUP_FILL, BookingStatus.AWAITING_PAYMENT],
      'expired',
    );

    const [updated] = await this.rlsTx.withTransaction((tx) => Promise.all([
      tx.booking.update({
        where: { id: cmd.bookingId },
        data: { status: BookingStatus.EXPIRED, expiresAt: new Date() },
      }),
      tx.bookingStatusLog.create({
        data: {
          bookingId: cmd.bookingId,
          fromStatus: booking.status,
          toStatus: BookingStatus.EXPIRED,
          changedBy: cmd.changedBy,
        },
      }),
    ]));
    return updated;
  }
}
