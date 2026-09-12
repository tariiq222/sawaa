import { PackagePurchaseStatus } from '@prisma/client';
import { lockPackagePurchase } from './package-purchase-lock.helper';

describe('lockPackagePurchase', () => {
  it('locks the parent purchase row before lifecycle mutations', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([
        { id: 'purchase-1', status: PackagePurchaseStatus.ACTIVE },
      ]),
    };

    await expect(lockPackagePurchase(tx as never, 'purchase-1')).resolves.toEqual({
      id: 'purchase-1',
      status: PackagePurchaseStatus.ACTIVE,
    });

    const [strings] = tx.$queryRaw.mock.calls[0];
    expect(strings.join(' ')).toContain('FROM "PackagePurchase"');
    expect(strings.join(' ')).toContain('FOR UPDATE');
  });

  it('returns null when the purchase disappeared before the lifecycle starts', async () => {
    const tx = { $queryRaw: jest.fn().mockResolvedValue([]) };

    await expect(lockPackagePurchase(tx as never, 'missing')).resolves.toBeNull();
  });
});
