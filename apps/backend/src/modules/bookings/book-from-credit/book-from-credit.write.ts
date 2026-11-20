import { ConflictException } from '@nestjs/common';
import {
  ActivityAction,
  DeliveryType,
  PackageCreditUsageStatus,
  Prisma,
} from '@prisma/client';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import { hashToInt32 } from '../booking-lifecycle.helper';
import { BookingCreatedEvent } from '../events/booking-created.event';
import { assertPackageSessionBookable } from '../package-credit-availability.helper';
import {
  BookingTarget,
} from '../package-credit-matching.helper';
import type { ResolvedCredit } from './book-from-credit.resolve';
import type { BookingParties } from './book-from-credit.parties';

/** Row shape returned by the FOR UPDATE raw select on PackageCredit. */
export interface LockedCreditRow {
  id: string;
  purchaseId: string;
  serviceId: string | null;
  employeeId: string | null;
  durationOptionId: string | null;
  purchaseGroupId: string | null;
  sessionPosition: number | null;
  durationMinsSnapshot: number | null;
  deliveryTypeSnapshot: DeliveryType | null;
  totalQuantity: number;
  usedQuantity: number;
  reservedQuantity: number;
}

export interface CreateCreditBookingInput {
  tx: Prisma.TransactionClient;
  cmd: {
    branchId: string;
    clientId: string;
    notes?: string | null;
    userId?: string;
  };
  credit: ResolvedCredit;
  target: BookingTarget;
  parties: BookingParties;
  scheduledAt: Date;
  endsAt: Date;
  durationMins: number;
  deliveryType: DeliveryType;
  categoryName: string | null;
  departmentName: string | null;
}

/**
 * Post-lock write phase of a package-credit booking (MNT-18).
 *
 * Runs entirely inside the caller's Serializable transaction and keeps the
 * exact statement order of the original handler: re-verify the credit under
 * FOR UPDATE, re-check capacity, take the booking-number advisory lock, then
 * create booking -> usage -> reserved counter -> audit -> outbox.
 */
export async function createCreditBooking(input: CreateCreditBookingInput) {
  const {
    tx,
    cmd,
    credit,
    target,
    parties,
    scheduledAt,
    endsAt,
    durationMins,
    deliveryType,
    categoryName,
    departmentName,
  } = input;

  // OVERDRAW GUARD: lock the credit row and recount inside the lock.
  const lockedRows = await tx.$queryRaw<LockedCreditRow[]>`
    SELECT id, "purchaseId", "serviceId", "employeeId", "durationOptionId",
           "purchaseGroupId", "sessionPosition", "durationMinsSnapshot", "deliveryTypeSnapshot",
           "totalQuantity", "usedQuantity", "reservedQuantity"
    FROM "PackageCredit"
    WHERE id = ${credit.id}
    FOR UPDATE
  `;
  if (lockedRows.length === 0) {
    throw new ConflictException('Package credit not found');
  }
  const locked = lockedRows[0];
  if (
    locked.purchaseId !== credit.purchaseId ||
    locked.serviceId !== credit.serviceId ||
    locked.employeeId !== credit.employeeId ||
    locked.durationOptionId !== credit.durationOptionId
  ) {
    throw new ConflictException('Package credit routing changed; please refresh and retry');
  }
  await assertPackageSessionBookable(tx, credit.id, target, {
    serviceId: credit.serviceId,
    employeeId: credit.employeeId,
    durationOptionId: credit.durationOptionId,
    durationMinsSnapshot: credit.durationMinsSnapshot,
    deliveryTypeSnapshot: credit.deliveryTypeSnapshot,
  }, { skipCapacity: true });
  // A reserved session belongs to an appointment that has not happened yet;
  // it occupies a seat exactly like a delivered one.
  if (locked.usedQuantity + locked.reservedQuantity >= locked.totalQuantity) {
    // The bucket was exhausted (delivered + booked) by a concurrent winner
    // between the pre-lock read and acquiring the row lock — reject over-draw.
    throw new ConflictException('No remaining credit in this package');
  }

  // Serialize bookingNumber generation (same advisory-lock pattern as
  // create-booking).
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
      employeeId: target.employeeId,
      serviceId: target.serviceId,
      durationOptionId: target.durationOptionId,
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
      branchNameSnapshot: parties.branch.nameAr,
      employeeNameSnapshot: parties.employee.name,
      serviceNameSnapshot: credit.serviceNameSnapshot ?? parties.service.nameAr,
      categoryNameSnapshot: categoryName,
      departmentNameSnapshot: departmentName,
      bookingNumber: nextBookingNumber,
    },
  });

  // Reserve the session (not consume it) + increment the reserved counter
  // (id-keyed update — no nested save, per .tariq/memory/notes/lessons.md).
  // The session is only actually consumed once it is delivered — see
  // `consumePackageCreditForBooking`.
  await tx.packageCreditUsage.create({
    data: {
      creditId: credit.id,
      bookingId: created.id,
      status: PackageCreditUsageStatus.RESERVED,
    },
  });
  await tx.packageCredit.update({
    where: { id: credit.id },
    data: { reservedQuantity: { increment: 1 } },
  });

  // P1-2 audit trail: every cross-client credit consumption is recorded with
  // the acting staff user + the target client + the credit bucket.
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
        employeeId: target.employeeId,
        scheduledAt: scheduledAt.toISOString(),
      } as Prisma.InputJsonValue,
    },
  });

  // A purchase completes when its last session is DELIVERED, not when it is
  // booked — the auto-complete moved to `consumePackageCreditForBooking`.

  // Outbox the BookingCreatedEvent inside the transaction so a crash before
  // publish is recovered by the OutboxPublisherCron.
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
}
