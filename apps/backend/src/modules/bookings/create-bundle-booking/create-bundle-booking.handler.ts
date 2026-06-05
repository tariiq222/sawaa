import {
  Injectable,
  Optional,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, type DeliveryType } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { BundlePriceService } from '../../org-experience/bundles/bundle-price.service';
import { BookingCreatedEvent } from '../events/booking-created.event';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import { CreateBundleBookingDto } from './create-bundle-booking.dto';
import { normalizeBookingTypes } from '../shared/delivery-type.helper';
import { computeVat } from '../../finance/money.helper';
import { CheckAvailabilityHandler } from '../check-availability/check-availability.handler';
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';

/** FNV-1a 32-bit hash → signed int32 (Postgres int4 range). */
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
    throw new ConflictException('Employee already has a booking overlapping the bundle window');
  }
  throw err;
}

// Money is integer halalas — round to whole halalas.
function roundHalalas(n: number): number {
  return Math.round(n);
}

export type CreateBundleBookingCommand = Omit<CreateBundleBookingDto, 'scheduledAt' | 'deliveryType'> & {
  scheduledAt: Date;
  deliveryType?: string;
};

@Injectable()
export class CreateBundleBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly bundlePriceService: BundlePriceService,
    @Optional() private readonly settingsHandler?: GetBookingSettingsHandler,
    @Optional() private readonly availabilityHandler?: CheckAvailabilityHandler,
  ) {}

  async execute(dto: CreateBundleBookingCommand) {
    // 1. scheduledAt must be in the future
    if (dto.scheduledAt <= new Date()) {
      throw new BadRequestException('Booking must be scheduled in the future');
    }

    // 2. Fetch bundle with items ordered by sortOrder
    const bundle = await this.prisma.serviceBundle.findFirst({
      where: { id: dto.bundleId, archivedAt: null },
      include: {
        items: {
          include: { service: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!bundle) throw new NotFoundException('Service bundle not found');
    if (!bundle.isActive) throw new BadRequestException('Service bundle is not active');

    for (const item of bundle.items) {
      if (!item.service.isActive || item.service.archivedAt) {
        throw new BadRequestException(
          `Service "${item.service.nameAr}" in the bundle is not available`,
        );
      }
    }

    // 3. Verify branch, client, employee exist
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId },
      select: { id: true, nameAr: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, deletedAt: null },
      select: { id: true },
    });
    if (!client) throw new NotFoundException('Client not found');

    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId },
      select: { id: true, name: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    // 4. Verify employee provides ALL services in the bundle
    const serviceIds = bundle.items.map((i) => i.service.id);
    const empServices = await this.prisma.employeeService.findMany({
      where: { employeeId: dto.employeeId, serviceId: { in: serviceIds } },
      select: { serviceId: true },
    });
    if (empServices.length !== serviceIds.length) {
      throw new BadRequestException('Employee does not provide all bundle services');
    }

    // payAtClinic gate — reject pay-at-clinic when the branch disables it.
    // Mirrors create-booking.handler. Skipped when the settings handler is not
    // wired (e.g. isolated unit tests construct the handler without it).
    if ((dto.payAtClinic ?? false) && this.settingsHandler) {
      const bookingSettings = await this.settingsHandler.execute({ branchId: dto.branchId });
      if (!('payAtClinicEnabled' in bookingSettings) || !(bookingSettings as Record<string, unknown>).payAtClinicEnabled) {
        throw new BadRequestException('Pay at clinic is not enabled for this branch');
      }
    }

    // Resolve snapshot data from already-loaded bundle items
    const firstService = bundle.items[0]?.service;
    let categoryName: string | null = null;
    let departmentName: string | null = null;
    if (firstService?.categoryId) {
      const cat = await this.prisma.serviceCategory.findFirst({
        where: { id: firstService.categoryId },
        select: { nameAr: true, departmentId: true },
      });
      if (cat) {
        categoryName = cat.nameAr;
        if (cat.departmentId) {
          const dept = await this.prisma.department.findFirst({
            where: { id: cat.departmentId },
            select: { nameAr: true },
          });
          if (dept) departmentName = dept.nameAr;
        }
      }
    }

    const { deliveryType } = normalizeBookingTypes({
      bookingType: 'INDIVIDUAL',
      deliveryType: dto.deliveryType,
    });

    // 5. Calculate consecutive time slots
    interface SlotInfo {
      service: (typeof bundle.items)[number]['service'];
      slotStart: Date;
      slotEnd: Date;
      durationMins: number;
    }
    const slots: SlotInfo[] = [];
    let cursor = dto.scheduledAt;
    for (const item of bundle.items) {
      const slotStart = new Date(cursor);
      const slotEnd = new Date(slotStart.getTime() + item.service.durationMins * 60_000);
      cursor = new Date(slotEnd.getTime() + (item.service.bufferMinutes ?? 0) * 60_000);
      slots.push({ service: item.service, slotStart, slotEnd, durationMins: item.service.durationMins });
    }
    const finalCursor = cursor;

    // 5b. Validate that EACH service slot is actually available for this
    // employee (working hours, exceptions, holidays, no overlap with other
    // bookings). Mirrors create-booking.handler's assertSlotAvailable. Skipped
    // when the availability handler is not wired (isolated unit tests).
    if (this.availabilityHandler) {
      for (const slot of slots) {
        const available = await this.availabilityHandler.execute({
          employeeId: dto.employeeId,
          branchId: dto.branchId,
          serviceId: slot.service.id,
          date: slot.slotStart,
          durationMins: slot.durationMins,
          bookingType: 'INDIVIDUAL',
          deliveryType: deliveryType as DeliveryType,
        });
        const slotMs = slot.slotStart.getTime();
        if (!available.some((s) => s.startTime.getTime() === slotMs)) {
          throw new BadRequestException(
            `Selected time for "${slot.service.nameAr}" is not available`,
          );
        }
      }
    }

    // 6. Compute bundle price
    const servicePrices = bundle.items.map((i) => Number(i.service.price));
    const { subtotal, finalPrice } = this.bundlePriceService.computeBundlePrice({
      servicePrices,
      discountType: bundle.discountType,
      discountValue: Number(bundle.discountValue),
    });

    // 7. Distribute discount proportionally across bookings
    const shares: number[] = [];
    if (subtotal === 0) {
      for (let i = 0; i < slots.length; i++) shares.push(0);
    } else {
      let sharesSum = 0;
      for (let i = 0; i < slots.length - 1; i++) {
        const share = roundHalalas(servicePrices[i] * finalPrice / subtotal);
        shares.push(share);
        sharesSum += share;
      }
      // Last service absorbs rounding difference
      shares.push(roundHalalas(finalPrice - sharesSum));
    }

    // 8. Execute everything in a serializable transaction
    const result = await this.rlsTransaction.withTransaction(
      async (tx) => {
        const bundleGroupId = randomUUID();

        // Advisory lock on employee across the full bundle window
        const lockKey1 = hashToInt32(dto.employeeId);
        const lockKey2 = hashToInt32(`${dto.scheduledAt.toISOString()}:${finalCursor.toISOString()}`);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey1}::int, ${lockKey2}::int)`;

        // Check for any overlap across the full window
        const conflict = await tx.booking.findFirst({
          where: {
            employeeId: dto.employeeId,
            status: { in: ['PENDING', 'CONFIRMED', 'AWAITING_PAYMENT'] },
            scheduledAt: { lt: finalCursor },
            endsAt: { gt: dto.scheduledAt },
          },
          select: { id: true },
        });
        if (conflict) {
          throw new ConflictException('Employee already has a booking overlapping the bundle window');
        }

        // Advisory lock for bookingNumber generation
        const numberLockKey1 = hashToInt32('booking_number');
        const numberLockKey2 = 0;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${numberLockKey1}::int, ${numberLockKey2}::int)`;

        const lastBooking = await tx.booking.findFirst({
          where: {},
          orderBy: { bookingNumber: 'desc' },
          select: { bookingNumber: true },
        });
        const nextBase = lastBooking?.bookingNumber ?? 0;

        // Create N bookings
        const createdBookings: Awaited<ReturnType<typeof tx.booking.create>>[] = [];
        for (let i = 0; i < slots.length; i++) {
          const slot = slots[i];
          const booking = await tx.booking.create({
            data: {
              branchId: dto.branchId,
              clientId: dto.clientId,
              employeeId: dto.employeeId,
              serviceId: slot.service.id,
              scheduledAt: slot.slotStart,
              endsAt: slot.slotEnd,
              durationMins: slot.durationMins,
              price: Number(slot.service.price),
              currency: slot.service.currency,
              discountedPrice: shares[i],
              bookingType: 'INDIVIDUAL',
              deliveryType,
              notes: dto.notes,
              payAtClinic: dto.payAtClinic ?? false,
              status: 'PENDING',
              bundleId: dto.bundleId,
              bundleGroupId,
              bookingNumber: nextBase + i + 1,
              // Snapshots
              priceSnapshot: new Prisma.Decimal(Number(slot.service.price).toString()),
              durationMinutesSnapshot: slot.durationMins,
              branchNameSnapshot: branch.nameAr,
              employeeNameSnapshot: employee.name,
              serviceNameSnapshot: slot.service.nameAr,
              categoryNameSnapshot: categoryName,
              departmentNameSnapshot: departmentName,
            },
          });
          createdBookings.push(booking);
        }

        // Create BundlePurchase for the bundle booking
        const bundlePurchase = await tx.bundlePurchase.create({
          data: {
            bundleId: dto.bundleId,
            clientId: dto.clientId,
            branchId: dto.branchId,
            amountPaid: finalPrice,
            paidAt: new Date(),
            status: 'ACTIVE',
            quantityTotal: bundle.items.length,
            quantityUsed: 0,
          },
        });

        // Validate enough sessions remain before creating usages
        if (bundlePurchase.quantityTotal < slots.length) {
          throw new BadRequestException('Bundle has no remaining sessions');
        }

        // Create BundleUsage for each booking
        for (let i = 0; i < createdBookings.length; i++) {
          const booking = createdBookings[i];
          const slot = slots[i];
          await tx.bundleUsage.create({
            data: {
              purchaseId: bundlePurchase.id,
              bookingId: booking.id,
              serviceId: slot.service.id,
              deliveryType,
              quantityUsed: 1,
            },
          });
        }

        // Update quantityUsed on BundlePurchase
        await tx.bundlePurchase.update({
          where: { id: bundlePurchase.id },
          data: { quantityUsed: slots.length },
        });

        // Create unified invoice linked to BundlePurchase (skip if payAtClinic)
        let invoice: { id: string } | null = null;
        if (!(dto.payAtClinic ?? false)) {
          const orgSettings = await tx.organizationSettings.findFirst({
            where: {},
            select: { vatRate: true },
          });
          const vatRateDec = new Prisma.Decimal(orgSettings?.vatRate?.toString() ?? '0.15');
          const subtotalDec = new Prisma.Decimal(subtotal.toString());
          const finalPriceDec = new Prisma.Decimal(finalPrice.toString());
          const discountAmtDec = subtotalDec.sub(finalPriceDec);
          const { vatAmtHalalas, totalHalalas } = computeVat(finalPriceDec, vatRateDec);

          invoice = await tx.invoice.create({
            data: {
              branchId: dto.branchId,
              clientId: dto.clientId,
              employeeId: dto.employeeId,
              bundlePurchaseId: bundlePurchase.id,
              bookingId: null,
              subtotal: subtotalDec,
              discountAmt: discountAmtDec,
              vatRate: vatRateDec,
              vatAmt: vatAmtHalalas,
              total: totalHalalas,
              currency: slots[0].service.currency,
              status: 'ISSUED',
              issuedAt: new Date(),
            },
            select: { id: true },
          });
        }

        // Write outbox events for each booking
        for (const booking of createdBookings) {
          const createdEvent = new BookingCreatedEvent({
            bookingId: booking.id,
            bookingNumber: booking.bookingNumber,
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
        }

        return { bundleGroupId, bookings: createdBookings, invoiceId: invoice?.id ?? null };
      },
      { isolationLevel: 'Serializable' },
    ).catch(mapDbConflict);

    return result;
  }
}
