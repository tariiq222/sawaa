import { createHash } from 'node:crypto';

export interface ClientCancellationSettings {
  clientCancellationPolicyEnabled?: boolean;
  clientCancelCutoffMode?: 'BEFORE_START' | 'BEFORE_CHECK_IN' | null;
  clientCancelBeforeHours?: number | null;
  earlyCancelRefundPercent?: number | null;
  freeCancelBeforeHours: number;
  freeCancelRefundType: string;
  lateCancelRefundPercent?: number;
  autoRefundOnCancel?: boolean;
  requireCancelApproval?: boolean;
}
export interface CancellationRefundSummary {
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
export interface ClientCancellationPreview {
  policyEnabled: boolean;
  requiresApproval: boolean;
  refundDecision: 'QUOTED' | 'AFTER_APPROVAL';
  canCancel: boolean;
  reasonCode: 'ALLOWED' | 'POLICY_NOT_CONFIGURED' | 'CUTOFF_PASSED' | 'ATTENDED' | 'FINAL_STATE' | 'HISTORICAL' | 'GROUP_STAFF_ONLY' | 'REFUND_REVIEW_REQUIRED';
  cutoffAt: string | null;
  quoteToken: string;
  refund: CancellationRefundSummary;
}
export interface CancellationRefundAllocation {
  paymentId: string;
  invoiceId: string;
  amount: number;
  execution: 'AUTOMATIC' | 'REVIEW';
  baselineRefundedAmount: number;
  baselinePendingAmount: number;
}
export interface ClientCancellationIntent {
  version: 1;
  initiatedBy: 'CLIENT';
  refund: CancellationRefundSummary;
  allocations: CancellationRefundAllocation[];
  pendingRequestIds?: string[];
}
export interface CancellationBooking {
  id: string; clientId: string; status: string; bookingType: string;
  scheduledAt: Date; endsAt: Date | null; checkedInAt: Date | null;
  isHistoricalImport: boolean; packageCreditId: string | null; currency: string;
}
export interface CancellationPayment {
  id: string; invoiceId: string; amount: unknown; refundedAmount: unknown;
  status: string; method: string; gatewayRef: string | null; currency: string;
  refundRequests: { id: string; amount: unknown; status: string }[];
}
export const RESERVED_REFUND_STATUSES = ['PENDING_REVIEW', 'APPROVED', 'PROCESSING', 'MANUAL_REVIEW'];
const halalas = (value: unknown): number => {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Invalid payment amount');
  return amount;
};
const percent = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;

export function calculateClientCancellation(
  booking: CancellationBooking,
  settings: ClientCancellationSettings,
  payments: CancellationPayment[],
  now = new Date(),
  legacyChannel: 'PUBLIC' | 'MOBILE' = 'PUBLIC',
): ClientCancellationPreview & { allocations: CancellationRefundAllocation[] } {
  const policyEnabled = settings.clientCancellationPolicyEnabled === true;
  if (!policyEnabled) return calculateLegacyCancellation(booking, settings, payments, now, legacyChannel);
  const configured = policyEnabled &&
    ['BEFORE_START', 'BEFORE_CHECK_IN'].includes(settings.clientCancelCutoffMode ?? '') &&
    (settings.clientCancelCutoffMode !== 'BEFORE_START' || (typeof settings.clientCancelBeforeHours === 'number' && Number.isFinite(settings.clientCancelBeforeHours) && settings.clientCancelBeforeHours >= 0)) &&
    Number.isFinite(settings.freeCancelBeforeHours) && settings.freeCancelBeforeHours >= 0 &&
    ['FULL', 'PARTIAL', 'NONE'].includes(settings.freeCancelRefundType) &&
    (settings.freeCancelRefundType !== 'PARTIAL' || percent(settings.earlyCancelRefundPercent)) &&
    percent(settings.lateCancelRefundPercent) && typeof settings.autoRefundOnCancel === 'boolean';
  const cutoffAt = settings.clientCancelCutoffMode === 'BEFORE_START' && typeof settings.clientCancelBeforeHours === 'number'
    ? new Date(booking.scheduledAt.getTime() - settings.clientCancelBeforeHours * 3600000)
    : settings.clientCancelCutoffMode === 'BEFORE_CHECK_IN' ? booking.endsAt : null;
  let reasonCode: ClientCancellationPreview['reasonCode'] = 'ALLOWED';
  if (booking.isHistoricalImport) reasonCode = 'HISTORICAL';
  else if (booking.bookingType === 'GROUP') reasonCode = 'GROUP_STAFF_ONLY';
  else if (booking.checkedInAt) reasonCode = 'ATTENDED';
  else if (!['PENDING', 'AWAITING_PAYMENT', 'CONFIRMED', 'DEPOSIT_PAID'].includes(booking.status)) reasonCode = 'FINAL_STATE';
  else if (!configured) reasonCode = 'POLICY_NOT_CONFIGURED';
  else if (!cutoffAt || (settings.clientCancelCutoffMode === 'BEFORE_START' ? now > cutoffAt : now >= cutoffAt)) reasonCode = 'CUTOFF_PASSED';
  const early = booking.scheduledAt.getTime() - now.getTime() >= settings.freeCancelBeforeHours * 3600000;
  const refundPercent = !configured ? 0 : early
    ? settings.freeCancelRefundType === 'FULL' ? 100 : settings.freeCancelRefundType === 'PARTIAL' ? settings.earlyCancelRefundPercent! : 0
    : settings.lateCancelRefundPercent!;
  const captured = payments.filter(p => ['COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(p.status)).sort((a, b) => a.id.localeCompare(b.id));
  const money = captured.map(p => ({
    ...p, amount: halalas(p.amount), refundedAmount: halalas(p.refundedAmount ?? 0),
    pending: p.refundRequests.filter(r => RESERVED_REFUND_STATUSES.includes(r.status)).reduce((n, r) => n + halalas(r.amount), 0),
  }));
  if (money.some(p => p.currency !== booking.currency)) throw new Error('Cancellation payments have inconsistent currencies');
  const paidAmount = money.reduce((n, p) => n + p.amount, 0);
  const alreadyRefundedAmount = money.reduce((n, p) => n + p.refundedAmount, 0);
  const pendingRefundAmount = money.reduce((n, p) => n + p.pending, 0);
  const refundable = money.reduce((n, p) => n + Math.max(0, p.amount - p.refundedAmount - p.pending), 0);
  const refundAmount = booking.packageCreditId ? 0 : Math.min(refundable, Math.max(0, Math.round(paidAmount * refundPercent / 100) - alreadyRefundedAmount - pendingRefundAmount));
  let remaining = refundAmount;
  const allocations: CancellationRefundAllocation[] = [];
  for (const p of money) {
    const amount = Math.min(remaining, Math.max(0, p.amount - p.refundedAmount - p.pending));
    if (!amount) continue;
    const automatic = settings.autoRefundOnCancel && p.method === 'ONLINE_CARD' && p.gatewayRef && p.refundedAmount === 0 && p.pending === 0;
    allocations.push({ paymentId: p.id, invoiceId: p.invoiceId, amount, execution: automatic ? 'AUTOMATIC' : 'REVIEW', baselineRefundedAmount: p.refundedAmount, baselinePendingAmount: p.pending });
    remaining -= amount;
  }
  const review = allocations.some(p => p.execution === 'REVIEW') || money.some(p => p.refundRequests.some(r => ['PENDING_REVIEW', 'MANUAL_REVIEW'].includes(r.status)));
  const execution = refundAmount > 0 || pendingRefundAmount > 0 ? review ? 'REVIEW' : 'AUTOMATIC' : 'NONE';
  const refund: CancellationRefundSummary = {
    status: booking.packageCreditId ? 'CREDIT_RETURNED' : !paidAmount ? 'NOT_APPLICABLE' : execution === 'NONE' ? 'NO_REFUND' : execution === 'REVIEW' ? 'PENDING_REVIEW' : 'PROCESSING',
    paidAmount, alreadyRefundedAmount, pendingRefundAmount, refundAmount, refundPercent,
    currency: booking.currency, execution, window: early ? 'EARLY' : 'LATE',
  };
  const quoteToken = createHash('sha256').update(JSON.stringify({
    booking, settings, reasonCode, refund,
    payments: money.map(p => ({ ...p, refundRequests: [...p.refundRequests].sort((a, b) => a.id.localeCompare(b.id)) })),
  })).digest('hex');
  return { policyEnabled, requiresApproval: false, refundDecision: 'QUOTED', canCancel: reasonCode === 'ALLOWED', reasonCode, cutoffAt: cutoffAt?.toISOString() ?? null, quoteToken, refund, allocations };
}

/** Preserve the existing legacy execution: one COMPLETED capture, with its legacy percentage. */
function calculateLegacyCancellation(
  booking: CancellationBooking, settings: ClientCancellationSettings, payments: CancellationPayment[],
  now: Date, channel: 'PUBLIC' | 'MOBILE',
): ClientCancellationPreview & { allocations: CancellationRefundAllocation[] } {
  const early = booking.scheduledAt.getTime() - now.getTime() >= settings.freeCancelBeforeHours * 3600000;
  const requiresApproval = settings.requireCancelApproval === true || (channel === 'PUBLIC' && !early);
  const partialPercent = typeof settings.lateCancelRefundPercent === 'number' && Number.isFinite(settings.lateCancelRefundPercent)
    ? Math.min(100, Math.max(0, Math.round(settings.lateCancelRefundPercent))) : 0;
  const paymentHold = channel === 'MOBILE' && ['AWAITING_PAYMENT', 'PENDING_GROUP_FILL'].includes(booking.status);
  const refundPercent = paymentHold ? 100 : early
    ? settings.freeCancelRefundType === 'FULL' ? 100 : settings.freeCancelRefundType === 'PARTIAL' ? partialPercent : 0
    : partialPercent;
  const ordered = [...payments].sort((a, b) => a.id.localeCompare(b.id));
  const selected = ordered.find(p => p.status === 'COMPLETED');
  const paidAmount = ordered.reduce((n, p) => n + halalas(p.amount), 0);
  const alreadyRefundedAmount = ordered.reduce((n, p) => n + halalas(p.refundedAmount ?? 0), 0);
  const pendingRefundAmount = ordered.flatMap(p => p.refundRequests).filter(r => RESERVED_REFUND_STATUSES.includes(r.status)).reduce((n, r) => n + halalas(r.amount), 0);
  // Approval does not promise a refund: staff may deny it or choose different terms.
  const refundAmount = requiresApproval || !selected ? 0 : Math.round(halalas(selected.amount) * refundPercent / 100);
  let reasonCode: ClientCancellationPreview['reasonCode'] = 'ALLOWED';
  if (booking.isHistoricalImport) reasonCode = 'HISTORICAL';
  else if (booking.bookingType === 'GROUP') reasonCode = 'GROUP_STAFF_ONLY';
  else if (booking.checkedInAt) reasonCode = 'ATTENDED';
  else if (!['PENDING', 'AWAITING_PAYMENT', 'CONFIRMED', 'DEPOSIT_PAID'].includes(booking.status)) reasonCode = 'FINAL_STATE';
  else if (!requiresApproval && selected && refundAmount > 0 && (
    selected.refundRequests.some(r => r.status === 'PROCESSING') ||
    refundAmount > halalas(selected.amount) - halalas(selected.refundedAmount ?? 0) ||
    (selected.method === 'ONLINE_CARD' && selected.gatewayRef && halalas(selected.refundedAmount ?? 0) > 0)
  )) reasonCode = 'REFUND_REVIEW_REQUIRED';
  const refund: CancellationRefundSummary = {
    status: requiresApproval ? 'PENDING_REVIEW' : booking.packageCreditId ? 'CREDIT_RETURNED' : !paidAmount ? 'NOT_APPLICABLE' : refundAmount ? 'PROCESSING' : 'NO_REFUND',
    paidAmount, alreadyRefundedAmount, pendingRefundAmount, refundAmount, refundPercent,
    currency: booking.currency, execution: requiresApproval ? 'REVIEW' : refundAmount ? 'AUTOMATIC' : 'NONE', window: early ? 'EARLY' : 'LATE',
  };
  const refundDecision = requiresApproval ? 'AFTER_APPROVAL' as const : 'QUOTED' as const;
  const quoteToken = createHash('sha256').update(JSON.stringify({ booking, settings, channel, requiresApproval, refundDecision, reasonCode, refund,
    payments: ordered.map(p => ({ ...p, refundRequests: [...p.refundRequests].sort((a, b) => a.id.localeCompare(b.id)) })),
  })).digest('hex');
  return { policyEnabled: false, requiresApproval, refundDecision, canCancel: reasonCode === 'ALLOWED', reasonCode, cutoffAt: null, quoteToken, refund, allocations: [] };
}
