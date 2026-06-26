/**
 * Design System Tokens — Sawaa Dashboard
 *
 * مرجع موحد للـ tokens المستخدمة في الكود.
 * الألوان الفعلية معرّفة في globals.css كـ CSS custom properties.
 * هذا الملف يوفر type-safe references + style mappings.
 */

// ─── State Colors (for badges, alerts, indicators) ───
export const stateColors = {
  success: { bg: "bg-success-soft", text: "text-success", border: "border-success/30" },
  warning: { bg: "bg-warning-soft", text: "text-warning", border: "border-warning/30" },
  error:   { bg: "bg-error-soft",   text: "text-error",   border: "border-error/30"   },
  info:    { bg: "bg-info-soft",    text: "text-info",    border: "border-info/30"    },
} as const

// ─── Booking Status Styles ───
export const bookingStatusStyles = {
  pending:            { bg: "bg-warning-soft",        text: "text-warning",           border: "border-warning/40",  icon: "text-warning"          },
  pending_group_fill: { bg: "bg-warning-soft",        text: "text-warning",           border: "border-warning/40",  icon: "text-warning"          },
  awaiting_payment:   { bg: "bg-warning-soft",        text: "text-warning",           border: "border-warning/40",  icon: "text-warning"          },
  deposit_paid:       { bg: "bg-accent-ultra-light",  text: "text-accent-foreground", border: "border-accent/40",   icon: "text-accent"           },
  confirmed:          { bg: "bg-success-soft",        text: "text-success",           border: "border-success/40",  icon: "text-success"          },
  completed:          { bg: "bg-primary-ultra-light", text: "text-primary",           border: "border-primary/30",  icon: "text-primary"          },
  cancelled:          { bg: "bg-error-soft",          text: "text-error",             border: "border-error/40",    icon: "text-error"            },
  cancel_requested:   { bg: "bg-warning-soft",        text: "text-warning",           border: "border-warning/40",  icon: "text-warning"          },
  no_show:            { bg: "bg-error-soft",          text: "text-error",             border: "border-error/40",    icon: "text-error"            },
  expired:            { bg: "bg-muted",               text: "text-muted-foreground",  border: "border-border",      icon: "text-muted-foreground" },
} as const

// ─── Booking Type Styles ───
export const bookingTypeStyles = {
  individual: { bg: "bg-primary-ultra-light", text: "text-primary", border: "border-primary/30", icon: "text-primary" },
  in_person:  { bg: "bg-primary-ultra-light", text: "text-primary", border: "border-primary/30", icon: "text-primary" },
  walk_in:    { bg: "bg-success-soft",        text: "text-success", border: "border-success/40", icon: "text-success" },
  group:      { bg: "bg-info-soft",           text: "text-info",    border: "border-info/40",    icon: "text-info"    },
} as const

// ─── Contact Message Status Styles (UPPERCASE keys) ───
export const contactMessageStatusStyles = {
  NEW:      { bg: "bg-info-soft",    text: "text-info",             border: "border-info/40"    },
  READ:     { bg: "bg-muted",        text: "text-muted-foreground", border: "border-border"     },
  REPLIED:  { bg: "bg-success-soft", text: "text-success",          border: "border-success/40" },
  ARCHIVED: { bg: "bg-muted",        text: "text-muted-foreground", border: "border-border"     },
} as const

// ─── Payment Status Styles (UPPERCASE keys — mirrors PaymentStatus enum) ───
export const paymentStatusStyles = {
  PENDING:              { bg: "bg-warning-soft",  text: "text-warning",          border: "border-warning/40"          },
  PENDING_VERIFICATION: { bg: "bg-warning-soft",  text: "text-warning",          border: "border-warning/40"          },
  COMPLETED:            { bg: "bg-success-soft",  text: "text-success",          border: "border-success/40"          },
  FAILED:               { bg: "bg-error-soft",    text: "text-error",            border: "border-error/40"            },
  REFUNDED:             { bg: "bg-refunded-soft", text: "text-refunded",         border: "border-refunded/40"         },
  PARTIALLY_REFUNDED:   { bg: "bg-refunded-soft", text: "text-refunded",         border: "border-refunded/40"         },
  // lowercase keys — booking payment-status cell (paid/unpaid/partial/...)
  paid:                 { bg: "bg-success-soft",  text: "text-success",          border: "border-success/40"          },
  unpaid:               { bg: "bg-error-soft",    text: "text-error",            border: "border-error/40"            },
  partial:              { bg: "bg-warning-soft",  text: "text-warning",          border: "border-warning/40"          },
  pending:              { bg: "bg-warning-soft",  text: "text-warning",          border: "border-warning/40"          },
  awaiting:             { bg: "bg-warning-soft",  text: "text-warning",          border: "border-warning/40"          },
  failed:               { bg: "bg-error-soft",    text: "text-error",            border: "border-error/40"            },
  rejected:             { bg: "bg-error-soft",    text: "text-error",            border: "border-error/40"            },
  refunded:             { bg: "bg-refunded-soft", text: "text-refunded",         border: "border-refunded/40"         },
  _fallback:            { bg: "bg-muted",          text: "text-muted-foreground", border: "border-border"              },
} as const

// ─── Invoice Status Styles (UPPERCASE keys — mirrors InvoiceStatus enum) ───
export const invoiceStatusStyles = {
  DRAFT:               { bg: "bg-warning-soft",    text: "text-warning",          border: "border-warning/40"          },
  ISSUED:              { bg: "bg-info-soft",       text: "text-info",             border: "border-info/40"             },
  PAID:                { bg: "bg-success-soft",    text: "text-success",          border: "border-success/40"          },
  PARTIALLY_PAID:      { bg: "bg-warning-soft",    text: "text-warning",          border: "border-warning/40"          },
  PARTIALLY_REFUNDED:  { bg: "bg-refunded-soft",   text: "text-refunded",         border: "border-refunded/40"         },
  VOID:                { bg: "bg-error-soft",       text: "text-error",            border: "border-error/40"            },
  REFUNDED:            { bg: "bg-refunded-soft",   text: "text-refunded",         border: "border-refunded/40"         },
  _fallback:           { bg: "bg-muted",            text: "text-muted-foreground", border: "border-border"              },
} as const

// ─── Active / Inactive Badge Styles ───
export const activeBadgeStyles = {
  active:   { bg: "bg-success-soft", text: "text-success",          border: "border-success/40" },
  inactive: { bg: "bg-muted",        text: "text-muted-foreground", border: "border-border"     },
} as const
