/**
 * Booking State Machine
 * =====================
 * Single source of truth for all BookingStatus transitions.
 *
 * State diagram:
 *
 *   (create)  ────────────────────────────────────────────
 *                │                       │
 *                ▼                       ▼
 *            PENDING                AWAITING_PAYMENT
 *                │                       │
 *         CONFIRM│              PAYMENT_CONFIRMED│
 *                │                       │
 *                ▼                       │
 *           CONFIRMED ◄──────────────────┘
 *             │    │
 *   COMPLETE  │    │  NO_SHOW
 *             │    │
 *         COMPLETED  NO_SHOW  (terminal)
 *
 *   Deposit flow:
 *     PENDING | AWAITING_PAYMENT  → DEPOSIT_CONFIRMED → DEPOSIT_PAID
 *       (appointment operationally confirmed; balance still due)
 *     DEPOSIT_PAID                → PAYMENT_CONFIRMED  → CONFIRMED
 *       (client settles the remaining balance)
 *     DEPOSIT_PAID                → COMPLETE | NO_SHOW (attendance lifecycle)
 *     Deposit bookings never expire for an outstanding balance.
 *     DEPOSIT_PAID is NOT terminal.
 *
 *   Any cancellable state:
 *     PENDING | CONFIRMED | AWAITING_PAYMENT | DEPOSIT_PAID → CLIENT_REQUEST_CANCEL → CANCEL_REQUESTED
 *     PENDING | PENDING_GROUP_FILL | AWAITING_PAYMENT | CONFIRMED | CANCEL_REQUESTED | DEPOSIT_PAID
 *       → DIRECT_CANCEL → CANCELLED
 *     PENDING | CONFIRMED | AWAITING_PAYMENT | DEPOSIT_PAID → CLIENT_DIRECT_CANCEL → CANCELLED
 *     CANCEL_REQUESTED                                      → APPROVE_CANCEL → CANCELLED
 *     CANCEL_REQUESTED                                      → REJECT_CANCEL → CONFIRMED
 *
 *   Terminal states: CANCELLED | COMPLETED | NO_SHOW | EXPIRED
 *   (none of these appear as a 'from' state in any transition;
 *    DEPOSIT_PAID is an active, non-terminal state)
 *
 *   Sole audited exception out of a terminal state:
 *     NO_SHOW → RESTORE_NO_SHOW → CONFIRMED
 *     Restores a mistakenly auto-no-show'd booking to CONFIRMED while
 *     preserving attendance and setting a separate automation-suppression
 *     marker. Still audited in `BookingStatusLog`. NO_SHOW remains
 *     terminal for every other transition (cancel / complete / delete / etc.).
 *
 *   Self-loops:
 *     CONFIRMED → RESCHEDULE → CONFIRMED
 *     PENDING   → RESCHEDULE → PENDING
 *     CONFIRMED → CHECK_IN   → CONFIRMED
 *     DEPOSIT_PAID → RESCHEDULE | CHECK_IN → DEPOSIT_PAID
 */

import { BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';

// ─── Transition names ────────────────────────────────────────────────────────

export type BookingTransition =
  | 'CREATE_PENDING'
  | 'CREATE_AWAITING_PAYMENT'
  | 'CREATE_CONFIRMED'
  | 'CONFIRM'
  | 'PAYMENT_CONFIRMED'
  | 'DEPOSIT_CONFIRMED'
  | 'CLIENT_REQUEST_CANCEL'
  | 'DIRECT_CANCEL'
  | 'CLIENT_DIRECT_CANCEL'
  | 'APPROVE_CANCEL'
  | 'REJECT_CANCEL'
  | 'RESCHEDULE'
  | 'COMPLETE'
  | 'NO_SHOW'
  | 'RESTORE_NO_SHOW'
  | 'EXPIRE'
  | 'CHECK_IN';

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
   * From DEPOSIT_PAID this represents the client settling the remaining balance,
   * without changing its operational confirmation.
   * Handler: payment-completed-handler/payment-completed.handler.ts
   */
  PAYMENT_CONFIRMED: {
    from: [
      BookingStatus.PENDING,
      BookingStatus.AWAITING_PAYMENT,
      BookingStatus.DEPOSIT_PAID,
    ],
    to: BookingStatus.CONFIRMED,
  },

  /**
   * Client pays the configured service deposit in full → the appointment time
   * is confirmed while a remaining balance stays due. Fired only when the full
   * deposit amount is collected (not a partial deposit).
   */
  DEPOSIT_CONFIRMED: {
    from: [BookingStatus.PENDING, BookingStatus.AWAITING_PAYMENT],
    to: BookingStatus.DEPOSIT_PAID,
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
      BookingStatus.DEPOSIT_PAID,
    ],
    to: BookingStatus.CANCEL_REQUESTED,
  },

  /**
   * Admin/staff cancels directly, including a previously requested cancel.
   *
   * Accepts the unconfirmed holds too (PENDING_GROUP_FILL / AWAITING_PAYMENT):
   * reception must be able to release a slot that is only being held for an
   * online payment that never arrived, without waiting for the expiry cron and
   * without first confirming a booking nobody paid for. `cancel-booking.handler`
   * treats those sources as penalty-free and refunds any captured amount in
   * full, mirroring the expiry path.
   *
   * Handler: cancel-booking/cancel-booking.handler.ts
   */
  DIRECT_CANCEL: {
    from: [
      BookingStatus.PENDING,
      BookingStatus.PENDING_GROUP_FILL,
      BookingStatus.AWAITING_PAYMENT,
      BookingStatus.CONFIRMED,
      BookingStatus.CANCEL_REQUESTED,
      BookingStatus.DEPOSIT_PAID,
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
      BookingStatus.DEPOSIT_PAID,
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
   * Staff rejects a cancel request → booking returns to the status it held
   * BEFORE the client requested cancellation (its `BookingStatusLog.fromStatus`).
   *
   * The `to` recorded here (PENDING) is only the *safe fallback* used when the
   * caller cannot supply the pre-request status. It must NOT promote an unpaid
   * booking to CONFIRMED — doing so bypasses payment (an unpaid/deposit-only
   * appointment would silently become a fully-confirmed, paid slot). PENDING is
   * the conservative default: it never grants a confirmed paid slot for free and
   * still allows the booking to be re-confirmed, paid, or expired normally.
   *
   * Callers should pass the real pre-request status via the `restoreTo` argument
   * to `assertTransition` so the booking is restored exactly to where it was.
   * Handler: reject-cancel-booking/reject-cancel-booking.handler.ts
   */
  REJECT_CANCEL: {
    from: [BookingStatus.CANCEL_REQUESTED],
    to: BookingStatus.PENDING,
  },

  /**
   * Booking is rescheduled — status is unchanged (self-loop).
   * Applies to PENDING, CONFIRMED and DEPOSIT_PAID.
   * Handlers: reschedule-booking.handler.ts, client/client-reschedule-booking.handler.ts
   */
  RESCHEDULE: {
    from: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.DEPOSIT_PAID],
    to: BookingStatus.CONFIRMED, // status preserved in practice — see assertTransition return logic
  },

  /**
   * Staff marks session complete.
   * Handler: complete-booking/complete-booking.handler.ts
   */
  COMPLETE: {
    from: [BookingStatus.CONFIRMED, BookingStatus.DEPOSIT_PAID],
    to: BookingStatus.COMPLETED,
  },

  /**
   * Staff marks client as no-show.
   * Handler: no-show-booking/no-show-booking.handler.ts
   */
  NO_SHOW: {
    from: [BookingStatus.CONFIRMED, BookingStatus.DEPOSIT_PAID],
    to: BookingStatus.NO_SHOW,
  },

  /**
   * Sole audited exception out of a terminal state.
   *
   * Restores a NO_SHOW booking to CONFIRMED so a mistakenly auto-no-show'd
   * slot can be corrected without the auto-no-show cron immediately
   * re-marking it. The handler preserves `checkedInAt` and sets a separate
   * automation-suppression marker, so the restore is durable without
   * fabricating attendance.
   *
   * The transition is the only entry in this table that lists a terminal
   * status in `from[]`. NO_SHOW remains terminal for every other transition
   * (CANCEL / COMPLETE / DELETE / etc.) — this single audited exception does
   * not weaken that invariant.
   *
   * Handler: restore-no-show-booking/restore-no-show-booking.handler.ts
   */
  RESTORE_NO_SHOW: {
    from: [BookingStatus.NO_SHOW],
    to: BookingStatus.CONFIRMED,
  },

  /**
   * Cron/system expires a non-confirmed booking whose payment window elapsed.
   * Deposit bookings are operationally confirmed and cannot expire.
   * Handler: expire-booking/expire-booking.handler.ts
   */
  EXPIRE: {
    from: [BookingStatus.PENDING, BookingStatus.AWAITING_PAYMENT],
    to: BookingStatus.EXPIRED,
  },

  /**
   * Receptionist marks client as arrived — status is preserved (self-loop),
   * only checkedInAt timestamp is set.
   * Handler: check-in-booking/check-in-booking.handler.ts
   */
  CHECK_IN: {
    from: [BookingStatus.CONFIRMED, BookingStatus.DEPOSIT_PAID],
    to: BookingStatus.CONFIRMED,
  },
};

