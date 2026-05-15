"use client"

import Image from "next/image"
import { Skeleton, Card } from "@sawaa/ui"
import { useTopPerformers } from "@/hooks/use-top-performers"
import { useLocale } from "@/components/locale-provider"
import { formatPrice } from "@/lib/money"

export function TopPerformersChart() {
  const { data, isLoading } = useTopPerformers()
  const { t, locale } = useLocale()

  if (isLoading) return <Skeleton className="h-[300px] rounded-xl" />

  return (
    <Card data-testid="top-performers" className="px-6 py-5">
      <h3 className="mb-4 text-sm font-semibold text-foreground">
        {t("dashboard.topPerformers.title")}
      </h3>
      {!data || data.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t("dashboard.topPerformers.empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-3.5">
          {data.map((p, i) => {
            const max = data[0].revenue || 1
            const widthPct = Math.max(4, Math.round((p.revenue / max) * 100))
            const currency = t("dashboard.currency")
            return (
              <li key={p.employeeId} className="flex items-center gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                {p.avatarUrl ? (
                  <Image
                    src={p.avatarUrl}
                    alt=""
                    width={32}
                    height={32}
                    className="size-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="size-8 rounded-full bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {p.displayName}
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                      {formatPrice(p.revenue, { locale })}{" "}
                      <span className="font-normal text-muted-foreground">{currency}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted/70">
                    <div
                      className="h-full rounded-full bg-primary/80"
                      style={{ inlineSize: `${widthPct}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {t("dashboard.topPerformers.bookingsCount").replace(
                      "{count}",
                      String(p.bookingsCount),
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
