import { Logger } from '@nestjs/common';
import { consumePackageCreditForBooking } from './package-credit-consume.helper';

/**
 * `anyUsage` scripts the SECOND findFirst call (no status filter — "does any
 * usage row exist for this booking at all") that only fires when the first,
 * RESERVED-scoped lookup (`usage`) comes back empty. Distinguishing the two
 * calls by whether `where.status` is present mirrors how the real Prisma args differ.
 */
function buildTx(usage: unknown, credit?: unknown, siblings?: unknown[], anyUsage: unknown = usage) {
  return {
    packageCreditUsage: {
      findFirst: jest.fn((args: { where?: Record<string, unknown> } = {}) =>
        Promise.resolve(args.where && 'status' in args.where ? usage : anyUsage),
      ),
      update: jest.fn().mockResolvedValue({}),
    },
    packageCredit: {
      update: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue(credit ?? null),
      findMany: jest.fn().mockResolvedValue(siblings ?? []),
    },
    packagePurchase: { update: jest.fn().mockResolvedValue({}) },
  };
}

describe('consumePackageCreditForBooking', () => {
  it('moves the session from reserved to used', async () => {
    const tx = buildTx({ id: 'u1', creditId: 'c1' }, {
      purchaseId: 'p1', totalQuantity: 2, usedQuantity: 1, reservedQuantity: 0,
    });

    await expect(consumePackageCreditForBooking(tx as never, 'b1')).resolves.toBe(true);

    expect(tx.packageCreditUsage.update)
      .toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { status: 'CONSUMED' },
      });

    expect(tx.packageCredit.update)
      .toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { reservedQuantity: { decrement: 1 }, usedQuantity: { increment: 1 } },
      });
  });

  it('does nothing when the booking has no reserved session (idempotent — a usage row exists in another status)', async () => {
    // anyUsage defaults to a row when not passed explicitly `null` here —
    // simulates a booking already CONSUMED, whose RESERVED-scoped lookup
    // legitimately comes back empty.
    const tx = buildTx(null, undefined, undefined, { id: 'already-consumed' });
    await expect(consumePackageCreditForBooking(tx as never, 'b1')).resolves.toBe(false);

    expect(tx.packageCreditUsage.update)
      .not.toHaveBeenCalled();
    expect(tx.packageCredit.update)
      .not.toHaveBeenCalled();
  });

  describe('observability for a missing usage row', () => {
    afterEach(() => jest.restoreAllMocks());

    it('logs when the booking has NO PackageCreditUsage row at all (data problem, not idempotency)', async () => {
      const errorSpy = jest.spyOn(Logger, 'error').mockImplementation(() => undefined);
      // Both the RESERVED-scoped lookup and the any-status lookup come back
      // empty — this booking never had a usage row recorded at all.
      const tx = buildTx(null, undefined, undefined, null);

      const result = await consumePackageCreditForBooking(tx as never, 'b1');

      expect(result).toBe(false);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toContain('b1');
      // Must not throw and must not alter any counters.
      expect(tx.packageCredit.update).not.toHaveBeenCalled();
    });

    it('does NOT log when a usage row exists in a different status (ordinary idempotent no-op)', async () => {
      const errorSpy = jest.spyOn(Logger, 'error').mockImplementation(() => undefined);
      const tx = buildTx(null, undefined, undefined, { id: 'already-consumed' });

      await consumePackageCreditForBooking(tx as never, 'b1');

      expect(errorSpy).not.toHaveBeenCalled();
    });
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

    await expect(consumePackageCreditForBooking(tx as never, 'b1')).resolves.toBe(true);

    expect(tx.packagePurchase.update)
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

    await expect(consumePackageCreditForBooking(tx as never, 'b1')).resolves.toBe(true);

    expect(tx.packagePurchase.update)
      .not.toHaveBeenCalled();
  });
});
