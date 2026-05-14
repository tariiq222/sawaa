import type { ZohoDataCenter } from './zoho-dc';

/**
 * Encrypted blob stored inside `Integration.config.ciphertext` for the
 * `provider = 'zoho-invoice'` row. All fields except `defaults` are required
 * once the OAuth dance completes.
 */
export interface ZohoIntegrationConfig {
  /** Long-lived OAuth refresh token issued by Zoho during /token exchange. */
  refreshToken: string;
  /** The `organization_id` Zoho Invoice expects in `X-com-zoho-invoice-organizationid`. */
  zohoOrganizationId: string;
  /** Display name of the Zoho org — for dashboard UI only. */
  zohoOrganizationName?: string;
  /** Data center the tenant authorised under (== where their data lives). */
  dataCenter: ZohoDataCenter;
  /** 32-byte hex secret we generated and asked the tenant to paste into Zoho's webhook config. */
  webhookSecret: string;
  /** Tenant-tunable defaults for invoice creation. */
  defaults: {
    /** When true, every newly created invoice is emailed automatically. */
    sendOnCreate: boolean;
    /** Optional Zoho item id to use as the line-item template; falls back to ad-hoc line items. */
    itemId?: string;
    /** Optional Zoho branch id (multi-branch Zoho orgs only). */
    branchId?: string;
    /** Free-text payment terms appended to invoices ("Net 0", "Due on receipt", etc.). */
    paymentTerms?: string;
  };
}

/** Public-facing status of the integration as surfaced to the dashboard. */
export interface ZohoIntegrationStatus {
  isConfigured: boolean;
  isActive: boolean;
  dataCenter?: ZohoDataCenter;
  zohoOrganizationName?: string;
  zohoOrganizationId?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  defaults?: ZohoIntegrationConfig['defaults'];
}

// ───────── Wire types — Zoho REST API responses ──────────────────────────

export interface ZohoOAuthTokenResponse {
  access_token: string;
  /** Refresh token is ONLY returned on the first /token call after `code` exchange. */
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  api_domain?: string;
  scope?: string;
}

export interface ZohoOrganizationListItem {
  organization_id: string;
  name: string;
  contact_name?: string;
  email?: string;
  is_default_org?: boolean;
  currency_code: string;
  currency_symbol?: string;
  time_zone?: string;
  country_code?: string;
}

export interface ZohoOrganizationListResponse {
  code: number;
  message: string;
  organizations: ZohoOrganizationListItem[];
}

export interface ZohoApiError {
  code: number;
  message: string;
}

// ───────── Resource shapes (subset of fields we read/write) ───────────────

export interface ZohoContact {
  contact_id: string;
  contact_name: string;
  email?: string;
  phone?: string;
  mobile?: string;
  status?: string;
  contact_persons?: ZohoContactPerson[];
}

export interface ZohoContactPerson {
  contact_person_id: string;
  email?: string;
  phone?: string;
  mobile?: string;
  is_primary_contact?: boolean;
}

export interface ZohoLineItem {
  /** Reference an existing Zoho item, or omit + supply `name`/`rate` for ad-hoc lines. */
  item_id?: string;
  name?: string;
  description?: string;
  rate: number;
  quantity: number;
  /** Discount/tax helpers can be added per Zoho docs; we keep this minimal. */
}

export interface ZohoInvoice {
  invoice_id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  status: string; // draft|sent|paid|partially_paid|void|overdue
  total: number;
  balance: number;
  currency_code: string;
  invoice_url?: string;
  /** Zoho's field name for the tenant-facing portal link is `invoice_url`. */
  pdf_url?: string;
  email?: string;
  date?: string;
  due_date?: string;
}

export interface ZohoCustomerPayment {
  payment_id: string;
  customer_id: string;
  amount: number;
  payment_mode: string;
  reference_number?: string;
  date: string;
}

export interface ZohoCreditNote {
  creditnote_id: string;
  creditnote_number: string;
  status: string;
  total: number;
  balance: number;
  customer_id: string;
}

// Zoho responses uniformly wrap the resource under a context key. The key
// argument is exposed on call sites for documentation purposes only — TS
// cannot use it to narrow the index signature with current tooling.
export interface ZohoEnvelope<_TKey extends string, TPayload> {
  code: number;
  message: string;
  [k: string]: unknown | TPayload;
}
