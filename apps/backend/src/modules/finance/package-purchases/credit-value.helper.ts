/**
 * Package credit valuation — integer halalas only.
 *
 * A credit's net value is what the client actually paid for its sessions
 * (after the item discount, with free sessions sharing the amount). Each
 * session carries floor(net / sessions); the rounding remainder sits on the
 * last session, so the sum always equals the net value exactly. Sessions are
 * consumed in order, so the remaining value is the net value minus the value
 * of the sessions already used.
 */

export interface CreditValueInput {
  netValue: number;
  totalQuantity: number;
  usedQuantity: number;
}

export function remainingCreditValue({ netValue, totalQuantity, usedQuantity }: CreditValueInput): number {
  const net = Math.max(0, Math.round(netValue));
  if (totalQuantity <= 0 || usedQuantity >= totalQuantity) return 0;
  const used = Math.max(0, usedQuantity);
  const unit = Math.floor(net / totalQuantity);
  return net - used * unit;
}

export interface LegacyCreditWeight {
  unitPriceSnapshot: number;
  totalQuantity: number;
}

/**
 * Fallback for credits issued before net values were stored: split a
 * purchase's net amount across its credits in proportion to their list value
 * (unit price × sessions). Exact for single-credit purchases; an estimate when
 * a purchase mixed items with different discounts.
 */
export function allocatePurchaseNet(purchaseNet: number, credits: LegacyCreditWeight[]): number[] {
  const net = Math.max(0, Math.round(purchaseNet));
  if (credits.length === 0) return [];
  const weights = credits.map((c) => Math.max(0, c.unitPriceSnapshot) * Math.max(0, c.totalQuantity));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const shares = credits.map((_, i) =>
    totalWeight > 0 ? Math.floor((net * weights[i]) / totalWeight) : Math.floor(net / credits.length),
  );
  const allocated = shares.slice(0, -1).reduce((sum, s) => sum + s, 0);
  shares[shares.length - 1] = net - allocated;
  return shares;
}
