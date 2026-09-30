import { summarizePackageBalance } from '../package-balance';
import type { ClientPackagePurchase } from '@sawaa/shared/types';

const purchase = (status: string, credits: Array<[number, number]>) =>
  ({ status, credits: credits.map(([totalQuantity, remaining]) => ({ totalQuantity, remaining })) }) as unknown as ClientPackagePurchase;

describe('summarizePackageBalance', () => {
  it('sums remaining and total sessions across active purchases only', () => {
    expect(summarizePackageBalance([
      purchase('ACTIVE', [[6, 4], [2, 2]]),
      purchase('COMPLETED', [[5, 0]]),
      purchase('REFUNDED', [[3, 3]]),
    ])).toEqual({ remaining: 6, total: 8 });
  });

  it('returns null when there is no active package', () => {
    expect(summarizePackageBalance(undefined)).toBeNull();
    expect(summarizePackageBalance([purchase('PENDING', [[4, 4]])])).toBeNull();
  });
});
