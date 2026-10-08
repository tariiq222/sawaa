export type NativePaymentMethod = 'ONLINE_CARD' | 'APPLE_PAY';
export interface NativeApplePayConfig {
  merchantId: string;
  label: string;
  countryCode: 'SA';
}
export interface NativePaymentCapabilities {
  enabled: boolean;
  isLive: boolean;
  supportedNetworks: Array<'mada' | 'visa' | 'mastercard'>;
  applePay: NativeApplePayConfig | null;
}
export interface NativePaymentConfiguration extends NativePaymentCapabilities {
  publishableKey: string;
  givenId: string;
  amount: number;
  currency: string;
  description: string;
}
export interface NativePaymentInitResponse {
  paymentId: string;
  invoiceId: string;
  config: NativePaymentConfiguration;
}
export interface NativePackagePurchaseInitResponse extends NativePaymentInitResponse {
  purchaseId: string;
}
export interface NativePaymentReconcileResponse {
  paymentId: string;
  invoiceId: string;
  status:
    | 'PENDING'
    | 'COMPLETED'
    | 'FAILED'
    | 'PARTIALLY_REFUNDED'
    | 'REFUNDED';
  requiresReview: boolean;
  /** True only after provider404 for a current payable native reservation. */
  canCreatePayment?: boolean;
  unavailableReason?: 'BOOKING_EXPIRED' | 'BOOKING_CLOSED' | 'INVOICE_CLOSED';
}
