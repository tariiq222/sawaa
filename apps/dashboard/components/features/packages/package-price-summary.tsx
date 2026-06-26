"use client"

import { formatPrice } from "@/lib/money"
import { useLocale } from "@/components/locale-provider"
import type { PackagePriceBreakdown } from "@/lib/types/package"
import type { PackageLineDetail } from "./package-item-builder"

interface Props {
  items: PackageLineDetail[]
  breakdown: PackagePriceBreakdown
}

export function PackagePriceSummary({ items, breakdown }: Props) {
  const { t } = useLocale()

  // Pair each item with its computed line (same order) and keep only the ones
  // that carry a price (a duration is selected → payable or free value > 0).
  const priced = items
    .map((it, i) => ({ it, line: breakdown.lines[i] }))
    .filter((x) => x.line && (x.line.payable > 0 || x.line.freeValue > 0))

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-muted/40 p-4">
      {priced.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground">{t("packages.summary.empty")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {priced.map(({ it, line }, i) => (
            <div key={`${it.serviceName}-${i}`} className="flex flex-col gap-0.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-foreground">{it.serviceName}</span>
                <span className="tabular-nums">{formatPrice(line.net)}</span>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">
                {it.paidQuantity} × {formatPrice(it.unitPrice)}
                {it.freeQuantity > 0 && ` · +${it.freeQuantity} ${t("packages.summary.free")}`}
                {line.discountAmount > 0 &&
                  ` · -${formatPrice(line.discountAmount)} ${t("packages.summary.discount")}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Totals */}
      <div className="flex flex-col gap-1.5 border-t border-border pt-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("packages.summary.fullValue")}</span>
          <span className="tabular-nums">{formatPrice(breakdown.fullValue)}</span>
        </div>
        {breakdown.freeValue > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("packages.summary.freeTotal")}</span>
            <span className="tabular-nums text-success">-{formatPrice(breakdown.freeValue)}</span>
          </div>
        )}
        {breakdown.discountAmount > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("packages.summary.discount")}</span>
            <span className="tabular-nums text-success">-{formatPrice(breakdown.discountAmount)}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-2">
        <span className="font-medium">{t("packages.summary.finalPrice")}</span>
        <span className="tabular-nums font-semibold text-foreground">{formatPrice(breakdown.finalPrice)}</span>
      </div>

      {breakdown.totalSavings > 0 && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-success">{t("packages.summary.totalSavings")}</span>
          <span className="tabular-nums text-success">{formatPrice(breakdown.totalSavings)}</span>
        </div>
      )}
    </div>
  )
}
