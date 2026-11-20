import { BadRequestException, ConflictException } from '@nestjs/common';
import { DeliveryType } from '@prisma/client';
import { isSerializableTransactionConflict } from '../../../common/database/person-reference-lock.helper';

/**
 * Pure rules extracted from BookFromCreditHandler (MNT-18).
 *
 * Nothing here touches Prisma, clocks or Nest context: every function takes
 * plain values and returns plain values, so behaviour can be unit-tested
 * without a database while `execute` keeps the transaction, query order and
 * lock order untouched.
 */

/** Prisma reports a Serializable transaction abort as P2034. Raw-query errors
 * can additionally preserve PostgreSQL's 40001 code directly, in `meta.code`,
 * or in the PrismaPg driver-adapter cause. All represent a safe rollback, so
 * expose the concurrent loser as a domain conflict instead of leaking a 500. */
export function mapConcurrentCreditConflict(error: unknown): never {
  if (isSerializableTransactionConflict(error)) {
    throw new ConflictException('Package credit was consumed concurrently; please retry');
  }

  throw error;
}

/**
 * Real availability = totalQuantity − usedQuantity − reservedQuantity > 0.
 * Prisma cannot express this as a field-reference `where` comparison (it can
 * only compare a column against another COLUMN, not a computed sum), so both
 * credit-selection paths in `resolveCreditAndTarget` fetch with a coarse
 * `usedQuantity < totalQuantity` DB filter and apply this JS predicate
 * afterwards as the authoritative check — otherwise a credit fully booked out
 * for future appointments (usedQuantity 0, reservedQuantity == totalQuantity)
 * would look available and get selected, only for the in-transaction overdraw
 * guard to reject the whole booking with a false "no credit left".
 */
export function hasAvailableCapacity(credit: {
  totalQuantity: number;
  usedQuantity: number;
  reservedQuantity?: number | null;
}): boolean {
  return credit.usedQuantity + (credit.reservedQuantity ?? 0) < credit.totalQuantity;
}

export interface CreditSnapshotRouting {
  durationMinsSnapshot: number | null;
  deliveryTypeSnapshot: DeliveryType | null;
  purchase?: { modelVersion: string } | null;
}

export interface ResolvedCreditRouting {
  isGroupedV2: boolean;
  durationMins: number;
  deliveryType: DeliveryType;
}

/**
 * Resolves the immutable duration/delivery of a credit and rejects grouped
 * credits whose snapshot no longer matches the practitioner's current
 * offering. Legacy credits keep deriving both from the live duration option.
 *
 * `durationOption` and `eligibility` are passed as plain values by the caller
 * after its existing reads, so query order does not change.
 */
export function resolveCreditRouting(input: {
  credit: CreditSnapshotRouting;
  durationOption: { durationMins: number };
  eligibility: { deliveryType: DeliveryType };
  requestedDeliveryType?: DeliveryType | null;
}): ResolvedCreditRouting {
  const { credit, durationOption, eligibility, requestedDeliveryType } = input;
  const isGroupedV2 = credit.purchase?.modelVersion === 'GROUPED_V2';

  if (isGroupedV2 && (credit.durationMinsSnapshot == null || credit.deliveryTypeSnapshot == null)) {
    throw new BadRequestException('Grouped package credit snapshot is incomplete');
  }

  const durationMins = isGroupedV2
    ? credit.durationMinsSnapshot!
    : durationOption.durationMins;
  const deliveryType: DeliveryType = isGroupedV2
    ? credit.deliveryTypeSnapshot!
    : eligibility.deliveryType;

  if (
    isGroupedV2 &&
    (durationOption.durationMins !== credit.durationMinsSnapshot ||
      eligibility.deliveryType !== credit.deliveryTypeSnapshot)
  ) {
    throw new BadRequestException(
      'Current practitioner offering no longer matches the package credit snapshot',
    );
  }

  if (requestedDeliveryType && requestedDeliveryType !== deliveryType) {
    throw new BadRequestException('Delivery type does not match the package credit snapshot');
  }

  return { isGroupedV2, durationMins, deliveryType };
}

/** A booking must be strictly in the future. Pure so the boundary is testable. */
export function assertScheduledInFuture(scheduledAt: Date, now: Date): void {
  if (scheduledAt <= now) {
    throw new BadRequestException('Booking must be scheduled in the future');
  }
}

/**
 * Validates the three-way target selection rule: either a creditId, or the
 * full (serviceId, employeeId, durationOptionId) triple. Supplying a creditId
 * plus only part of the triple is a caller mistake, never a silent fallback.
 */
export function assertTargetSelection(input: {
  creditId?: string | null;
  serviceId?: string | null;
  employeeId?: string | null;
  durationOptionId?: string | null;
}): void {
  const { creditId, serviceId, employeeId, durationOptionId } = input;
  if (!creditId && !(serviceId && employeeId && durationOptionId)) {
    throw new BadRequestException(
      'Provide either creditId or the full (serviceId, employeeId, durationOptionId) triple',
    );
  }
  const suppliedTargetFields = [serviceId, employeeId, durationOptionId]
    .filter((value) => value !== undefined && value !== null).length;
  if (creditId && suppliedTargetFields > 0 && suppliedTargetFields < 3) {
    throw new BadRequestException(
      'Provide all of serviceId, employeeId and durationOptionId when selecting a credit target',
    );
  }
}
