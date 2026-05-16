import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InvoiceView } from './invoice-view';
import type { InvoiceDetail } from './invoice.api';

const paid: InvoiceDetail = {
  id: 'abcdef1234',
  branchId: 'b1',
  clientId: 'c1',
  employeeId: 'e1',
  bookingId: 'bk1',
  subtotal: 100,
  discountAmt: 10,
  vatRate: 0.15,
  vatAmt: 13.5,
  total: 103.5,
  currency: 'SAR',
  status: 'PAID',
  issuedAt: '2026-04-17T10:00:00Z',
  dueAt: null,
  paidAt: '2026-04-17T10:05:00Z',
  createdAt: '2026-04-17T10:00:00Z',
};

describe('InvoiceView', () => {
  it('renders the short invoice id, totals breakdown, and PAID status', () => {
    render(<InvoiceView invoice={paid} />);
    expect(screen.getByRole('heading', { name: /فاتورة/i })).toBeTruthy();
    expect(screen.getByText('#abcdef12')).toBeTruthy();
    expect(screen.getByText('PAID')).toBeTruthy();
    expect(screen.getByText(/ضريبة القيمة المضافة \(15%\)/)).toBeTruthy();
    expect(screen.getByText('المجموع الفرعي')).toBeTruthy();
    expect(screen.getByText('الخصم')).toBeTruthy();
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
