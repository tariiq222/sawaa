import { computeRefundAccounting } from './refund-vat.helper';

// All amounts in HALALAS (integer). 115 SAR = 11500 halalas.

describe('computeRefundAccounting', () => {
  it('full refund of a 11500 halala invoice (10000 + 1500 VAT) returns REFUNDED + full VAT', () => {
    const r = computeRefundAccounting({
      invoiceTotal: 11500,
      invoiceVatAmt: 1500,
      alreadyRefundedAmount: 0,
      thisRefundAmount: 11500,
      isLastRefund: true,
    });
    expect(r.refundedVatPortion).toBe(1500);
    expect(r.newRefundedAmount).toBe(11500);
    expect(r.newRefundedVatAmt).toBe(1500);
    expect(r.newInvoiceStatus).toBe('REFUNDED');
  });

  it('half refund (5750 halalas) returns PARTIALLY_REFUNDED + half VAT', () => {
    const r = computeRefundAccounting({
      invoiceTotal: 11500,
      invoiceVatAmt: 1500,
      alreadyRefundedAmount: 0,
      thisRefundAmount: 5750,
    });
    expect(r.refundedVatPortion).toBe(750);
    expect(r.newRefundedAmount).toBe(5750);
    expect(r.newRefundedVatAmt).toBe(750);
    expect(r.newInvoiceStatus).toBe('PARTIALLY_REFUNDED');
  });

  it('cumulative second partial refund (isLastRefund) completes the invoice exactly', () => {
    const r = computeRefundAccounting({
      invoiceTotal: 11500,
      invoiceVatAmt: 1500,
      alreadyRefundedAmount: 5750,
      alreadyRefundedVatAmt: 750,
      thisRefundAmount: 5750,
      isLastRefund: true,
    });
    expect(r.newRefundedAmount).toBe(11500);
    expect(r.newRefundedVatAmt).toBe(1500);
    expect(r.newInvoiceStatus).toBe('REFUNDED');
  });

  it('zero-total invoice does not divide by zero', () => {
    const r = computeRefundAccounting({
      invoiceTotal: 0,
      invoiceVatAmt: 0,
      alreadyRefundedAmount: 0,
      thisRefundAmount: 0,
    });
    expect(r.refundedVatPortion).toBe(0);
    expect(r.newRefundedVatAmt).toBe(0);
    expect(r.newInvoiceStatus).toBe('REFUNDED');
  });

  it('1-halala tolerance — 11499 of 11500 still flips to REFUNDED', () => {
    const r = computeRefundAccounting({
      invoiceTotal: 11500,
      invoiceVatAmt: 1500,
      alreadyRefundedAmount: 0,
      thisRefundAmount: 11499,
      isLastRefund: true,
    });
    expect(r.newInvoiceStatus).toBe('REFUNDED');
  });

  it('partial refund without isLastRefund flag remains PARTIALLY_REFUNDED', () => {
    const r = computeRefundAccounting({
      invoiceTotal: 11500,
      invoiceVatAmt: 1500,
      alreadyRefundedAmount: 0,
      thisRefundAmount: 5000,
    });
    expect(r.newInvoiceStatus).toBe('PARTIALLY_REFUNDED');
  });

  it('drift-free: 5 equal partial refunds sum to exactly totalVat using remaining pattern', () => {
    // Invoice: 1000000 + 150000 VAT = 1150000 total halalas, 5 equal refunds of 230000
    const invoiceTotal = 1150000;
    const invoiceVat = 1500; // keep small invoice for test clarity: 11500 total
    // Actually use the 11500 invoice split into 5 unequal chunks
    const chunks = [2000, 2000, 2000, 2000, 3500]; // 11500 total
    let alreadyRefundedAmount = 0;
    let alreadyRefundedVatAmt = 0;

    for (let i = 0; i < chunks.length - 1; i++) {
      const r = computeRefundAccounting({
        invoiceTotal: 11500,
        invoiceVatAmt: 1500,
        alreadyRefundedAmount,
        alreadyRefundedVatAmt,
        thisRefundAmount: chunks[i],
      });
      alreadyRefundedAmount = r.newRefundedAmount;
      alreadyRefundedVatAmt = r.newRefundedVatAmt;
    }
    // Last chunk: use remaining pattern
    const last = computeRefundAccounting({
      invoiceTotal: 11500,
      invoiceVatAmt: 1500,
      alreadyRefundedAmount,
      alreadyRefundedVatAmt,
      thisRefundAmount: chunks[chunks.length - 1],
      isLastRefund: true,
    });
    expect(last.newRefundedVatAmt).toBe(1500); // exact, no drift
    expect(last.newInvoiceStatus).toBe('REFUNDED');
  });
});
