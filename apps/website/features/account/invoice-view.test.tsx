import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InvoiceView } from './invoice-view';
import type { InvoiceDetail } from './invoice.api';

// All amounts are integer halalas (backend convention): 1 SAR = 100 halalas.
const paid: InvoiceDetail = {
  id: 'abcdef1234',
  branchId: 'b1',
  clientId: 'c1',
  employeeId: 'e1',
  bookingId: 'bk1',
  packagePurchaseId: null,
  subtotal: 10000,
  discountAmt: 1000,
  vatRate: 0.15,
  vatAmt: 1350,
  total: 10350,
  refundedAmount: 0,
  refundedVatAmt: 0,
  currency: 'SAR',
  status: 'PAID',
  issuedAt: '2026-04-17T10:00:00Z',
  dueAt: null,
  paidAt: '2026-04-17T10:05:00Z',
  createdAt: '2026-04-17T10:00:00Z',
};

/**
 * Mirrors the component's formatter — default locale in tests is 'ar'.
 * Non-breaking/narrow spaces are normalized to plain spaces because Testing
 * Library normalizes DOM whitespace before matching string matchers.
 */
function fmtSar(sar: number): string {
  return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' })
    .format(sar)
    .replace(/[\u00a0\u202f]/g, ' ');
}

describe('InvoiceView', () => {
  it('renders the short invoice id, totals breakdown, and localized PAID status', () => {
    render(<InvoiceView invoice={paid} />);
    expect(screen.getByRole('heading', { name: /فاتورة/i })).toBeTruthy();
    expect(screen.getByText('#abcdef12')).toBeTruthy();
    // Status is localized — no raw English enum leaks
    expect(screen.getByText('مدفوعة')).toBeTruthy();
    expect(screen.queryByText('PAID')).toBeNull();
    expect(screen.getByText(/ضريبة القيمة المضافة \(15%\)/)).toBeTruthy();
    expect(screen.getByText('المجموع الفرعي')).toBeTruthy();
    expect(screen.getByText('الخصم')).toBeTruthy();
  });

  it('converts halalas to SAR before formatting amounts (regression: 10350 halalas → 103.50 SAR)', () => {
    render(<InvoiceView invoice={paid} />);
    expect(screen.getByText(fmtSar(103.5))).toBeTruthy(); // total
    expect(screen.getByText(fmtSar(100))).toBeTruthy(); // subtotal
    expect(screen.getByText(`-${fmtSar(10)}`)).toBeTruthy(); // discount
    expect(screen.getByText(fmtSar(13.5))).toBeTruthy(); // VAT
    // Raw halalas must never be shown as SAR
    expect(screen.queryByText(fmtSar(10350))).toBeNull();
    expect(screen.queryByText(fmtSar(10000))).toBeNull();
  });

  it('converts the refunded amount from halalas before formatting', () => {
    render(<InvoiceView invoice={{ ...paid, refundedAmount: 5000 }} />);
    expect(screen.getByText(`-${fmtSar(50)}`)).toBeTruthy();
    expect(screen.queryByText(`-${fmtSar(5000)}`)).toBeNull();
  });

  it('renders the seller name from the invoice payload', () => {
    render(<InvoiceView invoice={{ ...paid, sellerName: 'مركز سواء' }} />);
    expect(screen.getByText('مركز سواء')).toBeTruthy();
  });

  it('hides the discount row when discountAmt is zero', () => {
    render(<InvoiceView invoice={{ ...paid, discountAmt: 0 }} />);
    expect(screen.queryByText('الخصم')).toBeNull();
  });

  it('calls window.print when the Print button is clicked', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<InvoiceView invoice={paid} />);
    fireEvent.click(screen.getByRole('button', { name: /طباعة الفاتورة/i }));
    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });
});
