import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  GroupSequenceMode,
  PackageCreditUsageStatus,
  PackageModelVersion,
  PackagePurchaseStatus,
  Prisma,
} from '@prisma/client';
import { lockPackagePurchase } from './package-purchase-lock.helper';
import { packageCreditGroupCreditSelect } from './package-credit-group-select';
import { BookingTarget, creditMatchesTarget } from './package-credit-matching.helper';
import { validateBookingTargetEligibility } from './booking-target-eligibility.helper';

export type PackageCreditAvailabilityReason =
  | 'PREDECESSOR_INCOMPLETE'
  | 'GROUP_INCOMPLETE'
  | 'DEPENDENCY_INCOMPLETE'
  | 'RESERVED'
  | 'CONSUMED'
  | 'DELIVERED'
  | 'REFUNDED'
  | 'PURCHASE_INACTIVE'
  | 'OFFERING_UNAVAILABLE';

export interface PackageCreditAvailability {
  bookable: boolean;
  reason: PackageCreditAvailabilityReason | null;
}

export interface PackageCreditUsageState {
  status: PackageCreditUsageStatus | string;
  deliveredAt?: Date | null;
}

export interface PackageCreditGroupCreditState {
  id: string;
  sessionPosition?: number | null;
  totalQuantity: number;
  usedQuantity: number;
  reservedQuantity: number;
  usages?: PackageCreditUsageState[];
}

export interface PackageCreditAvailabilityInput {
  modelVersion?: PackageModelVersion | string | null;
  purchaseStatus?: PackagePurchaseStatus | string | null;
  totalQuantity: number;
  usedQuantity: number;
  reservedQuantity: number;
  usages?: PackageCreditUsageState[];
  sequenceMode?: GroupSequenceMode | string | null;
  sessionPosition?: number | null;
  creditId?: string | null;
  purchaseGroupId?: string | null;
  dependsOnGroupId?: string | null;
  dependencyCredits?: PackageCreditGroupCreditState[];
  groupCredits?: PackageCreditGroupCreditState[];
  offeringAvailable?: boolean;
}

export function creditHasDeliveredUsage(credit: PackageCreditGroupCreditState): boolean {
  const delivered = (credit.usages ?? []).filter(
    (usage) => usage.status === PackageCreditUsageStatus.CONSUMED && usage.deliveredAt != null,
  ).length;
  return delivered >= credit.totalQuantity;
}

export function groupHasDeliveredCredits(credits: PackageCreditGroupCreditState[] | undefined): boolean {
  return !!credits && credits.length > 0 && credits.every(creditHasDeliveredUsage);
}

/**
 * Compute package-session availability. Capacity remains separate from group
 * ordering: a V2 credit is bookable only when it has capacity and its sequence
 * and dependency gates are open. Legacy credits retain their old capacity-only
 * behaviour.
 */
