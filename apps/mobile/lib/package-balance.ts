import type { ClientPackagePurchase } from '@sawaa/shared/types';

/** Sessions left across the client's active packages. Null when there is nothing to show. */
export function summarizePackageBalance(
  purchases: ClientPackagePurchase[] | undefined,
): { remaining: number; total: number } | null {
  let remaining = 0;
  let total = 0;
  for (const purchase of purchases ?? []) {
    if (purchase.status !== 'ACTIVE') continue;
    for (const credit of purchase.credits) {
      total += credit.totalQuantity ?? 0;
      remaining += credit.remaining ?? 0;
    }
  }
  return total > 0 ? { remaining, total } : null;
}
