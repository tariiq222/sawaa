/**
 * Design System Tokens — Sawaa Dashboard
 *
 * مرجع موحد للـ tokens المستخدمة في الكود.
 * الألوان الفعلية معرّفة في globals.css كـ CSS custom properties.
 * هذا الملف يوفر type-safe references + style mappings.
 */

// ─── State Colors (for badges, alerts, indicators) ───
export const stateColors = {
  success: { bg: "bg-success-soft", text: "text-success", border: "border-success/30", accent: "border-s-success" },
  warning: { bg: "bg-warning-soft", text: "text-warning", border: "border-warning/30", accent: "border-s-warning" },
  error:   { bg: "bg-error-soft",   text: "text-error",   border: "border-error/30",   accent: "border-s-error"   },
  info:    { bg: "bg-info-soft",    text: "text-info",    border: "border-info/30",    accent: "border-s-info"    },
} as const

// ─── Booking Status Styles ───
export const bookingStatusStyles = {
  pending:            { bg: "bg-warning-soft",        text: "text-warning",           border: "border-warning/40",  accent: "border-s-warning",  icon: "text-warning" },
  pending_group_fill: { bg: "bg-warning-soft",        text: "text-warning",           border: "border-warning/40",  accent: "border-s-warning",  icon: "text-warning" },
  awaiting_payment:   { bg: "bg-warning-soft",        text: "text-warning",           border: "border-warning/40",  accent: "border-s-warning",  icon: "text-warning" },
  deposit_paid:       { bg: "bg-accent-ultra-light",  text: "text-accent-foreground", border: "border-accent/40",   accent: "border-s-accent",   icon: "text-accent"  },
  confirmed:          { bg: "bg-success-soft",        text: "text-success",           border: "border-success/40",  accent: "border-s-success",  icon: "text-success" },
  completed:          { bg: "bg-primary-ultra-light", text: "text-primary",           border: "border-primary/30",  accent: "border-s-primary",  icon: "text-primary" },
  cancelled:          { bg: "bg-error-soft",          text: "text-error",             border: "border-error/40",    accent: "border-s-error",    icon: "text-error"   },
  cancel_requested:   { bg: "bg-warning-soft",        text: "text-warning",           border: "border-warning/40",  accent: "border-s-warning",  icon: "text-warning" },
  no_show:            { bg: "bg-error-soft",          text: "text-error",             border: "border-error/40",    accent: "border-s-error",    icon: "text-error"   },
  expired:            { bg: "bg-muted",               text: "text-muted-foreground",  border: "border-border",      accent: "border-s-muted-foreground", icon: "text-muted-foreground" },
} as const

// ─── Booking Type Styles ───
export const bookingTypeStyles = {
  individual: { bg: "bg-primary-ultra-light", text: "text-primary", border: "border-primary/30", accent: "border-s-primary", icon: "text-primary" },
  in_person:  { bg: "bg-primary-ultra-light", text: "text-primary", border: "border-primary/30", accent: "border-s-primary", icon: "text-primary" },
  walk_in:    { bg: "bg-success-soft",        text: "text-success", border: "border-success/40", accent: "border-s-success", icon: "text-success" },
  group:      { bg: "bg-info-soft",           text: "text-info",    border: "border-info/40",    accent: "border-s-info",    icon: "text-info"    },
} as const

// ─── Contact Message Status Styles (UPPERCASE keys) ───
export const contactMessageStatusStyles = {
  NEW:      { bg: "bg-info-soft",    text: "text-info",             border: "border-info/40",    accent: "border-s-info"             },
  READ:     { bg: "bg-muted",        text: "text-muted-foreground", border: "border-border",     accent: "border-s-muted-foreground" },
  REPLIED:  { bg: "bg-success-soft", text: "text-success",          border: "border-success/40", accent: "border-s-success"          },
  ARCHIVED: { bg: "bg-muted",        text: "text-muted-foreground", border: "border-border",     accent: "border-s-muted-foreground" },
} as const
