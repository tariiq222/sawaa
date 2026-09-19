import { PrismaService } from '../../../infrastructure/database';
import { PackagePurchaseStatus, PaymentStatus, Prisma } from '@prisma/client';

export interface PackageSalesReportParams {
  from: Date;
  to: Date;
}

export interface PackageSalesReportResult {
  /** Number of package purchases sold (paidAt in range, including refunded purchases). */
  purchaseCount: number;
  /** Net revenue from settled package payments (integer halalas). */
  totalRevenue: number;
  /** Gross amount of settled package payments (integer halalas). */
  grossRevenue: number;
  /** Cumulative refund amount on settled package payments (integer halalas). */
  refundedAmount: number;
  /** Gross revenue less cumulative refunds (integer halalas). */
  netRevenue: number;
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
 * Revenue is taken from settled payments (COMPLETED, PARTIALLY_REFUNDED, or
 * REFUNDED) whose invoice is a package-purchase invoice
 * (`invoice.packagePurchaseId != null`), so booking payments never leak into the
 * package sales number. Refunds are cumulative on those payments and use the
 * payment's createdAt cohort; the refund-ledger report remains authoritative for
 * refund events by refundedAt. Purchase count comes from PackagePurchase rows
 * with `paidAt` in range whose status is ACTIVE, COMPLETED, or REFUNDED.
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
          in: [
            PackagePurchaseStatus.ACTIVE,
            PackagePurchaseStatus.COMPLETED,
            PackagePurchaseStatus.REFUNDED,
          ],
        },
      },
    }),
    prisma.payment.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        status: {
          in: [PaymentStatus.COMPLETED, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.REFUNDED],
        },
        invoice: { is: { packagePurchaseId: { not: null } } },
      },
      select: { amount: true, refundedAmount: true, method: true },
    }),
  ]);

  let grossRevenueDec = new Prisma.Decimal(0);
  let refundedAmountDec = new Prisma.Decimal(0);
  let netRevenueDec = new Prisma.Decimal(0);
  const cashDec = { v: new Prisma.Decimal(0) };
  const networkDec = { v: new Prisma.Decimal(0) };
  const electronicDec = { v: new Prisma.Decimal(0) };
  const methodAgg = new Map<string, { amount: Prisma.Decimal; count: number }>();

  for (const p of payments) {
    const gross = new Prisma.Decimal(p.amount.toString());
    const refunded = new Prisma.Decimal(p.refundedAmount?.toString() ?? '0');
    if (gross.isNegative() || refunded.isNegative() || refunded.greaterThan(gross)) {
      throw new Error('Invalid package payment amounts: refundedAmount must be between 0 and amount');
    }
    const net = gross.minus(refunded);
    grossRevenueDec = grossRevenueDec.plus(gross);
    refundedAmountDec = refundedAmountDec.plus(refunded);
    netRevenueDec = netRevenueDec.plus(net);

    if (p.method === 'CASH') {
      cashDec.v = cashDec.v.plus(net);
    } else if (NETWORK_METHODS.has(p.method)) {
      networkDec.v = networkDec.v.plus(net);
    } else if (ELECTRONIC_METHODS.has(p.method)) {
      electronicDec.v = electronicDec.v.plus(net);
    }

    const entry = methodAgg.get(p.method) ?? { amount: new Prisma.Decimal(0), count: 0 };
    entry.amount = entry.amount.plus(net);
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
    totalRevenue: netRevenueDec.toNumber(),
    grossRevenue: grossRevenueDec.toNumber(),
    refundedAmount: refundedAmountDec.toNumber(),
    netRevenue: netRevenueDec.toNumber(),
    byBucket: {
      cash: cashDec.v.toNumber(),
      network: networkDec.v.toNumber(),
      electronic: electronicDec.v.toNumber(),
    },
    byMethod,
  };
}
