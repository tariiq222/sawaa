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
    clientId: CLIENT_ID,
    notes: null,
    ...overrides,
  };
}

function buildTx() {
  return {
    packagePurchase: { update: jest.fn().mockResolvedValue({ id: PURCHASE_ID }) },
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
    // The credit-update uses a literal column expression — model the raw path too.
    $executeRaw: jest.fn().mockResolvedValue(2),
  };
}

function buildHandler(opts: { purchase?: unknown; tx?: ReturnType<typeof buildTx> } = {}) {
  const tx = opts.tx ?? buildTx();
  const prisma = {
    packagePurchase: {
      findFirst: jest.fn().mockResolvedValue(
        opts.purchase === undefined ? activePurchase() : opts.purchase,
      ),
    },
  };
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
    const { handler, tx } = buildHandler({ purchase: null });
    await expect(handler.execute(cmd())).rejects.toThrow(NotFoundException);
    expect(tx.packagePurchase.update).not.toHaveBeenCalled();
  });

  it('400 when the purchase is already REFUNDED (double-refund rejected)', async () => {
    const { handler, tx } = buildHandler({
      purchase: activePurchase({ status: PackagePurchaseStatus.REFUNDED }),
    });
    await expect(handler.execute(cmd())).rejects.toThrow(BadRequestException);
    expect(tx.packagePurchase.update).not.toHaveBeenCalled();
  });

  it('400 when refundAmount exceeds amountPaid', async () => {
    const { handler, tx } = buildHandler();
    await expect(handler.execute(cmd({ refundAmount: 60_000 }))).rejects.toThrow(BadRequestException);
    expect(tx.packagePurchase.update).not.toHaveBeenCalled();
  });

  it('400 when refundAmount is negative', async () => {
    const { handler, tx } = buildHandler();
    await expect(handler.execute(cmd({ refundAmount: -1 }))).rejects.toThrow(BadRequestException);
    expect(tx.packagePurchase.update).not.toHaveBeenCalled();
  });

  it('sets the purchase to REFUNDED with refundedAt + refundAmount recorded', async () => {
    const { handler, tx } = buildHandler();
    await handler.execute(cmd());

    expect(tx.packagePurchase.update).toHaveBeenCalledTimes(1);
    const args = tx.packagePurchase.update.mock.calls[0][0];
    expect(args.where).toEqual({ id: PURCHASE_ID });
    expect(args.data.status).toBe(PackagePurchaseStatus.REFUNDED);
    expect(args.data.refundedAt).toBeInstanceOf(Date);
    expect(Number(args.data.refundAmount)).toBe(50_000);
  });

  it('voids all credits of the purchase (remaining → 0) so none stays bookable', async () => {
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

  it('allows a zero-amount refund (cancellation with no money returned) and still voids credits', async () => {
    const { handler, tx } = buildHandler();
    await handler.execute(cmd({ refundAmount: 0 }));

    expect(tx.packagePurchase.update).toHaveBeenCalledTimes(1);
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
    expect(tx.packagePurchase.update).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw).toHaveBeenCalled();
    // No payment → cannot create a payment-linked RefundRequest, but the
    // purchase is still marked REFUNDED (financial record kept on the purchase).
    expect(tx.refundRequest.create).not.toHaveBeenCalled();
  });
});
