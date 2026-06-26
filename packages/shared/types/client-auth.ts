export interface ClientProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  emailVerified: string | null;
  phoneVerified: string | null;
  accountType: string;
  claimedAt: string | null;
  createdAt: string;
}

export interface ClientBookingItem {
  id: string;
  status: string;
  scheduledAt: string;
  endsAt: string;
  durationMins: number;
  price: string;
  currency: string;
  serviceId?: string;
  employeeId?: string;
  branchId?: string;
  serviceName: string;
  serviceNameAr: string | null;
  employeeName: string;
  employeeNameAr: string | null;
  branchName: string;
  branchNameAr: string | null;
  paymentStatus: string;
  createdAt: string;
  /** Invoice linked to this booking (null when no invoice exists yet). */
  invoiceId?: string | null;
  /** Status of the linked invoice (e.g. ISSUED, PAID) or null. */
  invoiceStatus?: string | null;
  /** How the session is delivered. */
  deliveryType?: 'IN_PERSON' | 'ONLINE';
  /** Zoom join URL for ONLINE sessions (null until generated). */
  zoomJoinUrl?: string | null;
}

export interface ClientBookingListResponse {
  items: ClientBookingItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UpdateClientProfilePayload {
  name?: string;
  phone?: string;
}

export type ClientInvoiceStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED'
  | 'VOID';

/** Invoice row returned by GET /public/me/invoices. All amounts are integer halalas. */
export interface ClientInvoiceItem {
  id: string;
  number: number;
  bookingId: string | null;
  serviceName: string;
  scheduledAt: string | null;
  subtotal: number;
  discountAmt: number;
  vatRate: number;
  vatAmt: number;
  total: number;
  refundedAmount: number;
  currency: string;
  status: ClientInvoiceStatus;
  paymentStatus: string | null;
  issuedAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface ClientInvoiceListResponse {
  items: ClientInvoiceItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ClientAuthResponse {
  clientId: string;
}

export interface ClientLoginPayload {
  email: string;
  password: string;
}

export interface ClientRegisterPayload {
  otpSessionToken: string;
  password: string;
  name?: string;
}

export interface CancelMyBookingPayload {
  reason?: string;
}

export interface RescheduleMyBookingPayload {
  newScheduledAt: string;
  newDurationMins?: number;
}