export function getPackageCreditAvailability(
  input: PackageCreditAvailabilityInput,
): PackageCreditAvailability {
  if (input.purchaseStatus === PackagePurchaseStatus.REFUNDED) {
    return { bookable: false, reason: 'REFUNDED' };
  }

  if (
    (input.modelVersion === PackageModelVersion.GROUPED_V2 || input.purchaseStatus != null) &&
    input.purchaseStatus !== PackagePurchaseStatus.ACTIVE
  ) {
    return { bookable: false, reason: 'PURCHASE_INACTIVE' };
  }

  if (input.usedQuantity + input.reservedQuantity >= input.totalQuantity) {
    return {
      bookable: false,
      reason:
        input.reservedQuantity > 0
          ? 'RESERVED'
          : creditHasDeliveredUsage({
                id: input.creditId ?? 'current',
                sessionPosition: input.sessionPosition,
                totalQuantity: input.totalQuantity,
                usedQuantity: input.usedQuantity,
                reservedQuantity: input.reservedQuantity,
                usages: input.usages,
              })
            ? 'DELIVERED'
            : 'CONSUMED',
    };
  }

  if (input.offeringAvailable === false) {
    return { bookable: false, reason: 'OFFERING_UNAVAILABLE' };
  }

  if (input.modelVersion !== PackageModelVersion.GROUPED_V2) {
    return { bookable: true, reason: null };
  }

  if (
    !input.purchaseGroupId ||
    (input.sequenceMode !== GroupSequenceMode.ORDERED &&
      input.sequenceMode !== GroupSequenceMode.UNORDERED) ||
    input.sessionPosition == null ||
    !Number.isInteger(input.sessionPosition) ||
    input.sessionPosition < 0 ||
    !input.groupCredits ||
    input.groupCredits.length === 0
  ) {
    return { bookable: false, reason: 'GROUP_INCOMPLETE' };
  }

  const positions = input.groupCredits.map((credit) => credit.sessionPosition);
  if (
    positions.some((position) => position == null || !Number.isInteger(position) || position < 0) ||
    new Set(positions).size !== positions.length
  ) {
    return { bookable: false, reason: 'GROUP_INCOMPLETE' };
  }
  const sortedPositions = [...positions].sort((a, b) => (a ?? 0) - (b ?? 0));
  if (sortedPositions.some((position, index) => position !== index)) {
    return { bookable: false, reason: 'GROUP_INCOMPLETE' };
  }
  if (
    input.creditId != null &&
    !input.groupCredits.some((credit) => credit.id === input.creditId)
  ) {
    return { bookable: false, reason: 'GROUP_INCOMPLETE' };
  }

  if (input.dependsOnGroupId) {
    if (!input.dependencyCredits || input.dependencyCredits.length === 0) {
      return { bookable: false, reason: 'GROUP_INCOMPLETE' };
    }
    if (!groupHasDeliveredCredits(input.dependencyCredits)) {
      return { bookable: false, reason: 'DEPENDENCY_INCOMPLETE' };
    }
  }

  if (input.sequenceMode === GroupSequenceMode.ORDERED) {
    const predecessorIncomplete = (input.groupCredits ?? [])
      .filter(
        (credit) =>
          credit.sessionPosition != null && credit.sessionPosition < input.sessionPosition!,
      )
      .some((credit) => !creditHasDeliveredUsage(credit));
    if (predecessorIncomplete) {
      return { bookable: false, reason: 'PREDECESSOR_INCOMPLETE' };
    }
  }

  return { bookable: true, reason: null };
}

interface PackageCreditLifecycleRow {
  id: string;
  purchaseId: string;
  purchase?: { status?: PackagePurchaseStatus; modelVersion?: PackageModelVersion | string | null };
  serviceId: string | null;
  employeeId: string | null;
  durationOptionId: string | null;
  durationMinsSnapshot?: number | null;
  deliveryTypeSnapshot?: string | null;
  totalQuantity: number;
  usedQuantity: number;
  reservedQuantity: number;
  sessionPosition?: number | null;
  purchaseGroup?: {
    id: string;
    sequenceMode: GroupSequenceMode;
    dependsOnGroupId?: string | null;
    credits: PackageCreditGroupCreditState[];
    dependsOnGroup?: { credits: PackageCreditGroupCreditState[] } | null;
  } | null;
  constraints?: Array<{
    dimension: string;
    mode: string;
    targets: Array<{ targetId: string }>;
  }>;
}

function lifecycleSelect() {
  return {
    id: true,
    purchaseId: true,
    serviceId: true,
    employeeId: true,
    durationOptionId: true,
    durationMinsSnapshot: true,
    deliveryTypeSnapshot: true,
    totalQuantity: true,
    usedQuantity: true,
    reservedQuantity: true,
    sessionPosition: true,
    constraints: { select: { dimension: true, mode: true, targets: { select: { targetId: true } } } },
    purchase: { select: { status: true, modelVersion: true } },
    purchaseGroup: {
      select: {
        id: true,
        sequenceMode: true,
        dependsOnGroupId: true,
        credits: { select: packageCreditGroupCreditSelect },
        dependsOnGroup: {
          select: {
            credits: { select: packageCreditGroupCreditSelect },
          },
        },
      },
    },
  } as const;
}

