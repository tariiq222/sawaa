import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { BundlePriceService } from '../../org-experience/bundles/bundle-price.service';
import { BookingCreatedEvent } from '../events/booking-created.event';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import { CreateBundleBookingDto } from './create-bundle-booking.dto';

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

export type CreateBundleBookingCommand = Omit<CreateBundleBookingDto, 'scheduledAt'> & {
  scheduledAt: Date;
};

@Injectable()
export class CreateBundleBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly bundlePriceService: BundlePriceService,
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
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId },
      select: { id: true },
    });
    if (!client) throw new NotFoundException('Client not found');

    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId },
      select: { id: true },
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

    // 6. Compute bundle price
    const servicePrices = bundle.items.map((i) => Number(i.service.price));
    const { subtotal, discountAmount, finalPrice } = this.bundlePriceService.computeBundlePrice({
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
              notes: dto.notes,
              payAtClinic: dto.payAtClinic ?? false,
              status: 'PENDING',
              bundleId: dto.bundleId,
              bundleGroupId,
              bookingNumber: nextBase + i + 1,
            },
          });
          createdBookings.push(booking);
        }

        // Create unified invoice linked to first booking (skip if payAtClinic)
        let invoice: { id: string } | null = null;
        if (!(dto.payAtClinic ?? false)) {
          const orgSettings = await tx.organizationSettings.findFirst({
            where: {},
            select: { vatRate: true },
          });
          const vatRate = new Prisma.Decimal(orgSettings?.vatRate?.toString() ?? '0.15');
          const vatBase = new Prisma.Decimal(finalPrice.toString());
          const vatAmt = new Prisma.Decimal(
            Math.round(vatBase.toNumber() * vatRate.toNumber()).toString(),
          );
          const total = new Prisma.Decimal(
            Math.round(vatBase.toNumber() + vatAmt.toNumber()).toString(),
          );
          const discountAmt = new Prisma.Decimal(
            Math.round(subtotal - finalPrice).toString(),
          );

          invoice = await tx.invoice.create({
            data: {
              branchId: dto.branchId,
              clientId: dto.clientId,
              employeeId: dto.employeeId,
              bookingId: createdBookings[0].id,
              subtotal,
              discountAmt: discountAmt.toNumber(),
              vatRate: vatRate.toNumber(),
              vatAmt: vatAmt.toNumber(),
              total: total.toNumber(),
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
