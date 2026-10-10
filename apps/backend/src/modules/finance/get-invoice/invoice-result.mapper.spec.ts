import { mapInvoiceResult } from './invoice-result.mapper';

const invoice = {
  id: 'inv-1', branchId: 'branch-1', clientId: 'client-1', employeeId: 'employee-1',
  bookingId: null, packagePurchaseId: 'purchase-1', subtotal: '123.45', discountAmt: '3.45',
  vatRate: '0', vatAmt: '0', total: '120', refundedAmount: '20', refundedVatAmt: '0',
  currency: 'SAR', status: 'PAID', issuedAt: null, dueAt: new Date('2026-08-14T09:00:00Z'),
  paidAt: null, createdAt: new Date('2026-08-13T09:00:00Z'), pdfUrl: null,
};

describe('mapInvoiceResult', () => {
  it('preserves the exact public invoice fields, numeric conversion, and ISO dates', () => {
    expect(mapInvoiceResult(invoice as never, 'Clinic')).toEqual({
      id: 'inv-1', sellerName: 'Clinic', branchId: 'branch-1', clientId: 'client-1', employeeId: 'employee-1',
      bookingId: null, packagePurchaseId: 'purchase-1', subtotal: 123.45, discountAmt: 3.45,
      vatRate: 0, vatAmt: 0, total: 120, refundedAmount: 20, refundedVatAmt: 0,
      currency: 'SAR', status: 'PAID', issuedAt: null, dueAt: '2026-08-14T09:00:00.000Z',
      paidAt: null, createdAt: '2026-08-13T09:00:00.000Z', pdfUrl: null,
    });
  });
});
