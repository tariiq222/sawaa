import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { PriceResolverService } from '../../org-experience/services/price-resolver.service';
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';
import { GroupSessionMinReachedHandler } from '../group-session-min-reached/group-session-min-reached.handler';
import { EventBusService } from '../../../infrastructure/events';
import { BookingCreatedEvent } from '../events/booking-created.event';
import { ValidateCouponService } from '../coupons/validate-coupon.service';
import { CreateBookingDto } from './create-booking.dto';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import { normalizeBookingTypes } from '../shared/delivery-type.helper';

/** FNV-1a 32-bit hash → signed int32 (Postgres int4 range). Same algorithm as create-zoom-meeting. */
function hashToInt32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h | 0;
}

/** Re-map a Postgres exclusion violation (23P01) to a domain 409 conflict. */
function mapDbConflict(err: unknown): never {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2010' &&
    (err.meta as Record<string, unknown> | undefined)?.['code'] === '23P01'
  ) {
    throw new ConflictException('Employee already has a booking in this time slot');
  }
  throw err;
}

// Money is integer halalas — round to whole halalas (0 decimal places).
const roundMoney = (amount: Prisma.Decimal | number): Prisma.Decimal =>
  new Prisma.Decimal(amount.toString()).toDecimalPlaces(0);

export type CreateBookingCommand = Omit<CreateBookingDto, 'scheduledAt' | 'expiresAt' | 'bookingType' | 'deliveryType'> & {
  scheduledAt: Date;
  expiresAt?: Date;
  bookingType?: string;
  deliveryType?: string;
};

