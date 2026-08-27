import { PackageCreditUsageStatus, PackagePurchaseStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import {
  reclaimPackageCreditForBooking,
  returnPackageCreditForBooking,
} from './package-credit-return.helper';

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

describe('reclaimPackageCreditForBooking', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns false (no-op) when the booking has no RETURNED usage', async () => {
    const tx = buildTx();
    tx.packageCreditUsage.findFirst.mockResolvedValue(null);

    const result = await reclaimPackageCreditForBooking(tx as never, BOOKING_ID);

    expect(result).toBe(false);
    expect(tx.packageCreditUsage.update).not.toHaveBeenCalled();
    expect(tx.packageCredit.update).not.toHaveBeenCalled();
  });

  describe('when the booking has a RETURNED usage to reclaim', () => {
    function mockReturned(tx: ReturnType<typeof buildTx>, credit: { totalQuantity: number; usedQuantity: number }) {
      tx.packageCreditUsage.findFirst.mockResolvedValue({
        id: USAGE_ID,
        creditId: CREDIT_ID,
        bookingId: BOOKING_ID,
        status: PackageCreditUsageStatus.RETURNED,
      });
      tx.packageCredit.findUnique.mockResolvedValue({
        id: CREDIT_ID,
        totalQuantity: credit.totalQuantity,
        usedQuantity: credit.usedQuantity,
      });
    }

    it('flips the usage row back to CONSUMED and clears returnedAt', async () => {
      const tx = buildTx();
      mockReturned(tx, { totalQuantity: 10, usedQuantity: 3 });

      const result = await reclaimPackageCreditForBooking(tx as never, BOOKING_ID);

      expect(result).toBe(true);
      expect(tx.packageCreditUsage.update).toHaveBeenCalledTimes(1);
      const call = tx.packageCreditUsage.update.mock.calls[0][0];
      expect(call.where).toEqual({ id: USAGE_ID });
      expect(call.data.status).toBe(PackageCreditUsageStatus.CONSUMED);
      expect(call.data.returnedAt).toBeNull();
    });

    it('increments credit.usedQuantity by exactly 1 via an id-keyed update', async () => {
      const tx = buildTx();
      mockReturned(tx, { totalQuantity: 10, usedQuantity: 3 });

      await reclaimPackageCreditForBooking(tx as never, BOOKING_ID);

      expect(tx.packageCredit.update).toHaveBeenCalledTimes(1);
      expect(tx.packageCredit.update).toHaveBeenCalledWith({
        where: { id: CREDIT_ID },
        data: { usedQuantity: { increment: 1 } },
      });
    });

    it('does NOT touch the parent purchase (reclaim is seat-only; auto-complete does not re-fire)', async () => {
      const tx = buildTx();
      mockReturned(tx, { totalQuantity: 10, usedQuantity: 3 });

      await reclaimPackageCreditForBooking(tx as never, BOOKING_ID);

      expect(tx.packagePurchase.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the credit bucket has no remaining capacity (usedQuantity >= totalQuantity)', async () => {
      const tx = buildTx();
      // Bucket is full — flipping the usage back would push the bucket past
      // totalQuantity. The transaction MUST roll back so staff can investigate.
      mockReturned(tx, { totalQuantity: 10, usedQuantity: 10 });

      await expect(
        reclaimPackageCreditForBooking(tx as never, BOOKING_ID),
      ).rejects.toThrow(BadRequestException);
      // No mutation must have happened — the throw must precede any write.
      expect(tx.packageCreditUsage.update).not.toHaveBeenCalled();
      expect(tx.packageCredit.update).not.toHaveBeenCalled();
    });

    it('is idempotent: a usage already CONSUMED is ignored (no double-increment)', async () => {
      const tx = buildTx();
      // findFirst is scoped to RETURNED only — a CONSUMED usage yields null,
      // proving a booking whose credit is already consumed cannot be re-claimed.
      tx.packageCreditUsage.findFirst.mockResolvedValue(null);

      const result = await reclaimPackageCreditForBooking(tx as never, BOOKING_ID);

      expect(result).toBe(false);
      expect(tx.packageCredit.update).not.toHaveBeenCalled();
    });
  });
});
