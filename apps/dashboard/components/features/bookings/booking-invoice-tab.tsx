"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Payment01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@sawaa/ui"

import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import { RecordPaymentDialog } from "@/components/features/bookings/record-payment-dialog"
import { useAuth } from "@/components/providers/auth-provider"
import type { Booking } from "@/lib/types/booking"

/* ── Invoice tab — read-only summary + collect action when the booking still
   owes money. Mirrors the eligibility rule used by PaymentStatusCell so the
   same "record payment" affordance is available wherever staff look. ── */

export function BookingInvoiceTab({
  booking,
  t,
  locale,
}: {
  booking: Booking
  t: (key: string) => string
  locale: "ar" | "en"
}) {
  const [recordOpen, setRecordOpen] = useState(false)
  const { canDo } = useAuth()

  const invoice = booking.invoice
  const hasOutstanding = (invoice?.outstanding ?? 0) > 0
  // Pay-at-clinic bookings have no invoice yet — same rule as PaymentStatusCell:
  // need a price and a client so the backend can materialise a DRAFT invoice.
  const bookingPrice = booking.priceSnapshot ?? booking.service?.price ?? 0
  const noInvoiceButPayable = !invoice && bookingPrice > 0 && !!booking.clientId
  // Backend gate: POST /dashboard/finance/payments requires `manage:Payment`
  // (and manage:Invoice for the DRAFT-invoice sub-call). Historical imports
  // are read-only — never expose collection on them.
  // The `payment.status !== "awaiting"` clause MUST stay in sync with
  // PaymentStatusCell (booking-column-cells.tsx) and canCollectBooking
  // (booking-collect-action.tsx): a bank transfer under verification is
  // stored as PENDING_VERIFICATION (UI: "awaiting"), and ProcessPaymentHandler
  // only sums COMPLETED payments when computing outstanding — so the invoice
  // can still show a full balance while the transfer is awaiting, and a
  // second collect here would create a duplicate COMPLETED payment.
  const canCollect =
    !booking.isHistoricalImport &&
    booking.payment?.status !== "awaiting" &&
    canDo("payment", "manage") &&
    (hasOutstanding || noInvoiceButPayable)

  const collectAction = canCollect ? (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="self-start gap-1.5"
        onClick={() => setRecordOpen(true)}
        aria-label={t("bookings.col.recordPayment")}
      >
        <HugeiconsIcon icon={Payment01Icon} size={14} strokeWidth={2.2} />
        {t("bookings.col.recordPayment")}
      </Button>
      <RecordPaymentDialog booking={booking} open={recordOpen} onOpenChange={setRecordOpen} />
    </>
  ) : null

  if (!invoice) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-solid p-4">
        <p className="text-sm text-muted-foreground">{t("detail.invoice.empty")}</p>
        {collectAction}
      </div>
    )
  }

  // Amounts are halalas; FormattedCurrency converts. Discount, VAT and paid are
  // derived so the rows reconcile with backend math:
  //   total = (subtotal − discount) × (1 + vatRate)
  // ⇒ netAfterDiscount = total / (1 + vatRate)
  //   discount = subtotal − netAfterDiscount
  //   vat      = total − netAfterDiscount
  // Then: subtotal − discount + vat === total, exactly.
  const netAfterDiscount = Math.round(invoice.total / (1 + invoice.vatRate))
  const discount = Math.max(invoice.subtotal - netAfterDiscount, 0)
  const vat = Math.max(invoice.total - netAfterDiscount, 0)
  const paid = Math.max(invoice.total - invoice.outstanding, 0)

  const row = (label: string, amount: number, strong = false, negative = false) => (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm tabular-nums ${strong ? "font-semibold text-foreground" : "font-medium text-foreground"}`}>
        {negative && amount > 0 && <span className="me-0.5">−</span>}
        <FormattedCurrency amount={amount} locale={locale} decimals={2} />
      </span>
    </div>
  )

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-solid p-4">
      <h4 className="text-sm font-bold text-foreground">{t("detail.invoice.title")}</h4>
      {row(t("detail.invoice.subtotal"), invoice.subtotal)}
      {discount > 0 && row(t("detail.invoice.discount"), discount, false, true)}
      {row(t("detail.invoice.vat"), vat)}
      {row(t("detail.invoice.total"), invoice.total, true)}
      <div className="border-t border-border" />
      {row(t("detail.invoice.paid"), paid)}
      {row(t("detail.invoice.outstanding"), invoice.outstanding, true)}
      {collectAction}
    </div>
  )
}
