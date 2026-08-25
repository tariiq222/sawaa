/**
 * booking-collect-action.tsx — Collect-payment entry for the booking actions menu.
 *
 * Sibling of BookingActions. Owns the dropdown item, the RecordPaymentDialog,
 * and the canCollect predicate. The caller (BookingActions) decides when to
 * mount it and drives the dialog open state so post-complete auto-open works.
 */
"use client"

import { useEffect, useRef } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Payment01Icon } from "@hugeicons/core-free-icons"
import { DropdownMenuItem } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { RecordPaymentDialog } from "./record-payment-dialog"
import type { Booking } from "@/lib/types/booking"

/**
 * "Owes money" predicate — mirrors PaymentStatusCell in booking-column-cells.tsx.
 * Credit/package bookings and historical imports never collect.
 */
export function canCollectBooking(
  booking: Booking,
  canDo: (module: string, action: string) => boolean,
): boolean {
  const hasOutstanding = (booking.invoice?.outstanding ?? 0) > 0
  const bookingPrice = booking.priceSnapshot ?? booking.service?.price ?? 0
  const noInvoiceButPayable = !booking.invoice && bookingPrice > 0 && !!booking.clientId
  return (
    !booking.isHistoricalImport &&
    (hasOutstanding || noInvoiceButPayable) &&
    booking.payment?.status !== "awaiting" &&
    canDo("payment", "manage")
  )
}

/**
 * Tracks the latest `value` in a ref so post-success callbacks can re-evaluate
 * the collect predicate against the parent's current booking instead of the
 * click-time closure. Read `.current` at the moment of decision. Lives here
 * (rather than in `hooks/`) because the only consumer is the auto-open collect
 * path inside BookingActions.
 */
export function useLatestBookingRef<T>(value: T) {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  }, [value])
  return ref
}

interface CollectActionProps {
  booking: Booking
  open: boolean
  setOpen: (open: boolean) => void
  /** Fired when the dialog closes (after either a successful or cancelled collection). */
  onCollected: () => void
}

export function CollectAction({ booking, open, setOpen, onCollected }: CollectActionProps) {
  const { t } = useLocale()
  return (
    <>
      <DropdownMenuItem onClick={() => setOpen(true)}>
        <HugeiconsIcon icon={Payment01Icon} size={15} className="shrink-0" />
        {t("bookings.col.recordPayment")}
      </DropdownMenuItem>
      <RecordPaymentDialog
        booking={booking}
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) onCollected()
        }}
      />
    </>
  )
}