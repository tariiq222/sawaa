import { PrismaService } from '../../../infrastructure/database';
import { PackagePurchaseStatus } from '@prisma/client';
import {
  allocatePurchaseNet,
  remainingCreditValue,
} from '../../finance/package-purchases/credit-value.helper';

/**
 * Outstanding-credit liability is a point-in-time measure ("what does the
 * center still owe in pre-paid, unconsumed sessions right now"), so it carries
 * no date range. Params are accepted for builder-signature consistency.
 */
export type OutstandingCreditReportParams = Record<string, never> | { from?: Date; to?: Date };

export interface OutstandingCreditReportResult {
  /** Value of remaining sessions at what clients actually paid — integer halalas. */
  outstandingLiability: number;
  /** Σ of remaining sessions across all active credits. */
  outstandingSessions: number;
  /** Number of credit buckets with remaining capacity. */
  creditCount: number;
  /**
   * Σ reservedQuantity across all active credits — outstanding sessions that
   * already have an appointment booked (reserved but not yet delivered).
   * Informational: it does not change outstandingLiability, which already
   * counts a reserved session as owed via usedQuantity staying untouched
   * until check-in.
   */
  reservedSessions: number;
}

/**
 * Outstanding credit report (liability) across ACTIVE purchases.
 *
 * Remaining sessions are valued at the net amount paid, not the list unit
 * price: a credit's net value (stored at purchase) is split evenly across its
 * sessions with the rounding remainder on the last one. Credits issued before
 * net values were stored take a share of their purchase's amount, allocated by
 * list value. A purchase never contributes more than it paid minus refunds.
 */
export async function buildOutstandingCreditReport(
  prisma: PrismaService,
  _params: OutstandingCreditReportParams,
): Promise<OutstandingCreditReportResult> {
  const purchases = await prisma.packagePurchase.findMany({
    where: { status: PackagePurchaseStatus.ACTIVE },
    select: {
      amountPaid: true,
      refundAmount: true,
      credits: {
        select: {
          unitPriceSnapshot: true,
          netValue: true,
          totalQuantity: true,
          usedQuantity: true,
          reservedQuantity: true,
        },
      },
    },
  });

  let outstandingLiability = 0;
  let outstandingSessions = 0;
  let creditCount = 0;
  let reservedSessions = 0;

  for (const purchase of purchases) {
    const purchaseNet = Math.max(
      0,
      Math.round(Number(purchase.amountPaid) - Number(purchase.refundAmount ?? 0)),
    );
    const fallbackShares = allocatePurchaseNet(
      purchaseNet,
      purchase.credits.map((c) => ({
        unitPriceSnapshot: Number(c.unitPriceSnapshot),
        totalQuantity: c.totalQuantity,
      })),
    );

    let purchaseLiability = 0;
    purchase.credits.forEach((c, index) => {
      // Reserved sessions are counted even off a fully-consumed credit's early
      // return below — they are still owed and still booked either way.
      reservedSessions += c.reservedQuantity;
      const remaining = c.totalQuantity - c.usedQuantity;
      if (remaining <= 0) return;
      creditCount += 1;
      outstandingSessions += remaining;
      const netValue = c.netValue != null ? Number(c.netValue) : fallbackShares[index];
      purchaseLiability += remainingCreditValue({
        netValue,
        totalQuantity: c.totalQuantity,
        usedQuantity: c.usedQuantity,
      });
    });

    outstandingLiability += Math.min(purchaseLiability, purchaseNet);
  }

  return { outstandingLiability, outstandingSessions, creditCount, reservedSessions };
}
