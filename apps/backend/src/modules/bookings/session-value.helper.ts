import { allocatePurchaseNet } from '../finance/package-purchases/credit-value.helper';

/**
 * `sessionValue` shown on a package-funded booking (list-bookings + get-booking)
 * is purely a display figure for the dashboard money column — the amount DUE
 * on a package booking stays zero regardless of what this returns.
 *
 * Precedence, mirroring the outstanding-credit report's fallback:
 *   1. `credit.netValue` when stored (credits created after phase 0) — split
 *      evenly across the credit's own sessions.
 *   2. Legacy credits with no stored `netValue`: take this credit's share of
 *      its purchase's net amount (amountPaid − refundAmount), allocated across
 *      ALL of the purchase's credits by list value via `allocatePurchaseNet`
 *      (the same helper `outstanding-credit-report.builder.ts` uses), then
 *      split that share across this credit's own sessions.
 * Returns null when the value cannot be resolved at all (no purchase, no
 * sibling credits, or a non-positive session count).
 */
export interface SessionValueCredit {
  id: string;
  netValue: unknown; // Prisma Decimal | number | null
  totalQuantity: number;
}

export interface SessionValuePurchase {
  amountPaid: unknown; // Prisma Decimal | number
  refundAmount: unknown; // Prisma Decimal | number | null
}

export interface SessionValueSiblingCredit {
  id: string;
  unitPriceSnapshot: unknown; // Prisma Decimal | number
  totalQuantity: number;
}

export function resolveSessionValue(
  credit: SessionValueCredit,
  purchase: SessionValuePurchase | null | undefined,
  siblingCredits: SessionValueSiblingCredit[],
): number | null {
  if (credit.totalQuantity <= 0) return null;

  if (credit.netValue != null) {
    return Math.floor(Number(credit.netValue) / credit.totalQuantity);
  }

  if (!purchase || siblingCredits.length === 0) return null;

  const purchaseNet = Number(purchase.amountPaid) - Number(purchase.refundAmount ?? 0);
  const shares = allocatePurchaseNet(
    purchaseNet,
    siblingCredits.map((c) => ({
      unitPriceSnapshot: Number(c.unitPriceSnapshot),
      totalQuantity: c.totalQuantity,
    })),
  );
  const index = siblingCredits.findIndex((c) => c.id === credit.id);
  if (index === -1) return null;

  return Math.floor(shares[index] / credit.totalQuantity);
}
