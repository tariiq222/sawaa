import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { DeliveryType, PackagePurchaseStatus } from '@prisma/client';
import { PrismaService, TransactionService } from '../../../infrastructure/database';
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';
import { CheckAvailabilityHandler } from '../check-availability/check-availability.handler';
import { hashToInt32 } from '../booking-lifecycle.helper';
import {
  ACTIVE_BOOKING_STATUSES,
  STAFF_TIME_BLOCKING_BOOKING_STATUSES,
} from '../active-booking-statuses';
import { BookFromCreditDto } from './book-from-credit.dto';
import { loadBookingParties, loadCategoryAndDepartmentNames } from './book-from-credit.parties';
import { resolveCreditAndTarget } from './book-from-credit.resolve';
import { createCreditBooking } from './book-from-credit.write';
import {
  lockPersonReferences,
  retrySerializableTransaction,
} from '../../../common/database/person-reference-lock.helper';
import {
  assertScheduledInFuture,
  assertTargetSelection,
  mapConcurrentCreditConflict,
  resolveCreditRouting,
} from './book-from-credit.rules';
import { lockPackagePurchase } from '../package-purchase-lock.helper';

export type BookFromCreditCommand = Omit<BookFromCreditDto, 'scheduledAt'> & {
  scheduledAt: Date;
  /** Acting user id (set by the controller). */
  userId?: string;
};

/**
 * Reserve one session-package credit to create a zero-value booking.
 *
 * The credit pack model: the client pre-paid in full at purchase time, so a
 * credit booking carries NO invoice and NO payment — price = 0. The duration
 * is FIXED by the credit's durationOptionId (the caller may not change it).
 *
 * Reserve vs consume: booking only RESERVES a seat (`reservedQuantity`); the
 * session is actually consumed (`usedQuantity`) once it is delivered, via
 * `consumePackageCreditForBooking` at check-in/complete. That is what lets a
 * cancelled or no-showed booking give the seat back without ever having
 * touched the delivered count.
 *
 * Concurrency safety (the high-risk part):
 *  - Availability + overlap are checked exactly like a normal booking
 *    (CheckAvailabilityHandler + a pg advisory lock on employee+slot + an
 *    overlap query).
 *  - The credit bucket is reserved inside ONE Serializable transaction. The
 *    `SELECT ... FOR UPDATE` row lock + an in-lock recount of
 *    `usedQuantity + reservedQuantity < totalQuantity` is the OVERDRAW GUARD:
 *    two concurrent bookings on the last remaining seat serialize on the row
 *    lock, so the second one observes the bucket full (delivered + booked)
 *    and is rejected with a 409 instead of over-drawing it.
 */
@Injectable()
export class BookFromCreditHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: TransactionService,
    private readonly settingsHandler: GetBookingSettingsHandler,
    @Optional() private readonly availabilityHandler?: CheckAvailabilityHandler,
  ) {}

  async execute(cmd: BookFromCreditCommand) {
    const scheduledAt = new Date(cmd.scheduledAt);
    assertScheduledInFuture(scheduledAt, new Date());
    assertTargetSelection({
      creditId: cmd.creditId,
      serviceId: cmd.serviceId,
      employeeId: cmd.employeeId,
      durationOptionId: cmd.durationOptionId,
    });

    // ── Resolve the credit bucket + the concrete booking target ──
    // Flexible credits: the caller supplies the target and it is validated against
    // the credit's constraints. Legacy credits: the target is the credit's triple.
    const { credit, target, eligibility } = await resolveCreditAndTarget(this.prisma, cmd);
    const creditServiceId = target.serviceId;
    const creditEmployeeId = target.employeeId;

    // ── Validate the supporting entities + slot (mirrors create-booking) ──
    const { branch, employee, service } = await loadBookingParties(this.prisma, {
      branchId: cmd.branchId,
      clientId: cmd.clientId,
      employeeId: creditEmployeeId,
      serviceId: creditServiceId,
    });

    // The selected concrete target determines duration: legacy credits use
    // their frozen duration, while flexible credits use the caller's target.
    const durationOption = eligibility.durationOption;
    if (!durationOption) throw new NotFoundException('Credit duration option not found');
    const { durationMins, deliveryType } = resolveCreditRouting({
      credit,
      durationOption,
      eligibility,
      requestedDeliveryType: cmd.deliveryType ?? null,
    });

    const endsAt = new Date(scheduledAt.getTime() + durationMins * 60_000);

    const bookingSettings = await this.settingsHandler.execute({ branchId: cmd.branchId });

    // Resolve category/department snapshot names.
    const { categoryName, departmentName } = await loadCategoryAndDepartmentNames(
      this.prisma,
      service.categoryId,
    );

    await this.assertSlotAvailable({
      employeeId: creditEmployeeId,
      branchId: cmd.branchId,
      serviceId: creditServiceId,
      scheduledAt,
      durationMins,
      deliveryType,
    });

    // ── One Serializable transaction: lock the credit, recount, consume ──
    const booking = await retrySerializableTransaction(() =>
      this.rlsTransaction.withTransaction(async (tx) => {
        // Same global lock order as create-booking: client -> employee/slot ->
        // booking number. The client lock serializes this credit booking with
        // any concurrent paid booking for the same client.
        const clientLockKey1 = hashToInt32('client_booking');
        const clientLockKey2 = hashToInt32(cmd.clientId);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${clientLockKey1}::int, ${clientLockKey2}::int)`;

        await lockPersonReferences(
          tx,
          [
            { kind: 'Client', id: cmd.clientId },
            { kind: 'Employee', id: creditEmployeeId },
          ],
          'reference',
        );

        // Parity with create-booking: a client cannot hold two overlapping
        // active appointments, whether paid or funded by package credit.
        const clientConflict = await tx.booking.findFirst({
          where: {
            clientId: cmd.clientId,
            isHistoricalImport: false,
            status: { in: [...ACTIVE_BOOKING_STATUSES] },
            scheduledAt: { lt: endsAt },
            endsAt: { gt: scheduledAt },
          },
          select: { id: true },
        });
        if (clientConflict) {
          throw new ConflictException('Client already has an overlapping appointment');
        }

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

        // Lock the parent purchase before the credit row. Every package
        // mutation uses this parent-first order, so booking cannot deadlock
        // with consume/return/reclaim/refund while sibling state changes.
        const lockedPurchase = await lockPackagePurchase(tx, credit.purchaseId);
        if (!lockedPurchase || lockedPurchase.status !== PackagePurchaseStatus.ACTIVE) {
          throw new BadRequestException(
            'Package purchase is not active; its credits cannot be booked',
          );
        }

        return createCreditBooking({
          tx,
          cmd,
          credit,
          target,
          parties: { branch, employee, service },
          scheduledAt,
          endsAt,
          durationMins,
          deliveryType,
          categoryName,
          departmentName,
        });
      }, { isolationLevel: 'Serializable' }),
    ).catch(mapConcurrentCreditConflict);

    return booking;
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
