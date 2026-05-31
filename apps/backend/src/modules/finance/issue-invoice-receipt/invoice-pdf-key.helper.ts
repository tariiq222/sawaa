/**
 * Invoice PDF objects live in the `finance-invoices` MinIO bucket under the
 * key `invoices/<invoiceId>/<timestamp>.pdf`. As of S2.3a the invoice row
 * stores the bare object KEY in `pdfUrl` (never a public URL), and read
 * endpoints / emails mint short-lived presigned URLs on demand.
 *
 * Older rows may still hold a full `http(s)://host/finance-invoices/<key>`
 * URL persisted before the fix. `extractInvoicePdfKey` normalises either form
 * back to the object key so a presigned URL can be generated for both.
 */
export const FINANCE_INVOICES_BUCKET_NAME = 'finance-invoices';

/**
 * Returns the MinIO object key for an invoice PDF given whatever is stored in
 * `invoice.pdfUrl`.
 *
 * - New rows store the bare key (`invoices/<id>/<ts>.pdf`) and are returned
 *   unchanged.
 * - Legacy rows store a full URL; everything up to and including
 *   `/finance-invoices/` is stripped so only the object key remains.
 */
export function extractInvoicePdfKey(stored: string): string {
  const marker = `/${FINANCE_INVOICES_BUCKET_NAME}/`;
  // Legacy full URL form: http(s)://host[:port]/finance-invoices/<key>
  if (/^https?:\/\//i.test(stored)) {
    const idx = stored.indexOf(marker);
    if (idx !== -1) {
      return stored.slice(idx + marker.length);
    }
    // URL without the expected bucket segment — fall back to the path tail.
    try {
      return new URL(stored).pathname.replace(/^\/+/, '');
    } catch {
      return stored;
    }
  }
  // Already a bare key.
  return stored;
}
