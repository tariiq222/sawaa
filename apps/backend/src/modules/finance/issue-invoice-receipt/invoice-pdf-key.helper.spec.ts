import { extractInvoicePdfKey } from './invoice-pdf-key.helper';

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
