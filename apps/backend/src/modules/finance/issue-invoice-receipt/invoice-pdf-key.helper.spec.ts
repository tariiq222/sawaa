import { extractInvoicePdfKey, resolveReceiptPdfKey } from './invoice-pdf-key.helper';

describe('extractInvoicePdfKey', () => {
  it('returns a bare key unchanged (new-row format)', () => {
    const key = 'invoices/abc-123/1700000000000.pdf';
    expect(extractInvoicePdfKey(key)).toBe(key);
  });

  it('extracts the key from a legacy full http URL', () => {
    const url = 'http://localhost:9000/finance-invoices/invoices/abc-123/1700000000000.pdf';
    expect(extractInvoicePdfKey(url)).toBe('invoices/abc-123/1700000000000.pdf');
  });

  it('extracts the key from a legacy full https URL with a host and no port', () => {
    const url = 'https://storage.example.com/finance-invoices/invoices/xyz/42.pdf';
    expect(extractInvoicePdfKey(url)).toBe('invoices/xyz/42.pdf');
  });

  it('falls back to the path tail when a legacy URL lacks the bucket segment', () => {
    const url = 'https://cdn.example.com/some/other/path.pdf';
    expect(extractInvoicePdfKey(url)).toBe('some/other/path.pdf');
  });

  it('does not treat a key that merely contains "finance-invoices" as a URL', () => {
    const key = 'invoices/finance-invoices-id/99.pdf';
    expect(extractInvoicePdfKey(key)).toBe(key);
  });
});

describe('resolveReceiptPdfKey', () => {
  const paidAt = new Date('2026-10-01T10:00:00Z');
  const base = { receiptPdfKey: null, pdfUrl: null, pdfGeneratedAt: null, paidAt };

  it('prefers receiptPdfKey over any legacy pdfUrl', () => {
    expect(
      resolveReceiptPdfKey({
        ...base,
        receiptPdfKey: 'receipts/inv/pay.pdf',
        pdfUrl: 'invoices/inv/1.pdf',
        pdfGeneratedAt: new Date('2026-10-02T00:00:00Z'),
      }),
    ).toBe('receipts/inv/pay.pdf');
  });

  it('accepts a legacy pdfUrl generated at or after payment as the receipt', () => {
    expect(
      resolveReceiptPdfKey({
        ...base,
        pdfUrl: 'http://minio:9000/finance-invoices/invoices/inv/2.pdf',
        pdfGeneratedAt: paidAt,
      }),
    ).toBe('invoices/inv/2.pdf');
  });

  it('rejects a legacy pdfUrl generated before payment (a statement, not a receipt)', () => {
    expect(
      resolveReceiptPdfKey({
        ...base,
        pdfUrl: 'invoices/inv/0.pdf',
        pdfGeneratedAt: new Date('2026-09-30T00:00:00Z'),
      }),
    ).toBeNull();
  });

  it('returns null for an unpaid invoice or one with no PDF', () => {
    expect(resolveReceiptPdfKey({ ...base, paidAt: null, pdfUrl: 'invoices/inv/3.pdf', pdfGeneratedAt: paidAt })).toBeNull();
    expect(resolveReceiptPdfKey(base)).toBeNull();
  });
});
