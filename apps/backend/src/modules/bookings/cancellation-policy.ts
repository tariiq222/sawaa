/**
 * Cancellation Policy — shared refund/penalty calculation
 * =========================================================
 * Extracted from the three cancel handlers so refund logic lives in one place.
 *
 * Cancel path overview (all three handlers remain separate — this module
 * provides only the refund-type calculation):
 *
 *  1. `client/client-cancel-booking.handler.ts`
 *     - Invoked by: client self-service cancel (mobile/web portal)
 *     - Transitions used: CLIENT_REQUEST_CANCEL | CLIENT_DIRECT_CANCEL
 *     - When to call computeRefundType: only on CLIENT_DIRECT_CANCEL path
 *
 *  2. `cancel-booking/cancel-booking.handler.ts`
 *     - Invoked by: admin/staff direct cancel (dashboard)
 *     - Transitions used: DIRECT_CANCEL
 *     - When to call computeRefundType: always (staff may override with their own reason)
 *
 *  3. `approve-cancel-booking/approve-cancel-booking.handler.ts`
 *     - Invoked by: staff approving a pending CANCEL_REQUEST
 *     - Transitions used: APPROVE_CANCEL
 *     - Refund note: this handler delegates to the `autoRefund` flag in settings;
 *       refund initiation is handled by the BookingCancelApprovedEvent subscriber
 *       (not directly by this handler).
 */

import { RefundType } from '@prisma/client';

export interface CancellationPolicyInput {
  scheduledAt: Date;
  freeCancelBeforeHours: number;
  freeCancelRefundType: RefundType | string;
  /**
   * Percent (0–100) of the paid amount to refund when the cancellation falls
   * OUTSIDE the free window (a "late" cancel). Defaults to 0 (no refund /
   * full forfeiture). Stored on BookingSettings.lateCancelRefundPercent.
   */
  lateCancelRefundPercent?: number;
  /** Optional override — if provided, returns NONE (penalty applies). */
  lateCancel?: boolean;
}

export interface CancellationPolicyResult {
  refundType: RefundType;
  /**
   * Percent (0–100) of the paid amount that should be refunded. The caller
   * applies this to the integer-halala paid amount with explicit rounding.
   * - FULL  → 100
   * - NONE  → 0
   * - PARTIAL → the configured percent
   */
  refundPercent: number;
  hoursUntilBooking: number;
  isWithinFreeWindow: boolean;
}

/** Clamp an arbitrary number into an integer percent in [0, 100]. */
function clampPercent(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/**
 * Computes the refund type AND refundable percent for a cancellation based on
 * the timing policy.
 *
 * Rules:
 * - `hoursUntilBooking >= freeCancelBeforeHours` → free cancel → `freeCancelRefundType`
 *     - FULL    → 100%
 *     - NONE    → 0%
 *     - PARTIAL → `lateCancelRefundPercent`% (the configured partial percent)
 * - `hoursUntilBooking < freeCancelBeforeHours`  → late cancel  → refund
 *     `lateCancelRefundPercent`% of the paid amount:
 *     - 0   → NONE (full forfeiture — the previous always-NONE behaviour)
 *     - 100 → FULL
 *     - else → PARTIAL
 *
 * This is a pure function — no DB access, no side effects. It never returns a
 * fractional percent; the caller is responsible for integer-halala rounding
 * when applying the percent to the paid amount.
 */
export function computeRefundType(input: CancellationPolicyInput): CancellationPolicyResult {
  const hoursUntilBooking = (input.scheduledAt.getTime() - Date.now()) / 3_600_000;
  const isWithinFreeWindow = hoursUntilBooking >= input.freeCancelBeforeHours;
  const lateCancelRefundPercent = clampPercent(input.lateCancelRefundPercent);

  let refundType: RefundType;
  let refundPercent: number;

  if (isWithinFreeWindow) {
    refundType = input.freeCancelRefundType as RefundType;
    if (refundType === RefundType.FULL) {
      refundPercent = 100;
    } else if (refundType === RefundType.PARTIAL) {
      refundPercent = lateCancelRefundPercent;
      // A configured 0% partial degrades to NONE so we never create a
      // zero-amount refund request.
      if (refundPercent === 0) refundType = RefundType.NONE;
    } else {
      refundPercent = 0;
    }
  } else {
    // Late cancel — honour lateCancelRefundPercent instead of always voiding.
    refundPercent = lateCancelRefundPercent;
    if (refundPercent === 0) {
      refundType = RefundType.NONE;
    } else if (refundPercent === 100) {
      refundType = RefundType.FULL;
    } else {
      refundType = RefundType.PARTIAL;
    }
  }

  return { refundType, refundPercent, hoursUntilBooking, isWithinFreeWindow };
}

/**
 * Apply a refund percent to a paid amount, returning an exact integer number
 * of halalas. Never emits a fractional halala (rounds half-up).
 */
export function computeRefundAmountHalalas(paidAmountHalalas: number, refundPercent: number): number {
  const paid = Math.max(0, Math.round(paidAmountHalalas));
  const pct = Math.min(100, Math.max(0, refundPercent));
  if (pct >= 100) return paid;
  if (pct <= 0) return 0;
  return Math.round((paid * pct) / 100);
}
