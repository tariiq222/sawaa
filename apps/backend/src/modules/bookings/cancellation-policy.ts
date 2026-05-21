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
  /** Optional override — if provided, returns NONE (penalty applies). */
  lateCancel?: boolean;
}

export interface CancellationPolicyResult {
  refundType: RefundType;
  hoursUntilBooking: number;
  isWithinFreeWindow: boolean;
}

/**
 * Computes the refund type for a direct cancellation based on timing policy.
 *
 * Rules:
 * - `hoursUntilBooking >= freeCancelBeforeHours` → free cancel → `freeCancelRefundType`
 * - `hoursUntilBooking < freeCancelBeforeHours`  → late cancel  → `NONE`
 *
 * This is a pure function — no DB access, no side effects.
 */
export function computeRefundType(input: CancellationPolicyInput): CancellationPolicyResult {
  const hoursUntilBooking = (input.scheduledAt.getTime() - Date.now()) / 3_600_000;
  const isWithinFreeWindow = hoursUntilBooking >= input.freeCancelBeforeHours;

  const refundType: RefundType = isWithinFreeWindow
    ? (input.freeCancelRefundType as RefundType)
    : RefundType.NONE;

  return { refundType, hoursUntilBooking, isWithinFreeWindow };
}