/** Re-read a credit and enforce its sequence/dependency gate inside a reservation transaction. */
export async function assertPackageSessionBookable(
  tx: Prisma.TransactionClient,
  creditId: string,
  target?: BookingTarget,
  expected?: {
    serviceId: string | null;
    employeeId: string | null;
    durationOptionId: string | null;
    durationMinsSnapshot?: number | null;
    deliveryTypeSnapshot?: string | null;
  },
  options?: { skipCapacity?: boolean },
): Promise<PackageCreditLifecycleRow> {
  const reference = await tx.packageCredit.findUnique({
    where: { id: creditId },
    select: { purchaseId: true },
  });
  if (!reference) throw new BadRequestException('Package credit not found');

  // Parent purchase is the first lock in every package mutation. Only after
  // acquiring it do we read group topology and mutable routing fields.
  const purchase = await lockPackagePurchase(tx, reference.purchaseId);
  if (!purchase) throw new BadRequestException('Package purchase not found');

  const credit = (await tx.packageCredit.findUnique({
    where: { id: creditId },
    select: lifecycleSelect(),
  })) as PackageCreditLifecycleRow | null;
  if (!credit) throw new BadRequestException('Package credit not found');

  if (credit.purchase?.status === PackagePurchaseStatus.REFUNDED || purchase.status === PackagePurchaseStatus.REFUNDED) {
    throw new BadRequestException('Package purchase is refunded');
  }
  if (
    purchase.status !== PackagePurchaseStatus.ACTIVE ||
    (credit.purchase?.status != null && credit.purchase.status !== PackagePurchaseStatus.ACTIVE)
  ) {
    throw new BadRequestException('Package purchase is not active; its credits cannot be booked');
  }

  if (
    expected &&
    (credit.serviceId !== expected.serviceId ||
      credit.employeeId !== expected.employeeId ||
      credit.durationOptionId !== expected.durationOptionId ||
      (expected.durationMinsSnapshot !== undefined &&
        credit.durationMinsSnapshot !== expected.durationMinsSnapshot) ||
      (expected.deliveryTypeSnapshot !== undefined &&
        credit.deliveryTypeSnapshot !== expected.deliveryTypeSnapshot))
  ) {
    throw new ConflictException('Package credit routing or offering changed; please refresh and retry');
  }

  if (target && credit.constraints && !creditMatchesTarget(credit as never, target)) {
    throw new BadRequestException('The selected credit is not valid for this booking');
  }

  if (target && credit.purchase?.modelVersion === PackageModelVersion.GROUPED_V2) {
    const currentEligibility = await validateBookingTargetEligibility(tx, {
      serviceId: target.serviceId,
      employeeId: target.employeeId,
      durationOptionId: target.durationOptionId,
      deliveryType: target.deliveryType,
      bookingType: 'INDIVIDUAL',
    });
    if (
      currentEligibility.durationOption?.durationMins !== credit.durationMinsSnapshot ||
      currentEligibility.deliveryType !== credit.deliveryTypeSnapshot
    ) {
      throw new BadRequestException('Current practitioner offering no longer matches the package credit snapshot');
    }
  }

  const group = credit.purchaseGroup;
  const availability = getPackageCreditAvailability({
    modelVersion: credit.purchase?.modelVersion,
    purchaseStatus: purchase.status,
    totalQuantity: options?.skipCapacity ? Number.MAX_SAFE_INTEGER : credit.totalQuantity,
    usedQuantity: options?.skipCapacity ? 0 : credit.usedQuantity,
    reservedQuantity: options?.skipCapacity ? 0 : credit.reservedQuantity,
    usages: group?.credits.find((groupCredit) => groupCredit.id === credit.id)?.usages,
    sequenceMode: group?.sequenceMode,
    sessionPosition: credit.sessionPosition,
    creditId: credit.id,
    purchaseGroupId: credit.purchaseGroup?.id,
    dependsOnGroupId: group?.dependsOnGroupId,
    dependencyCredits: group?.dependsOnGroup?.credits,
    groupCredits: group?.credits,
  });
  if (!availability.bookable) {
    throw new BadRequestException(`Package credit is unavailable: ${availability.reason}`);
  }
  return credit;
}

/** Lock and reject refunded package credits before a booking lifecycle write. */
export async function assertPackageCreditLifecycleAllowed(
  tx: Prisma.TransactionClient,
  creditId: string,
): Promise<void> {
  const reference = await tx.packageCredit.findUnique({
    where: { id: creditId },
    select: { purchaseId: true },
  });
  if (!reference) throw new BadRequestException('Package credit not found');
  const purchase = await lockPackagePurchase(tx, reference.purchaseId);
  if (!purchase || purchase.status === PackagePurchaseStatus.REFUNDED) {
    throw new BadRequestException('Package purchase is refunded');
  }
}

export async function isGroupedV2PackageCredit(
  db: Prisma.TransactionClient | { packageCredit: Prisma.TransactionClient['packageCredit'] },
  creditId: string,
): Promise<boolean> {
  const credit = await db.packageCredit.findUnique({
    where: { id: creditId },
    select: { purchase: { select: { modelVersion: true } } },
  });
  return credit?.purchase?.modelVersion === PackageModelVersion.GROUPED_V2;
}
