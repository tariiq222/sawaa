import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { CollectBookingPaymentHandler } from './collect-booking-payment.handler';

const BOOKING_ID = '00000000-0000-4000-a000-000000000001';
const INVOICE_ID = '00000000-0000-4000-a000-000000000010';
const PAYMENT_ID = '00000000-0000-4000-a000-000000000020';
const APPLIED_BY = '00000000-0000-4000-a000-000000000099';

const baseEnsured = {
  id: INVOICE_ID,
  subtotal: 40000,
  vatRate: 0,
  total: 40000,
  outstanding: 40000,
  status: 'ISSUED',
};

// The handler reads the invoice shape three times: pre-discount (step 1),
// post-discount / pre-payment (step 3), and post-payment (step 6). The
// post-payment read is the one returned in the response so the dashboard can
// surface the real outstanding + status. Tests that reach the post-payment
// step must mock all three calls explicitly; tests that early-return at
// outstanding <= 0 only need the first two.
function build() {
  const ensureBookingInvoice = {
    execute: jest.fn().mockResolvedValue({ ...baseEnsured }),
  };
  const applyInvoiceDiscount = { execute: jest.fn().mockResolvedValue({ id: INVOICE_ID }) };
  const processPayment = {
    // Echo the amount the caller asked processPayment to record — the handler
    // returns payment.amount verbatim, and a hardcoded 40000 breaks the partial
    // collection assertion below.
    execute: jest.fn().mockImplementation((cmd: { amount: number; method: PaymentMethod }) => ({
      id: PAYMENT_ID,
      invoiceId: INVOICE_ID,
      amount: cmd.amount,
      method: cmd.method,
      status: PaymentStatus.COMPLETED,
    })),
  };
  const handler = new CollectBookingPaymentHandler(
    ensureBookingInvoice as never,
    applyInvoiceDiscount as never,
    processPayment as never,
  );
  return { handler, ensureBookingInvoice, applyInvoiceDiscount, processPayment };
}

