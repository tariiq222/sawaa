import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  BookingStatus,
  DeliveryType,
  ProgramStatus,
  Prisma,
} from '@prisma/client';
import {
  PrismaService,
  RlsTransactionService,
} from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { ProgramMinReachedEvent } from '../events/program-min-reached.event';
import {
  assertProgramTransition,
  isProgramOpenForEnrollment,
} from '../program/program-state-machine';

/**
 * Sentinel date used as Booking.scheduledAt until the program is SCHEDULED.
 * Picked far in the future so calendar/availability checks never treat the
 * placeholder as a real appointment.
 */
export const PROGRAM_DATE_PLACEHOLDER = new Date('2999-01-01T00:00:00.000Z');

interface EnrollInProgramCommand {
  programId: string;
  clientId: string;
  /** True when called from the public endpoint — requires isPublic=true. */
  public?: boolean;
}

export interface EnrollInProgramResult {
  type: 'ENROLLED';
  bookingId: string;
  status: BookingStatus;
  invoiceId: string | null;
}

@Injectable()
export class EnrollInProgramHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(cmd: EnrollInProgramCommand): Promise<EnrollInProgramResult> {
    const program = await this.prisma.program.findFirst({
      where: {
        id: cmd.programId,
        ...(cmd.public ? { isPublic: true } : {}),
      },
      include: { supervisors: { orderBy: { employeeId: 'asc' }, take: 1 } },
    });

    if (!program) {
      throw new NotFoundException('Program not found');
    }

    if (!isProgramOpenForEnrollment(program.status)) {
      throw new BadRequestException(
        `Program is not open for enrollment (status: ${program.status})`,
      );
    }

    if (program.enrolledCount >= program.maxParticipants) {
      throw new ConflictException('Program is full');
    }

    const existingEnrollment = await this.prisma.programEnrollment.findUnique({
      where: {
        programId_clientId: {
          programId: cmd.programId,
          clientId: cmd.clientId,
        },
      },
    });

    if (existingEnrollment) {
      throw new ConflictException('Already enrolled in this program');
    }

    const firstSupervisor = program.supervisors[0]?.employeeId;
    if (!firstSupervisor) {
      // Defensive — a program without supervisors cannot accept bookings.
      throw new BadRequestException('Program has no supervisor assigned');
    }

    const price = Number(program.price);
    const initialBookingStatus =
      price > 0 ? BookingStatus.AWAITING_PAYMENT : BookingStatus.CONFIRMED;

    const result = await this.rlsTransaction
      .withTransaction(async (tx) => {
        // Lock the program row so concurrent enrollment attempts serialise.
        await tx.$queryRaw`SELECT id FROM "Program" WHERE id = ${program.id} FOR UPDATE`;

        // Guarded capacity increment — the WHERE filter is the actual
        // capacity check. If another enrollment raced ahead and filled the
        // last seat, this returns count=0 and we abort with Conflict.
        const reserved = await tx.program.updateMany({
          where: {
            id: program.id,
            status: { in: [ProgramStatus.OPEN, ProgramStatus.MIN_REACHED] },
            enrolledCount: { lt: program.maxParticipants },
          },
          data: { enrolledCount: { increment: 1 } },
        });
        if (reserved.count !== 1) {
          throw new ConflictException('Program is full');
        }

        // Advisory lock around the booking-number sequence so concurrent
        // enrollments do not race for the same bookingNumber.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('booking_number'), 0)`;

        const lastBooking = await tx.booking.findFirst({
          where: {},
          orderBy: { bookingNumber: 'desc' },
          select: { bookingNumber: true },
        });
        const nextBookingNumber = (lastBooking?.bookingNumber ?? 0) + 1;

        const placeholder = PROGRAM_DATE_PLACEHOLDER;
        const booking = await tx.booking.create({
          data: {
            branchId: program.branchId,
            clientId: cmd.clientId,
            employeeId: firstSupervisor,
            serviceId: null,
            bookingType: 'GROUP',
            deliveryType: DeliveryType.IN_PERSON,
            source: cmd.public ? 'ONLINE' : 'RECEPTION',
            status: initialBookingStatus,
            scheduledAt: placeholder,
            endsAt: placeholder,
            durationMins: 0,
            price,
            currency: program.currency,
            programId: program.id,
            expiresAt: price > 0 ? new Date(Date.now() + 30 * 60 * 1000) : null,
            bookingNumber: nextBookingNumber,
          },
        });

        // Paid program enrollments need an Invoice so the payment-init flow
        // can drive a Moyasar transaction. No coupon/discount applies to
        // programs — subtotal = price.
        let invoiceId: string | null = null;
        if (price > 0) {
          const orgSettings = await tx.organizationSettings.findFirst({
            where: {},
            select: { vatRate: true },
          });
          const vatRate = new Prisma.Decimal(
            orgSettings?.vatRate?.toString() ?? '0',
          );
          const subtotalDec = new Prisma.Decimal(price.toString());
          const discountAmtDec = new Prisma.Decimal(0);
          const vatBase = subtotalDec.sub(discountAmtDec);
          const vatAmt = vatBase.mul(vatRate).toDecimalPlaces(0);
          const total = vatBase.add(vatAmt).toDecimalPlaces(0);

          const invoice = await tx.invoice.create({
            data: {
              branchId: booking.branchId,
              clientId: booking.clientId,
              employeeId: booking.employeeId,
              bookingId: booking.id,
              subtotal: subtotalDec.toNumber(),
              discountAmt: discountAmtDec.toNumber(),
              vatRate: vatRate.toNumber(),
              vatAmt: vatAmt.toNumber(),
              total: total.toNumber(),
              currency: booking.currency,
              status: 'ISSUED',
              issuedAt: new Date(),
            },
            select: { id: true },
          });
          invoiceId = invoice.id;
        }

        await tx.programEnrollment.create({
          data: {
            programId: program.id,
            clientId: cmd.clientId,
            bookingId: booking.id,
          },
        });

        // After a successful enrollment, evaluate the MIN_REACHED transition.
        // If the program was OPEN and the new count has reached the configured
        // minimum, flip it to MIN_REACHED inside the same transaction so the
        // event we publish below reflects the post-commit state.
        let reachedMin = false;
        if (program.status === ProgramStatus.OPEN) {
          const updated = await tx.program.findUnique({
            where: { id: program.id },
            select: { enrolledCount: true, minParticipants: true },
          });
          if (
            updated &&
            updated.enrolledCount >= updated.minParticipants
          ) {
            assertProgramTransition(ProgramStatus.OPEN, 'MIN_REACHED');
            await tx.program.update({
              where: { id: program.id },
              data: { status: ProgramStatus.MIN_REACHED },
            });
            reachedMin = true;
          }
        }

        return { booking, invoiceId, reachedMin };
      })
      .catch((err: unknown) => {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          throw new ConflictException('Already enrolled in this program');
        }
        throw err;
      });

    if (result.reachedMin) {
      const event = new ProgramMinReachedEvent({
        programId: program.id,
        programRef: program.ref,
        programNameAr: program.nameAr,
        programNameEn: program.nameEn,
        enrolledCount: program.enrolledCount + 1,
        minParticipants: program.minParticipants,
        reachedAt: new Date(),
      });
      await this.eventBus.publish(event.eventName, event.toEnvelope());
    }

    return {
      type: 'ENROLLED',
      bookingId: result.booking.id,
      status: result.booking.status,
      invoiceId: result.invoiceId,
    };
  }
}
