export type ZohoDataCenter = "com" | "sa" | "eu" | "in" | "au" | "jp" | "ca"

export interface ZohoIntegrationStatus {
  isConfigured: boolean
  isActive: boolean
  dataCenter?: ZohoDataCenter
  zohoOrganizationName?: string
  zohoOrganizationId?: string
  webhookUrl?: string
  webhookConfigured?: boolean
  defaults?: {
    sendOnCreate: boolean
    itemId?: string
    branchId?: string
    paymentTerms?: string
  }
}

export interface ZohoConnectResponse {
  authUrl: string
}

export interface ZohoTestResponse {
  ok: boolean
  error?: string
  organizationName?: string
}

export interface ZohoUpdateConfigInput {
  sendOnCreate?: boolean
  itemId?: string
  branchId?: string
  paymentTerms?: string
}

export interface ZohoSelectOrgInput {
  zohoOrganizationId: string
}

export interface ZohoInvoiceLinkRow {
  deqahInvoiceId: string | null
  zohoInvoiceId: string
  status: string
  invoiceUrl: string | null
  pdfUrl: string | null
  viewedAt: string | null
  lastSentAt: string | null
  createdAt: string
}

export interface ZohoPaymentMirrorRow {
  paymentId: string
  amount: string | number
  currency: string
  method: string
  gatewayRef: string | null
  processedAt: string | null
  invoiceId: string
  clientId: string
  bookingId: string | null
  zohoMirror: ZohoInvoiceLinkRow | null
}

export interface ZohoPaymentMirrorsResponse {
  items: ZohoPaymentMirrorRow[]
  meta: { page: number; perPage: number; total: number; totalPages: number }
}
