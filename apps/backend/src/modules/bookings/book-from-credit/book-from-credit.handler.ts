import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ActivityAction, DeliveryType, PackagePurchaseStatus, Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';
import { CheckAvailabilityHandler } from '../check-availability/check-availability.handler';
import { BookingCreatedEvent } from '../events/booking-created.event';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import { hashToInt32 } from '../booking-lifecycle.helper';
import { STAFF_TIME_BLOCKING_BOOKING_STATUSES } from '../active-booking-statuses';
import {
  BookingTarget,
  CreditConstraint,
  creditMatchesTarget,
  specificityScore,
} from '../package-credit-matching.helper';
import { BookFromCreditDto } from './book-from-credit.dto';

export type BookFromCreditCommand = Omit<BookFromCreditDto, 'scheduledAt'> & {
  scheduledAt: Date;
  /** Acting user id (set by the controller). */
  userId?: string;
};

/** Row shape returned by the FOR UPDATE raw select on PackageCredit. */
interface LockedCreditRow {
  id: string;
  purchaseId: string;
  serviceId: string;
  employeeId: string;
  durationOptionId: string;
  totalQuantity: number;
  usedQuantity: number;
}

/**
 * Consume one session-package credit to create a zero-value booking.
 *
 * The credit pack model: the client pre-paid in full at purchase time, so a
 * credit booking carries NO invoice and NO payment — price = 0. The duration
 * is FIXED by the credit's durationOptionId (the caller may not change it).
 *
 * Concurrency safety (the high-risk part):
 *  - Availability + overlap are checked exactly like a normal booking
 *    (CheckAvailabilityHandler + a pg advisory lock on employee+slot + an
 *    overlap query).
 *  - The credit bucket is consumed inside ONE Serializable transaction. The
 *    `SELECT ... FOR UPDATE` row lock + an in-lock recount of
 *    `usedQuantity < totalQuantity` is the OVERDRAW GUARD: two concurrent
 *    bookings on the last remaining credit serialize on the row lock, so the
 *    second one observes `usedQuantity == totalQuantity` and is rejected with
 *    a 409 instead of over-drawing the bucket.
 */
