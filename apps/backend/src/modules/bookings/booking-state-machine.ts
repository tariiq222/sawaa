/**
 * Booking State Machine
 * =====================
 * Single source of truth for all BookingStatus transitions.
 *
 * State diagram:
 *
 *   (create)  ──────────────────────────────────────────────────────────────────────
 *                │                       │                       │
 *                ▼                       ▼                       ▼
 *            PENDING           PENDING_GROUP_FILL         AWAITING_PAYMENT
 *                │                       │                       │
 *         CONFIRM│              ─────────┘              PAYMENT_CONFIRMED│
 *                │             EXPIRE                           │
 *                ▼                                              │
 *           CONFIRMED ◄────────────────────────────────────────┘
 *             │    │
 *   COMPLETE  │    │  NO_SHOW
 *             │    │
 *         COMPLETED  NO_SHOW  (terminal)
 *
 *   Any cancellable state:
 *     PENDING | CONFIRMED | AWAITING_PAYMENT  → CLIENT_REQUEST_CANCEL → CANCEL_REQUESTED
 *     PENDING | CONFIRMED | CANCEL_REQUESTED  → DIRECT_CANCEL → CANCELLED
 *     PENDING | CONFIRMED | AWAITING_PAYMENT  → CLIENT_DIRECT_CANCEL → CANCELLED
 *     CANCEL_REQUESTED                        → APPROVE_CANCEL → CANCELLED
 *     CANCEL_REQUESTED                        → REJECT_CANCEL → CONFIRMED
 *
 *   Group session rollback (when an enrollee cancels after min reached):
 *     AWAITING_PAYMENT  → GROUP_FILL_ROLLBACK → PENDING_GROUP_FILL
 *
 *   Terminal states: CANCELLED | COMPLETED | NO_SHOW | EXPIRED
 *   (none of these appear as a 'from' state in any transition)
 *
 *   Self-loops:
 *     CONFIRMED → RESCHEDULE → CONFIRMED
 *     PENDING   → RESCHEDULE → PENDING
 *     CONFIRMED → CHECK_IN   → CONFIRMED
 */

import { BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';

// ─── Transition names ────────────────────────────────────────────────────────

export type BookingTransition =
  | 'CREATE_PENDING'
  | 'CREATE_GROUP_FILL'
  | 'CREATE_AWAITING_PAYMENT'
  | 'CREATE_CONFIRMED'
  | 'CONFIRM'
  | 'PAYMENT_CONFIRMED'
  | 'GROUP_FILL_REACHED_MIN'
  | 'CLIENT_REQUEST_CANCEL'
  | 'DIRECT_CANCEL'
  | 'CLIENT_DIRECT_CANCEL'
  | 'APPROVE_CANCEL'
  | 'REJECT_CANCEL'
  | 'RESCHEDULE'
  | 'COMPLETE'
  | 'NO_SHOW'
  | 'EXPIRE'
  | 'CHECK_IN'
  | 'GROUP_FILL_ROLLBACK';

// ─── Transition table ─────────────────────────────────────────────────────────

export const VALID_TRANSITIONS: Record<
  BookingTransition,
  { from: BookingStatus[]; to: BookingStatus }
> = {
  /**
   * CREATE_* transitions have an empty `from` list because a booking doesn't
   * exist yet. They are included here to document the initial status choices
   * and to allow callers to derive `to` without hardcoding status strings.
   */
  CREATE_PENDING: {
    from: [],
    to: BookingStatus.PENDING,
  },
  CREATE_GROUP_FILL: {
    from: [],
    to: BookingStatus.PENDING_GROUP_FILL,
  },
  CREATE_AWAITING_PAYMENT: {
    from: [],
    to: BookingStatus.AWAITING_PAYMENT,
  },
  CREATE_CONFIRMED: {
    from: [],
    to: BookingStatus.CONFIRMED,
  },

  /**
   * Admin confirms a PENDING booking manually (without payment).
   * Handler: confirm-booking.handler.ts
   */
  CONFIRM: {
    from: [BookingStatus.PENDING],
    to: BookingStatus.CONFIRMED,
  },

  /**
   * Payment gateway confirms payment → booking auto-confirmed.
   * Handler: payment-completed-handler/payment-completed.handler.ts
   */
  PAYMENT_CONFIRMED: {
    from: [BookingStatus.PENDING, BookingStatus.AWAITING_PAYMENT],
    to: BookingStatus.CONFIRMED,
  },

  /**
   * Minimum participant count reached for a group session slot →
   * all PENDING_GROUP_FILL bookings are promoted to AWAITING_PAYMENT.
   * Handler: group-session-min-reached/group-session-min-reached.handler.ts
   */
  GROUP_FILL_REACHED_MIN: {
    from: [BookingStatus.PENDING_GROUP_FILL],
    to: BookingStatus.AWAITING_PAYMENT,
  },

  /**
   * Client requests cancellation — requires staff approval.
   * Handler: client/client-cancel-booking.handler.ts (approval path)
   */
  CLIENT_REQUEST_CANCEL: {
    from: [
      BookingStatus.PENDING,
      BookingStatus.CONFIRMED,
      BookingStatus.AWAITING_PAYMENT,
    ],
    to: BookingStatus.CANCEL_REQUESTED,
  },

  /**
   * Admin/staff cancels directly, including a previously requested cancel.
   * Handler: cancel-booking/cancel-booking.handler.ts
   */
  DIRECT_CANCEL: {
    from: [
      BookingStatus.PENDING,
      BookingStatus.CONFIRMED,
      BookingStatus.CANCEL_REQUESTED,
    ],
    to: BookingStatus.CANCELLED,
  },

  /**
   * Client cancels directly (no approval needed, within cancellation window).
   * Handler: client/client-cancel-booking.handler.ts (direct cancel path)
   */
  CLIENT_DIRECT_CANCEL: {
    from: [
      BookingStatus.PENDING,
      BookingStatus.CONFIRMED,
      BookingStatus.AWAITING_PAYMENT,
    ],
    to: BookingStatus.CANCELLED,
  },

  /**
   * Staff approves a pending cancel request.
   * Handler: approve-cancel-booking/approve-cancel-booking.handler.ts
   */
  APPROVE_CANCEL: {
    from: [BookingStatus.CANCEL_REQUESTED],
    to: BookingStatus.CANCELLED,
  },

  /**
   * Staff rejects a cancel request → booking returns to CONFIRMED.
   * Handler: reject-cancel-booking/reject-cancel-booking.handler.ts
   */
  REJECT_CANCEL: {
    from: [BookingStatus.CANCEL_REQUESTED],
    to: BookingStatus.CONFIRMED,
  },

  /**
   * Booking is rescheduled — status is unchanged (self-loop).
   * Applies to both PENDING and CONFIRMED.
   * Handlers: reschedule-booking.handler.ts, client/client-reschedule-booking.handler.ts
   */
  RESCHEDULE: {
    from: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
    to: BookingStatus.CONFIRMED, // status preserved in practice — see assertTransition return logic
  },

  /**
   * Staff marks session complete.
   * Handler: complete-booking/complete-booking.handler.ts
   */
  COMPLETE: {
    from: [BookingStatus.CONFIRMED],
    to: BookingStatus.COMPLETED,
  },

  /**
   * Staff marks client as no-show.
   * Handler: no-show-booking/no-show-booking.handler.ts
   */
  NO_SHOW: {
    from: [BookingStatus.CONFIRMED],
    to: BookingStatus.NO_SHOW,
  },

  /**
   * Cron/system expires a non-confirmed booking whose payment window elapsed.
   * Handler: expire-booking/expire-booking.handler.ts
   */
  EXPIRE: {
    from: [
      BookingStatus.PENDING,
      BookingStatus.PENDING_GROUP_FILL,
      BookingStatus.AWAITING_PAYMENT,
    ],
    to: BookingStatus.EXPIRED,
  },

  /**
   * Receptionist marks client as arrived — status stays CONFIRMED (self-loop),
   * only checkedInAt timestamp is set.
   * Handler: check-in-booking/check-in-booking.handler.ts
   */
  CHECK_IN: {
    from: [BookingStatus.CONFIRMED],
    to: BookingStatus.CONFIRMED,
  },

  /**
   * A participant cancels from a group session that had already reached
   * min-participants and transitioned to AWAITING_PAYMENT. If the remaining
   * enrolled count drops below the threshold the remaining bookings roll back
   * from AWAITING_PAYMENT → PENDING_GROUP_FILL to restart the fill window.
   *
   * Handler: group-session/group-session-capacity.service.ts
   */
  GROUP_FILL_ROLLBACK: {
    from: [BookingStatus.AWAITING_PAYMENT],
    to: BookingStatus.PENDING_GROUP_FILL,
  },
};

// ─── Terminal states ──────────────────────────────────────────────────────────

export const TERMINAL_STATUSES: ReadonlySet<BookingStatus> = new Set([
  BookingStatus.CANCELLED,
  BookingStatus.COMPLETED,
  BookingStatus.NO_SHOW,
  BookingStatus.EXPIRED,
]);

// ─── Guard function ────────────────────────────────────────────────────────────

/**
 * Validates that `from` is an allowed source for `transition` and returns
 * the resulting `BookingStatus`.
 *
 * Special case — RESCHEDULE is a self-loop: the `to` is the same as `from`
 * (either PENDING or CONFIRMED), not always CONFIRMED. The table stores
 * CONFIRMED as the canonical `to`; this function corrects that for PENDING.
 *
 * Throws `BadRequestException` if the transition is not valid from `from`.
 */
export function assertTransition(
  from: BookingStatus,
  transition: BookingTransition,
): BookingStatus {
  const rule = VALID_TRANSITIONS[transition];

  if (rule.from.length === 0) {
    // CREATE_* transitions — no `from` constraint (booking is being created)
    return rule.to;
  }

  if (!rule.from.includes(from)) {
    const allowed = rule.from.join(', ');
    throw new BadRequestException(
      `Cannot apply transition '${transition}' to a booking in status '${from}'. ` +
        `Allowed source statuses: [${allowed}].`,
    );
  }

  // RESCHEDULE self-loop: preserve the actual current status
  if (transition === 'RESCHEDULE') {
    return from;
  }

  return rule.to;
}

/**
 * Returns true if the given status is terminal (i.e., no outgoing transitions).
 */
export function isTerminalStatus(status: BookingStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}
