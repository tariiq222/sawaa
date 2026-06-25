import { PrismaService } from '../../../infrastructure/database';
import { PackagePurchaseStatus, PaymentStatus, Prisma } from '@prisma/client';

export interface PackageSalesReportParams {
  from: Date;
  to: Date;
}

export interface PackageSalesReportResult {
  /** Number of package purchases sold (paidAt in range, not refunded). */
  purchaseCount: number;
  /** Σ of COMPLETED payments on package-purchase invoices (integer halalas). */
  totalRevenue: number;
  /**
   * Revenue grouped into the three operational channels the center reports on:
   *   cash       → CASH
   *   network    → MADA (mada POS terminal)
   *   electronic → ONLINE_CARD, TABBY, BANK_TRANSFER
   * (COUPON carries no real cash and is excluded from the buckets but still
   *  appears in `byMethod` for completeness.)
   */
  byBucket: { cash: number; network: number; electronic: number };
  /** Raw per-PaymentMethod breakdown so nothing is hidden by the bucketing. */
  byMethod: Array<{ method: string; amount: number; count: number }>;
}

const NETWORK_METHODS = new Set(['MADA']);
const ELECTRONIC_METHODS = new Set(['ONLINE_CARD', 'TABBY', 'BANK_TRANSFER']);

/**
 * Package sales report — count of purchases + total revenue within a date
 * range, broken down by payment method.
 *
 * Revenue is taken from COMPLETED payments whose invoice is a package-purchase
 * invoice (`invoice.packagePurchaseId != null`), so booking payments never leak
 * into the package sales number. Purchase count comes from PackagePurchase rows
 * with `paidAt` in range whose status is ACTIVE or COMPLETED (a REFUNDED
 * purchase is reported by the cancelled/refunded report, not as a sale).
 */
export async function buildPackageSalesReport(
  prisma: PrismaService,
  params: PackageSalesReportParams,
): Promise<PackageSalesReportResult> {
  const { from, to } = params;

  const [purchaseCount, payments] = await Promise.all([
    prisma.packagePurchase.count({
      where: {
        paidAt: { gte: from, lte: to },
        status: {
          in: [PackagePurchaseStatus.ACTIVE, PackagePurchaseStatus.COMPLETED],
        },
      },
    }),
    prisma.payment.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        status: PaymentStatus.COMPLETED,
        invoice: { is: { packagePurchaseId: { not: null } } },
      },
      select: { amount: true, method: true },
    }),
  ]);

  let totalRevenueDec = new Prisma.Decimal(0);
  const cashDec = { v: new Prisma.Decimal(0) };
  const networkDec = { v: new Prisma.Decimal(0) };
  const electronicDec = { v: new Prisma.Decimal(0) };
  const methodAgg = new Map<string, { amount: Prisma.Decimal; count: number }>();

  for (const p of payments) {
    const amt = new Prisma.Decimal(p.amount.toString());
    totalRevenueDec = totalRevenueDec.plus(amt);

    if (p.method === 'CASH') {
      cashDec.v = cashDec.v.plus(amt);
    } else if (NETWORK_METHODS.has(p.method)) {
      networkDec.v = networkDec.v.plus(amt);
    } else if (ELECTRONIC_METHODS.has(p.method)) {
      electronicDec.v = electronicDec.v.plus(amt);
    }

    const entry = methodAgg.get(p.method) ?? { amount: new Prisma.Decimal(0), count: 0 };
    entry.amount = entry.amount.plus(amt);
    entry.count += 1;
    methodAgg.set(p.method, entry);
  }

  const byMethod = [...methodAgg.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([method, v]) => ({
      method,
      amount: v.amount.toNumber(),
      count: v.count,
    }));

  return {
    purchaseCount,
    totalRevenue: totalRevenueDec.toNumber(),
    byBucket: {
      cash: cashDec.v.toNumber(),
      network: networkDec.v.toNumber(),
      electronic: electronicDec.v.toNumber(),
    },
    byMethod,
  };
}
