import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DeliveryType, PackagePurchaseStatus } from '@prisma/client';
import type { PrismaService } from '../../../infrastructure/database';
import {
  BookingTarget,
  CreditConstraint,
  creditMatchesTarget,
  specificityScore,
} from '../package-credit-matching.helper';
import {
  BookingTargetEligibility,
  validateBookingTargetEligibility,
} from '../booking-target-eligibility.helper';
import { hasAvailableCapacity } from './book-from-credit.rules';
import type { BookFromCreditCommand } from './book-from-credit.handler';

export interface ResolvedCredit {
  id: string;
  purchaseId: string;
  serviceId: string | null;
  employeeId: string | null;
  durationOptionId: string | null;
  totalQuantity: number;
  usedQuantity: number;
  reservedQuantity: number;
  durationMinsSnapshot: number | null;
  deliveryTypeSnapshot: DeliveryType | null;
  serviceNameSnapshot: string | null;
  employeeNameSnapshot: string | null;
  purchase: { modelVersion: string };
  constraints: CreditConstraint[];
}

export interface ResolvedCreditAndTarget {
  credit: ResolvedCredit;
  target: BookingTarget;
  eligibility: BookingTargetEligibility;
}

/**
 * Resolve the credit bucket AND the concrete booking target (MNT-18).
 *
 *  - With a triple (service/employee/duration), the target is the caller's:
 *    an explicit creditId is validated against the credit's constraints; without
 *    one, the narrowest eligible credit (then FIFO) is auto-selected.
 *  - With only a creditId (no triple), the target is the credit's legacy triple
 *    (a flexible credit rejects this — it needs an explicit target).
 *
 * Every query, filter and ordering here is byte-for-byte the one the handler
 * used before extraction; only the `prisma` receiver is now a parameter.
 */
export async function resolveCreditAndTarget(
  prisma: PrismaService,
  cmd: BookFromCreditCommand,
): Promise<ResolvedCreditAndTarget> {
  const select = {
    id: true,
    purchaseId: true,
    serviceId: true,
    employeeId: true,
    durationOptionId: true,
    totalQuantity: true,
    usedQuantity: true,
    reservedQuantity: true,
    durationMinsSnapshot: true,
    deliveryTypeSnapshot: true,
    serviceNameSnapshot: true,
    employeeNameSnapshot: true,
    purchase: { select: { modelVersion: true } },
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
    const credit = await prisma.packageCredit.findFirst({
      where: {
        id: cmd.creditId,
        // Prisma cannot express `usedQuantity + reservedQuantity <
        // totalQuantity` as a field-reference comparison, so this coarse
        // filter only rules out credits that are already fully DELIVERED.
        // A credit that is fully booked out by RESERVED sessions still
        // passes here and is caught by the JS predicate below, which is
        // the authoritative availability check.
        usedQuantity: { lt: prisma.packageCredit.fields.totalQuantity },
        purchase: { clientId: cmd.clientId, status: PackagePurchaseStatus.ACTIVE },
      },
      select,
    });
    if (!credit || !hasAvailableCapacity(credit)) {
      throw new NotFoundException('No usable package credit found for this id');
    }

    // A flexible credit uses the caller's concrete triple. A legacy credit
    // without one derives it from the immutable credit routing fields.
    const targetIds = hasTriple
      ? {
          serviceId: cmd.serviceId!,
          employeeId: cmd.employeeId!,
          durationOptionId: cmd.durationOptionId!,
        }
      : {
          serviceId: credit.serviceId,
          employeeId: credit.employeeId,
          durationOptionId: credit.durationOptionId,
        };
    if (!targetIds.serviceId || !targetIds.employeeId || !targetIds.durationOptionId) {
      throw new BadRequestException(
        'This credit needs an explicit service, practitioner and duration',
      );
    }
    const eligibility = await validateBookingTargetEligibility(prisma, {
      serviceId: targetIds.serviceId,
      employeeId: targetIds.employeeId,
      durationOptionId: targetIds.durationOptionId,
      deliveryType: cmd.deliveryType ?? null,
      bookingType: 'INDIVIDUAL',
    });
    const target: BookingTarget = {
      serviceId: targetIds.serviceId,
      employeeId: targetIds.employeeId,
      durationOptionId: targetIds.durationOptionId,
      deliveryType: eligibility.deliveryType,
    };
    if (!creditMatchesTarget(credit, target)) {
      throw new BadRequestException('The selected credit is not valid for this booking');
    }
    return { credit, target, eligibility };
  }

  if (!hasTriple) {
    throw new BadRequestException(
      'Provide either creditId or the full (serviceId, employeeId, durationOptionId) triple',
    );
  }

  const requestedTarget: BookingTarget = {
    serviceId: cmd.serviceId!,
    employeeId: cmd.employeeId!,
    durationOptionId: cmd.durationOptionId!,
    deliveryType: cmd.deliveryType ?? null,
  };

  // Validate the concrete target before matching any credit. In particular,
  // the selected duration supplies deliveryType when the caller omitted it.
  const eligibility = await validateBookingTargetEligibility(prisma, {
    ...requestedTarget,
    bookingType: 'INDIVIDUAL',
  });
  const target: BookingTarget = {
    ...requestedTarget,
    deliveryType: eligibility.deliveryType,
  };

  // Auto-select: all client's ACTIVE credits with remaining, filter by the
  // matching engine, then narrowest-first (specificity) then FIFO.
  const candidates = await prisma.packageCredit.findMany({
    where: {
      // Same coarse DB filter as the explicit-creditId path — it still
      // helps cut down the candidate set, but real availability (including
      // reservedQuantity) is checked in JS below.
      usedQuantity: { lt: prisma.packageCredit.fields.totalQuantity },
      purchase: { clientId: cmd.clientId, status: PackagePurchaseStatus.ACTIVE },
    },
    orderBy: [{ purchase: { createdAt: 'asc' } }, { createdAt: 'asc' }],
    select,
  });
  const credit = candidates
    .filter((c) => hasAvailableCapacity(c) && creditMatchesTarget(c, target))
    .sort((a, b) => specificityScore(b) - specificityScore(a))[0];
  if (!credit) {
    throw new NotFoundException(
      'No matching package credit with remaining capacity for this client',
    );
  }
  return { credit, target, eligibility };
}
