"use client"

import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import type { Booking } from "@/lib/types/booking"

/* ── Invoice tab — read-only summary of the booking's invoice ── */

export function BookingInvoiceTab({
  booking,
  t,
  locale,
}: {
  booking: Booking
  t: (key: string) => string
  locale: "ar" | "en"
}) {
  const invoice = booking.invoice
  if (!invoice) {
    return (
      <p className="text-sm text-muted-foreground">{t("detail.invoice.empty")}</p>
    )
  }

  // Amounts are halalas; FormattedCurrency converts. VAT and paid are derived.
  const vat = Math.round(invoice.subtotal * invoice.vatRate)
  const paid = Math.max(invoice.total - invoice.outstanding, 0)

  const row = (label: string, amount: number, strong = false) => (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm tabular-nums ${strong ? "font-semibold text-foreground" : "font-medium text-foreground"}`}>
        <FormattedCurrency amount={amount} locale={locale} decimals={2} />
      </span>
    </div>
  )

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-solid p-4">
      <h4 className="text-sm font-bold text-foreground">{t("detail.invoice.title")}</h4>
      {row(t("detail.invoice.subtotal"), invoice.subtotal)}
      {row(t("detail.invoice.vat"), vat)}
      {row(t("detail.invoice.total"), invoice.total, true)}
      <div className="border-t border-border" />
      {row(t("detail.invoice.paid"), paid)}
      {row(t("detail.invoice.outstanding"), invoice.outstanding, true)}
    </div>
  )
}
