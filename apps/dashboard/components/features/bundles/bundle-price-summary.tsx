"use client"

import { useMemo } from "react"
import { computeBundlePrice } from "@/lib/bundle-price"
import { useLocale } from "@/components/locale-provider"
import type { BundleDiscountType } from "@/lib/types/bundle"

interface Props {
  servicePrices: number[]
  discountType: BundleDiscountType
  discountValue: number
  currency?: string
}

export function BundlePriceSummary({
  servicePrices,
  discountType,
  discountValue,
  currency = "SAR",
}: Props) {
  const { t } = useLocale()

  const { subtotal, discountAmount, finalPrice } = useMemo(
    () => computeBundlePrice(servicePrices, discountType, discountValue),
    [servicePrices, discountType, discountValue],
  )

  return (
    <div className="rounded-lg border p-4 flex flex-col gap-2 bg-muted/30">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t("bundles.summary.subtotal")}</span>
        <span className="tabular-nums">{subtotal} {currency}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t("bundles.summary.discount")}</span>
        <span className="tabular-nums text-success">-{discountAmount} {currency}</span>
      </div>
      <div className="flex items-center justify-between border-t pt-2 mt-1">
        <span className="font-medium">{t("bundles.summary.finalPrice")}</span>
        <span className="tabular-nums font-semibold text-foreground">{finalPrice} {currency}</span>
      </div>
    </div>
  )
}
