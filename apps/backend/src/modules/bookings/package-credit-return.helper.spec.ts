import { PackageCreditUsageStatus, PackagePurchaseStatus } from '@prisma/client';
import { BadRequestException, Logger } from '@nestjs/common';
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
    booking: {
      findUnique: jest.fn(),
    },
    // `SELECT ... FOR UPDATE` raw row-lock used by the package helpers. The
    // parent-purchase lock is active by default; tests script later lock rows
    // with mockResolvedValueOnce when they need a different result.
    $queryRaw: jest.fn().mockResolvedValue([{ id: PURCHASE_ID, status: PackagePurchaseStatus.ACTIVE }]),
  };
}

const CREDIT_ID = 'credit-1';
const PURCHASE_ID = 'purchase-1';
const USAGE_ID = 'usage-1';
const BOOKING_ID = 'book-1';

describe('returnPackageCreditForBooking', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns false (no-op) when the booking has no RESERVED or CONSUMED usage', async () => {
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
      tx.$queryRaw.mockResolvedValue([{ id: PURCHASE_ID, status: purchaseStatus }]);
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
      // First call (RESERVED/CONSUMED scoped) → null. Second call (any
      // status, the missing-row check) → the already-RETURNED row, so this
      // is recognized as ordinary idempotency, not a data problem.
      tx.packageCreditUsage.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'usage-1' });

      const result = await returnPackageCreditForBooking(tx as never, BOOKING_ID);

      expect(result).toBe(false);
      expect(tx.packageCredit.update).not.toHaveBeenCalled();
    });

    it('logs (does not throw) when the booking has NO PackageCreditUsage row at all', async () => {
      const errorSpy = jest.spyOn(Logger, 'error').mockImplementation(() => undefined);
      const tx = buildTx();
      tx.packageCreditUsage.findFirst.mockResolvedValue(null);

      const result = await returnPackageCreditForBooking(tx as never, BOOKING_ID);

      expect(result).toBe(false);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toContain(BOOKING_ID);
      errorSpy.mockRestore();
    });
  });

  describe('when the booking reserved a credit (not yet attended)', () => {
    function mockReserved(tx: ReturnType<typeof buildTx>) {
      tx.packageCreditUsage.findFirst.mockResolvedValue({
        id: USAGE_ID,
        creditId: CREDIT_ID,
        bookingId: BOOKING_ID,
        status: PackageCreditUsageStatus.RESERVED,
      });
      tx.packageCredit.findUnique.mockResolvedValue({ id: CREDIT_ID, purchaseId: PURCHASE_ID });
      tx.packagePurchase.findUnique.mockResolvedValue({ id: PURCHASE_ID, status: PackagePurchaseStatus.ACTIVE });
    }

    it('releases a reserved session back to the bucket on cancel', async () => {
      const tx = buildTx();
      mockReserved(tx);

      const result = await returnPackageCreditForBooking(tx as never, BOOKING_ID);

      expect(result).toBe(true);
      expect(tx.packageCredit.update).toHaveBeenCalledWith({
        where: { id: CREDIT_ID },
        data: { reservedQuantity: { decrement: 1 } },
      });
    });

    it('flips the reserved usage row to RETURNED with a returnedAt timestamp', async () => {
      const tx = buildTx();
      mockReserved(tx);

      await returnPackageCreditForBooking(tx as never, BOOKING_ID);

      expect(tx.packageCreditUsage.update).toHaveBeenCalledTimes(1);
      const call = tx.packageCreditUsage.update.mock.calls[0][0];
      expect(call.where).toEqual({ id: USAGE_ID });
      expect(call.data.status).toBe(PackageCreditUsageStatus.RETURNED);
      expect(call.data.returnedAt).toBeInstanceOf(Date);
    });

    it('does NOT decrement usedQuantity for a reserved (never-consumed) session', async () => {
      const tx = buildTx();
      mockReserved(tx);

      await returnPackageCreditForBooking(tx as never, BOOKING_ID);

      expect(tx.packageCredit.update).toHaveBeenCalledTimes(1);
      expect(tx.packageCredit.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: { usedQuantity: { decrement: 1 } } }),
      );
    });
  });
});

describe('returnPackageCreditForBooking — consumed vs reserved decrement target', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns a consumed session to used, not reserved', async () => {
    const tx = buildTx();
    tx.packageCreditUsage.findFirst.mockResolvedValue({
      id: USAGE_ID,
      creditId: CREDIT_ID,
      bookingId: BOOKING_ID,
      status: PackageCreditUsageStatus.CONSUMED,
    });
    tx.packageCredit.findUnique.mockResolvedValue({ id: CREDIT_ID, purchaseId: PURCHASE_ID });

    await returnPackageCreditForBooking(tx as never, BOOKING_ID);

    expect(tx.packageCredit.update).toHaveBeenCalledWith({
      where: { id: CREDIT_ID },
      data: { usedQuantity: { decrement: 1 } },
    });
  });
});

