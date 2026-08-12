"use client"

import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import { useLocale } from "@/components/locale-provider"
import type { HistoricalPaymentStats as HistoricalPaymentStatsValue } from "@/lib/types/payment"

export function HistoricalPaymentStats({ stats }: { stats: HistoricalPaymentStatsValue }) {
  const { t, locale } = useLocale()

  return (
    <section className="grid gap-3 md:grid-cols-2" aria-label={t("payments.historical.title")}>
      <div className="rounded-lg border border-border bg-surface-solid p-4">
        <p className="text-sm font-medium text-muted-foreground">{t("payments.historical.collected")}</p>
        <FormattedCurrency
          amount={stats.collectedAmount}
          locale={locale}
          decimals={2}
          className="mt-2 text-xl font-semibold text-foreground"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {stats.collectedCount} {t("payments.historical.appointments")}
        </p>
      </div>
      <div className="rounded-lg border border-warning/30 bg-warning-soft p-4">
        <p className="text-sm font-medium text-warning">{t("payments.historical.review")}</p>
        <FormattedCurrency
          amount={stats.reviewAmount}
          locale={locale}
          decimals={2}
          className="mt-2 text-xl font-semibold text-foreground"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {stats.reviewCount} {t("payments.historical.appointments")}
        </p>
      </div>
      <p className="text-xs text-muted-foreground md:col-span-2">
        {t("payments.historical.readOnly")}
      </p>
    </section>
  )
}
