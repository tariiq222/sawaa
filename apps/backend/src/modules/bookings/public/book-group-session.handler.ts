import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { BookingStatus, DeliveryType, GroupSessionStatus, Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';

// Money is integer halalas — round to whole halalas (0 decimal places).
const roundMoney = (amount: Prisma.Decimal | number): Prisma.Decimal =>
  new Prisma.Decimal(amount.toString()).toDecimalPlaces(0);

interface BookGroupSessionCommand {
  groupSessionId: string;
  clientId: string;
}

export interface BookGroupSessionResult {
  type: 'BOOKED';
  bookingId: string;
}

@Injectable()
export class BookGroupSessionHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(cmd: BookGroupSessionCommand): Promise<BookGroupSessionResult> {
    const session = await this.prisma.groupSession.findFirst({
      where: {
        id: cmd.groupSessionId,
        isPublic: true,
        status: GroupSessionStatus.OPEN,
      },
    });

    if (!session) {
      throw new NotFoundException('Group session not found');
    }

    if (session.scheduledAt <= new Date()) {
      throw new BadRequestException('Group session has already started');
    }

    const existingEnrollment = await this.prisma.groupEnrollment.findUnique({
      where: {
        groupSessionId_clientId: {
          groupSessionId: cmd.groupSessionId,
          clientId: cmd.clientId,
        },
      },
    });

    if (existingEnrollment) {
      throw new ConflictException('Already enrolled in this group session');
    }

    if (session.enrolledCount >= session.maxCapacity) {
      throw new ConflictException('الجلسة مكتملة العدد');
    }

    return this.createBooking(cmd.clientId, session);
  }

  private async createBooking(
    clientId: string,
    session: { id: string; price: unknown; currency: string; employeeId: string; serviceId: string; branchId: string; scheduledAt: Date; durationMins: number; maxCapacity: number; deliveryType: DeliveryType },
  ): Promise<BookGroupSessionResult> {
    const price = Number(session.price);

    // Wrap booking + invoice + enrollment + capacity increment in one
    // transaction so a paid group booking never exists without its Invoice
    // (the payment-init handlers require an Invoice to start a Moyasar payment).
    const booking = await this.rlsTransaction.withTransaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "GroupSession" WHERE id = ${session.id} FOR UPDATE`;

      const reserved = await tx.groupSession.updateMany({
        where: {
          id: session.id,
          status: GroupSessionStatus.OPEN,
          enrolledCount: { lt: session.maxCapacity },
        },
        data: { enrolledCount: { increment: 1 } },
      });
      if (reserved.count !== 1) {
        throw new ConflictException('الجلسة مكتملة العدد');
      }

      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('booking_number'), 0)`;

      const lastBooking = await tx.booking.findFirst({
        where: {},
        orderBy: { bookingNumber: 'desc' },
        select: { bookingNumber: true },
      });
      const nextBookingNumber = (lastBooking?.bookingNumber ?? 0) + 1;

      const booking = await tx.booking.create({
        data: {
          branchId: session.branchId,
          clientId,
          employeeId: session.employeeId,
          serviceId: session.serviceId,
          bookingType: 'GROUP',
          deliveryType: session.deliveryType,
          source: 'ONLINE',
          status: price > 0 ? BookingStatus.AWAITING_PAYMENT : BookingStatus.CONFIRMED,
          scheduledAt: session.scheduledAt,
          endsAt: new Date(session.scheduledAt.getTime() + session.durationMins * 60_000),
          durationMins: session.durationMins,
          price: price,
          currency: session.currency,
          groupSessionId: session.id,
          expiresAt: price > 0 ? new Date(Date.now() + 30 * 60 * 1000) : null,
          bookingNumber: nextBookingNumber,
        },
      });

      // Paid group bookings need an Invoice for the payment-init flow.
      // Group sessions have no coupon/discount: discountAmt = 0, subtotal = price.
      if (price > 0) {
        const orgSettings = await tx.organizationSettings.findFirst({
          where: {},
          select: { vatRate: true },
        });
        const vatRate = new Prisma.Decimal(orgSettings?.vatRate?.toString() ?? '0');

        const subtotalDec = new Prisma.Decimal(price.toString());
        const discountAmtDec = new Prisma.Decimal(0);
        const vatBaseDec = subtotalDec.sub(discountAmtDec);
        const vatAmt = roundMoney(vatBaseDec.mul(vatRate));
        const total = roundMoney(vatBaseDec.add(vatAmt));

        await tx.invoice.create({
          data: {
            branchId: booking.branchId,
            clientId: booking.clientId,
            employeeId: booking.employeeId,
            bookingId: booking.id,
            subtotal: subtotalDec.toDecimalPlaces(0).toNumber(),
            discountAmt: discountAmtDec.toDecimalPlaces(0).toNumber(),
            vatRate: vatRate.toNumber(),
            vatAmt: vatAmt.toNumber(),
            total: total.toNumber(),
            currency: booking.currency,
            status: 'ISSUED',
            issuedAt: new Date(),
          },
          select: { id: true },
        });
      }

      await tx.groupEnrollment.create({
        data: {
          groupSessionId: session.id,
          clientId,
          bookingId: booking.id,
        },
      });

      return booking;
    }).catch((err) => {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Already enrolled in this group session');
      }
      throw err;
    });

    return {
      type: 'BOOKED',
      bookingId: booking.id,
    };
  }
}
