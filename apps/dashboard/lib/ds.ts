/**
 * Design System Tokens — Deqah Dashboard
 *
 * مرجع موحد للـ tokens المستخدمة في الكود.
 * الألوان الفعلية معرّفة في globals.css كـ CSS custom properties.
 * هذا الملف يوفر type-safe references + style mappings.
 */

/* ─── Radius — iOS-inspired roundness ───
 * Values defined in globals.css `@theme` block.
 * Keep this map in sync with --radius-* custom properties.
 */
export const radius = {
  sm: "rounded-sm",    // 8px  — chips, small pills, table action buttons
  md: "rounded-md",    // 12px — inputs, buttons
  lg: "rounded-lg",    // 16px — cards, data tables
  xl: "rounded-xl",    // 20px — modals, large surfaces
  "2xl": "rounded-2xl", // 24px — hero surfaces, feature cards
  "3xl": "rounded-3xl", // 28px — decorative shells
} as const

/* ─── Shadows — frosted layered depth ─── */
export const shadow = {
  sm: "shadow-sm",              // subtle — cards at rest
  md: "shadow-md",              // medium — cards on hover, dropdowns
  lg: "shadow-lg",              // strong — modals only
  primary: "shadow-primary",    // blue glow — primary CTA buttons
} as const

/* ─── Glassmorphism — frosted glass surfaces ─── */
export const glass = {
  /** Standard glass — cards, sidebar, panels */
  surface: "glass",
  /** Solid glass — popover, dropdown, higher opacity */
  solid: "glass-solid",
  /** Card with glass + hover lift */
  card: "glass card-lift",
} as const

/* ─── Typography ─── */
export const text = {
  xs: "text-xs",       // 12px
  sm: "text-sm",       // 14px — minimum for important text
  md: "text-base",     // 16px
  lg: "text-lg",       // 18px
  xl: "text-xl",       // 20px
  "2xl": "text-2xl",   // 24px
  "3xl": "text-3xl",   // 30px
} as const

export const weight = {
  regular: "font-normal",   // 400
  medium: "font-medium",    // 500
  semibold: "font-semibold", // 600 — headings
  bold: "font-bold",        // 700
} as const

/* ─── Spacing (Tailwind units, 8px grid) ─── */
export const space = {
  1: "1",    // 4px
  2: "2",    // 8px
  3: "3",    // 12px
  4: "4",    // 16px
  5: "5",    // 20px
  6: "6",    // 24px
  8: "8",    // 32px
  10: "10",  // 40px
  12: "12",  // 48px
} as const

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
  in_person: {
    bg: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/20",
  },
  online: {
    bg: "bg-info/10",
    text: "text-info",
    border: "border-info/20",
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

/* ─── Surface Hierarchy ─── */
export const surface = {
  page: "bg-background",
  card: "bg-card",
  cardGlass: "glass",
  nested: "bg-surface-muted",
  solid: "bg-surface-solid",
} as const
