import { PrismaService } from '../../../infrastructure/database';
import { PackagePurchaseStatus, Prisma } from '@prisma/client';

export interface RefundedPackagesReportParams {
  from: Date;
  to: Date;
}

export interface RefundedPackageItem {
  purchaseId: string;
  packageId: string;
  clientId: string;
  /** integer halalas */
  amountPaid: number;
  /** integer halalas */
  refundAmount: number;
  refundedAt: string;
  notes: string | null;
}

export interface RefundedPackagesReportResult {
  refundedCount: number;
  /** Σ of refundAmount across refunded purchases — integer halalas. */
  totalRefunded: number;
  items: RefundedPackageItem[];
}

/**
 * Cancelled/refunded packages report: the list + count of REFUNDED package
 * purchases whose `refundedAt` falls in the range, plus the total refunded.
 * In this domain "cancellation = refund" (one concept), so a refunded purchase
 * is the single REFUNDED state.
 */
export async function buildRefundedPackagesReport(
  prisma: PrismaService,
  params: RefundedPackagesReportParams,
): Promise<RefundedPackagesReportResult> {
  const { from, to } = params;

  const purchases = await prisma.packagePurchase.findMany({
    where: {
      status: PackagePurchaseStatus.REFUNDED,
      refundedAt: { gte: from, lte: to },
    },
    orderBy: { refundedAt: 'asc' },
    select: {
      id: true,
      packageId: true,
      clientId: true,
      amountPaid: true,
      refundAmount: true,
      refundedAt: true,
      notes: true,
    },
  });

  let totalRefundedDec = new Prisma.Decimal(0);
  const items: RefundedPackageItem[] = purchases.map((p) => {
    totalRefundedDec = totalRefundedDec.plus(new Prisma.Decimal(p.refundAmount.toString()));
    return {
      purchaseId: p.id,
      packageId: p.packageId,
      clientId: p.clientId,
      amountPaid: Math.round(Number(p.amountPaid.toString())),
      refundAmount: Math.round(Number(p.refundAmount.toString())),
      // refundedAt is non-null for REFUNDED rows; guard for the optional column type.
      refundedAt: (p.refundedAt ?? new Date(0)).toISOString(),
      notes: p.notes ?? null,
    };
  });

  return {
    refundedCount: purchases.length,
    totalRefunded: totalRefundedDec.toNumber(),
    items,
  };
}