@Injectable()
export class BookFromCreditHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly settingsHandler: GetBookingSettingsHandler,
    @Optional() private readonly availabilityHandler?: CheckAvailabilityHandler,
  ) {}

  async execute(cmd: BookFromCreditCommand) {
    const scheduledAt = new Date(cmd.scheduledAt);
    if (scheduledAt <= new Date()) {
      throw new BadRequestException('Booking must be scheduled in the future');
    }

    if (!cmd.creditId && !(cmd.serviceId && cmd.employeeId && cmd.durationOptionId)) {
      throw new BadRequestException(
        'Provide either creditId or the full (serviceId, employeeId, durationOptionId) triple',
      );
    }

    // ── Resolve the credit bucket + the concrete booking target ──
    // Flexible credits: the caller supplies the target and it is validated against
    // the credit's constraints. Legacy credits: the target is the credit's triple.
    const { credit, target } = await this.resolveCreditAndTarget(cmd);
    const creditServiceId = target.serviceId;
    const creditEmployeeId = target.employeeId;
    const creditDurationOptionId = target.durationOptionId;

    // ── Validate the supporting entities + slot (mirrors create-booking) ──
    const branch = await this.prisma.branch.findFirst({
      where: { id: cmd.branchId },
      select: { id: true, nameAr: true, isActive: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    if (branch.isActive === false) throw new BadRequestException('Branch is not active');

    const client = await this.prisma.client.findFirst({
      where: { id: cmd.clientId, deletedAt: null },
      select: { id: true },
    });
    if (!client) throw new NotFoundException('Client not found');

    const employee = await this.prisma.employee.findFirst({
      where: { id: creditEmployeeId },
      select: { id: true, name: true, isActive: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    if (employee.isActive === false) throw new BadRequestException('Employee is not active');

    const service = await this.prisma.service.findFirst({
      where: { id: creditServiceId },
      select: {
        id: true,
        nameAr: true,
        categoryId: true,
        isActive: true,
        archivedAt: true,
        bufferMinutes: true,
      },
    });
    if (!service) throw new NotFoundException('Service not found');
    if (service.isActive === false) throw new BadRequestException('Service is not active');
    if (service.archivedAt != null) throw new BadRequestException('Service is archived');

    // Duration is FIXED by the credit's durationOptionId — never the caller's.
    const durationOption = await this.prisma.serviceDurationOption.findFirst({
      where: { id: creditDurationOptionId },
      select: { id: true, durationMins: true, deliveryType: true },
    });
    if (!durationOption) throw new NotFoundException('Credit duration option not found');
    const durationMins = durationOption.durationMins;
    const deliveryType: DeliveryType =
      cmd.deliveryType ?? (durationOption.deliveryType as DeliveryType);

    const endsAt = new Date(scheduledAt.getTime() + durationMins * 60_000);

    const bookingSettings = await this.settingsHandler.execute({ branchId: cmd.branchId });

    // Resolve category/department snapshot names.
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

    await this.assertSlotAvailable({
      employeeId: creditEmployeeId,
      branchId: cmd.branchId,
      serviceId: creditServiceId,
      scheduledAt,
      durationMins,
      deliveryType,
    });

    // ── One Serializable transaction: lock the credit, recount, consume ──
    const booking = await this.rlsTransaction.withTransaction(
      async (tx) => {
        // Advisory lock on employee + slot window — same pattern as
        // create-booking — so two concurrent bookings cannot both pass the
        // overlap check.
        const lockKey1 = hashToInt32(creditEmployeeId);
        const lockKey2 = hashToInt32(`${scheduledAt.toISOString()}:${endsAt.toISOString()}`);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey1}::int, ${lockKey2}::int)`;

        // Overlap check with statuses that occupy staff time.
        const effectiveBufferMins = service.bufferMinutes ?? bookingSettings.bufferMinutes;
        const bufferMs = effectiveBufferMins * 60_000;
        const bufferedStart = new Date(scheduledAt.getTime() - bufferMs);
        const bufferedEnd = new Date(endsAt.getTime() + bufferMs);

        const conflict = await tx.booking.findFirst({
          where: {
            employeeId: creditEmployeeId,
            status: { in: [...STAFF_TIME_BLOCKING_BOOKING_STATUSES] },
            scheduledAt: { lt: bufferedEnd },
            endsAt: { gt: bufferedStart },
          },
          select: { id: true },
        });
        if (conflict) {
          throw new ConflictException('Employee already has a booking in this time slot');
        }

        // OVERDRAW GUARD: lock the credit row and recount inside the lock.
        const lockedRows = await tx.$queryRaw<LockedCreditRow[]>`
          SELECT id, "purchaseId", "serviceId", "employeeId", "durationOptionId",
                 "totalQuantity", "usedQuantity"
          FROM "PackageCredit"
          WHERE id = ${credit.id}
          FOR UPDATE
        `;
        if (lockedRows.length === 0) {
          throw new NotFoundException('Package credit not found');
        }
        const locked = lockedRows[0];
        if (locked.usedQuantity >= locked.totalQuantity) {
          // The bucket was exhausted by a concurrent winner between the
          // pre-lock read and acquiring the row lock — reject the over-draw.
          throw new ConflictException('No remaining credit in this package');
        }

        // REFUNDED-purchase guard (finance-safety): re-read the parent purchase
        // status INSIDE the lock. resolveCredit already filters for an ACTIVE
        // purchase, but a manual refund could complete between that read and
        // acquiring this row lock (TOCTOU). A REFUNDED purchase's credits are
        // voided money — they must never be bookable even if remaining > 0.
        const parentPurchase = await tx.packagePurchase.findUnique({
          where: { id: locked.purchaseId },
          select: { status: true },
        });
        if (
          !parentPurchase ||
          parentPurchase.status !== PackagePurchaseStatus.ACTIVE
        ) {
          throw new BadRequestException(
            'Package purchase is not active; its credits cannot be booked',
          );
        }

        // Serialize bookingNumber generation (same advisory-lock pattern as create-booking).
        const numberLockKey1 = hashToInt32('booking_number');
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${numberLockKey1}::int, 0::int)`;
        const lastBooking = await tx.booking.findFirst({
          where: {},
          orderBy: { bookingNumber: 'desc' },
          select: { bookingNumber: true },
        });
        const nextBookingNumber = (lastBooking?.bookingNumber ?? 0) + 1;

        const created = await tx.booking.create({
          data: {
            branchId: cmd.branchId,
            clientId: cmd.clientId,
            employeeId: creditEmployeeId,
            serviceId: creditServiceId,
            durationOptionId: creditDurationOptionId,
            scheduledAt,
            endsAt,
            durationMins,
            // Zero-value booking: pre-paid at purchase, so no price is owed.
            price: new Prisma.Decimal(0),
            discountedPrice: new Prisma.Decimal(0),
            currency: 'SAR',
            bookingType: 'INDIVIDUAL',
            deliveryType,
            source: 'RECEPTION',
            notes: cmd.notes,
            packageCreditId: credit.id,
            status: 'CONFIRMED',
            confirmedAt: new Date(),
            priceSnapshot: new Prisma.Decimal(0),
            durationMinutesSnapshot: durationMins,
            branchNameSnapshot: branch.nameAr,
            employeeNameSnapshot: employee.name,
            serviceNameSnapshot: service.nameAr,
            categoryNameSnapshot: categoryName,
            departmentNameSnapshot: departmentName,
            bookingNumber: nextBookingNumber,
          },
        });

        // Record the consumption + increment the bucket (id-keyed update — no
        // nested save, per .tariq/lessons.md).
        await tx.packageCreditUsage.create({
          data: {
            creditId: credit.id,
            bookingId: created.id,
            status: 'CONSUMED',
          },
        });
        await tx.packageCredit.update({
          where: { id: credit.id },
          data: { usedQuantity: { increment: 1 } },
        });

        // P1-2 audit trail: every cross-client credit consumption is recorded
        // with the acting staff user + the target client + the credit bucket.
        // The endpoint already requires create:Booking, so the audit row is
        // the accountability layer that makes a rogue receptionist's
        // cross-client consumption traceable after the fact.
        await tx.activityLog.create({
          data: {
            userId: cmd.userId ?? cmd.clientId,
            action: ActivityAction.CREATE,
            entity: 'PackageCreditUsage',
            entityId: credit.id,
            description: `Staff consumed a session-package credit on behalf of a client`,
            metadata: {
              bookingId: created.id,
              bookingNumber: nextBookingNumber,
              targetClientId: cmd.clientId,
              creditId: credit.id,
              purchaseId: credit.purchaseId,
              employeeId: creditEmployeeId,
              scheduledAt: scheduledAt.toISOString(),
            } as Prisma.InputJsonValue,
          },
        });

        // Auto-complete the purchase when every credit is fully consumed.
        const purchaseCredits = await tx.packageCredit.findMany({
          where: { purchaseId: credit.purchaseId },
          select: { totalQuantity: true, usedQuantity: true },
        });
        const allConsumed = purchaseCredits.every(
          (c) => c.usedQuantity >= c.totalQuantity,
        );
        if (allConsumed) {
          await tx.packagePurchase.update({
            where: { id: credit.purchaseId },
            data: { status: PackagePurchaseStatus.COMPLETED },
          });
        }

        // Outbox the BookingCreatedEvent inside the transaction so a crash
        // before publish is recovered by the OutboxPublisherCron.
        const createdEvent = new BookingCreatedEvent({
          bookingId: created.id,
          bookingNumber: created.bookingNumber,
          clientId: created.clientId,
          employeeId: created.employeeId ?? '',
          organizationId: DEFAULT_ORG_ID,
          scheduledAt: created.scheduledAt,
          serviceId: created.serviceId!,
        });
        await tx.outboxEvent.create({
          data: {
            aggregateId: created.id,
            eventType: createdEvent.eventName,
            payload: createdEvent.toEnvelope() as unknown as Prisma.InputJsonValue,
          },
        });

        return created;
      },
      { isolationLevel: 'Serializable' },
    );

    return booking;
  }

  /**
   * Resolve the credit bucket AND the concrete booking target.
   *
   *  - With a triple (service/employee/duration), the target is the caller's:
   *    an explicit creditId is validated against the credit's constraints; without
   *    one, the narrowest eligible credit (then FIFO) is auto-selected.
   *  - With only a creditId (no triple), the target is the credit's legacy triple
   *    (a flexible credit rejects this — it needs an explicit target).
   */
  private async resolveCreditAndTarget(
    cmd: BookFromCreditCommand,
  ): Promise<{
    credit: {
      id: string;
      purchaseId: string;
      serviceId: string | null;
      employeeId: string | null;
      durationOptionId: string | null;
      totalQuantity: number;
      usedQuantity: number;
      constraints: CreditConstraint[];
    };
    target: BookingTarget;
  }> {
    const select = {
      id: true,
      purchaseId: true,
      serviceId: true,
      employeeId: true,
      durationOptionId: true,
      totalQuantity: true,
      usedQuantity: true,
      constraints: {
        select: {
          dimension: true,
          mode: true,
          targets: { select: { targetId: true } },
        },
      },
    } as const;

    const hasTriple = !!(cmd.serviceId && cmd.employeeId && cmd.durationOptionId);

    if (cmd.creditId) {
      const credit = await this.prisma.packageCredit.findFirst({
        where: {
          id: cmd.creditId,
          usedQuantity: { lt: this.prisma.packageCredit.fields.totalQuantity },
          purchase: { clientId: cmd.clientId, status: PackagePurchaseStatus.ACTIVE },
        },
        select,
      });
      if (!credit) {
        throw new NotFoundException('No usable package credit found for this id');
      }

      if (hasTriple) {
        const target: BookingTarget = {
          serviceId: cmd.serviceId!,
          employeeId: cmd.employeeId!,
          durationOptionId: cmd.durationOptionId!,
          deliveryType: cmd.deliveryType ?? null,
        };
        if (!creditMatchesTarget(credit, target)) {
          throw new BadRequestException('The selected credit is not valid for this booking');
        }
        return { credit, target };
      }

      // Legacy path: derive the target from the credit's own triple.
      if (!credit.serviceId || !credit.employeeId || !credit.durationOptionId) {
        throw new BadRequestException(
          'This credit needs an explicit service, practitioner and duration',
        );
      }
      return {
        credit,
        target: {
          serviceId: credit.serviceId,
          employeeId: credit.employeeId,
          durationOptionId: credit.durationOptionId,
          deliveryType: cmd.deliveryType ?? null,
        },
      };
    }

    if (!hasTriple) {
      throw new BadRequestException(
        'Provide either creditId or the full (serviceId, employeeId, durationOptionId) triple',
      );
    }

    const target: BookingTarget = {
      serviceId: cmd.serviceId!,
      employeeId: cmd.employeeId!,
      durationOptionId: cmd.durationOptionId!,
      deliveryType: cmd.deliveryType ?? null,
    };

    // Auto-select: all client's ACTIVE credits with remaining, filter by the
    // matching engine, then narrowest-first (specificity) then FIFO.
    const candidates = await this.prisma.packageCredit.findMany({
      where: {
        usedQuantity: { lt: this.prisma.packageCredit.fields.totalQuantity },
        purchase: { clientId: cmd.clientId, status: PackagePurchaseStatus.ACTIVE },
      },
      orderBy: [{ purchase: { createdAt: 'asc' } }, { createdAt: 'asc' }],
      select,
    });
    const credit = candidates
      .filter((c) => creditMatchesTarget(c, target))
      .sort((a, b) => specificityScore(b) - specificityScore(a))[0];
    if (!credit) {
      throw new NotFoundException(
        'No matching package credit with remaining capacity for this client',
      );
    }
    return { credit, target };
  }

  private async assertSlotAvailable(input: {
    employeeId: string;
    branchId: string;
    serviceId: string;
    scheduledAt: Date;
    durationMins: number;
    deliveryType: DeliveryType;
  }) {
    if (!this.availabilityHandler) return;

    const slots = await this.availabilityHandler.execute({
      employeeId: input.employeeId,
      branchId: input.branchId,
      serviceId: input.serviceId,
      date: input.scheduledAt,
      durationMins: input.durationMins,
      bookingType: 'INDIVIDUAL',
      deliveryType: input.deliveryType,
    });

    const scheduledMs = input.scheduledAt.getTime();
    if (!slots.some((slot) => slot.startTime.getTime() === scheduledMs)) {
      throw new BadRequestException('Selected booking time is not available');
    }
  }
}
