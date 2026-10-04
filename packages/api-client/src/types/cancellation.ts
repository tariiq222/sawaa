/** Cancellation policy amounts are integer halalas. */
export interface CancellationRefund {
  status: 'NOT_APPLICABLE' | 'NO_REFUND' | 'PENDING_REVIEW' | 'PROCESSING' | 'CREDIT_RETURNED';
  paidAmount: number;
  alreadyRefundedAmount: number;
  pendingRefundAmount: number;
  refundAmount: number;
  refundPercent: number;
  currency: string;
  execution: 'NONE' | 'AUTOMATIC' | 'REVIEW';
  window: 'EARLY' | 'LATE';
}
export type PersistedCancellationRefund = Omit<CancellationRefund, 'status'> & {
  status: CancellationRefund['status'] | 'COMPLETED' | 'FAILED';
  completedAmount: number;
  failedAmount: number;
};
export interface CancellationPreview {
  policyEnabled: boolean;
  requiresApproval: boolean;
  refundDecision: 'QUOTED' | 'AFTER_APPROVAL';
  canCancel: boolean;
  reasonCode: 'ALLOWED' | 'POLICY_NOT_CONFIGURED' | 'CUTOFF_PASSED' | 'ATTENDED' | 'FINAL_STATE' | 'HISTORICAL' | 'GROUP_STAFF_ONLY' | 'REFUND_REVIEW_REQUIRED';
  cutoffAt: string | null;
  quoteToken: string;
  refund: CancellationRefund;
}
export interface CancellationQuoteInput { acceptedRefundTerms: true; quoteToken: string; sourceActionId?: string }
export interface ClientCancellationResult {
  status: string;
  booking: unknown;
  requiresApproval: boolean;
  refund?: CancellationRefund;
}