describe('reclaimPackageCreditForBooking', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns false (no-op) when the booking has no RETURNED usage', async () => {
    const tx = buildTx();
    tx.packageCreditUsage.findFirst.mockResolvedValue(null);

    const result = await reclaimPackageCreditForBooking(tx as never, BOOKING_ID, true);

    expect(result).toBe(false);
    expect(tx.packageCreditUsage.update).not.toHaveBeenCalled();
    expect(tx.packageCredit.update).not.toHaveBeenCalled();
  });

  describe('when the booking has a RETURNED usage to reclaim', () => {
    // `wasAttended` is the caller's pre-transaction snapshot — the helper no
    // longer reads `booking.checkedInAt` itself (see the helper's JSDoc for
    // why: the restore handler stamps checkedInAt in the same transaction,
    // so a self-read would always see "attended").
    function mockReturned(
      tx: ReturnType<typeof buildTx>,
      credit: { totalQuantity: number; usedQuantity: number; reservedQuantity?: number },
    ) {
      tx.packageCreditUsage.findFirst.mockResolvedValue({
        id: USAGE_ID,
        creditId: CREDIT_ID,
        bookingId: BOOKING_ID,
        status: PackageCreditUsageStatus.RETURNED,
      });
      tx.packageCredit.findUnique.mockResolvedValue({ id: CREDIT_ID, purchaseId: PURCHASE_ID });
      // The capacity check must read the row under `SELECT ... FOR UPDATE`,
      // not a plain findUnique — otherwise a concurrent booking can take the
      // last seat between the read and the write (TOCTOU).
      tx.$queryRaw.mockResolvedValue([
        {
          id: CREDIT_ID,
          totalQuantity: credit.totalQuantity,
          usedQuantity: credit.usedQuantity,
          reservedQuantity: credit.reservedQuantity ?? 0,
        },
      ]);
    }

    it('flips the usage row back to CONSUMED and clears returnedAt when the session was attended', async () => {
      const tx = buildTx();
      mockReturned(tx, { totalQuantity: 10, usedQuantity: 3 });

      const result = await reclaimPackageCreditForBooking(tx as never, BOOKING_ID, true);

      expect(result).toBe(true);
      expect(tx.packageCreditUsage.update).toHaveBeenCalledTimes(1);
      const call = tx.packageCreditUsage.update.mock.calls[0][0];
      expect(call.where).toEqual({ id: USAGE_ID });
      expect(call.data.status).toBe(PackageCreditUsageStatus.CONSUMED);
      expect(call.data.returnedAt).toBeNull();
    });

    it('increments credit.usedQuantity by exactly 1 via an id-keyed update when attended', async () => {
      const tx = buildTx();
      mockReturned(tx, { totalQuantity: 10, usedQuantity: 3 });

      await reclaimPackageCreditForBooking(tx as never, BOOKING_ID, true);

      expect(tx.packageCredit.update).toHaveBeenCalledTimes(1);
      expect(tx.packageCredit.update).toHaveBeenCalledWith({
        where: { id: CREDIT_ID },
        data: { usedQuantity: { increment: 1 } },
      });
    });

    it('reclaims a restored no-show back to reserved when it was never attended', async () => {
      const tx = buildTx();
      mockReturned(tx, { totalQuantity: 2, usedQuantity: 0, reservedQuantity: 0 });

      await reclaimPackageCreditForBooking(tx as never, BOOKING_ID, false);

      expect(tx.packageCreditUsage.update).toHaveBeenCalledWith({
        where: { id: USAGE_ID },
        data: { status: PackageCreditUsageStatus.RESERVED, returnedAt: null },
      });
      expect(tx.packageCredit.update).toHaveBeenCalledWith({
        where: { id: CREDIT_ID },
        data: { reservedQuantity: { increment: 1 } },
      });
    });

    it('does NOT touch the parent purchase (reclaim is seat-only; auto-complete does not re-fire)', async () => {
      const tx = buildTx();
      mockReturned(tx, { totalQuantity: 10, usedQuantity: 3 });

      await reclaimPackageCreditForBooking(tx as never, BOOKING_ID, true);

      expect(tx.packagePurchase.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the credit bucket has no remaining capacity (usedQuantity + reservedQuantity >= totalQuantity)', async () => {
      const tx = buildTx();
      // Bucket is full — flipping the usage back would push the bucket past
      // totalQuantity. The transaction MUST roll back so staff can investigate.
      mockReturned(tx, { totalQuantity: 10, usedQuantity: 10, reservedQuantity: 0 });

      await expect(
        reclaimPackageCreditForBooking(tx as never, BOOKING_ID, true),
      ).rejects.toThrow(BadRequestException);
      // No mutation must have happened — the throw must precede any write.
      expect(tx.packageCreditUsage.update).not.toHaveBeenCalled();
      expect(tx.packageCredit.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when reserved sessions alone fill the bucket (usedQuantity + reservedQuantity >= totalQuantity)', async () => {
      const tx = buildTx();
      // usedQuantity is 0 but reservedQuantity already fills the bucket —
      // the guard must count both counters, not usedQuantity alone.
      mockReturned(tx, { totalQuantity: 5, usedQuantity: 0, reservedQuantity: 5 });

      await expect(
        reclaimPackageCreditForBooking(tx as never, BOOKING_ID, false),
      ).rejects.toThrow(BadRequestException);
      expect(tx.packageCreditUsage.update).not.toHaveBeenCalled();
      expect(tx.packageCredit.update).not.toHaveBeenCalled();
    });

    it('is idempotent: a usage already CONSUMED is ignored (no double-increment)', async () => {
      const tx = buildTx();
      // First call (RETURNED-scoped) → null. Second call (any status, the
      // missing-row check) → the already-CONSUMED row, so this is ordinary
      // idempotency, not a data problem.
      tx.packageCreditUsage.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'usage-1' });

      const result = await reclaimPackageCreditForBooking(tx as never, BOOKING_ID, true);

      expect(result).toBe(false);
      expect(tx.packageCredit.update).not.toHaveBeenCalled();
    });

    it('logs (does not throw) when the booking has NO PackageCreditUsage row at all', async () => {
      const errorSpy = jest.spyOn(Logger, 'error').mockImplementation(() => undefined);
      const tx = buildTx();
      tx.packageCreditUsage.findFirst.mockResolvedValue(null);

      const result = await reclaimPackageCreditForBooking(tx as never, BOOKING_ID, true);

      expect(result).toBe(false);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toContain(BOOKING_ID);
      errorSpy.mockRestore();
    });

    it('takes a SELECT ... FOR UPDATE row lock on the credit before the capacity check (not a plain findUnique)', async () => {
      const tx = buildTx();
      mockReturned(tx, { totalQuantity: 10, usedQuantity: 3 });

      await reclaimPackageCreditForBooking(tx as never, BOOKING_ID, true);

      expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
      const [purchaseStrings] = tx.$queryRaw.mock.calls[0];
      const [creditStrings] = tx.$queryRaw.mock.calls[1];
      expect(purchaseStrings.join(' ')).toContain('"PackagePurchase"');
      expect(creditStrings.join(' ')).toContain('FOR UPDATE');
      // The immutable purchase reference is looked up before locking; the
      // mutable quantity read must still come from the locked raw row.
      expect(tx.packageCredit.findUnique).toHaveBeenCalledWith({
        where: { id: CREDIT_ID },
        select: { purchaseId: true },
      });
    });

    it('throws BadRequestException when the credit row is not found under lock', async () => {
      const tx = buildTx();
      tx.packageCreditUsage.findFirst.mockResolvedValue({
        id: USAGE_ID,
        creditId: CREDIT_ID,
        bookingId: BOOKING_ID,
        status: PackageCreditUsageStatus.RETURNED,
      });
      tx.packageCredit.findUnique.mockResolvedValue({ id: CREDIT_ID, purchaseId: PURCHASE_ID });
      tx.$queryRaw
        .mockResolvedValueOnce([{ id: PURCHASE_ID, status: PackagePurchaseStatus.ACTIVE }])
        .mockResolvedValueOnce([]);

      await expect(
        reclaimPackageCreditForBooking(tx as never, BOOKING_ID, true),
      ).rejects.toThrow(BadRequestException);
    });

    it('reads wasAttended from the caller argument, not from tx.booking, even when the booking row would say otherwise', async () => {
      // Regression test for the defect this fix addresses: the restore
      // handler stamps checkedInAt on the same booking row inside the same
      // transaction, so if this helper ever reads tx.booking again it would
      // always see "attended". Script tx.booking.findUnique to return an
      // attended booking while passing wasAttended=false, and assert the
      // RESERVED branch is still taken — proving the parameter, not the row,
      // controls the outcome.
      const tx = buildTx();
      mockReturned(tx, { totalQuantity: 10, usedQuantity: 0, reservedQuantity: 0 });
      tx.booking.findUnique.mockResolvedValue({ checkedInAt: new Date() });

      await reclaimPackageCreditForBooking(tx as never, BOOKING_ID, false);

      expect(tx.booking.findUnique).not.toHaveBeenCalled();
      expect(tx.packageCreditUsage.update).toHaveBeenCalledWith({
        where: { id: USAGE_ID },
        data: { status: PackageCreditUsageStatus.RESERVED, returnedAt: null },
      });
      expect(tx.packageCredit.update).toHaveBeenCalledWith({
        where: { id: CREDIT_ID },
        data: { reservedQuantity: { increment: 1 } },
      });
    });
  });
});
