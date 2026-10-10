import { packageCreditGroupCreditSelect } from './package-credit-group-select';

describe('package credit group credit selection', () => {
  it('selects all fields needed for availability in both group and dependency credits', () => {
    expect(packageCreditGroupCreditSelect).toEqual({
      id: true,
      sessionPosition: true,
      totalQuantity: true,
      usedQuantity: true,
      reservedQuantity: true,
      usages: { select: { status: true, deliveredAt: true } },
    });
  });
});