@Injectable()
export class CreateBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly priceResolver: PriceResolverService,
    private readonly settingsHandler: GetBookingSettingsHandler,
    private readonly groupMinReachedHandler: GroupSessionMinReachedHandler,
    private readonly eventBus: EventBusService,
    private readonly couponValidator: ValidateCouponService,
  ) {}

  async execute(dto: CreateBookingCommand) {
    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt <= new Date()) {
      throw new BadRequestException('Booking must be scheduled in the future');
    }

    const bookingSettings = await this.settingsHandler.execute({
      branchId: dto.branchId,
    });

    if (dto.payAtClinic) {
      if (!('payAtClinicEnabled' in bookingSettings) || !(bookingSettings as Record<string, unknown>).payAtClinicEnabled) {
        throw new BadRequestException('Pay at clinic is not enabled for this branch');
      }
    }

    // Normalize legacy bookingType values into the new (bookingType, deliveryType) model.
    const { bookingType, deliveryType } = normalizeBookingTypes({
      bookingType: dto.bookingType,
      deliveryType: dto.deliveryType,
    });

    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId },
      select: { id: true, nameAr: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId },
      select: { id: true },
    });
    if (!client) throw new NotFoundException('Client not found');

    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId },
      select: { id: true, name: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId },
      select: { id: true, nameAr: true, categoryId: true },
    });
    if (!service) throw new NotFoundException('Service not found');

    const employeeService = await this.prisma.employeeService.findUnique({
      where: { employeeId_serviceId: { employeeId: dto.employeeId, serviceId: dto.serviceId } },
    });
    if (!employeeService) {
      throw new BadRequestException('Employee does not provide this service');
    }

    // Resolve category and department names for snapshots
    let categoryName: string | null = null;
    let departmentName: string | null = null;
    if (service.categoryId) {
      const category = await this.prisma.serviceCategory.findFirst({
        where: { id: service.categoryId },
        select: { nameAr: true, departmentId: true },
      });
      if (category) {
        categoryName = category.nameAr;
        if (category.departmentId) {
          const department = await this.prisma.department.findFirst({
            where: { id: category.departmentId },
            select: { nameAr: true },
          });
          if (department) departmentName = department.nameAr;
        }
      }
    }

    if (bookingType && bookingType !== 'WALK_IN') {
      const allowedConfigs = await this.prisma.serviceBookingConfig.findMany({
        where: { serviceId: dto.serviceId },
        select: { deliveryType: true },
      });
      const allowedDeliveryTypes = allowedConfigs.map(c => c.deliveryType);

      if (allowedDeliveryTypes.length > 0 && !allowedDeliveryTypes.includes(deliveryType)) {
        throw new BadRequestException(`Service does not support ${deliveryType} delivery type`);
      }
    }

    // Resolve price + duration via PriceResolverService (3-tier: employee override → duration option → service base).
    const resolved = await this.priceResolver.resolve({
      serviceId: dto.serviceId,
      employeeServiceId: employeeService.id,
      durationOptionId: dto.durationOptionId ?? null,
      bookingType: bookingType ?? null,
      deliveryType: deliveryType ?? null,
    });

    const durationMins = resolved.durationMins;
    const price = resolved.price;
    const currency = dto.currency ?? resolved.currency;
    if (currency !== resolved.currency) {
      throw new BadRequestException(`Currency mismatch: service uses ${resolved.currency} but ${currency} was requested`);
    }

    const endsAt = new Date(scheduledAt.getTime() + durationMins * 60_000);

    let discountedPrice: number | null = null;

    // Resolve group-session settings from the service
    const serviceRecord = await this.prisma.service.findFirst({
      where: { id: dto.serviceId },
      select: { minParticipants: true, maxParticipants: true, reserveWithoutPayment: true },
    });
    const isGroupService =
      !!serviceRecord && serviceRecord.maxParticipants > 1 && serviceRecord.reserveWithoutPayment;

    // For group services, use PENDING_GROUP_FILL until minParticipants is reached.
    const initialStatus = isGroupService ? 'PENDING_GROUP_FILL' : 'PENDING';

    // Serializable: prevents two concurrent group-session bookings from both reading slotCount=N-1 and overflowing capacity.
    const booking = await this.rlsTransaction.withTransaction(
      async (tx) => {
        if (!isGroupService) {
          // CR-5: acquire advisory lock BEFORE the conflict check so that two
          // concurrent requests on the same employee+slot cannot both see "no
          // conflict" and both proceed. Lock key is scoped to
          // employeeId + slot window.
          const lockKey1 = hashToInt32(`${dto.employeeId ?? 'noemp'}`);
          const lockKey2 = hashToInt32(`${scheduledAt.toISOString()}:${endsAt.toISOString()}`);
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey1}::int, ${lockKey2}::int)`;

          // Now that the lock is held, check for an overlap with PENDING/CONFIRMED bookings.
          const bufferMs = bookingSettings.bufferMinutes * 60_000;
          const bufferedStart = new Date(scheduledAt.getTime() - bufferMs);
          const bufferedEnd = new Date(endsAt.getTime() + bufferMs);

          const conflict = await tx.booking.findFirst({
            where: {
              employeeId: dto.employeeId,
              status: { in: ['PENDING', 'CONFIRMED', 'AWAITING_PAYMENT'] },
              scheduledAt: { lt: bufferedEnd },
              endsAt: { gt: bufferedStart },
            },
            select: { id: true },
          });
          if (conflict) {
            throw new ConflictException('Employee already has a booking in this time slot');
          }
        } else {
          // Group bookings: serialize concurrent attempts on the same slot.
          // Same pattern as create-zoom-meeting — pg_advisory_xact_lock is held
          // until the transaction commits, preventing two clients from both
          // reading slotCount < maxParticipants and both succeeding.
          const lockKey1 = hashToInt32(`${dto.serviceId}:${dto.employeeId ?? 'noemp'}`);
          const lockKey2 = hashToInt32(scheduledAt.toISOString());
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey1}::int, ${lockKey2}::int)`;

          // Check capacity now that the lock is held
          const slotCount = await tx.booking.count({
            where: {
              serviceId: dto.serviceId,
              employeeId: dto.employeeId,
              scheduledAt,
              status: { in: ['PENDING_GROUP_FILL', 'AWAITING_PAYMENT', 'CONFIRMED'] },
            },
          });
          if (slotCount >= serviceRecord!.maxParticipants) {
            throw new ConflictException('This group session is full');
          }
        }

        if (dto.couponCode) {
          // P2-6: acquire advisory lock on the coupon to prevent concurrent
          // redemptions from exceeding the usage limit.
          const couponLockKey1 = hashToInt32(`coupon`);
          const couponLockKey2 = hashToInt32(dto.couponCode);
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${couponLockKey1}::int, ${couponLockKey2}::int)`;

          const result = await this.couponValidator.validate({
            tx,
            code: dto.couponCode,
            orgId: DEFAULT_ORG_ID,
            clientId: dto.clientId,
            serviceId: dto.serviceId,
            subtotal: Number(price),
          });
          discountedPrice = Math.max(0, new Prisma.Decimal(price.toString()).sub(new Prisma.Decimal(result.discount.toString())).toDecimalPlaces(2).toNumber());
          await tx.coupon.update({
            where: { id: result.couponId },
            data: { usedCount: { increment: 1 } },
          });
        }

        // P1-2: serialize bookingNumber generation within the org using an
        // advisory lock so two concurrent transactions cannot read the same
        // 'last' number and both insert it.
        const numberLockKey1 = hashToInt32(`booking_number`);
        const numberLockKey2 = 0;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${numberLockKey1}::int, ${numberLockKey2}::int)`;

        const lastBooking = await tx.booking.findFirst({
          where: {},
          orderBy: { bookingNumber: 'desc' },
          select: { bookingNumber: true },
        });
        const nextBookingNumber = (lastBooking?.bookingNumber ?? 0) + 1;

        const booking = await tx.booking.create({
          data: {
            branchId: dto.branchId,
            clientId: dto.clientId,
            employeeId: dto.employeeId,
            serviceId: dto.serviceId,
            durationOptionId: resolved.durationOptionId || null,
            scheduledAt,
            endsAt,
            durationMins,
            price,
            currency,
            bookingType: isGroupService ? 'GROUP' : bookingType,
            deliveryType,
            notes: dto.notes,
            expiresAt: dto.expiresAt ?? (!dto.payAtClinic ? new Date(Date.now() + 15 * 60 * 1000) : undefined),
            groupSessionId: dto.groupSessionId,
            payAtClinic: dto.payAtClinic ?? false,
            couponCode: dto.couponCode ?? null,
            discountedPrice: discountedPrice,
            status: initialStatus,
            // Snapshots: denormalized at creation for stable history
            priceSnapshot: new Prisma.Decimal(price.toString()),
            durationMinutesSnapshot: durationMins,
            branchNameSnapshot: branch.nameAr,
            employeeNameSnapshot: employee.name,
            serviceNameSnapshot: service.nameAr,
            categoryNameSnapshot: categoryName,
            departmentNameSnapshot: departmentName,
            bookingNumber: nextBookingNumber,
          },
        });

        let invoice: { id: string } | null = null;
        if (!dto.payAtClinic && !isGroupService) {
          const orgSettings = await tx.organizationSettings.findFirst({
            where: {},
            select: { vatRate: true },
          });
          const vatRate = new Prisma.Decimal(orgSettings?.vatRate?.toString() ?? '0.15');

          const subtotalDec = new Prisma.Decimal(price.toString());
          const discountAmtDec = discountedPrice !== null
            ? subtotalDec.sub(new Prisma.Decimal(discountedPrice.toString()))
            : new Prisma.Decimal(0);
          const vatBaseDec = subtotalDec.sub(discountAmtDec);
          const vatAmt = roundMoney(vatBaseDec.mul(vatRate));
          const total = roundMoney(vatBaseDec.add(vatAmt));

          invoice = await tx.invoice.create({
            data: {
              branchId: booking.branchId,
              clientId: booking.clientId,
              employeeId: booking.employeeId,
              bookingId: booking.id,
              subtotal: subtotalDec.toDecimalPlaces(2).toNumber(),
              discountAmt: discountAmtDec.toDecimalPlaces(2).toNumber(),
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

        // CR-5: write to outbox INSIDE the transaction instead of publishing
        // directly after commit. If the process crashes after commit but before
        // publish, the OutboxPublisherCron picks up the unpublished row.
        const createdEvent = new BookingCreatedEvent({
          bookingId: booking.id,
          clientId: booking.clientId,
          employeeId: booking.employeeId ?? '',
          organizationId: DEFAULT_ORG_ID,
          scheduledAt: booking.scheduledAt,
          serviceId: booking.serviceId,
        });
        await tx.outboxEvent.create({
          data: {
            aggregateId: booking.id,
            eventType: createdEvent.eventName,
            payload: createdEvent.toEnvelope() as unknown as Prisma.InputJsonValue,
          },
        });

        return { ...booking, invoiceId: invoice?.id ?? null };
      },
      { isolationLevel: 'Serializable' },
    ).catch(mapDbConflict);

    // After insert: check if minParticipants is now reached for this slot
    if (isGroupService) {
      const filledCount = await this.prisma.booking.count({
        where: {
          serviceId: dto.serviceId,
          employeeId: dto.employeeId,
          scheduledAt,
          status: { in: ['PENDING_GROUP_FILL', 'AWAITING_PAYMENT', 'CONFIRMED'] },
        },
      });
      if (filledCount >= serviceRecord!.minParticipants) {
        // Fire-and-forget — don't fail the booking if notification fails
        this.groupMinReachedHandler.execute({
          serviceId: dto.serviceId,
          employeeId: dto.employeeId,
          scheduledAt,
        }).catch(() => { /* logged by eventBus */ });
      }
    }

    return booking;
  }
}
