"use client"

import { Badge } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { bookingStatusStyles, bookingTypeStyles } from "@/lib/ds"
import { cn } from "@/lib/utils"
import type { BookingStatus, BookingType } from "@/lib/types/booking"

const statusTranslationKeys: Record<BookingStatus, string> = {
  pending: "bookings.status.pending",
  pending_group_fill: "bookings.status.pending",
  awaiting_payment: "bookings.status.pending",
  confirmed: "bookings.status.confirmed",
  completed: "bookings.status.completed",
  cancelled: "bookings.status.cancelled",
  cancel_requested: "bookings.status.cancel_requested",
  no_show: "bookings.status.no_show",
  expired: "bookings.status.expired",
}

const typeTranslationKeys: Record<BookingType, string> = {
  in_person: "bookings.type.inPerson",
  online: "bookings.type.online",
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
      className={cn("font-medium", styles.bg, styles.text, styles.border, className)}
    >
      {t(translationKey)}
    </Badge>
  )
}

interface BookingTypeBadgeProps {
  type: BookingType
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
