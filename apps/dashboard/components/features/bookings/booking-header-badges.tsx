"use client"

import { Badge } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { BookingTypeBadge, StatusBadge } from "@/components/features/status-badge"
import { normalizeDeliveryType } from "@/lib/booking-delivery"
import type { Booking } from "@/lib/types/booking"

/**
 * Booking detail header badges: the delivery channel from `deliveryType`,
 * the booking-type badge only when it adds information (group / walk-in),
 * then the status. Individual bookings arrive with `type = "in_person"`,
 * which is not a delivery channel and must not be shown as one.
 */
export function BookingHeaderBadges({
  booking,
}: {
  booking: Pick<Booking, "type" | "deliveryType" | "status">
}) {
  const { t } = useLocale()
  const delivery = normalizeDeliveryType(booking.deliveryType)
  const type = String(booking.type)
  const showType = type === "group" || type === "walk_in"

  return (
    <div className="flex items-center gap-2">
      {delivery && (
        <Badge variant="outline" className="font-semibold text-[11px]">
          {t(delivery === "ONLINE" ? "bookings.col.type.online" : "bookings.col.type.inPerson")}
        </Badge>
      )}
      {showType && <BookingTypeBadge type={booking.type} />}
      <StatusBadge status={booking.status} />
    </div>
  )
}
