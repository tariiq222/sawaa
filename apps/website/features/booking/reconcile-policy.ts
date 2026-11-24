/** 1-based poll attempts (after a pending-looking status read) that trigger an on-demand reconcile. */
export const RECONCILE_ATTEMPTS: readonly number[] = [3, 8];

/** Hard cap on reconcile calls per page visit (per booking). */
export const MAX_RECONCILE_CALLS = RECONCILE_ATTEMPTS.length;

export interface BookingStatusLike {
  status: string;
  paymentStatus: string;
}

/**
 * Whether the confirm page should ask the backend to reconcile with the gateway.
 * Only for a pending-looking poll on a scheduled attempt, within the call cap.
 */
export function shouldReconcile(attempt: number, pending: boolean, callsSoFar = 0): boolean {
  return pending && callsSoFar < MAX_RECONCILE_CALLS && RECONCILE_ATTEMPTS.includes(attempt);
}

/** Paid outcome carried by a status/reconcile payload, or null when it says nothing conclusive. */
export function paidPhase(data: BookingStatusLike | null | undefined): 'success' | 'deposit_paid' | null {
  if (!data) return null;
  if (data.status === 'DEPOSIT_PAID') return 'deposit_paid';
  if (data.paymentStatus === 'COMPLETED' || data.status === 'CONFIRMED') return 'success';
  return null;
}