// ─── Cancel-request restore set ─────────────────────────────────────────────────

/**
 * Statuses a booking may legitimately have held immediately BEFORE a client
 * requested cancellation. This is exactly the source set of CLIENT_REQUEST_CANCEL
 * (the only way to reach CANCEL_REQUESTED from an active booking). When a staff
 * member rejects the cancel request, the booking must be restored to one of these
 * — never silently promoted to CONFIRMED.
 */
export const REJECT_CANCEL_RESTORE_STATUSES: ReadonlySet<BookingStatus> =
  new Set(VALID_TRANSITIONS.CLIENT_REQUEST_CANCEL.from);

// ─── Terminal states ──────────────────────────────────────────────────────────

/**
 * Terminal statuses: NO outgoing transitions in normal flow (cancel, complete,
 * expire, delete). Every terminal status appears as a `from` source in ZERO
 * transitions of `VALID_TRANSITIONS` except for the sole audited exception:
 *
 *   NO_SHOW → RESTORE_NO_SHOW → CONFIRMED
 *
 * That exception exists so a mistakenly auto-no-show'd booking can be
 * corrected by staff (with a reason and a `BookingStatusLog` row) without
 * the auto-no-show cron immediately re-marking it. NO_SHOW is otherwise still
 * terminal — `RESTORE_NO_SHOW` is the only path back out, and only ever
 * into CONFIRMED.
 */
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
 * RESCHEDULE and CHECK_IN are self-loops: preserve the actual current status,
 * including DEPOSIT_PAID so attendance never implies full payment.
 *
 * Special case — REJECT_CANCEL must restore the booking to the status it held
 * before the client requested cancellation. The caller passes that status via
 * `restoreTo` (read from the matching `BookingStatusLog.fromStatus`). When it is
 * provided and is a legitimate pre-request status it is honoured; otherwise the
 * conservative table default (PENDING) is returned so an unpaid booking is never
 * promoted to CONFIRMED and granted a paid slot for free.
 *
 * Throws `BadRequestException` if the transition is not valid from `from`, or if
 * a non-restorable `restoreTo` is supplied for REJECT_CANCEL.
 */
export function assertTransition(
  from: BookingStatus,
  transition: BookingTransition,
  restoreTo?: BookingStatus | null,
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

  // Attendance and rescheduling preserve the actual current status.
  if (transition === 'RESCHEDULE' || transition === 'CHECK_IN') {
    return from;
  }

  // REJECT_CANCEL: restore the pre-request status instead of forcing CONFIRMED.
  if (transition === 'REJECT_CANCEL') {
    if (restoreTo == null) {
      // Pre-request status unknown — fall back to the safe, non-promoting default.
      return rule.to;
    }
    if (!REJECT_CANCEL_RESTORE_STATUSES.has(restoreTo)) {
      const allowed = [...REJECT_CANCEL_RESTORE_STATUSES].join(', ');
      throw new BadRequestException(
        `Cannot restore a rejected cancel request to status '${restoreTo}'. ` +
          `Restorable statuses: [${allowed}].`,
      );
    }
    return restoreTo;
  }

  return rule.to;
}

/**
 * Returns true if the given status is terminal (i.e., no outgoing transitions).
 */
export function isTerminalStatus(status: BookingStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}
