"use client"

import { useLocale } from "@/components/locale-provider"

/** Collection intent stays visible alongside the current financial status. */
export function BookingPaymentIntent({ payAtClinic }: { payAtClinic?: boolean }) {
  const { t } = useLocale()
  if (payAtClinic !== true) return null
  return <span className="text-xs font-medium text-muted-foreground">{t("bookings.payAtCenter")}</span>
}
