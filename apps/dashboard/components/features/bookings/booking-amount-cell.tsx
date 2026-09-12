"use client"

import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import { useLocale } from "@/components/locale-provider"
import type { Booking } from "@/lib/types/booking"

/**
 * The bookings table's money column: a historical import shows its own
 * imported amount, a package-funded appointment shows what the client already
 * paid for that session, and everything else falls back through the payment
 * total, the price snapshot and the service list price.
 */
export function AmountCell({ booking }: { booking: Booking }) {
  const { t, locale } = useLocale()
  const currencyClassName = "font-numeric text-sm font-medium text-foreground"

  // Historical imports carry their own (possibly review-pending) amount and
  // must win over everything else, exactly as before this cell was extracted.
  const historicalAmount = booking.isHistoricalImport ? booking.historicalPayment?.amount : undefined
  if (historicalAmount != null) {
    return <FormattedCurrency amount={historicalAmount} locale={locale} decimals={2} className={currencyClassName} />
  }

  // A package booking collects nothing at the desk; the figure shown is what
  // the client already paid for this session inside their package. This is
  // more specific than the service list price, so it goes ahead of the
  // payment/priceSnapshot/service fallback chain below.
  if (booking.packageFunding?.sessionValue != null) {
    return (
      <div className="flex flex-col items-start gap-0.5">
        <FormattedCurrency amount={booking.packageFunding.sessionValue} locale={locale} decimals={2} className={currencyClassName} />
        <span className="text-xs text-muted-foreground">{t("bookings.amount.fromPackage")}</span>
      </div>
    )
  }

  const amount = booking.payment?.totalAmount ?? booking.priceSnapshot ?? booking.service?.price ?? null
  if (amount == null) return <span className="text-muted-foreground">—</span>
  return <FormattedCurrency amount={amount} locale={locale} decimals={2} className={currencyClassName} />
}
