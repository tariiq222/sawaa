import {
  Injectable,
  Optional,
  ConflictException,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { PriceResolverService } from '../../org-experience/services/price-resolver.service';
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';

import { CreateGuestBookingDto } from './create-guest-booking.dto';
import { Prisma, type OtpChannel, type DeliveryType } from '@prisma/client';
import { normalizeBookingTypes } from '../shared/delivery-type.helper';
import { CheckAvailabilityHandler } from '../check-availability/check-availability.handler';
import { STAFF_TIME_BLOCKING_BOOKING_STATUSES } from '../active-booking-statuses';

export type CreateGuestBookingCommand = CreateGuestBookingDto & {
  identifier: string;
  sessionJti: string;
  sessionExp: number;
  sessionChannel: OtpChannel;
};



/** FNV-1a 32-bit hash → signed int32 (Postgres int4 range). */
function hashToInt32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h | 0;
}

@Injectable()
export class CreateGuestBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly priceResolver: PriceResolverService,
    private readonly settingsHandler: GetBookingSettingsHandler,
    @Optional() private readonly availabilityHandler?: CheckAvailabilityHandler,
  ) {}

  async execute(cmd: CreateGuestBookingCommand) {
    const scheduledAt = new Date(cmd.startsAt);
    if (scheduledAt <= new Date()) {
      throw new BadRequestException('Booking must be scheduled in the future');
    }

    // P2-8: enforce booking window constraints from branch/global settings
    const settings = await this.settingsHandler.execute({ branchId: cmd.branchId });
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + settings.maxAdvanceBookingDays);
    maxDate.setHours(23, 59, 59, 999);
    if (scheduledAt > maxDate) {
      throw new BadRequestException(
        `Booking cannot be scheduled more than ${settings.maxAdvanceBookingDays} days in advance`,
      );
    }
    const earliestAllowed = new Date(Date.now() + settings.minBookingLeadMinutes * 60_000);
    if (scheduledAt < earliestAllowed) {
      throw new BadRequestException(
        `Booking must be scheduled at least ${settings.minBookingLeadMinutes} minutes in advance`,
      );
    }

    // Fix B — identifier match: session.identifier must equal the contact being booked
    const identifierMatchesEmail = cmd.sessionChannel === 'EMAIL' && cmd.identifier === cmd.client.email;
    const identifierMatchesPhone = cmd.sessionChannel === 'SMS' && cmd.identifier === cmd.client.phone;
    if (!identifierMatchesEmail && !identifierMatchesPhone) {
      throw new UnauthorizedException('Session identifier does not match booking contact');
    }

    const branch = await this.prisma.branch.findFirst({
      where: { id: cmd.branchId },
      select: { id: true, isActive: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    if (branch.isActive === false) throw new BadRequestException('Branch is not active');

    // SECURITY (P0-17): even though `employeeId` comes from the public DTO,
    // we constrain it three ways: must be active, must be flagged `isPublic`,
    // must be assigned to the requested branch, AND (below) must offer the
    // requested service via EmployeeService. This blocks an attacker from
    // spoofing an arbitrary `employeeId` to fraudulently credit commission
    // to themselves or to route a booking to a private/internal therapist.
    const employee = await this.prisma.employee.findFirst({
      where: { id: cmd.employeeId },
      select: { id: true, isActive: true, isPublic: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    if (!employee.isActive) {
      throw new BadRequestException('Employee is not active');
    }
    if (!employee.isPublic) {
      throw new BadRequestException('Employee is not available for public booking');
    }

    // Fix D — employee must belong to the requested branch
    const employeeBranch = await this.prisma.employeeBranch.findUnique({
      where: {
        employeeId_branchId: { employeeId: cmd.employeeId, branchId: cmd.branchId },
      },
      select: { id: true },
    });
    if (!employeeBranch) {
      throw new BadRequestException('Employee is not assigned to this branch');
    }

    const service = await this.prisma.service.findFirst({
      where: { id: cmd.serviceId },
      select: { id: true, isActive: true, isHidden: true },
    });
    if (!service) throw new NotFoundException('Service not found');
    if (!service.isActive) {
      throw new BadRequestException('Service is not active');
    }
    if (service.isHidden) {
      throw new BadRequestException('Service is not available for public booking');
    }

    const employeeService = await this.prisma.employeeService.findUnique({
      where: { employeeId_serviceId: { employeeId: cmd.employeeId, serviceId: cmd.serviceId } },
    });
    if (!employeeService) {
      throw new BadRequestException('Employee does not provide this service');
    }

    const { bookingType, deliveryType } = normalizeBookingTypes({
      bookingType: cmd.bookingType,
      deliveryType: cmd.deliveryType,
    });

    const resolved = await this.priceResolver.resolve({
      serviceId: cmd.serviceId,
      employeeServiceId: employeeService.id,
      durationOptionId: cmd.durationOptionId ?? null,
      bookingType: bookingType ?? null,
      deliveryType: deliveryType ?? null,
    });

    const durationMins = resolved.durationMins;
    const price = resolved.price;
    const currency = resolved.currency;
    const endsAt = new Date(scheduledAt.getTime() + durationMins * 60_000);

    await this.assertSlotAvailable({
      employeeId: cmd.employeeId,
      branchId: cmd.branchId,
      serviceId: cmd.serviceId,
      scheduledAt,
      durationMins,
      durationOptionId: cmd.durationOptionId ?? resolved.durationOptionId ?? null,
      bookingType,
      deliveryType,
    });

    const result = await this.rlsTransaction.withTransaction(async (tx) => {
      // Fix A — enforce single-use: insert UsedOtpSession or throw if already exists
      try {
        await tx.usedOtpSession.create({
          data: {
            jti: cmd.sessionJti,
            expiresAt: new Date(cmd.sessionExp * 1000),
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new UnauthorizedException('OTP session already used');
        }
        throw err;
      }

      // CR-5: acquire an advisory lock keyed on employee + slot window BEFORE
      // the conflict query so that two concurrent guest requests on the same
      // employee+slot cannot both see "no conflict" and both proceed (TOCTOU
      // double-booking race). Mirrors create-booking.handler. The lock is held
      // until the transaction commits.
      const slotLockKey1 = hashToInt32(`${cmd.employeeId}`);
      const slotLockKey2 = hashToInt32(`${scheduledAt.toISOString()}:${endsAt.toISOString()}`);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${slotLockKey1}::int, ${slotLockKey2}::int)`;

      const conflict = await tx.booking.findFirst({
        where: {
          employeeId: cmd.employeeId,
          status: { in: [...STAFF_TIME_BLOCKING_BOOKING_STATUSES] },
          scheduledAt: { lt: endsAt },
          endsAt: { gt: scheduledAt },
        },
        select: { id: true },
      });
      if (conflict) {
        throw new ConflictException('Employee already has a booking in this time slot');
      }

      let client = await tx.client.findFirst({
        where: {
          OR: [{ phone: cmd.client.phone }, { email: cmd.client.email }],
        },
      });

      const now = new Date();

      if (!client) {
        client = await tx.client.create({
          data: {
            name: cmd.client.name,
            phone: cmd.client.phone,
            email: cmd.client.email,
            gender: cmd.client.gender,
            emailVerified: now,
            source: 'ONLINE',
            accountType: 'WALK_IN',
          },
        });
      } else {
        await tx.client.update({
          where: { id: client.id },
          data: {
            name: cmd.client.name,
            gender: cmd.client.gender ?? client.gender,
          },
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

      // Resolve snapshot data
      const branchSnap = await tx.branch.findFirst({ where: { id: cmd.branchId }, select: { nameAr: true } });
      const employeeSnap = await tx.employee.findFirst({ where: { id: cmd.employeeId }, select: { name: true } });
      const serviceSnap = await tx.service.findFirst({ where: { id: cmd.serviceId }, select: { nameAr: true, categoryId: true } });
      let categoryName: string | null = null;
      let departmentName: string | null = null;
      if (serviceSnap?.categoryId) {
        const cat = await tx.serviceCategory.findFirst({ where: { id: serviceSnap.categoryId }, select: { nameAr: true, departmentId: true } });
        if (cat) {
          categoryName = cat.nameAr;
          if (cat.departmentId) {
            const dept = await tx.department.findFirst({ where: { id: cat.departmentId }, select: { nameAr: true } });
            if (dept) departmentName = dept.nameAr;
          }
        }
      }

      const booking = await tx.booking.create({
        data: {
          branchId: cmd.branchId,
          clientId: client.id,
          employeeId: cmd.employeeId,
          serviceId: cmd.serviceId,
          durationOptionId: resolved.durationOptionId || null,
          scheduledAt,
          endsAt,
          durationMins,
          price,
          currency,
          bookingType: bookingType ?? 'INDIVIDUAL',
          deliveryType,
          notes: cmd.client.notes,
          status: 'AWAITING_PAYMENT',
          bookingNumber: nextBookingNumber,
          priceSnapshot: new Prisma.Decimal(price.toString()),
          durationMinutesSnapshot: durationMins,
          branchNameSnapshot: branchSnap?.nameAr ?? null,
          employeeNameSnapshot: employeeSnap?.name ?? null,
          serviceNameSnapshot: serviceSnap?.nameAr ?? null,
          categoryNameSnapshot: categoryName,
          departmentNameSnapshot: departmentName,
        },
      });

      const orgSettings = await tx.organizationSettings.findFirst({
        where: {},
        select: { vatRate: true },
      });
      const vatRate = new Prisma.Decimal(orgSettings?.vatRate?.toString() ?? '0.15');

      const subtotal = new Prisma.Decimal(price.toString());
      const vatAmt = subtotal.mul(vatRate).toDecimalPlaces(2);
      const total = subtotal.add(vatAmt).toDecimalPlaces(2);

      const invoice = await tx.invoice.create({
        data: {
          branchId: cmd.branchId,
          clientId: client.id,
          employeeId: cmd.employeeId,
          bookingId: booking.id,
          subtotal: subtotal.toNumber(),
          discountAmt: 0,
          vatRate: vatRate.toNumber(),
          vatAmt: vatAmt.toNumber(),
          total: total.toNumber(),
          status: 'ISSUED',
          issuedAt: now,
        },
      });

      // total is already in halalas
      return { bookingId: booking.id, invoiceId: invoice.id, totalHalalat: Math.round(total.toNumber()) };
    });

    return result;
  }

  private async assertSlotAvailable(input: {
    employeeId: string;
    branchId: string;
    serviceId: string;
    scheduledAt: Date;
    durationMins: number;
    durationOptionId?: string | null;
    bookingType: string;
    deliveryType: string;
  }) {
    if (!this.availabilityHandler) return;

    const slots = await this.availabilityHandler.execute({
      employeeId: input.employeeId,
      branchId: input.branchId,
      serviceId: input.serviceId,
      date: input.scheduledAt,
      durationMins: input.durationMins,
      durationOptionId: input.durationOptionId,
      bookingType: input.bookingType,
      deliveryType: input.deliveryType as DeliveryType,
    });

    const scheduledMs = input.scheduledAt.getTime();
    if (!slots.some((slot) => slot.startTime.getTime() === scheduledMs)) {
      throw new BadRequestException('Selected booking time is not available');
    }
  }
}
