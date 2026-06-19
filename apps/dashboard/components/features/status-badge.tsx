"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  Tick01Icon,
  CancelCircleIcon,
  Clock02Icon,
  CheckmarkCircle02Icon,
  ArrowReloadHorizontalIcon,
  MoneyAdd01Icon,
} from "@hugeicons/core-free-icons"
import { Badge } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { bookingStatusStyles, bookingTypeStyles, paymentStatusStyles, invoiceStatusStyles, activeBadgeStyles } from "@/lib/ds"
import { cn } from "@/lib/utils"
import type { BookingStatus, BookingType } from "@/lib/types/booking"

export const statusTranslationKeys: Record<BookingStatus, string> = {
  pending: "bookings.status.pending",
  pending_group_fill: "bookings.status.pending_group_fill",
  awaiting_payment: "bookings.status.awaiting_payment",
  deposit_paid: "bookings.status.deposit_paid",
  confirmed: "bookings.status.confirmed",
  completed: "bookings.status.completed",
  cancelled: "bookings.status.cancelled",
  cancel_requested: "bookings.status.cancel_requested",
  no_show: "bookings.status.no_show",
  expired: "bookings.status.expired",
}

const statusIconMap: Record<BookingStatus, { icon: typeof Tick01Icon; iconClass: string }> = {
  pending:          { icon: Clock02Icon,            iconClass: "text-warning" },
  pending_group_fill:{ icon: Clock02Icon,            iconClass: "text-warning" },
  awaiting_payment:  { icon: Clock02Icon,            iconClass: "text-warning" },
  deposit_paid:      { icon: MoneyAdd01Icon,         iconClass: "text-accent" },
  confirmed:        { icon: Tick01Icon,             iconClass: "text-success" },
  completed:        { icon: CheckmarkCircle02Icon,  iconClass: "text-primary" },
  cancelled:        { icon: CancelCircleIcon,       iconClass: "text-error" },
  cancel_requested:  { icon: ArrowReloadHorizontalIcon, iconClass: "text-warning" },
  no_show:          { icon: CancelCircleIcon,       iconClass: "text-error" },
  expired:          { icon: Clock02Icon,            iconClass: "text-muted-foreground" },
}

const typeTranslationKeys: Record<BookingType | "in_person", string> = {
  individual: "bookings.type.individual",
  in_person: "bookings.type.inPerson",
  walk_in: "bookings.type.walkIn",
  group: "bookings.type.group",
}

interface StatusBadgeProps {
  status: BookingStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { t } = useLocale()
  const translationKey = statusTranslationKeys[status]
  const styles = bookingStatusStyles[status as keyof typeof bookingStatusStyles]
  const iconEntry = statusIconMap[status]
  if (!translationKey || !styles) {
    return (
      <Badge variant="outline" className={cn("font-medium", className)}>
        {status ?? "Unknown"}
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-semibold gap-1.5 ps-2.5 pe-2.5 py-0.5 text-[11px] tracking-tight",
        "rounded-md",
        styles.bg,
        styles.text,
        styles.border,
        className,
      )}
    >
      {iconEntry && (
        <HugeiconsIcon icon={iconEntry.icon} size={12} strokeWidth={2.4} className={iconEntry.iconClass} />
      )}
      {t(translationKey)}
    </Badge>
  )
}

interface BookingTypeBadgeProps {
  type: BookingType | "in_person"
  className?: string
}

export function BookingTypeBadge({ type, className }: BookingTypeBadgeProps) {
  const { t } = useLocale()
  const translationKey = typeTranslationKeys[type]
  const styles = bookingTypeStyles[type as keyof typeof bookingTypeStyles]
  if (!translationKey || !styles) {
    return (
      <Badge variant="outline" className={cn("font-medium", className)}>
        {type ?? "Unknown"}
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-semibold gap-1.5 ps-2.5 pe-2.5 py-0.5 text-[11px] tracking-tight",
        "rounded-md",
        styles.bg,
        styles.text,
        styles.border,
        className,
      )}
    >
      {t(translationKey)}
    </Badge>
  )
}

// ─── Shared chip base ───────────────────────────────────────────────────────

function ChipBadge({
  bg,
  text,
  border,
  label,
  className,
}: {
  bg: string
  text: string
  border: string
  label: string
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-semibold ps-2.5 pe-2.5 py-0.5 text-[11px] tracking-tight rounded-md",
        bg,
        text,
        border,
        className,
      )}
    >
      {label}
    </Badge>
  )
}

// ─── PaymentStatusBadge ──────────────────────────────────────────────────────

export function PaymentStatusBadge({
  status,
  label,
  className,
}: {
  status: string
  label: string
  className?: string
}) {
  const styles =
    paymentStatusStyles[status as keyof typeof paymentStatusStyles] ??
    paymentStatusStyles._fallback
  return <ChipBadge bg={styles.bg} text={styles.text} border={styles.border} label={label} className={className} />
}

// ─── InvoiceStatusBadge ──────────────────────────────────────────────────────

export function InvoiceStatusBadge({
  status,
  label,
  className,
}: {
  status: string
  label: string
  className?: string
}) {
  const styles =
    invoiceStatusStyles[status as keyof typeof invoiceStatusStyles] ??
    invoiceStatusStyles._fallback
  return <ChipBadge bg={styles.bg} text={styles.text} border={styles.border} label={label} className={className} />
}

// ─── ActiveBadge ─────────────────────────────────────────────────────────────

export function ActiveBadge({
  active,
  label,
  className,
}: {
  active: boolean
  label: string
  className?: string
}) {
  const styles = active ? activeBadgeStyles.active : activeBadgeStyles.inactive
  return <ChipBadge bg={styles.bg} text={styles.text} border={styles.border} label={label} className={className} />
}
