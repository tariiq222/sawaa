/**
 * Status → action vocabulary for the booking actions dropdown.
 *
 * Extracted from `booking-actions.tsx` when type-guarding these maps pushed the
 * component past its own 350-line ceiling (MNT-21 item 21.5). Keeping them here
 * also means the exhaustiveness guards are compile-time and not tied to a
 * component render.
 *
 * Every map is keyed by `BookingStatus`, so a status added to the committed
 * OpenAPI snapshot becomes a type error here instead of a booking that silently
 * renders with no actions or an untranslated label.
 */
import {
  ArrowTurnBackwardIcon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  EyeIcon,
  Tick01Icon,
  UserCheck01Icon,
} from "@hugeicons/core-free-icons"

import type { BookingStatus } from "@/lib/types/booking"

/** Every action the dropdown can dispatch. Declared here (not in the component)
 * so these maps do not have to import from the component that imports them. */
export type BookingAction =
  | "confirm"
  | "checkin"
  | "complete"
  | "noshow"
  | "cancel"
  | "approve_cancel"
  | "reject_cancel"
  | "restore_noshow"

/* ── Transition map: status → available actions ──
 * Mirrors the backend booking-state-machine. Never advertise an action it
 * rejects: holds (awaiting_payment / pending_group_fill) are cancellable and
 * confirmed by recording the payment, but CONFIRM is PENDING-only and they are
 * not reschedulable. Deposit bookings support attendance with a balance due.
 */
export const statusActions: Record<BookingStatus, readonly BookingAction[]> = {
  pending: ["confirm", "cancel"],
  pending_group_fill: ["cancel"],
  awaiting_payment: ["cancel"],
  deposit_paid: ["checkin", "complete", "noshow", "cancel"],
  confirmed: ["checkin", "complete", "noshow", "cancel"],
  cancel_requested: ["approve_cancel", "reject_cancel"],
  completed: [],
  cancelled: [],
  no_show: ["restore_noshow"],
  expired: [],
}

export function getStatusLabels(
  t: (k: string) => string,
): Record<BookingStatus, string> {
  return {
    pending: t("bookings.actions.status.pending"),
    pending_group_fill: t("bookings.actions.status.pending_group_fill"),
    awaiting_payment: t("bookings.actions.status.awaiting_payment"),
    confirmed: t("bookings.actions.status.confirmed"),
    deposit_paid: t("bookings.actions.status.deposit_paid"),
    completed: t("bookings.actions.status.completed"),
    cancelled: t("bookings.actions.status.cancelled"),
    cancel_requested: t("bookings.actions.status.cancel_requested"),
    no_show: t("bookings.actions.status.no_show"),
    expired: t("bookings.actions.status.expired"),
  }
}

/**
 * Icon + label + button variant per action. Lives here rather than in the
 * component so the whole status→action table is one reviewable file.
 */
export function getActionMeta(t: (k: string) => string): Record<
  BookingAction,
  { label: string; icon: typeof Tick01Icon; variant: "default" | "outline" | "destructive" }
> {
  return {
    confirm: { label: t("bookings.actions.action.confirm"), icon: Tick01Icon, variant: "default" },
    checkin: { label: t("bookings.actions.action.checkin"), icon: UserCheck01Icon, variant: "outline" },
    complete: { label: t("bookings.actions.action.complete"), icon: CheckmarkCircle01Icon, variant: "default" },
    noshow: { label: t("bookings.actions.action.noshow"), icon: EyeIcon, variant: "destructive" },
    cancel: { label: t("bookings.actions.action.cancel"), icon: Cancel01Icon, variant: "destructive" },
    approve_cancel: { label: t("bookings.actions.action.approveCancel"), icon: Tick01Icon, variant: "default" },
    reject_cancel: { label: t("bookings.actions.action.rejectCancel"), icon: Cancel01Icon, variant: "outline" },
    restore_noshow: { label: t("bookings.actions.action.restoreNoShow"), icon: ArrowTurnBackwardIcon, variant: "outline" },
  }
}
