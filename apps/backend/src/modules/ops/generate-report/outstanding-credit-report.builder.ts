import { PrismaService } from '../../../infrastructure/database';
import { PackagePurchaseStatus, Prisma } from '@prisma/client';

/**
 * Outstanding-credit liability is a point-in-time measure ("what does the
 * center still owe in pre-paid, unconsumed sessions right now"), so it carries
 * no date range. Params are accepted for builder-signature consistency.
 */
export type OutstandingCreditReportParams = Record<string, never> | { from?: Date; to?: Date };

export interface OutstandingCreditReportResult {
  /** Σ over remaining credits of (remaining × unitPriceSnapshot) — integer halalas. */
  outstandingLiability: number;
  /** Σ of remaining sessions across all active credits. */
  outstandingSessions: number;
  /** Number of credit buckets with remaining capacity. */
  creditCount: number;
}

/**
 * Outstanding credit report (liability): across ACTIVE purchases, the
 * paid-but-unconsumed liability on the center.
 *
 *   outstandingLiability = Σ (remaining × unitPriceSnapshot)
 *   outstandingSessions  = Σ remaining
 *   where remaining = totalQuantity − usedQuantity, over credits whose parent
 *   purchase is ACTIVE and which still have remaining > 0.
 */
export async function buildOutstandingCreditReport(
  prisma: PrismaService,
  _params: OutstandingCreditReportParams,
): Promise<OutstandingCreditReportResult> {
  const credits = await prisma.packageCredit.findMany({
    where: {
      // Column-to-column: remaining > 0 ⇔ usedQuantity < totalQuantity.
      usedQuantity: { lt: prisma.packageCredit.fields.totalQuantity },
      purchase: { is: { status: PackagePurchaseStatus.ACTIVE } },
    },
    select: { totalQuantity: true, usedQuantity: true, unitPriceSnapshot: true },
  });

  let liabilityDec = new Prisma.Decimal(0);
  let outstandingSessions = 0;
  let creditCount = 0;

  for (const c of credits) {
    const remaining = c.totalQuantity - c.usedQuantity;
    if (remaining <= 0) continue; // defensive — query already filters this
    creditCount += 1;
    outstandingSessions += remaining;
    liabilityDec = liabilityDec.plus(
      new Prisma.Decimal(c.unitPriceSnapshot.toString()).times(remaining),
    );
  }

  return {
    outstandingLiability: liabilityDec.toNumber(),
    outstandingSessions,
    creditCount,
  };
}
