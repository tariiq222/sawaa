import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PackagePurchaseStatus, RefundStatus } from '@prisma/client';
import { RefundPackagePurchaseHandler } from './refund-package-purchase.handler';

const PURCHASE_ID = '00000000-0000-4000-a000-000000000007';
const INVOICE_ID = '00000000-0000-4000-a000-000000000010';
const PAYMENT_ID = '00000000-0000-4000-a000-000000000011';
const CLIENT_ID = '00000000-0000-4000-a000-000000000001';

function activePurchase(overrides: Record<string, unknown> = {}) {
  return {
    id: PURCHASE_ID,
    status: PackagePurchaseStatus.ACTIVE,
    amountPaid: 50_000,
    refundAmount: 0,
    clientId: CLIENT_ID,
    notes: null,
    ...overrides,
  };
}

function buildTx(opts: { purchaseRow?: unknown; updateManyCount?: number } = {}) {
  const purchaseRow =
    opts.purchaseRow === undefined ? activePurchase() : opts.purchaseRow;
  return {
    // FOR UPDATE lock on the PackagePurchase row (concurrency guard, P1-3).
    $queryRaw: jest.fn().mockResolvedValue(purchaseRow === null ? [] : [purchaseRow]),
    packagePurchase: {
      // updateMany with a status != REFUNDED guard — the in-tx terminal guard.
      updateMany: jest
        .fn()
        .mockResolvedValue({ count: opts.updateManyCount ?? 1 }),
    },
    packageCredit: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    invoice: {
      findFirst: jest.fn().mockResolvedValue({
        id: INVOICE_ID,
        total: 50_000,
        vatAmt: 0,
        refundedAmount: 0,
        currency: 'SAR',
        clientId: CLIENT_ID,
        payments: [{ id: PAYMENT_ID, refundedAmount: 0 }],
      }),
      update: jest.fn().mockResolvedValue({ id: INVOICE_ID }),
    },
    payment: { update: jest.fn().mockResolvedValue({ id: PAYMENT_ID }) },
    refundRequest: { create: jest.fn().mockResolvedValue({ id: 'rr-1' }) },
    // The credit-void uses a literal column expression — model the raw path too.
    $executeRaw: jest.fn().mockResolvedValue(2),
  };
}

