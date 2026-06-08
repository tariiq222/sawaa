/**
 * Design System Tokens — Sawaa Dashboard
 *
 * مرجع موحد للـ tokens المستخدمة في الكود.
 * الألوان الفعلية معرّفة في globals.css كـ CSS custom properties.
 * هذا الملف يوفر type-safe references + style mappings.
 */

/* ─── State Colors (for badges, alerts, indicators) ─── */
export const stateColors = {
  success: {
    bg: "bg-success/10",
    text: "text-success",
    border: "border-success/20",
  },
  warning: {
    bg: "bg-warning/10",
    text: "text-warning",
    border: "border-warning/20",
  },
  error: {
    bg: "bg-error/10",
    text: "text-error",
    border: "border-error/20",
  },
  info: {
    bg: "bg-info/10",
    text: "text-info",
    border: "border-info/20",
  },
} as const

/* ─── Booking Status Styles ─── */
export const bookingStatusStyles = {
  pending: {
    bg: "bg-warning/10",
    text: "text-warning",
    border: "border-warning/20",
  },
  pending_group_fill: {
    bg: "bg-warning/10",
    text: "text-warning",
    border: "border-warning/20",
  },
  awaiting_payment: {
    bg: "bg-warning/10",
    text: "text-warning",
    border: "border-warning/20",
  },
  deposit_paid: {
    bg: "bg-accent/10",
    text: "text-accent",
    border: "border-accent/20",
  },
  confirmed: {
    bg: "bg-success/10",
    text: "text-success",
    border: "border-success/20",
  },
  completed: {
    bg: "bg-accent/10",
    text: "text-accent",
    border: "border-accent/20",
  },
  cancelled: {
    bg: "bg-error/10",
    text: "text-error",
    border: "border-error/20",
  },
  cancel_requested: {
    bg: "bg-warning/10",
    text: "text-warning",
    border: "border-warning/20",
  },
  no_show: {
    bg: "bg-error/10",
    text: "text-error",
    border: "border-error/20",
  },
  expired: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border",
  },
} as const

/* ─── Booking Type Styles ─── */
export const bookingTypeStyles = {
  individual: {
    bg: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/20",
  },
  in_person: {
    bg: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/20",
  },
  walk_in: {
    bg: "bg-success/10",
    text: "text-success",
    border: "border-success/20",
  },
  group: {
    bg: "bg-accent/10",
    text: "text-accent",
    border: "border-accent/20",
  },
} as const
