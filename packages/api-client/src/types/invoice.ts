import type { paths } from './generated/openapi'
import type { PaginatedResponse, PaginationParams } from './api'


/**
 * List row of `GET /api/v1/dashboard/finance/invoices`.
 * NOT derived: the documented `InvoiceListRowDto` is a different contract
 * (`number`, `clientName`, `vatAmt`, decimal-string money, `hasPdf`), while
 * this legacy row uses `invoiceNumber`, `vatAmount`, `pdfUrl`, `paymentId`,
 * `groupEnrollmentId` and integrity hashes that no invoice schema documents.
 * Kept hand-written to preserve the exported contract.
 */
export interface InvoiceListItem {
  id: string
  paymentId: string | null
  groupEnrollmentId: string | null
  invoiceNumber: string
  pdfUrl: string | null
  sentAt: string | null
  vatAmount: number
  vatRate: number
  invoiceHash: string | null
  previousHash: string | null
  qrCodeData: string | null
  createdAt: string
  updatedAt: string
  payment?: InvoicePaymentInfo | null
}

/**
 * NOT derived: no documented invoice payment-summary schema. Kept hand-written
 * as a local projection.
 */
export interface InvoicePaymentInfo {
  id: string
  amount: number
  totalAmount: number
  status: string
  method: string
  booking?: {
    id: string
    client?: {
      id: string
      firstName: string
      lastName: string
    } | null
  } | null
}

/** NOT derived: no documented invoices-stats operation. Kept hand-written. */
export interface InvoiceStats {
  total: number
  sent: number
  pending: number
}

/**
 * Query of `GET /api/v1/dashboard/finance/invoices`, projected to paging plus
 * the date window the old type exposed.
 */
export type InvoiceListQuery = PaginationParams & {
  dateFrom?: NonNullable<
    paths['/api/v1/dashboard/finance/invoices']['get']['parameters']['query']
  >['fromDate']
  dateTo?: NonNullable<
    paths['/api/v1/dashboard/finance/invoices']['get']['parameters']['query']
  >['toDate']
}

export type InvoiceListResponse = PaginatedResponse<InvoiceListItem>
