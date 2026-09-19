import { Injectable } from '@nestjs/common';
import { PackagePurchaseStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import {
  creditMatchesTarget,
  specificityScore,
} from '../package-credit-matching.helper';
import { getPackageCreditAvailability } from '../package-credit-availability.helper';
import { GetMatchingCreditsDto } from './get-matching-credits.dto';

export type GetMatchingCreditsQuery = GetMatchingCreditsDto;

export interface MatchingCredit {
  creditId: string;
  purchaseId: string;
  // null on flexible (rule-based) credits, which are not pinned to one triple.
  serviceId: string | null;
  employeeId: string | null;
  durationOptionId: string | null;
  totalQuantity: number;
  usedQuantity: number;
  // Booked but not-yet-delivered sessions; they occupy a seat like a used one.
  reservedQuantity: number;
  remaining: number;
  createdAt: Date;
  modelVersion: 'LEGACY' | 'GROUPED_V2';
  purchaseGroupId: string | null;
  sessionPosition: number | null;
  groupLabel: string | null;
  sequenceMode: 'ORDERED' | 'UNORDERED' | null;
  dependsOnGroupId: string | null;
  availability: { bookable: boolean; reason: string | null };
}

/**
 * Return a client's ACTIVE session-package credits eligible for the given
 * booking target (service, employee, duration[, delivery type]) with remaining
 * capacity. Ordered by consumption priority: narrowest credit first (highest
 * specificity), then FIFO (oldest purchase, then oldest credit).
 *
 * Read-only suggestion source for the dashboard booking wizard.
 */
@Injectable()
export class GetMatchingCreditsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetMatchingCreditsQuery): Promise<MatchingCredit[]> {
    const credits = await this.prisma.packageCredit.findMany({
      where: {
        purchase: {
          clientId: query.clientId,
          status: PackagePurchaseStatus.ACTIVE,
        },
      },
      orderBy: [{ purchase: { createdAt: 'asc' } }, { createdAt: 'asc' }],
      select: {
        id: true,
        purchaseId: true,
        serviceId: true,
        employeeId: true,
        durationOptionId: true,
        totalQuantity: true,
        usedQuantity: true,
        reservedQuantity: true,
        purchaseGroupId: true,
        sessionPosition: true,
        createdAt: true,
        purchase: { select: { modelVersion: true } },
        purchaseGroup: {
          select: {
            id: true,
            label: true,
            sequenceMode: true,
            dependsOnGroupId: true,
            credits: {
              select: {
                id: true,
                sessionPosition: true,
                totalQuantity: true,
                usedQuantity: true,
                reservedQuantity: true,
                usages: { select: { status: true, deliveredAt: true } },
              },
            },
            dependsOnGroup: {
              select: {
                credits: {
                  select: {
                    id: true,
                    sessionPosition: true,
                    totalQuantity: true,
                    usedQuantity: true,
                    reservedQuantity: true,
                    usages: { select: { status: true, deliveredAt: true } },
                  },
                },
              },
            },
          },
        },
        constraints: {
          select: {
            dimension: true,
            mode: true,
            targets: { select: { targetId: true } },
          },
        },
      },
    });

    const target = {
      serviceId: query.serviceId,
      employeeId: query.employeeId,
      durationOptionId: query.durationOptionId,
      deliveryType: query.deliveryType ?? null,
    };

    return credits
      // A reserved session belongs to an appointment that hasn't happened yet —
      // it occupies a seat exactly like a delivered one, so it can't be offered again.
      .filter((c) => creditMatchesTarget(c, target))
      .map((c) => {
        const group = c.purchaseGroup;
        const availability = getPackageCreditAvailability({
          modelVersion: c.purchase?.modelVersion,
          purchaseStatus: PackagePurchaseStatus.ACTIVE,
          totalQuantity: c.totalQuantity,
          usedQuantity: c.usedQuantity,
          reservedQuantity: c.reservedQuantity,
          sequenceMode: group?.sequenceMode,
          sessionPosition: c.sessionPosition,
          creditId: c.id,
          purchaseGroupId: group?.id,
          usages: group?.credits.find((credit) => credit.id === c.id)?.usages,
          dependsOnGroupId: group?.dependsOnGroupId,
          dependencyCredits: group?.dependsOnGroup?.credits,
          groupCredits: group?.credits,
        });
        return { c, availability };
      })
      .filter(({ availability }) => availability.bookable)
      // Narrowest first, then keep the DB's FIFO order (stable sort).
      .sort((a, b) => specificityScore(b.c) - specificityScore(a.c))
      .map(({ c, availability }) => ({
        creditId: c.id,
        purchaseId: c.purchaseId,
        serviceId: c.serviceId,
        employeeId: c.employeeId,
        durationOptionId: c.durationOptionId,
        totalQuantity: c.totalQuantity,
        usedQuantity: c.usedQuantity,
        reservedQuantity: c.reservedQuantity,
        remaining: c.totalQuantity - c.usedQuantity - c.reservedQuantity,
        createdAt: c.createdAt,
        modelVersion: c.purchase?.modelVersion === 'GROUPED_V2' ? 'GROUPED_V2' : 'LEGACY',
        purchaseGroupId: c.purchaseGroupId ?? null,
        sessionPosition: c.sessionPosition ?? null,
        groupLabel: c.purchaseGroup?.label ?? null,
        sequenceMode: c.purchaseGroup?.sequenceMode ?? null,
        dependsOnGroupId: c.purchaseGroup?.dependsOnGroupId ?? null,
        availability,
      }));
  }
}
