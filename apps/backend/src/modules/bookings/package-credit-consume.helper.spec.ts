import { consumePackageCreditForBooking } from './package-credit-consume.helper';

function buildTx(usage: unknown, credit?: unknown, siblings?: unknown[]) {
  return {
    packageCreditUsage: {
      findFirst: jest.fn().mockResolvedValue(usage),
      update: jest.fn().mockResolvedValue({}),
    },
    packageCredit: {
      update: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue(credit ?? null),
      findMany: jest.fn().mockResolvedValue(siblings ?? []),
    },
    packagePurchase: { update: jest.fn().mockResolvedValue({}) },
  } as never;
}

describe('consumePackageCreditForBooking', () => {
  it('moves the session from reserved to used', async () => {
    const tx = buildTx({ id: 'u1', creditId: 'c1' }, {
      purchaseId: 'p1', totalQuantity: 2, usedQuantity: 1, reservedQuantity: 0,
    });

    await expect(consumePackageCreditForBooking(tx, 'b1')).resolves.toBe(true);

    expect((tx as never as ReturnType<typeof buildTx>).packageCreditUsage.update)
      .toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { status: 'CONSUMED' },
      });

    expect((tx as never as ReturnType<typeof buildTx>).packageCredit.update)
      .toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { reservedQuantity: { decrement: 1 }, usedQuantity: { increment: 1 } },
      });
  });

  it('does nothing when the booking has no reserved session', async () => {
    const tx = buildTx(null);
    await expect(consumePackageCreditForBooking(tx, 'b1')).resolves.toBe(false);

    expect((tx as never as ReturnType<typeof buildTx>).packageCreditUsage.update)
      .not.toHaveBeenCalled();
    expect((tx as never as ReturnType<typeof buildTx>).packageCredit.update)
      .not.toHaveBeenCalled();
  });

  it('auto-completes the purchase when every sibling credit is fully delivered', async () => {
    const tx = buildTx(
      { id: 'u1', creditId: 'c1' },
      { purchaseId: 'p1', totalQuantity: 1, usedQuantity: 1, reservedQuantity: 0 },
      [
        { totalQuantity: 1, usedQuantity: 1 },
        { totalQuantity: 2, usedQuantity: 2 },
      ],
    );

    await expect(consumePackageCreditForBooking(tx, 'b1')).resolves.toBe(true);

    expect((tx as never as ReturnType<typeof buildTx>).packagePurchase.update)
      .toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { status: 'COMPLETED' },
      });
  });

  it('does not complete the purchase when a sibling credit still has sessions left', async () => {
    const tx = buildTx(
      { id: 'u1', creditId: 'c1' },
      { purchaseId: 'p1', totalQuantity: 1, usedQuantity: 1, reservedQuantity: 0 },
      [
        { totalQuantity: 1, usedQuantity: 1 },
        { totalQuantity: 2, usedQuantity: 1 },
      ],
    );

    await expect(consumePackageCreditForBooking(tx, 'b1')).resolves.toBe(true);

    expect((tx as never as ReturnType<typeof buildTx>).packagePurchase.update)
      .not.toHaveBeenCalled();
  });
});
