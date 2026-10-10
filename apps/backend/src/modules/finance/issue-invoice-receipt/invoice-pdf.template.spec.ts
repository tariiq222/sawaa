import * as React from 'react';
import { InvoicePdf, type InvoicePdfData } from './invoice-pdf.template';

/** Collect every string rendered below an element tree (function components are expanded). */
const collectText = (node: unknown): string[] => {
  if (node == null || typeof node === 'boolean') return [];
  if (typeof node === 'string' || typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(collectText);
  const el = node as React.ReactElement<{ children?: unknown }>;
  if (typeof el.type === 'function') {
    return collectText((el.type as (p: unknown) => unknown)(el.props));
  }
  return collectText(el.props?.children);
};

const render = (data: InvoicePdfData) => collectText(InvoicePdf({ data })).join('|');

const base: InvoicePdfData = {
  kind: 'statement',
  status: 'ISSUED',
  outstanding: 11500,
  invoiceNumber: 42,
  invoiceId: 'inv-1',
  issuedAt: new Date('2026-05-24T10:00:00Z'),
  paidAt: null,
  sellerNameAr: 'مركز سواء',
  sellerVatNumber: null,
  sellerAddress: null,
  logoUrl: null,
  brandColor: null,
  clientName: 'فاطمة',
  serviceName: 'استشارة أسرية',
  subtotal: 10000,
  discountAmt: 0,
  vatAmt: 1500,
  total: 11500,
  currency: 'SAR',
  paymentMethod: '—',
  payments: [],
  qrDataUrl: null,
};

describe('InvoicePdf template', () => {
  it('titles a statement «فاتورة» and shows status and outstanding, with no payment rows', () => {
    const text = render(base);
    expect(text).toContain('فاتورة');
    expect(text).not.toContain('إيصال دفع');
    expect(text).toContain('الحالة');
    expect(text).toContain('المبلغ المتبقي');
    expect(text).toContain('115.00');
    expect(text).not.toContain('تاريخ الدفع');
    expect(text).not.toContain('طريقة الدفع');
  });

  it('never renders a QR for a statement even if a data URL is supplied', () => {
    const text = collectText(InvoicePdf({ data: { ...base, qrDataUrl: 'data:image/png;base64,X' } }));
    expect(text.join('|')).not.toContain('امسح للتحقق');
  });

  it('titles a receipt «إيصال دفع» and lists every payment', () => {
    const text = render({
      ...base,
      kind: 'receipt',
      status: 'PAID',
      outstanding: 0,
      paidAt: new Date('2026-05-24T10:05:00Z'),
      paymentMethod: 'ONLINE_CARD',
      payments: [
        { date: new Date('2026-05-24T10:03:00Z'), method: 'CASH', amount: 5000, refundedAmount: 0 },
        { date: new Date('2026-05-24T10:05:00Z'), method: 'ONLINE_CARD', amount: 6500, refundedAmount: 0 },
      ],
    });
    expect(text).toContain('إيصال دفع');
    expect(text).toContain('تاريخ الدفع');
    expect(text).toContain('2026-05-24 13:03');
    expect(text).toContain('2026-05-24 13:05');
    expect(text).toContain('50.00');
    expect(text).toContain('65.00');
  });

  it('shows payment date and method on a PAID statement', () => {
    const text = render({
      ...base,
      status: 'PAID',
      outstanding: 0,
      paidAt: new Date('2026-05-24T10:05:00Z'),
      paymentMethod: 'CASH',
      payments: [{ date: new Date('2026-05-24T10:05:00Z'), method: 'CASH', amount: 11500, refundedAmount: 0 }],
    });
    expect(text).toContain('فاتورة');
    expect(text).toContain('تاريخ الدفع');
    expect(text).toContain('طريقة الدفع');
  });

  it('shows settled payments on refunded and partially paid statements, date only when paidAt exists', () => {
    const pay = [{ date: new Date('2026-05-24T10:05:00Z'), method: 'CASH', amount: 5000, refundedAmount: 0 }];
    for (const status of ['PARTIALLY_REFUNDED', 'REFUNDED']) {
      const text = render({ ...base, status, paidAt: new Date('2026-05-24T10:05:00Z'), paymentMethod: 'CASH', payments: pay });
      expect(text).toContain('طريقة الدفع');
      expect(text).toContain('تاريخ الدفع');
      expect(text).toContain('2026-05-24 13:05');
    }
    const partial = render({ ...base, status: 'PARTIALLY_PAID', paidAt: null, paymentMethod: 'CASH', payments: pay });
    expect(partial).toContain('2026-05-24 13:05');
    expect(partial).not.toContain('تاريخ الدفع');
    expect(render(base)).not.toContain('طريقة الدفع');
  });

  it('labels every PaymentMethod in plain Arabic', () => {
    const expected: Record<string, string> = {
      ONLINE_CARD: 'بطاقة إلكترونية', BANK_TRANSFER: 'تحويل بنكي', CASH: 'نقداً',
      COUPON: 'قسيمة', MADA: 'مدى', TABBY: 'تابي',
    };
    for (const [method, label] of Object.entries(expected)) {
      const text = render({
        ...base, kind: 'receipt', status: 'PAID', paidAt: new Date('2026-05-24T10:05:00Z'),
        paymentMethod: method,
        payments: [{ date: new Date('2026-05-24T10:05:00Z'), method, amount: 100, refundedAmount: 0 }],
      });
      expect(text).toContain(label);
      expect(text).not.toContain(method);
    }
  });

  it('titles a statement by VAT: simplified tax invoice with VAT, plain invoice without', () => {
    const withVat = render(base);
    expect(withVat).toContain('فاتورة ضريبية مبسطة');
    expect(withVat).toContain('SIMPLIFIED TAX INVOICE');
    const noVat = render({ ...base, vatAmt: 0, total: 10000, outstanding: 10000 });
    expect(noVat).not.toContain('ضريبية');
    expect(noVat).toContain('INVOICE');
    expect(noVat).not.toContain('SIMPLIFIED TAX INVOICE');
    const receipt = render({ ...base, kind: 'receipt', status: 'PAID' });
    expect(receipt).toContain('PAYMENT RECEIPT');
    expect(receipt).not.toContain('SIMPLIFIED TAX INVOICE');
  });
  it('renders a refunded amount as a separate negative line under its payment', () => {
    const text = render({
      ...base,
      status: 'PARTIALLY_REFUNDED',
      outstanding: 2000,
      total: 10000,
      paidAt: new Date('2026-05-24T10:05:00Z'),
      paymentMethod: 'CASH',
      payments: [
        { date: new Date('2026-05-24T10:05:00Z'), method: 'CASH', amount: 10000, refundedAmount: 2000 },
      ],
    });
    expect(text).toContain('100.00');
    expect(text).toContain('مبلغ مسترد');
    expect(text).toContain('مبلغ مسترد|-|20.00');
    const none = render({
      ...base,
      paymentMethod: 'CASH',
      payments: [{ date: new Date('2026-05-24T10:05:00Z'), method: 'CASH', amount: 5000, refundedAmount: 0 }],
    });
    expect(none).not.toContain('مبلغ مسترد');
  });

  it('formats dates in the business timezone (Asia/Riyadh), not UTC', () => {
    // 22:30Z on the 24th is 01:30 on the 25th in Riyadh (+03:00).
    const instant = new Date('2026-05-24T22:30:00Z');
    const text = render({
      ...base,
      status: 'PAID',
      outstanding: 0,
      issuedAt: instant,
      paidAt: instant,
      paymentMethod: 'CASH',
      payments: [{ date: instant, method: 'CASH', amount: 11500, refundedAmount: 0 }],
    });
    expect(text).toContain('2026-05-25');
    expect(text).toContain('2026-05-25 01:30');
    expect(text).not.toContain('2026-05-24');
  });
});
