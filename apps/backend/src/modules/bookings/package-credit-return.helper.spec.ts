import { PackageCreditUsageStatus, PackagePurchaseStatus } from '@prisma/client';
import { returnPackageCreditForBooking } from './package-credit-return.helper';

/**
 * Build a minimal transaction-client stub exposing only the models the
 * credit-return helper touches. Each test scripts the responses it needs.
 */
function buildTx() {
  return {
    packageCreditUsage: {
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({ id: 'usage-1' }),
    },
    packageCredit: {
      update: jest.fn().mockResolvedValue({ id: 'credit-1' }),
      findUnique: jest.fn(),
    },
    packagePurchase: {
      update: jest.fn().mockResolvedValue({ id: 'purchase-1' }),
      findUnique: jest.fn(),
    },
  };
}

const CREDIT_ID = 'credit-1';
const PURCHASE_ID = 'purchase-1';
const USAGE_ID = 'usage-1';
const BOOKING_ID = 'book-1';

describe('returnPackageCreditForBooking', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns false (no-op) when the booking has no CONSUMED usage', async () => {
    const tx = buildTx();
    tx.packageCreditUsage.findFirst.mockResolvedValue(null);

    const result = await returnPackageCreditForBooking(tx as never, BOOKING_ID);

    expect(result).toBe(false);
    expect(tx.packageCreditUsage.update).not.toHaveBeenCalled();
    expect(tx.packageCredit.update).not.toHaveBeenCalled();
    expect(tx.packagePurchase.update).not.toHaveBeenCalled();
  });

  describe('when the booking consumed a credit', () => {
    function mockConsumed(tx: ReturnType<typeof buildTx>, purchaseStatus: PackagePurchaseStatus = PackagePurchaseStatus.ACTIVE) {
      tx.packageCreditUsage.findFirst.mockResolvedValue({
        id: USAGE_ID,
        creditId: CREDIT_ID,
        bookingId: BOOKING_ID,
        status: PackageCreditUsageStatus.CONSUMED,
      });
      tx.packageCredit.findUnique.mockResolvedValue({ id: CREDIT_ID, purchaseId: PURCHASE_ID });
      tx.packagePurchase.findUnique.mockResolvedValue({ id: PURCHASE_ID, status: purchaseStatus });
    }

    it('flips the usage row to RETURNED with a returnedAt timestamp', async () => {
      const tx = buildTx();
      mockConsumed(tx);

      const result = await returnPackageCreditForBooking(tx as never, BOOKING_ID);

      expect(result).toBe(true);
      expect(tx.packageCreditUsage.update).toHaveBeenCalledTimes(1);
      const call = tx.packageCreditUsage.update.mock.calls[0][0];
      expect(call.where).toEqual({ id: USAGE_ID });
      expect(call.data.status).toBe(PackageCreditUsageStatus.RETURNED);
      expect(call.data.returnedAt).toBeInstanceOf(Date);
    });

    it('decrements credit.usedQuantity by exactly 1 via an id-keyed update (not a nested save)', async () => {
      const tx = buildTx();
      mockConsumed(tx);

      await returnPackageCreditForBooking(tx as never, BOOKING_ID);

      expect(tx.packageCredit.update).toHaveBeenCalledTimes(1);
      expect(tx.packageCredit.update).toHaveBeenCalledWith({
        where: { id: CREDIT_ID },
        data: { usedQuantity: { decrement: 1 } },
      });
    });

    it('reopens the parent purchase to ACTIVE when it was COMPLETED', async () => {
      const tx = buildTx();
      mockConsumed(tx, PackagePurchaseStatus.COMPLETED);

      await returnPackageCreditForBooking(tx as never, BOOKING_ID);

      expect(tx.packagePurchase.update).toHaveBeenCalledTimes(1);
      expect(tx.packagePurchase.update).toHaveBeenCalledWith({
        where: { id: PURCHASE_ID },
        data: { status: PackagePurchaseStatus.ACTIVE },
      });
    });

    it('does NOT touch the purchase status when it was already ACTIVE', async () => {
      const tx = buildTx();
      mockConsumed(tx, PackagePurchaseStatus.ACTIVE);

      await returnPackageCreditForBooking(tx as never, BOOKING_ID);

      expect(tx.packagePurchase.update).not.toHaveBeenCalled();
    });

    it('does NOT reopen a REFUNDED purchase (a refunded purchase stays terminal)', async () => {
      const tx = buildTx();
      mockConsumed(tx, PackagePurchaseStatus.REFUNDED);

      await returnPackageCreditForBooking(tx as never, BOOKING_ID);

      expect(tx.packagePurchase.update).not.toHaveBeenCalled();
    });

    it('is idempotent: a usage already RETURNED is ignored (no double-decrement)', async () => {
      const tx = buildTx();
      // findFirst is scoped to CONSUMED usages only, so an already-returned
      // booking yields null — proving the same booking cannot be returned twice.
      tx.packageCreditUsage.findFirst.mockResolvedValue(null);

      const result = await returnPackageCreditForBooking(tx as never, BOOKING_ID);

      expect(result).toBe(false);
      expect(tx.packageCredit.update).not.toHaveBeenCalled();
    });
  });
});
