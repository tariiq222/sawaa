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
import { bookingStatusStyles, bookingTypeStyles } from "@/lib/ds"
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
  completed:        { icon: CheckmarkCircle02Icon,  iconClass: "text-accent" },
  cancelled:        { icon: CancelCircleIcon,       iconClass: "text-destructive" },
  cancel_requested:  { icon: ArrowReloadHorizontalIcon, iconClass: "text-warning" },
  no_show:          { icon: CancelCircleIcon,       iconClass: "text-destructive" },
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
      className={cn("font-medium gap-1.5", styles.bg, styles.text, styles.border, className)}
    >
      {iconEntry && (
        <HugeiconsIcon icon={iconEntry.icon} size={11} className={iconEntry.iconClass} />
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
      className={cn("font-medium", styles.bg, styles.text, styles.border, className)}
    >
      {t(translationKey)}
    </Badge>
  )
}