function buildHandler(opts: { tx?: ReturnType<typeof buildTx> } = {}) {
  const tx = opts.tx ?? buildTx();
  const prisma = {};
  const rls = {
    withTransaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
  const handler = new RefundPackagePurchaseHandler(
    prisma as never,
    rls as never,
    eventBus as never,
  );
  return { handler, prisma, tx, rls, eventBus };
}

const cmd = (over: Record<string, unknown> = {}) => ({
  purchaseId: PURCHASE_ID,
  refundAmount: 50_000,
  notes: 'client moved abroad',
  userId: 'manager-1',
  ...over,
});

describe('RefundPackagePurchaseHandler', () => {
  afterEach(() => jest.clearAllMocks());

  it('404 when the purchase does not exist', async () => {
    const tx = buildTx({ purchaseRow: null });
    const { handler } = buildHandler({ tx });
    await expect(handler.execute(cmd())).rejects.toThrow(NotFoundException);
    expect(tx.packagePurchase.updateMany).not.toHaveBeenCalled();
  });

  it('400 when the purchase is already REFUNDED (double-refund rejected)', async () => {
    const tx = buildTx({
      purchaseRow: activePurchase({ status: PackagePurchaseStatus.REFUNDED }),
    });
    const { handler } = buildHandler({ tx });
    await expect(handler.execute(cmd())).rejects.toThrow(BadRequestException);
    expect(tx.packagePurchase.updateMany).not.toHaveBeenCalled();
  });

  it('locks the purchase row FOR UPDATE before mutating it (concurrency guard)', async () => {
    const { handler, tx } = buildHandler();
    await handler.execute(cmd());

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    const sql = tx.$queryRaw.mock.calls[0][0];
    const joined = Array.isArray(sql) ? sql.join('?') : String(sql);
    expect(joined).toContain('PackagePurchase');
    expect(joined).toContain('FOR UPDATE');
  });

  it('400 when refundAmount exceeds the outstanding balance', async () => {
    const { handler, tx } = buildHandler();
    await expect(handler.execute(cmd({ refundAmount: 60_000 }))).rejects.toThrow(BadRequestException);
    expect(tx.packagePurchase.updateMany).not.toHaveBeenCalled();
  });

  it('400 when the outstanding balance is already exhausted by a prior partial refund', async () => {
    // Purchase has 50_000 paid, 50_000 already refunded → outstanding 0.
    const tx = buildTx({
      purchaseRow: activePurchase({ refundAmount: 50_000 }),
    });
    const { handler } = buildHandler({ tx });
    await expect(handler.execute(cmd({ refundAmount: 1 }))).rejects.toThrow(BadRequestException);
    expect(tx.packagePurchase.updateMany).not.toHaveBeenCalled();
  });

  it('400 when refundAmount is negative', async () => {
    const { handler, tx } = buildHandler();
    await expect(handler.execute(cmd({ refundAmount: -1 }))).rejects.toThrow(BadRequestException);
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it('a concurrent refund that already flipped the row to REFUNDED is rejected (updateMany count 0)', async () => {
    // The FOR UPDATE read still sees ACTIVE (snapshot before the other tx
    // committed), but the guarded updateMany matches 0 rows → reject.
    const tx = buildTx({ updateManyCount: 0 });
    const { handler } = buildHandler({ tx });
    await expect(handler.execute(cmd())).rejects.toThrow(BadRequestException);
    // No money ledger / credit void may run once the guarded update failed.
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(tx.refundRequest.create).not.toHaveBeenCalled();
  });

  it('full refund sets the purchase to REFUNDED with refundedAt + cumulative refundAmount recorded', async () => {
    const { handler, tx } = buildHandler();
    const res = await handler.execute(cmd());

    expect(tx.packagePurchase.updateMany).toHaveBeenCalledTimes(1);
    const args = tx.packagePurchase.updateMany.mock.calls[0][0];
    expect(args.where).toEqual({
      id: PURCHASE_ID,
      status: { not: PackagePurchaseStatus.REFUNDED },
    });
    expect(args.data.status).toBe(PackagePurchaseStatus.REFUNDED);
    expect(args.data.refundedAt).toBeInstanceOf(Date);
    expect(Number(args.data.refundAmount)).toBe(50_000);
    expect(res.status).toBe(PackagePurchaseStatus.REFUNDED);
    expect(res.isFullRefund).toBe(true);
  });

  it('full refund voids all credits of the purchase (remaining → 0) so none stays bookable', async () => {
    const { handler, tx } = buildHandler();
    await handler.execute(cmd());

    // Credits are voided by setting usedQuantity = totalQuantity.
    expect(tx.$executeRaw).toHaveBeenCalled();
    const sql = tx.$executeRaw.mock.calls[0][0];
    // Tagged-template: the SQL strings array mentions PackageCredit + usedQuantity.
    const joined = Array.isArray(sql) ? sql.join('?') : String(sql);
    expect(joined).toContain('PackageCredit');
    expect(joined).toContain('usedQuantity');
  });

  // P1-2 regression: a PARTIAL money refund must NOT wipe the credits and must
  // keep the purchase ACTIVE so the still-paid sessions survive.
  it('partial refund (20k of 50k) keeps the purchase ACTIVE and does NOT void credits', async () => {
    const { handler, tx } = buildHandler();
    const res = await handler.execute(cmd({ refundAmount: 20_000 }));

    // Purchase stays ACTIVE — only refundAmount is updated (cumulative).
    const args = tx.packagePurchase.updateMany.mock.calls[0][0];
    expect(args.data.status).toBe(PackagePurchaseStatus.ACTIVE);
    expect(args.data.refundedAt).toBeUndefined();
    expect(Number(args.data.refundAmount)).toBe(20_000);

    // Credits are NOT voided on a partial refund.
    expect(tx.$executeRaw).not.toHaveBeenCalled();

    // The money ledger still records the partial refund.
    expect(tx.refundRequest.create).toHaveBeenCalledTimes(1);
    expect(Number(tx.refundRequest.create.mock.calls[0][0].data.amount)).toBe(20_000);

    expect(res.status).toBe(PackagePurchaseStatus.ACTIVE);
    expect(res.isFullRefund).toBe(false);
    expect(res.refundedAt).toBeNull();
    expect(res.totalRefunded).toBe(20_000);
  });

  it('partial refund accumulates with a prior partial refund and voids credits only on the closing refund', async () => {
    // 10k already refunded; refunding the remaining 40k closes the purchase.
    const tx = buildTx({ purchaseRow: activePurchase({ refundAmount: 10_000 }) });
    const { handler } = buildHandler({ tx });
    const res = await handler.execute(cmd({ refundAmount: 40_000 }));

    const args = tx.packagePurchase.updateMany.mock.calls[0][0];
    expect(args.data.status).toBe(PackagePurchaseStatus.REFUNDED);
    expect(Number(args.data.refundAmount)).toBe(50_000); // cumulative
    expect(tx.$executeRaw).toHaveBeenCalled(); // closing refund voids credits
    expect(res.isFullRefund).toBe(true);
    expect(res.totalRefunded).toBe(50_000);
  });

  it('records a COMPLETED RefundRequest against the purchase invoice + payment', async () => {
    const { handler, tx } = buildHandler();
    await handler.execute(cmd());

    expect(tx.refundRequest.create).toHaveBeenCalledTimes(1);
    const data = tx.refundRequest.create.mock.calls[0][0].data;
    expect(data.invoiceId).toBe(INVOICE_ID);
    expect(data.paymentId).toBe(PAYMENT_ID);
    expect(data.status).toBe(RefundStatus.COMPLETED);
    expect(Number(data.amount)).toBe(50_000);
    expect(data.processedBy).toBe('manager-1');
  });

  it('increments invoice + payment refundedAmount and flips status to REFUNDED on a full refund', async () => {
    const { handler, tx } = buildHandler();
    await handler.execute(cmd());

    const invArgs = tx.invoice.update.mock.calls[0][0];
    expect(invArgs.data.status).toBe('REFUNDED');
    expect(Number(invArgs.data.refundedAmount)).toBe(50_000);

    const payArgs = tx.payment.update.mock.calls[0][0];
    expect(payArgs.where).toEqual({ id: PAYMENT_ID });
    expect(payArgs.data.status).toBe('REFUNDED');
  });

  it('emits finance.refund.completed with bookingId = null (package refund) after commit', async () => {
    const { handler, eventBus } = buildHandler();
    await handler.execute(cmd());

    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    const [eventName, envelope] = eventBus.publish.mock.calls[0];
    expect(eventName).toBe('finance.refund.completed');
    expect(envelope.payload.bookingId).toBeNull();
    expect(envelope.payload.invoiceId).toBe(INVOICE_ID);
    expect(envelope.payload.amount).toBe(50_000);
  });

  it('allows a zero-amount refund (full cancellation with no money returned) and still voids credits', async () => {
    const { handler, tx } = buildHandler();
    const res = await handler.execute(cmd({ refundAmount: 0 }));

    expect(tx.packagePurchase.updateMany).toHaveBeenCalledTimes(1);
    // A zero-money refund is an explicit full cancellation → REFUNDED + voided.
    expect(tx.packagePurchase.updateMany.mock.calls[0][0].data.status).toBe(
      PackagePurchaseStatus.REFUNDED,
    );
    expect(res.isFullRefund).toBe(true);
    expect(tx.$executeRaw).toHaveBeenCalled(); // credits still voided
    // No money moved → no RefundRequest / invoice / payment mutation for 0.
    expect(tx.refundRequest.create).not.toHaveBeenCalled();
    expect(tx.invoice.update).not.toHaveBeenCalled();
    expect(tx.payment.update).not.toHaveBeenCalled();
  });

  it('does not require a payment row (cash purchase with invoice but no recorded payment voids credits + marks REFUNDED)', async () => {
    const tx = buildTx();
    tx.invoice.findFirst.mockResolvedValue({
      id: INVOICE_ID, total: 50_000, vatAmt: 0, refundedAmount: 0,
      currency: 'SAR', clientId: CLIENT_ID, payments: [],
    });
    const { handler } = buildHandler({ tx });

    // Should not throw even though there is no payment to refund-record against.
    await handler.execute(cmd());
    expect(tx.packagePurchase.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw).toHaveBeenCalled();
    // No payment → cannot create a payment-linked RefundRequest, but the
    // purchase is still marked REFUNDED (financial record kept on the purchase).
    expect(tx.refundRequest.create).not.toHaveBeenCalled();
  });
});
