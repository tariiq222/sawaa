/**
 * The shared invoice handlers expose the frozen receipt object key as `pdfUrl`.
 * The /client surface never returns it; callers fetch a presigned URL from
 * `GET /client/invoices/:id/pdf` when `hasReceipt` is true.
 */
export function toClientInvoice<T extends { pdfUrl: string | null }>(invoice: T): Omit<T, 'pdfUrl'> & { hasReceipt: boolean } {
  const { pdfUrl, ...rest } = invoice;
  return { ...rest, hasReceipt: Boolean(pdfUrl) };
}