describe('CollectBookingPaymentHandler', () => {
  it('ensures the invoice, then records the full outstanding when amount is omitted', async () => {
    const { handler, ensureBookingInvoice, applyInvoiceDiscount, processPayment } = build();
    // Read 1: pre-discount. Read 2: post-discount / pre-payment (still 40000 —
    // no discount was applied). Read 3: post-payment — the handler must return
    // THIS snapshot in the response, not the pre-payment one.
    ensureBookingInvoice.execute
      .mockResolvedValueOnce({ ...baseEnsured })
      .mockResolvedValueOnce({ ...baseEnsured })
      .mockResolvedValueOnce({ ...baseEnsured, outstanding: 0, status: 'PAID' });

    const result = await handler.execute({
      bookingId: BOOKING_ID,
      appliedBy: APPLIED_BY,
      method: PaymentMethod.CASH,
    });

    expect(ensureBookingInvoice.execute).toHaveBeenCalledTimes(3);
    expect(ensureBookingInvoice.execute).toHaveBeenNthCalledWith(1, { bookingId: BOOKING_ID });
    expect(ensureBookingInvoice.execute).toHaveBeenNthCalledWith(2, { bookingId: BOOKING_ID });
    expect(ensureBookingInvoice.execute).toHaveBeenNthCalledWith(3, { bookingId: BOOKING_ID });
    expect(applyInvoiceDiscount.execute).not.toHaveBeenCalled();
    expect(processPayment.execute).toHaveBeenCalledWith({
      invoiceId: INVOICE_ID,
      amount: 40000,
      method: PaymentMethod.CASH,
      idempotencyKey: undefined,
    });
    expect(result.payment).toEqual({
      id: PAYMENT_ID,
      amount: 40000,
      method: PaymentMethod.CASH,
      status: 'COMPLETED',
    });
    // Response reflects POST-payment state: full collection settled the
    // outstanding to 0 and flipped the status to PAID.
    expect(result.invoice.outstanding).toBe(0);
    expect(result.invoice.status).toBe('PAID');
    expect(result.payment).not.toBeNull();
  });

  it('forwards an explicit amount when the caller asked for a partial collection', async () => {
    const { handler, ensureBookingInvoice, processPayment, applyInvoiceDiscount } = build();
    // Read 1: pre-discount. Read 2: pre-payment. Read 3: post-payment — after
    // collecting 15000 of a 40000 invoice, the remaining outstanding is 25000
    // and the status is still ISSUED (partial collection leaves the invoice
    // unpaid). The response must surface that remaining balance.
    ensureBookingInvoice.execute
      .mockResolvedValueOnce({ ...baseEnsured })
      .mockResolvedValueOnce({ ...baseEnsured })
      .mockResolvedValueOnce({ ...baseEnsured, outstanding: 25000 });

    const result = await handler.execute({
      bookingId: BOOKING_ID,
      appliedBy: APPLIED_BY,
      method: PaymentMethod.BANK_TRANSFER,
      amount: 15000,
      idempotencyKey: 'idem-1',
    });

    expect(ensureBookingInvoice.execute).toHaveBeenCalledTimes(3);
    expect(applyInvoiceDiscount.execute).not.toHaveBeenCalled();
    expect(processPayment.execute).toHaveBeenCalledWith({
      invoiceId: INVOICE_ID,
      amount: 15000,
      method: PaymentMethod.BANK_TRANSFER,
      idempotencyKey: 'idem-1',
    });
    expect(result.payment?.amount).toBe(15000);
    // Response reflects POST-payment state: remaining balance after a partial
    // collection is 40000 - 15000 = 25000.
    expect(result.invoice.outstanding).toBe(25000);
    expect(result.invoice.status).toBe('ISSUED');
  });

  it('applies the manual discount BEFORE recording the payment when discountAmt > 0', async () => {
    const { handler, ensureBookingInvoice, applyInvoiceDiscount, processPayment } = build();
    // Read 1: pre-discount (40000). Read 2: post-discount / pre-payment
    // (30000 — discountAmt=10000 reduced total+outstanding). Read 3:
    // post-payment — charging the full 30000 settles the invoice to 0/PAID.
    ensureBookingInvoice.execute
      .mockResolvedValueOnce({ ...baseEnsured })
      .mockResolvedValueOnce({ ...baseEnsured, outstanding: 30000, total: 30000 })
      .mockResolvedValueOnce({ ...baseEnsured, outstanding: 0, total: 0, status: 'PAID' });

    const result = await handler.execute({
      bookingId: BOOKING_ID,
      appliedBy: APPLIED_BY,
      method: PaymentMethod.MADA,
      discountAmt: 10000,
      discountReasonId: 'reason-1',
      note: 'approved by manager',
    });

    expect(ensureBookingInvoice.execute).toHaveBeenCalledTimes(3);
    expect(applyInvoiceDiscount.execute).toHaveBeenCalledWith({
      invoiceId: INVOICE_ID,
      appliedBy: APPLIED_BY,
      discountAmt: 10000,
      discountReasonId: 'reason-1',
      note: 'approved by manager',
    });
    // The PRE-payment read drives the charge: amount is 30000 (post-discount
    // outstanding), not 0 (post-payment outstanding). Using the post-payment
    // read to drive the charge would silently undercharge every partial
    // collection.
    expect(processPayment.execute).toHaveBeenCalledWith({
      invoiceId: INVOICE_ID,
      amount: 30000,
      method: PaymentMethod.MADA,
      idempotencyKey: undefined,
    });
    // Response reflects POST-payment state.
    expect(result.invoice.outstanding).toBe(0);
    expect(result.invoice.status).toBe('PAID');
  });

  it('skips applyInvoiceDiscount when discountAmt is 0 (no-op clear)', async () => {
    const { handler, ensureBookingInvoice, applyInvoiceDiscount, processPayment } = build();
    // Read 1: pre-discount. Read 2: pre-payment (no discount applied). Read 3:
    // post-payment — full collection leaves outstanding=0.
    ensureBookingInvoice.execute
      .mockResolvedValueOnce({ ...baseEnsured })
      .mockResolvedValueOnce({ ...baseEnsured })
      .mockResolvedValueOnce({ ...baseEnsured, outstanding: 0, status: 'PAID' });

    await handler.execute({
      bookingId: BOOKING_ID,
      appliedBy: APPLIED_BY,
      method: PaymentMethod.CASH,
      discountAmt: 0,
    });

    expect(ensureBookingInvoice.execute).toHaveBeenCalledTimes(3);
    expect(applyInvoiceDiscount.execute).not.toHaveBeenCalled();
    expect(processPayment.execute).toHaveBeenCalled();
  });

  it('skips processPayment and returns payment:null when outstanding is 0 after the discount', async () => {
    const { handler, ensureBookingInvoice, applyInvoiceDiscount, processPayment } = build();
    ensureBookingInvoice.execute
      .mockResolvedValueOnce({ ...baseEnsured })
      .mockResolvedValueOnce({ ...baseEnsured, outstanding: 0, total: 0, status: 'PAID' });

    const result = await handler.execute({
      bookingId: BOOKING_ID,
      appliedBy: APPLIED_BY,
      method: PaymentMethod.CASH,
      discountAmt: 40000,
      discountReasonId: 'reason-1',
    });

    // The handler short-circuits before processPayment, so only the two
    // pre-payment ensure reads fire — there is no post-payment read.
    expect(ensureBookingInvoice.execute).toHaveBeenCalledTimes(2);
    expect(applyInvoiceDiscount.execute).toHaveBeenCalled();
    expect(processPayment.execute).not.toHaveBeenCalled();
    expect(result.payment).toBeNull();
    expect(result.invoice.outstanding).toBe(0);
  });

  it('rejects ONLINE_CARD before invoking any composed handler', async () => {
    const { handler, ensureBookingInvoice, applyInvoiceDiscount, processPayment } = build();

    await expect(
      handler.execute({
        bookingId: BOOKING_ID,
        appliedBy: APPLIED_BY,
        method: PaymentMethod.ONLINE_CARD,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(ensureBookingInvoice.execute).not.toHaveBeenCalled();
    expect(applyInvoiceDiscount.execute).not.toHaveBeenCalled();
    expect(processPayment.execute).not.toHaveBeenCalled();
  });

  it('rejects COUPON before invoking any composed handler', async () => {
    const { handler, ensureBookingInvoice, applyInvoiceDiscount, processPayment } = build();

    await expect(
      handler.execute({
        bookingId: BOOKING_ID,
        appliedBy: APPLIED_BY,
        method: PaymentMethod.COUPON,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(ensureBookingInvoice.execute).not.toHaveBeenCalled();
    expect(applyInvoiceDiscount.execute).not.toHaveBeenCalled();
    expect(processPayment.execute).not.toHaveBeenCalled();
  });

  it('propagates ensureBookingInvoice NotFoundException without calling the rest of the pipeline', async () => {
    const { handler, ensureBookingInvoice, applyInvoiceDiscount, processPayment } = build();
    ensureBookingInvoice.execute.mockRejectedValueOnce(new NotFoundException('Booking missing not found'));

    await expect(
      handler.execute({
        bookingId: BOOKING_ID,
        appliedBy: APPLIED_BY,
        method: PaymentMethod.CASH,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(applyInvoiceDiscount.execute).not.toHaveBeenCalled();
    expect(processPayment.execute).not.toHaveBeenCalled();
  });

  it('propagates ensureBookingInvoice historical-import rejection without calling the rest of the pipeline', async () => {
    const { handler, ensureBookingInvoice, applyInvoiceDiscount, processPayment } = build();
    ensureBookingInvoice.execute.mockRejectedValueOnce(
      new BadRequestException('Historical bookings are read-only and cannot be invoiced'),
    );

    await expect(
      handler.execute({
        bookingId: BOOKING_ID,
        appliedBy: APPLIED_BY,
        method: PaymentMethod.CASH,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(applyInvoiceDiscount.execute).not.toHaveBeenCalled();
    expect(processPayment.execute).not.toHaveBeenCalled();
  });
});
