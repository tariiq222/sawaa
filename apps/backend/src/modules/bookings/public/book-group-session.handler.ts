import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { BookingStatus, GroupSessionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

// Money is integer halalas — round to whole halalas (0 decimal places).
const roundMoney = (amount: Prisma.Decimal | number): Prisma.Decimal =>
  new Prisma.Decimal(amount.toString()).toDecimalPlaces(0);

interface BookGroupSessionCommand {
  groupSessionId: string;
  clientId: string;
}

export interface BookGroupSessionResult {
  type: 'BOOKED' | 'WAITLISTED';
  bookingId?: string;
  waitlistPosition?: number;
}

@Injectable()
export class BookGroupSessionHandler {
  constructor(
    private readonly prisma: PrismaService,
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

    const existingWaitlist = await this.prisma.groupSessionWaitlist.findUnique({
      where: {
        groupSessionId_clientId: {
          groupSessionId: cmd.groupSessionId,
          clientId: cmd.clientId,
        },
      },
    });

    if (existingWaitlist) {
      throw new ConflictException('Already on the waitlist for this group session');
    }

    const spotsLeft = session.maxCapacity - session.enrolledCount;

    if (spotsLeft > 0) {
      return this.createBooking(cmd.clientId, session);
    } else if (session.waitlistEnabled) {
      return this.addToWaitlist(cmd.clientId, session);
    } else {
      throw new BadRequestException('Group session is full and waitlist is not enabled');
    }
  }

  private async createBooking(
    clientId: string,
    session: { id: string; price: unknown; currency: string; employeeId: string; serviceId: string; branchId: string; scheduledAt: Date },
  ): Promise<BookGroupSessionResult> {
    const price = Number(session.price);

    // Wrap booking + invoice + enrollment + capacity increment in one
    // transaction so a paid group booking never exists without its Invoice
    // (the payment-init handlers require an Invoice to start a Moyasar payment).
    const booking = await this.prisma.$transaction(async (tx) => {
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
          status: price > 0 ? BookingStatus.AWAITING_PAYMENT : BookingStatus.CONFIRMED,
          scheduledAt: session.scheduledAt,
          endsAt: new Date(session.scheduledAt.getTime() + 60 * 60 * 1000),
          durationMins: 60,
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
        const vatRate = new Prisma.Decimal(orgSettings?.vatRate?.toString() ?? '0.15');

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

      await tx.groupSession.update({
        where: { id: session.id },
        data: { enrolledCount: { increment: 1 } },
      });

      return booking;
    });

    return {
      type: 'BOOKED',
      bookingId: booking.id,
    };
  }

  private async addToWaitlist(
    clientId: string,
    session: { id: string },
  ): Promise<BookGroupSessionResult> {
    const lastEntry = await this.prisma.groupSessionWaitlist.findFirst({
      where: { groupSessionId: session.id },
      orderBy: { position: 'desc' },
    });

    const position = (lastEntry?.position ?? 0) + 1;

    await this.prisma.groupSessionWaitlist.create({
      data: {
        groupSessionId: session.id,
        clientId,
        position,
      },
    });

    await this.prisma.groupSession.update({
      where: { id: session.id },
      data: { waitlistCount: { increment: 1 } },
    });

    return {
      type: 'WAITLISTED',
      waitlistPosition: position,
    };
  }
}